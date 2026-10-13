import { Op } from 'sequelize';
import { sequelize, Task, TaskAssignee, User, Company, Contact, ContactPhone, Activity, Opportunity } from '../models/index.js';
import { TASK_TYPES, LEVELS, TASK_STATUSES } from '../models/commercial.model.js';
import { isAdmin } from '../middlewares/auth.middleware.js';
import { asyncHandler, badRequest, forbidden, idParam, notFound, toInt } from '../utils/http.js';
import { parseDate, required, text, oneOf } from '../utils/validation.js';
import { createCalendarEventForAssignee, deleteCalendarEvent } from '../services/calendarIntegration.js';
import { createNotification } from './notification.controller.js';

// Estados como los mandaba la v1 (en minúscula): se aceptan y se guardan con el nombre canónico.
const V1_STATUS = { pendiente: 'Pendiente', 'en progreso': 'Pendiente', finalizada: 'Finalizada', completada: 'Finalizada', cancelada: 'Cancelada' };
const normalizeStatus = (e) => (e ? V1_STATUS[String(e).toLowerCase()] || e : e);

const include = [
  { model: TaskAssignee, as: 'assignments', include: [{ model: User, as: 'user', attributes: ['idUser', 'fullName', 'role', 'email'] }] },
  { model: User, as: 'createdBy', attributes: ['idUser', 'fullName', 'role'] },
  { model: User, as: 'completedBy', attributes: ['idUser', 'fullName', 'role'] },
  { model: Company, as: 'company', attributes: ['id', 'legalName'], paranoid: false },
  {
    model: Contact, as: 'contact', attributes: ['id', 'fullName', 'jobTitle', 'email', 'companyId'], paranoid: false,
    include: [{ model: ContactPhone, as: 'phones', attributes: ['number'] }],
  },
  {
    model: Activity, as: 'activity', attributes: ['id', 'contactType', 'occurredAt', 'description', 'opportunityId'],
    include: [{ model: Opportunity, as: 'opportunity', attributes: ['id', 'title'], paranoid: false }],
  },
];

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
const visible = async (req, task) => {
  if (isAdmin(req) || task.createdById === req.user.idUser) return true;
  return Boolean(await TaskAssignee.findOne({ where: { taskId: task.id, userId: req.user.idUser } }));
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
    if (d.companyId && !(await Company.findByPk(d.companyId, { transaction }))) throw badRequest('La empresa indicada no existe', { companyId: 'missing' });
  } else if (b.company !== undefined) {
    // Pantalla v1: nombre de la empresa. Si no está registrada, el nombre queda en las notas.
    const name = text(b.company, 'company', 150);
    const e = name ? await Company.findOne({ where: { legalName: name }, transaction }) : null;
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
    const c = name ? await Contact.findOne({ where: { fullName: name, ...(d.companyId ? { companyId: d.companyId } : {}) }, transaction }) : null;
    d.contactId = c?.id ?? null;
    if (name && !c && !(d.notes || b.notes || '').includes(name)) {
      d.notes = [d.notes ?? text(b.notes, 'notes', 5000), `Contacto: ${name}`].filter(Boolean).join('\n');
    }
  } else if (b.contactId !== undefined || b.contact !== undefined) {
    d.contactId = null;
  }
  if (d.contactId) {
    const c = await Contact.findByPk(d.contactId, { transaction });
    if (!c) throw badRequest('El contacto indicado no existe', { contactId: 'missing' });
    const taskCompany = d.companyId !== undefined ? d.companyId : actual?.companyId ?? null;
    if (taskCompany && c.companyId && c.companyId !== taskCompany) throw badRequest('El contacto no pertenece a la empresa de la tarea', { contactId: 'otherCompany' });
    if (!taskCompany && c.companyId) d.companyId = c.companyId;
  } else if (d.companyId !== undefined && d.contactId === undefined && actual?.contactId) {
    // Cambió la empresa: si el contacto anterior era de otra empresa, se desvincula.
    const c = await Contact.findByPk(actual.contactId, { transaction, paranoid: false });
    if (c && c.companyId !== d.companyId) d.contactId = null;
  }
  const activityId = b.activityId !== undefined ? b.activityId : b.activityFormId;
  if (activityId !== undefined) {
    d.activityId = activityId ? toInt(activityId) : null;
    if (d.activityId && !(await Activity.findByPk(d.activityId, { transaction }))) throw badRequest('La actividad indicada no existe', { activityId: 'missing' });
  }
  return d;
};

// Reemplaza los asignados. Devuelve los ids agregados (para notificar y crear eventos).
const syncAssignees = async (task, ids, transaction) => {
  if (!Array.isArray(ids)) return [];
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length && (await User.count({ where: { idUser: { [Op.in]: unique } }, transaction })) !== unique.length) throw badRequest('Algún usuario asignado no existe', { assigneeIds: 'missing' });
  const current = await TaskAssignee.findAll({ where: { taskId: task.id }, transaction });
  const toRemove = current.filter((a) => !unique.includes(a.userId));
  for (const a of toRemove) {
    if (a.calendarEventId) deleteCalendarEvent(a.calendarEventId).catch(() => {});
    await a.destroy({ transaction });
  }
  const add = unique.filter((id) => !current.some((a) => a.userId === id));
  if (add.length) await TaskAssignee.bulkCreate(add.map((userId) => ({ taskId: task.id, userId })), { transaction });
  return add;
};

// Eventos de calendario y notificaciones, fuera de la transacción (best-effort).
const afterAssign = async (req, task, added) => {
  for (const userId of added) {
    if (userId !== req.user.idUser) await createNotification(userId, 'tarea_asignada', `${req.user.fullName || 'Te asignaron'}: ${task.title}`, 'tarea', task.id);
    const row = await TaskAssignee.findOne({ where: { taskId: task.id, userId }, include: [{ model: User, as: 'user', attributes: ['idUser', 'fullName', 'email'] }] });
    if (row?.user) {
      const r = await createCalendarEventForAssignee(task, row.user);
      if (r.success) await row.update({ calendarEventId: r.eventId });
    }
  }
};

export const list = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = normalizeStatus(String(req.query.status));
  if (req.query.companyId) where.companyId = toInt(req.query.companyId);
  if (!isAdmin(req)) {
    const mine = await TaskAssignee.findAll({ where: { userId: req.user.idUser }, attributes: ['taskId'] });
    where[Op.or] = [{ createdById: req.user.idUser }, { id: { [Op.in]: mine.map((m) => m.taskId).concat(0) } }];
  } else if (req.query.userId) {
    const assignedRows = await TaskAssignee.findAll({ where: { userId: String(req.query.userId) }, attributes: ['taskId'] });
    where.id = { [Op.in]: assignedRows.map((m) => m.taskId).concat(0) };
  }
  const tasks = await Task.findAll({ where, include, order: [['id', 'DESC']] });
  res.json({ data: tasks.map(serializeTask) });
});

export const get = asyncHandler(async (req, res) => {
  const t = await Task.findByPk(idParam(req), { include });
  if (!t) throw notFound('Tarea');
  if (!(await visible(req, t))) throw forbidden('No tenés acceso a esta tarea');
  res.json({ data: serializeTask(t) });
});

export const create = asyncHandler(async (req, res) => {
  const body = req.body || {};
  let added = [];
  const task = await sequelize.transaction(async (transaction) => {
    const d = await taskData(body, transaction);
    required(d, ['title']);
    const t = await Task.create({ ...d, status: 'Pendiente', createdById: req.user.idUser }, { transaction });
    const ids = Array.isArray(body.assigneeIds) && body.assigneeIds.length ? body.assigneeIds : [req.user.idUser];
    added = await syncAssignees(t, ids, transaction);
    return t;
  });
  await afterAssign(req, task, added);
  const full = await Task.findByPk(task.id, { include });
  res.status(201).json({ message: 'Tarea creada', data: serializeTask(full) });
});

// Editar: administración o quien la creó. Los asignados solo pueden finalizarla.
export const update = asyncHandler(async (req, res) => {
  const t = await Task.findByPk(idParam(req));
  if (!t) throw notFound('Tarea');
  if (!isAdmin(req) && t.createdById !== req.user.idUser) throw forbidden('Solo la administración o quien creó la tarea pueden editarla');
  const body = req.body || {};
  if (body.status !== undefined && normalizeStatus(body.status) !== t.status) {
    throw badRequest('El estado se cambia con "Finalizar" o "Reabrir", no desde la edición', { status: 'useEndpoint' });
  }
  let added = [];
  await sequelize.transaction(async (transaction) => {
    const d = await taskData(body, transaction, t);
    if (d.title === null) throw badRequest('El título no puede quedar vacío');
    await t.update(d, { transaction });
    added = await syncAssignees(t, body.assigneeIds, transaction);
  });
  await afterAssign(req, t, added);
  const full = await Task.findByPk(t.id, { include });
  res.json({ message: 'Tarea actualizada', data: serializeTask(full) });
});

// Finalizar: administración o un usuario asignado.
export const complete = asyncHandler(async (req, res) => {
  const t = await Task.findByPk(idParam(req));
  if (!t) throw notFound('Tarea');
  if (t.status === 'Finalizada') throw badRequest('La tarea ya está finalizada');
  const assigned = await TaskAssignee.findOne({ where: { taskId: t.id, userId: req.user.idUser } });
  if (!isAdmin(req) && !assigned) throw forbidden('Solo los asignados o la administración pueden finalizar esta tarea');
  await t.update({ status: 'Finalizada', completedById: req.user.idUser, completedAt: new Date() });
  if (t.createdById && t.createdById !== req.user.idUser) {
    await createNotification(t.createdById, 'tarea_finalizada', `${req.user.fullName || 'Un usuario'} finalizó: ${t.title}`, 'tarea', t.id);
  }
  const full = await Task.findByPk(t.id, { include });
  res.json({ message: 'Tarea finalizada', data: serializeTask(full) });
});

// Cambio de estado (compatibilidad): Finalizada pasa por las reglas de finalizar.
export const changeStatus = asyncHandler(async (req, res, next) => {
  const status = oneOf(normalizeStatus(req.body?.status), TASK_STATUSES, 'status');
  if (status === 'Finalizada') return complete(req, res, next);
  const t = await Task.findByPk(idParam(req));
  if (!t) throw notFound('Tarea');
  const assigned = await TaskAssignee.findOne({ where: { taskId: t.id, userId: req.user.idUser } });
  if (!isAdmin(req) && t.createdById !== req.user.idUser && !assigned) throw forbidden('No tenés acceso a esta tarea');
  if (status === 'Cancelada' && !isAdmin(req) && t.createdById !== req.user.idUser) throw forbidden('Solo quien creó la tarea o la administración pueden cancelarla');
  await t.update({ status, completedById: null, completedAt: null });
  const full = await Task.findByPk(t.id, { include });
  res.json({ message: 'Estado actualizado', data: serializeTask(full) });
});

export const remove = asyncHandler(async (req, res) => {
  const t = await Task.findByPk(idParam(req));
  if (!t) throw notFound('Tarea');
  if (!isAdmin(req) && t.createdById !== req.user.idUser) throw forbidden('Solo la administración o quien creó la tarea pueden eliminarla');
  const assignments = await TaskAssignee.findAll({ where: { taskId: t.id } });
  await sequelize.transaction(async (transaction) => {
    await TaskAssignee.destroy({ where: { taskId: t.id }, transaction });
    await t.destroy({ transaction });
  });
  for (const a of assignments) if (a.calendarEventId) deleteCalendarEvent(a.calendarEventId).catch(() => {});
  res.json({ message: 'Tarea eliminada', id: t.id });
});
