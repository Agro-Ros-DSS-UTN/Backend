import { ACTIVITY_CONTACT_TYPES } from './activity.entity.js';
import { TASK_TYPES, LEVELS } from './task.entity.js';
import { OPPORTUNITY_STATUSES } from '../commercial/opportunity.entity.js';
import * as activityRepository from './activity.repository.js';
import { badRequest, forbidden, notFound, toInt } from '../../shared/utils/http.js';
import { dataUrl, number, parseDate, parseDateTime, text, oneOf } from '../../shared/utils/validation.js';
import { createOpportunityInTransaction } from '../commercial/opportunity.service.js';
import { createNotification } from '../notifications/notification.service.js';

const V1_TYPE = { Visita: 'visita', Llamada: 'llamada', WhatsApp: 'whatsapp', Whatsapp: 'whatsapp', Email: 'email', Correo: 'email', 'Reunión': 'reunion', Reunion: 'reunion' };
const normalizeType = (t) => (t ? V1_TYPE[t] || String(t).toLowerCase() : 'visita');

export const serializeActivity = (a) => {
  if (!a) return null;
  const j = typeof a.toJSON === 'function' ? a.toJSON() : a;
  const company = j.opportunity?.company || j.serviceOrder?.company || null;
  const attachments = (j.attachments || []).map((x) => ({ id: x.id, type: x.type, fileName: x.fileName, mimeType: x.mimeType, sizeKb: x.sizeKb, url: `/attachments/${x.id}` }));
  return {
    id: j.id,
    contactType: j.contactType,
    occurredAt: j.occurredAt,
    description: j.description ?? null,
    result: j.result ?? null,
    saleAmount: j.saleAmount !== null && j.saleAmount !== undefined ? Number(j.saleAmount) : null,
    noFollowUp: Boolean(j.noFollowUp),
    opportunityId: j.opportunityId ?? null,
    opportunity: j.opportunity ? { id: j.opportunity.id, title: j.opportunity.title, status: j.opportunity.status } : null,
    serviceOrderId: j.serviceOrderId ?? null,
    serviceOrder: j.serviceOrder ? { id: j.serviceOrder.id, orderNumber: j.serviceOrder.orderNumber } : null,
    companyId: company?.id ?? null,
    company: company?.legalName ?? j.serviceOrder?.customerName ?? null,
    roadmapStopId: j.roadmapStopId ?? null,
    userId: j.userId ?? null,
    author: j.author ? { idUser: j.author.idUser, fullName: j.author.fullName } : null,
    attachments,
    tasks: j.tasks,
    createdAt: j.createdAt,
    clientUuid: j.clientUuid ?? null,
    // compatibilidad con las pantallas que usan la forma v1
    formId: j.id,
    idUser: j.userId ?? null,
    authorName: j.author?.fullName ?? null,
  };
};

// Pantallas viejas mandaban { photoUrl, audioData } en "fileAttachment".
const attachmentsOf = (body) => {
  const listing = [];
  if (Array.isArray(body.attachments)) listing.push(...body.attachments);
  const v1 = body.fileAttachment;
  if (v1 && typeof v1 === 'object') {
    if (v1.photoUrl) listing.push({ type: 'foto', content: v1.photoUrl });
    if (v1.audioData) listing.push({ type: 'audio', content: v1.audioData });
  }
  if (listing.length > 6) throw badRequest('Se pueden adjuntar hasta 6 archivos por actividad');
  return listing.map((x, i) => {
    const content = dataUrl(x.content ?? x.data ?? x.url, `attachments[${i}]`, 6);
    if (!content) return null;
    const mime = content.slice(5, content.indexOf(';'));
    const type = x.type && ['foto', 'audio', 'documento'].includes(x.type) ? x.type : mime.startsWith('image/') ? 'foto' : mime.startsWith('audio/') ? 'audio' : 'documento';
    return {
      type,
      fileName: text(x.fileName ?? x.name, 'fileName', 200) ?? null,
      mimeType: mime,
      sizeKb: Math.ceil(((content.length - content.indexOf(',') - 1) * 3) / 4 / 1024),
      content,
    };
  }).filter(Boolean);
};

const activityData = (b) => {
  const d = {};
  if (b.contactType !== undefined) d.contactType = oneOf(normalizeType(b.contactType), ACTIVITY_CONTACT_TYPES, 'contactType');
  if (b.occurredAt !== undefined) {
    d.occurredAt = parseDateTime(b.occurredAt, 'occurredAt');
    // Una actividad registra algo que ya pasó (margen de 15 min por relojes desfasados).
    if (d.occurredAt && d.occurredAt.getTime() > Date.now() + 15 * 60000) throw badRequest('La fecha de la actividad no puede ser futura. Para algo pendiente, creá una tarea.', { occurredAt: 'future' });
  }
  if (b.description !== undefined) d.description = text(b.description, 'description', 10000);
  if (b.result !== undefined) d.result = text(b.result, 'result', 255);
  if (b.saleAmount !== undefined) d.saleAmount = number(b.saleAmount, 'saleAmount', { min: 0 });
  if (b.noFollowUp !== undefined) d.noFollowUp = Boolean(b.noFollowUp);
  return d;
};

// Oportunidad de la actividad: id explícito, alta en línea, o (pantallas v1)
// la oportunidad abierta más reciente de la empresa, creándola si no hay.
const resolveOpportunity = async ({ admin, currentUserId }, body, transaction) => {
  const id = toInt(body.opportunityId);
  if (id && !Number.isNaN(id)) {
    const o = await activityRepository.findOpportunityById(id, { transaction });
    if (!o) throw badRequest('La oportunidad indicada no existe', { opportunityId: 'missing' });
    return { opportunity: o, created: false };
  }
  const newOppData = body.newOpportunity;
  let companyId = toInt(newOppData?.companyId ?? body.companyId);
  if (!companyId && typeof body.company === 'string' && body.company.trim()) {
    const e = await activityRepository.findCompanyByLegalName(body.company.trim(), transaction);
    if (!e) throw badRequest(`No existe la empresa "${body.company.trim()}". Registrala primero o elegila de la lista.`, { company: 'missing' });
    companyId = e.id;
  }
  if (!companyId) return { opportunity: null, created: false };
  if (!newOppData) {
    const open = await activityRepository.findOpenOpportunityForCompany({ companyId, admin, currentUserId, transaction });
    if (open) return { opportunity: open, created: false };
  }
  const o = await createOpportunityInTransaction({ admin, currentUserId }, { ...(newOppData || {}), companyId }, transaction);
  return { opportunity: o, created: true };
};

// El contacto de la tarea: el indicado (si es de la empresa) o, por defecto, el de la oportunidad.
const taskContact = async (t, companyId, defaultContact, transaction) => {
  const id = toInt(t.contactId);
  if (!id) return defaultContact || null;
  const c = await activityRepository.findContactById(id, transaction);
  if (!c || (companyId && c.companyId && c.companyId !== companyId)) throw badRequest('El contacto de la tarea no pertenece a la empresa', { 'task.contactId': 'otherCompany' });
  return c.id;
};

const createFollowUpTask = async ({ currentUserId }, activity, companyId, t, transaction, defaultContact = null) => {
  const title = text(t.title ?? t.description, 'task.title', 200);
  const notes = text(t.notes, 'task.notes', 5000);
  if (!title) throw badRequest('Indicá qué hay que hacer en la tarea de seguimiento', { 'task.title': 'required' });
  const dueDate = parseDate(t.dueDate, 'task.dueDate');
  if (!dueDate) throw badRequest('Indicá la fecha de la tarea de seguimiento', { 'task.dueDate': 'required' });
  const task = await activityRepository.createTask({
    title,
    description: text(t.description, 'task.description', 5000),
    type: oneOf(t.type || 'llamada', TASK_TYPES, 'task.type'),
    priority: oneOf(t.priority || 'Media', LEVELS, 'task.priority'),
    dueDate,
    dueTime: /^\d{2}:\d{2}$/.test(t.dueTime || '') ? t.dueTime : null,
    notes: notes ?? null,
    companyId,
    contactId: await taskContact(t, companyId, defaultContact, transaction),
    activityId: activity.id,
    createdById: currentUserId,
  }, transaction);
  const assignees = Array.isArray(t.assigneeIds) && t.assigneeIds.length ? [...new Set(t.assigneeIds.map(String))] : [currentUserId];
  if ((await activityRepository.countUsersByIds(assignees, transaction)) !== assignees.length) {
    throw badRequest('Algún usuario asignado no existe');
  }
  await activityRepository.bulkCreateTaskAssignees(assignees.map((userId) => ({ taskId: task.id, userId })), transaction);
  return { task, assignees };
};

const load = async ({ admin, currentUserId }, id) => {
  const a = await activityRepository.findByIdFull(id);
  if (!a) throw notFound('Actividad');
  if (!admin && a.userId !== currentUserId) throw forbidden('Solo podés ver y editar tus propias actividades');
  return a;
};

export const listActivities = async (query = {}, { admin, currentUserId }) => {
  const userId = !admin ? currentUserId : (query.userId ? String(query.userId) : undefined);
  const opportunityId = query.opportunityId ? toInt(query.opportunityId) : undefined;
  const serviceOrderId = query.serviceOrderId ? toInt(query.serviceOrderId) : undefined;
  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to');
  const fromDate = from ? parseDateTime(from) : undefined;
  const toDate = to ? new Date(parseDateTime(to).getTime() + 86400000) : undefined;
  const companyId = toInt(query.companyId);
  const limit = Math.min(Number(query.limit) || 1000, 3000);
  const activities = await activityRepository.findAll({
    userId,
    opportunityId,
    serviceOrderId,
    fromDate,
    toDate,
    companyId,
    limit,
  });
  return activities.map(serializeActivity);
};

export const getActivity = async (id, auth) => serializeActivity(await load(auth, id));

// CUU01 — Registrar una actividad. Todo en una transacción: oportunidad (si se
// crea en línea), actividad, adjuntos y tarea de seguimiento.
export const createActivity = async (body = {}, { admin, currentUserId }) => {
  const clientUuid = text(body.clientUuid, 'clientUuid', 36);
  if (clientUuid) {
    // Reenvío desde la cola offline: si ya se guardó, se devuelve la misma.
    const previous = await activityRepository.findByClientUuid(clientUuid);
    if (previous) {
      if (previous.userId !== currentUserId && !admin) throw forbidden();
      return {
        status: 200,
        payload: { message: 'La actividad ya estaba registrada', data: serializeActivity(previous), duplicate: true },
      };
    }
  }
  const d = activityData(body);
  if (!d.occurredAt) d.occurredAt = new Date();
  const attachments = attachmentsOf(body);
  const serviceOrderId = toInt(body.serviceOrderId);

  const result = await activityRepository.runTransaction(async (transaction) => {
    let opportunity = null;
    let created = false;
    let companyId = null;
    if (serviceOrderId) {
      if (body.opportunityId || body.newOpportunity) throw badRequest('Una actividad pertenece a una oportunidad o a una orden de servicio, no a ambas');
      const os = await activityRepository.findServiceOrderById(serviceOrderId, transaction);
      if (!os) throw badRequest('La orden de servicio no existe', { serviceOrderId: 'missing' });
      companyId = os.companyId;
    } else {
      ({ opportunity, created } = await resolveOpportunity({ admin, currentUserId }, body, transaction));
      if (!opportunity) throw badRequest('Elegí la empresa y la oportunidad de la actividad (o creá una nueva).', { opportunityId: 'required' });
      companyId = opportunity.companyId;
    }

    let roadmapStopId = toInt(body.roadmapStopId);
    if (roadmapStopId) {
      const stop = await activityRepository.findRoadmapStopWithRoadmap(roadmapStopId, transaction);
      if (!stop || (!admin && stop.roadmap?.userId !== currentUserId)) roadmapStopId = null;
      else if (stop.status !== 'completada') await activityRepository.updateRoadmapStop(stop, { status: 'completada' }, transaction);
    }

    const activity = await activityRepository.create({
      ...d,
      contactType: d.contactType || 'visita',
      opportunityId: opportunity?.id ?? null,
      serviceOrderId: serviceOrderId || null,
      roadmapStopId: roadmapStopId || null,
      userId: currentUserId, // el autor siempre es quien está logueado
      createdAt: new Date(),
      clientUuid,
    }, { transaction });

    if (attachments.length) {
      await activityRepository.bulkCreateAttachments(attachments.map((x) => ({ ...x, activityId: activity.id })), transaction);
    }

    if (opportunity) {
      const changes = { lastActivityAt: d.occurredAt > (opportunity.lastActivityAt || 0) ? d.occurredAt : opportunity.lastActivityAt };
      if (opportunity.status === 'Prospecto') changes.status = 'Contactado';
      if (body.opportunityStatus) changes.status = oneOf(body.opportunityStatus, OPPORTUNITY_STATUSES, 'opportunityStatus');
      await activityRepository.updateOpportunity(opportunity, changes, transaction);
    }

    // Tareas de seguimiento (una o varias). "noFollowUp" deja constancia de que no hacen falta.
    const requested = Array.isArray(body.tasks) ? body.tasks : (body.task || body.followUp ? [body.task || body.followUp] : []);
    if (requested.length > 8) throw badRequest('Se pueden generar hasta 8 tareas de seguimiento por actividad');
    const tasks = [];
    if (!d.noFollowUp) {
      for (const t of requested) {
        tasks.push(await createFollowUpTask({ currentUserId }, activity, companyId, t, transaction, opportunity?.contactId));
      }
    }
    return { activity, createdOpportunity: created ? opportunity : null, tasks };
  });

  for (const t of result.tasks) {
    for (const u of t.assignees.filter((x) => x !== currentUserId)) {
      await createNotification(u, 'tarea_asignada', `Nueva tarea: ${t.task.title}`, 'tarea', t.task.id);
    }
  }
  const full = await activityRepository.findByIdFull(result.activity.id);
  return {
    status: 201,
    payload: {
      message: 'Actividad registrada',
      data: serializeActivity(full),
      createdOpportunity: result.createdOpportunity ? { id: result.createdOpportunity.id, title: result.createdOpportunity.title } : null,
      taskId: result.tasks[0]?.task.id ?? null,
      taskIds: result.tasks.map((t) => t.task.id),
    },
  };
};

export const updateActivity = async (id, body = {}, auth) => {
  const a = await load(auth, id);
  const d = activityData(body);
  const attachments = attachmentsOf(body);
  await activityRepository.runTransaction(async (transaction) => {
    const newOpp = toInt(body.opportunityId);
    if (newOpp && !Number.isNaN(newOpp) && newOpp !== a.opportunityId && !a.serviceOrderId) {
      if (!(await activityRepository.findOpportunityById(newOpp, { transaction }))) {
        throw badRequest('La oportunidad indicada no existe');
      }
      d.opportunityId = newOpp;
    }
    await activityRepository.update(a, d, { transaction });
    if (attachments.length) {
      await activityRepository.bulkCreateAttachments(attachments.map((x) => ({ ...x, activityId: a.id })), transaction);
    }
    if (Array.isArray(body.removeAttachments) && body.removeAttachments.length) {
      await activityRepository.destroyAttachmentsByIds(a.id, body.removeAttachments.map(Number), transaction);
    }
  });
  const full = await activityRepository.findByIdFull(a.id);
  return serializeActivity(full);
};

export const removeActivity = async (id, auth) => {
  const a = await load(auth, id);
  await activityRepository.destroyWithChildren(a);
  return { message: 'Actividad eliminada', id: a.id };
};

// Contenido de un adjunto (data URL). Lo ve el autor de la actividad o la administración.
export const getActivityAttachment = async (id, { admin, currentUserId }) => {
  const adj = await activityRepository.findAttachmentWithContent(id);
  if (!adj) throw notFound('Adjunto');
  if (!admin && adj.activity?.userId !== currentUserId) throw forbidden('No podés ver este adjunto');
  return { id: adj.id, type: adj.type, mimeType: adj.mimeType, fileName: adj.fileName, content: adj.content };
};
