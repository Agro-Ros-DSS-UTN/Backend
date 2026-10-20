import { TASK_TYPES, LEVELS, TASK_STATUSES } from './task.entity.js';
import * as taskRepository from './task.repository.js';
import { badRequest, forbidden, notFound, toInt } from '../../shared/utils/http.js';
import { parseDate, required, text, oneOf } from '../../shared/utils/validation.js';
import { createNotification } from '../notification/notification.service.js';

// Estados como los mandaba la v1 (en minúscula): se aceptan y se guardan con el nombre canónico.
const V1_STATUS = { pendiente: 'Pendiente', 'en progreso': 'Pendiente', finalizada: 'Finalizada', completada: 'Finalizada', cancelada: 'Cancelada' };
const normalizeStatus = (e) => (e ? V1_STATUS[String(e).toLowerCase()] || e : e);

export const serializeTask = (t) => {
  if (!t) return null;
  const j = typeof t.toJSON === 'function' ? t.toJSON() : t;
  const assignments = (j.assignments || []).map((a) => ({
    userId: a.userId,
    fullName: a.user?.fullName ?? null,
    role: a.user?.role ?? null,
    // compatibilidad v1
    idUser: a.userId,
    User: a.user ? { idUser: a.user.idUser, fullName: a.user.fullName, role: a.user.role } : null,
  }));
  const roleOf = (r) => (r === 'administrador' ? 'administrador' : 'vendedor');
  return {
    id: j.id,
    title: j.title,
    description: j.description ?? null,
    type: j.type,
    priority: j.priority,
    status: j.status,
    createdAt: j.createdAt,
    dueDate: j.dueDate ?? null,
    dueTime: j.dueTime ?? null,
    notes: j.notes ?? null,
    companyId: j.companyId ?? null,
    company: j.company?.legalName ?? null,
    contactId: j.contactId ?? null,
    // `contact` sigue siendo texto (como en v1); el detalle va aparte.
    contact: j.contact?.fullName ?? null,
    contactDetails: j.contact ? {
      id: j.contact.id, fullName: j.contact.fullName, jobTitle: j.contact.jobTitle ?? null, email: j.contact.email ?? null,
      phones: (j.contact.phones || []).map((t) => t.number),
    } : null,
    activityId: j.activityId ?? null,
    activity: j.activity ? {
      id: j.activity.id, contactType: j.activity.contactType, occurredAt: j.activity.occurredAt,
      opportunity: j.activity.opportunity ? { id: j.activity.opportunity.id, title: j.activity.opportunity.title } : null,
    } : null,
    createdById: j.createdById ?? null,
    createdBy: j.createdBy ? { idUser: j.createdBy.idUser, fullName: j.createdBy.fullName } : null,
    completedById: j.completedById ?? null,
    completedBy: j.completedBy ? { idUser: j.completedBy.idUser, fullName: j.completedBy.fullName } : null,
    completedAt: j.completedAt ?? null,
    assignments,
    assigneeIds: assignments.map((a) => a.userId),
    // compatibilidad v1
    assignedTo: assignments.map((a) => a.fullName).filter(Boolean).join(', ') || null,
    activityFormId: j.activityId ?? null,
    ActivityForm: j.activity ? { contactType: j.activity.contactType, company: j.company?.legalName ?? null, occurredAt: j.activity.occurredAt } : null,
    createdByRole: j.createdBy ? roleOf(j.createdBy.role) : null,
    recipientRole: assignments.some((a) => a.role === 'vendedor') ? 'vendedor' : assignments.length ? 'administrador' : null,
  };
};

// Visible para: administración (todas), asignados y quien la creó.
const visible = async ({ admin, currentUserId }, task) => {
  if (admin || task.createdById === currentUserId) return true;
  return Boolean(await taskRepository.findAssignment(task.id, currentUserId));
};

const taskData = async (b, transaction, actual = null) => {
  const d = {};
  if (b.title !== undefined || b.description !== undefined) d.title = text(b.title ?? b.description, 'title', 200);
  if (b.description !== undefined) d.description = text(b.description, 'description', 5000);
  if (b.type !== undefined) d.type = oneOf(String(b.type).toLowerCase(), TASK_TYPES, 'type');
  if (b.priority !== undefined) d.priority = oneOf(b.priority, LEVELS, 'priority');
  if (b.dueDate !== undefined) d.dueDate = parseDate(b.dueDate, 'dueDate');
  if (b.dueTime !== undefined) {
    if (b.dueTime && !/^\d{2}:\d{2}$/.test(b.dueTime)) throw badRequest('La hora debe tener el formato HH:MM', { dueTime: 'format' });
    d.dueTime = b.dueTime || null;
  }
  if (b.notes !== undefined) d.notes = text(b.notes, 'notes', 5000);
  if (b.companyId !== undefined) {
    d.companyId = b.companyId ? toInt(b.companyId) : null;
    if (d.companyId && !(await taskRepository.findCompanyById(d.companyId, transaction))) {
      throw badRequest('La empresa indicada no existe', { companyId: 'missing' });
    }
  } else if (b.company !== undefined) {
    // Pantalla v1: nombre de la empresa. Si no está registrada, el nombre queda en las notas.
    const name = text(b.company, 'company', 150);
    const e = name ? await taskRepository.findCompanyByLegalName(name, transaction) : null;
    d.companyId = e?.id ?? null;
    if (name && !e) d.notes = [d.notes ?? b.notes, `Empresa: ${name}`].filter(Boolean).join('\n');
  }
  // Contacto de la tarea (P-7): vínculo a un contacto cargado. Tiene que ser de la
  // empresa de la tarea; si la tarea no tiene empresa, toma la del contacto.
  if (b.contactId) {
    d.contactId = toInt(b.contactId);
  } else if (typeof b.contact === 'string' && b.contact.trim()) {
    // Pantalla v1: nombre escrito. Se vincula si coincide con un contacto de la empresa;
    // si no, queda en las notas.
    const name = text(b.contact, 'contact', 150);
    const c = name ? await taskRepository.findContactByNameAndCompany({ fullName: name, companyId: d.companyId }, transaction) : null;
    d.contactId = c?.id ?? null;
    if (name && !c && !(d.notes || b.notes || '').includes(name)) {
      d.notes = [d.notes ?? text(b.notes, 'notes', 5000), `Contacto: ${name}`].filter(Boolean).join('\n');
    }
  } else if (b.contactId !== undefined || b.contact !== undefined) {
    d.contactId = null;
  }
  if (d.contactId) {
    const c = await taskRepository.findContactById(d.contactId, { transaction });
    if (!c) throw badRequest('El contacto indicado no existe', { contactId: 'missing' });
    const taskCompany = d.companyId !== undefined ? d.companyId : actual?.companyId ?? null;
    if (taskCompany && c.companyId && c.companyId !== taskCompany) {
      throw badRequest('El contacto no pertenece a la empresa de la tarea', { contactId: 'otherCompany' });
    }
    if (!taskCompany && c.companyId) d.companyId = c.companyId;
  } else if (d.companyId !== undefined && d.contactId === undefined && actual?.contactId) {
    // Cambió la empresa: si el contacto anterior era de otra empresa, se desvincula.
    const c = await taskRepository.findContactById(actual.contactId, { transaction, paranoid: false });
    if (c && c.companyId !== d.companyId) d.contactId = null;
  }
  const activityId = b.activityId !== undefined ? b.activityId : b.activityFormId;
  if (activityId !== undefined) {
    d.activityId = activityId ? toInt(activityId) : null;
    if (d.activityId && !(await taskRepository.findActivityById(d.activityId, transaction))) {
      throw badRequest('La actividad indicada no existe', { activityId: 'missing' });
    }
  }
  return d;
};

// Reemplaza los asignados. Devuelve los ids agregados (para notificar y crear eventos).
const syncAssignees = async (task, ids, transaction) => {
  if (!Array.isArray(ids)) return [];
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length && (await taskRepository.countUsersByIds(unique, transaction)) !== unique.length) {
    throw badRequest('Algún usuario asignado no existe', { assigneeIds: 'missing' });
  }
  const current = await taskRepository.findAssignmentsByTask(task.id, { transaction });
  const toRemove = current.filter((a) => !unique.includes(a.userId));
  for (const a of toRemove) {
    if (a.calendarEventId) taskRepository.deleteExternalCalendarEvent(a.calendarEventId).catch(() => {});
    await taskRepository.destroyAssignment(a, { transaction });
  }
  const add = unique.filter((id) => !current.some((a) => a.userId === id));
  if (add.length) {
    await taskRepository.bulkCreateAssignments(add.map((userId) => ({ taskId: task.id, userId })), { transaction });
  }
  return add;
};

// Eventos de calendario y notificaciones, fuera de la transacción (best-effort).
const afterAssign = async ({ currentUserId, currentUserFullName }, task, added) => {
  for (const userId of added) {
    if (userId !== currentUserId) {
      await createNotification(userId, 'tarea_asignada', `${currentUserFullName || 'Te asignaron'}: ${task.title}`, 'tarea', task.id);
    }
    const row = await taskRepository.findAssignmentWithUser(task.id, userId);
    if (row?.user) {
      const r = await taskRepository.createExternalCalendarEvent(task, row.user);
      if (r.success) await taskRepository.updateAssignment(row, { calendarEventId: r.eventId });
    }
  }
};

export const listTasks = async (query = {}, { admin, currentUserId }) => {
  const status = query.status ? normalizeStatus(String(query.status)) : undefined;
  const companyId = query.companyId ? toInt(query.companyId) : undefined;
  const tasks = await taskRepository.findAll({
    status,
    companyId,
    admin,
    currentUserId,
    filterUserId: query.userId,
  });
  return tasks.map(serializeTask);
};

export const getTask = async (id, auth) => {
  const t = await taskRepository.findByIdFull(id);
  if (!t) throw notFound('Tarea');
  if (!(await visible(auth, t))) throw forbidden('No tenés acceso a esta tarea');
  return serializeTask(t);
};

export const createTask = async (body = {}, { currentUserId, currentUserFullName }) => {
  let added = [];
  const task = await taskRepository.runTransaction(async (transaction) => {
    const d = await taskData(body, transaction);
    required(d, ['title']);
    const t = await taskRepository.create({ ...d, status: 'Pendiente', createdById: currentUserId }, { transaction });
    const ids = Array.isArray(body.assigneeIds) && body.assigneeIds.length ? body.assigneeIds : [currentUserId];
    added = await syncAssignees(t, ids, transaction);
    return t;
  });
  await afterAssign({ currentUserId, currentUserFullName }, task, added);
  const full = await taskRepository.findByIdFull(task.id);
  return serializeTask(full);
};

// Editar: administración o quien la creó. Los asignados solo pueden finalizarla.
export const updateTask = async (id, body = {}, { admin, currentUserId, currentUserFullName }) => {
  const t = await taskRepository.findById(id);
  if (!t) throw notFound('Tarea');
  if (!admin && t.createdById !== currentUserId) throw forbidden('Solo la administración o quien creó la tarea pueden editarla');
  if (body.status !== undefined && normalizeStatus(body.status) !== t.status) {
    throw badRequest('El estado se cambia con "Finalizar" o "Reabrir", no desde la edición', { status: 'useEndpoint' });
  }
  let added = [];
  await taskRepository.runTransaction(async (transaction) => {
    const d = await taskData(body, transaction, t);
    if (d.title === null) throw badRequest('El título no puede quedar vacío');
    await taskRepository.update(t, d, { transaction });
    added = await syncAssignees(t, body.assigneeIds, transaction);
  });
  await afterAssign({ currentUserId, currentUserFullName }, t, added);
  const full = await taskRepository.findByIdFull(t.id);
  return serializeTask(full);
};

// Finalizar: administración o un usuario asignado.
export const completeTask = async (id, { admin, currentUserId, currentUserFullName }) => {
  const t = await taskRepository.findById(id);
  if (!t) throw notFound('Tarea');
  if (t.status === 'Finalizada') throw badRequest('La tarea ya está finalizada');
  const assigned = await taskRepository.findAssignment(t.id, currentUserId);
  if (!admin && !assigned) throw forbidden('Solo los asignados o la administración pueden finalizar esta tarea');
  await taskRepository.update(t, { status: 'Finalizada', completedById: currentUserId, completedAt: new Date() });
  if (t.createdById && t.createdById !== currentUserId) {
    await createNotification(t.createdById, 'tarea_finalizada', `${currentUserFullName || 'Un usuario'} finalizó: ${t.title}`, 'tarea', t.id);
  }
  const full = await taskRepository.findByIdFull(t.id);
  return serializeTask(full);
};

// Cambio de estado (compatibilidad): Finalizada pasa por las reglas de finalizar.
export const changeTaskStatus = async (id, body = {}, auth) => {
  const status = oneOf(normalizeStatus(body?.status), TASK_STATUSES, 'status');
  if (status === 'Finalizada') {
    const data = await completeTask(id, auth);
    return { message: 'Tarea finalizada', data };
  }
  const t = await taskRepository.findById(id);
  if (!t) throw notFound('Tarea');
  const assigned = await taskRepository.findAssignment(t.id, auth.currentUserId);
  if (!auth.admin && t.createdById !== auth.currentUserId && !assigned) throw forbidden('No tenés acceso a esta tarea');
  if (status === 'Cancelada' && !auth.admin && t.createdById !== auth.currentUserId) {
    throw forbidden('Solo quien creó la tarea o la administración pueden cancelarla');
  }
  await taskRepository.update(t, { status, completedById: null, completedAt: null });
  const full = await taskRepository.findByIdFull(t.id);
  return { message: 'Estado actualizado', data: serializeTask(full) };
};

export const removeTask = async (id, { admin, currentUserId }) => {
  const t = await taskRepository.findById(id);
  if (!t) throw notFound('Tarea');
  if (!admin && t.createdById !== currentUserId) throw forbidden('Solo la administración o quien creó la tarea pueden eliminarla');
  const assignments = await taskRepository.findAssignmentsByTask(t.id);
  await taskRepository.destroyWithAssignees(t);
  for (const a of assignments) {
    if (a.calendarEventId) taskRepository.deleteExternalCalendarEvent(a.calendarEventId).catch(() => {});
  }
  return { message: 'Tarea eliminada', id: t.id };
};

// Recordatorio 48 h y 24 h antes del vencimiento a cada asignado. Nunca lanza.
const due = (task) => {
  if (!task?.dueDate) return null;
  const time = /^\d{2}:\d{2}$/.test(task.dueTime || '') ? task.dueTime : '23:59';
  const d = new Date(`${task.dueDate}T${time}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const runTaskReminderSweep = async () => {
  const rows = await taskRepository.findPendingReminderAssignments();
  const now = Date.now();
  let sent48 = 0;
  let sent24 = 0;
  for (const row of rows) {
    const v = due(row.task);
    if (!v) continue;
    const hours = (v.getTime() - now) / 3600000;
    if (hours < 0) continue;
    if (!row.reminder48hSent && hours <= 48) {
      if ((await taskRepository.sendReminderEmail(row.task, row.user, 48)).success) {
        row.reminder48hSent = true;
        await taskRepository.saveAssignment(row);
        sent48++;
      }
    }
    if (!row.reminder24hSent && hours <= 24) {
      if ((await taskRepository.sendReminderEmail(row.task, row.user, 24)).success) {
        row.reminder24hSent = true;
        await taskRepository.saveAssignment(row);
        sent24++;
      }
    }
  }
  if (sent48 || sent24) console.log(`[taskReminders] Recordatorios enviados — 48h: ${sent48}, 24h: ${sent24}`);
  return { sent48, sent24, checked: rows.length };
};
