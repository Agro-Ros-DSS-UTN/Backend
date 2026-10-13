import { Op } from 'sequelize';
import {
  sequelize, Activity, Attachment, Opportunity, Company, Contact, User, Task, TaskAssignee, ServiceOrder, RoadmapStop, Roadmap,
} from '../models/index.js';
import { ACTIVITY_CONTACT_TYPES, TASK_TYPES, LEVELS, OPEN_STATUSES } from '../models/commercial.model.js';
import { isAdmin } from '../middlewares/auth.middleware.js';
import { asyncHandler, badRequest, forbidden, idParam, notFound, toInt } from '../utils/http.js';
import { dataUrl, number, parseDate, parseDateTime, text, oneOf } from '../utils/validation.js';
import { createOpportunity } from './opportunity.controller.js';
import { createNotification } from './notification.controller.js';

const V1_TYPE = { Visita: 'visita', Llamada: 'llamada', WhatsApp: 'whatsapp', Whatsapp: 'whatsapp', Email: 'email', Correo: 'email', 'Reunión': 'reunion', Reunion: 'reunion' };
const normalizeType = (t) => (t ? V1_TYPE[t] || String(t).toLowerCase() : 'visita');

const include = [
  {
    model: Opportunity, as: 'opportunity', attributes: ['id', 'title', 'status', 'companyId', 'userId'], paranoid: false,
    include: [{ model: Company, as: 'company', attributes: ['id', 'legalName'], paranoid: false }],
  },
  {
    model: ServiceOrder, as: 'serviceOrder', attributes: ['id', 'orderNumber', 'companyId', 'customerName'], paranoid: false,
    include: [{ model: Company, as: 'company', attributes: ['id', 'legalName'], paranoid: false }],
  },
  { model: User, as: 'author', attributes: ['idUser', 'fullName'] },
  { model: Attachment, as: 'attachments' },
  { model: Task, as: 'tasks', attributes: ['id', 'title', 'status', 'dueDate'] },
];

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
const resolveOpportunity = async (req, body, transaction) => {
  const id = toInt(body.opportunityId);
  if (id && !Number.isNaN(id)) {
    const o = await Opportunity.findByPk(id, { transaction });
    if (!o) throw badRequest('La oportunidad indicada no existe', { opportunityId: 'missing' });
    return { opportunity: o, created: false };
  }
  const newOppData = body.newOpportunity;
  let companyId = toInt(newOppData?.companyId ?? body.companyId);
  if (!companyId && typeof body.company === 'string' && body.company.trim()) {
    const e = await Company.findOne({ where: { legalName: body.company.trim() }, transaction });
    if (!e) throw badRequest(`No existe la empresa "${body.company.trim()}". Registrala primero o elegila de la lista.`, { company: 'missing' });
    companyId = e.id;
  }
  if (!companyId) return { opportunity: null, created: false };
  if (!newOppData) {
    const open = await Opportunity.findOne({
      where: { companyId, status: { [Op.in]: OPEN_STATUSES }, ...(isAdmin(req) ? {} : { [Op.or]: [{ userId: req.user.idUser }, { userId: null }] }) },
      order: [['lastActivityAt', 'DESC']],
      transaction,
    });
    if (open) return { opportunity: open, created: false };
  }
  const o = await createOpportunity(req, { ...(newOppData || {}), companyId }, transaction);
  return { opportunity: o, created: true };
};

// El contacto de la tarea: el indicado (si es de la empresa) o, por defecto, el de la oportunidad.
const taskContact = async (t, companyId, defaultContact, transaction) => {
  const id = toInt(t.contactId);
  if (!id) return defaultContact || null;
  const c = await Contact.findByPk(id, { transaction });
  if (!c || (companyId && c.companyId && c.companyId !== companyId)) throw badRequest('El contacto de la tarea no pertenece a la empresa', { 'task.contactId': 'otherCompany' });
  return c.id;
};

const createFollowUpTask = async (req, activity, companyId, t, transaction, defaultContact = null) => {
  const title = text(t.title ?? t.description, 'task.title', 200);
  const notes = text(t.notes, 'task.notes', 5000);
  if (!title) throw badRequest('Indicá qué hay que hacer en la tarea de seguimiento', { 'task.title': 'required' });
  const dueDate = parseDate(t.dueDate, 'task.dueDate');
  if (!dueDate) throw badRequest('Indicá la fecha de la tarea de seguimiento', { 'task.dueDate': 'required' });
  const task = await Task.create({
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
    createdById: req.user.idUser,
  }, { transaction });
  const assignees = Array.isArray(t.assigneeIds) && t.assigneeIds.length ? [...new Set(t.assigneeIds.map(String))] : [req.user.idUser];
  if ((await User.count({ where: { idUser: { [Op.in]: assignees } }, transaction })) !== assignees.length) throw badRequest('Algún usuario asignado no existe');
  await TaskAssignee.bulkCreate(assignees.map((userId) => ({ taskId: task.id, userId })), { transaction });
  return { task, assignees };
};

export const list = asyncHandler(async (req, res) => {
  const where = {};
  if (!isAdmin(req)) where.userId = req.user.idUser;
  else if (req.query.userId) where.userId = String(req.query.userId);
  if (req.query.opportunityId) where.opportunityId = toInt(req.query.opportunityId);
  if (req.query.serviceOrderId) where.serviceOrderId = toInt(req.query.serviceOrderId);
  const from = parseDate(req.query.from, 'from');
  const to = parseDate(req.query.to, 'to');
  if (from || to) where.occurredAt = { ...(from ? { [Op.gte]: parseDateTime(from) } : {}), ...(to ? { [Op.lt]: new Date(parseDateTime(to).getTime() + 86400000) } : {}) };
  const companyId = toInt(req.query.companyId);
  if (companyId) {
    const opps = await Opportunity.findAll({ where: { companyId }, attributes: ['id'], paranoid: false });
    const orders = await ServiceOrder.findAll({ where: { companyId }, attributes: ['id'], paranoid: false });
    where[Op.and] = [{ [Op.or]: [{ opportunityId: { [Op.in]: opps.map((o) => o.id).concat(0) } }, { serviceOrderId: { [Op.in]: orders.map((o) => o.id).concat(0) } }] }];
  }
  const activities = await Activity.findAll({
    where,
    include,
    order: [['occurredAt', 'DESC'], ['id', 'DESC']],
    limit: Math.min(Number(req.query.limit) || 1000, 3000),
  });
  res.json({ data: activities.map(serializeActivity) });
});

const load = async (req, id) => {
  const a = await Activity.findByPk(id, { include });
  if (!a) throw notFound('Actividad');
  if (!isAdmin(req) && a.userId !== req.user.idUser) throw forbidden('Solo podés ver y editar tus propias actividades');
  return a;
};

export const get = asyncHandler(async (req, res) => {
  res.json({ data: serializeActivity(await load(req, idParam(req))) });
});

// CUU01 — Registrar una actividad. Todo en una transacción: oportunidad (si se
// crea en línea), actividad, adjuntos y tarea de seguimiento.
export const create = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const clientUuid = text(body.clientUuid, 'clientUuid', 36);
  if (clientUuid) {
    // Reenvío desde la cola offline: si ya se guardó, se devuelve la misma.
    const previous = await Activity.findOne({ where: { clientUuid }, include });
    if (previous) {
      if (previous.userId !== req.user.idUser && !isAdmin(req)) throw forbidden();
      return res.status(200).json({ message: 'La actividad ya estaba registrada', data: serializeActivity(previous), duplicate: true });
    }
  }
  const d = activityData(body);
  if (!d.occurredAt) d.occurredAt = new Date();
  const attachments = attachmentsOf(body);
  const serviceOrderId = toInt(body.serviceOrderId);

  const result = await sequelize.transaction(async (transaction) => {
    let opportunity = null;
    let created = false;
    let companyId = null;
    if (serviceOrderId) {
      if (body.opportunityId || body.newOpportunity) throw badRequest('Una actividad pertenece a una oportunidad o a una orden de servicio, no a ambas');
      const os = await ServiceOrder.findByPk(serviceOrderId, { transaction });
      if (!os) throw badRequest('La orden de servicio no existe', { serviceOrderId: 'missing' });
      companyId = os.companyId;
    } else {
      ({ opportunity, created } = await resolveOpportunity(req, body, transaction));
      if (!opportunity) throw badRequest('Elegí la empresa y la oportunidad de la actividad (o creá una nueva).', { opportunityId: 'required' });
      companyId = opportunity.companyId;
    }

    let roadmapStopId = toInt(body.roadmapStopId);
    if (roadmapStopId) {
      const stop = await RoadmapStop.findByPk(roadmapStopId, { include: [{ model: Roadmap, as: 'roadmap', attributes: ['userId'] }], transaction });
      if (!stop || (!isAdmin(req) && stop.roadmap?.userId !== req.user.idUser)) roadmapStopId = null;
      else if (stop.status !== 'completada') await stop.update({ status: 'completada' }, { transaction });
    }

    const activity = await Activity.create({
      ...d,
      contactType: d.contactType || 'visita',
      opportunityId: opportunity?.id ?? null,
      serviceOrderId: serviceOrderId || null,
      roadmapStopId: roadmapStopId || null,
      userId: req.user.idUser, // el autor siempre es quien está logueado
      createdAt: new Date(),
      clientUuid,
    }, { transaction });

    if (attachments.length) await Attachment.bulkCreate(attachments.map((x) => ({ ...x, activityId: activity.id })), { transaction });

    if (opportunity) {
      const changes = { lastActivityAt: d.occurredAt > (opportunity.lastActivityAt || 0) ? d.occurredAt : opportunity.lastActivityAt };
      if (opportunity.status === 'Prospecto') changes.status = 'Contactado';
      if (body.opportunityStatus) changes.status = oneOf(body.opportunityStatus, ['Prospecto', 'Contactado', 'Cotizado', 'Ganada', 'Perdida'], 'opportunityStatus');
      await opportunity.update(changes, { transaction });
    }

    // Tareas de seguimiento (una o varias). "noFollowUp" deja constancia de que no hacen falta.
    const requested = Array.isArray(body.tasks) ? body.tasks : (body.task || body.followUp ? [body.task || body.followUp] : []);
    if (requested.length > 8) throw badRequest('Se pueden generar hasta 8 tareas de seguimiento por actividad');
    const tasks = [];
    if (!d.noFollowUp) {
      for (const t of requested) tasks.push(await createFollowUpTask(req, activity, companyId, t, transaction, opportunity?.contactId));
    }
    return { activity, createdOpportunity: created ? opportunity : null, tasks };
  });

  for (const t of result.tasks) {
    for (const u of t.assignees.filter((x) => x !== req.user.idUser)) {
      await createNotification(u, 'tarea_asignada', `Nueva tarea: ${t.task.title}`, 'tarea', t.task.id);
    }
  }
  const full = await Activity.findByPk(result.activity.id, { include });
  res.status(201).json({
    message: 'Actividad registrada',
    data: serializeActivity(full),
    createdOpportunity: result.createdOpportunity ? { id: result.createdOpportunity.id, title: result.createdOpportunity.title } : null,
    taskId: result.tasks[0]?.task.id ?? null,
    taskIds: result.tasks.map((t) => t.task.id),
  });
});

export const update = asyncHandler(async (req, res) => {
  const a = await load(req, idParam(req));
  const body = req.body || {};
  const d = activityData(body);
  const attachments = attachmentsOf(body);
  await sequelize.transaction(async (transaction) => {
    const newOpp = toInt(body.opportunityId);
    if (newOpp && !Number.isNaN(newOpp) && newOpp !== a.opportunityId && !a.serviceOrderId) {
      if (!(await Opportunity.findByPk(newOpp, { transaction }))) throw badRequest('La oportunidad indicada no existe');
      d.opportunityId = newOpp;
    }
    await a.update(d, { transaction });
    if (attachments.length) await Attachment.bulkCreate(attachments.map((x) => ({ ...x, activityId: a.id })), { transaction });
    if (Array.isArray(body.removeAttachments) && body.removeAttachments.length) {
      await Attachment.destroy({ where: { activityId: a.id, id: { [Op.in]: body.removeAttachments.map(Number) } }, transaction });
    }
  });
  const full = await Activity.findByPk(a.id, { include });
  res.json({ message: 'Actividad actualizada', data: serializeActivity(full) });
});

export const remove = asyncHandler(async (req, res) => {
  const a = await load(req, idParam(req));
  await sequelize.transaction(async (transaction) => {
    await Attachment.destroy({ where: { activityId: a.id }, transaction });
    await Task.update({ activityId: null }, { where: { activityId: a.id }, transaction });
    await a.destroy({ transaction });
  });
  res.json({ message: 'Actividad eliminada', id: a.id });
});

// Contenido de un adjunto (data URL). Lo ve el autor de la actividad o la administración.
export const getAttachment = asyncHandler(async (req, res) => {
  const adj = await Attachment.scope('withContent').findByPk(idParam(req), {
    include: [{ model: Activity, as: 'activity', attributes: ['userId'] }],
  });
  if (!adj) throw notFound('Adjunto');
  if (!isAdmin(req) && adj.activity?.userId !== req.user.idUser) throw forbidden('No podés ver este adjunto');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.json({ data: { id: adj.id, type: adj.type, mimeType: adj.mimeType, fileName: adj.fileName, content: adj.content } });
});
