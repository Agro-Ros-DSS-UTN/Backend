import { Op } from 'sequelize';
import { sequelize, Tarea, TareaAsignado, Usuario, Empresa, Contacto, ContactoTelefono, Actividad, Oportunidad } from '../models/index.js';
import { TIPOS_TAREA, NIVELES, ESTADOS_TAREA } from '../models/comercial.model.js';
import { isAdmin } from '../middlewares/auth.middleware.js';
import { asyncHandler, badRequest, forbidden, idParam, notFound, toInt } from '../utils/http.js';
import { parseFecha, requerido, texto, unoDe } from '../utils/validacion.js';
import { createCalendarEventForAssignee, deleteCalendarEvent } from '../services/calendarIntegration.js';
import { crearNotificacion } from './notificacion.controller.js';

const ESTADO_V1 = { pendiente: 'Pendiente', 'en progreso': 'Pendiente', finalizada: 'Finalizada', completada: 'Finalizada', cancelada: 'Cancelada' };
const normalizarEstado = (e) => (e ? ESTADO_V1[String(e).toLowerCase()] || e : e);

const include = [
  { model: TareaAsignado, as: 'asignaciones', include: [{ model: Usuario, as: 'usuario', attributes: ['idUser', 'nombreApellido', 'rol', 'email'] }] },
  { model: Usuario, as: 'creadoPor', attributes: ['idUser', 'nombreApellido', 'rol'] },
  { model: Usuario, as: 'finalizadoPor', attributes: ['idUser', 'nombreApellido', 'rol'] },
  { model: Empresa, as: 'empresa', attributes: ['id', 'razonSocial'], paranoid: false },
  {
    model: Contacto, as: 'contacto', attributes: ['id', 'nombreApellido', 'cargo', 'email', 'empresaId'], paranoid: false,
    include: [{ model: ContactoTelefono, as: 'telefonos', attributes: ['numero'] }],
  },
  {
    model: Actividad, as: 'actividad', attributes: ['id', 'tipoContacto', 'fechaHora', 'descripcion', 'oportunidadId'],
    include: [{ model: Oportunidad, as: 'oportunidad', attributes: ['id', 'titulo'], paranoid: false }],
  },
];

export const serializeTarea = (t) => {
  if (!t) return null;
  const j = typeof t.toJSON === 'function' ? t.toJSON() : t;
  const asignaciones = (j.asignaciones || []).map((a) => ({
    usuarioId: a.usuarioId,
    nombreApellido: a.usuario?.nombreApellido ?? null,
    rol: a.usuario?.rol ?? null,
    // compatibilidad v1
    idUser: a.usuarioId,
    User: a.usuario ? { idUser: a.usuario.idUser, nombreApellido: a.usuario.nombreApellido, role: a.usuario.rol } : null,
  }));
  const rolDe = (r) => (r === 'administrador' ? 'administrador' : 'vendedor');
  return {
    id: j.id,
    titulo: j.titulo,
    descripcion: j.descripcion ?? null,
    tipo: j.tipo,
    prioridad: j.prioridad,
    estado: j.estado,
    fechaCreacion: j.fechaCreacion,
    fechaVencimiento: j.fechaVencimiento ?? null,
    horaVencimiento: j.horaVencimiento ?? null,
    notas: j.notas ?? null,
    empresaId: j.empresaId ?? null,
    empresa: j.empresa?.razonSocial ?? null,
    contactoId: j.contactoId ?? null,
    // `contacto` sigue siendo texto (como en v1); el detalle va aparte.
    contacto: j.contacto?.nombreApellido ?? null,
    contactoDetalle: j.contacto ? {
      id: j.contacto.id, nombreApellido: j.contacto.nombreApellido, cargo: j.contacto.cargo ?? null, email: j.contacto.email ?? null,
      telefonos: (j.contacto.telefonos || []).map((t) => t.numero),
    } : null,
    actividadId: j.actividadId ?? null,
    actividad: j.actividad ? {
      id: j.actividad.id, tipoContacto: j.actividad.tipoContacto, fechaHora: j.actividad.fechaHora,
      oportunidad: j.actividad.oportunidad ? { id: j.actividad.oportunidad.id, titulo: j.actividad.oportunidad.titulo } : null,
    } : null,
    creadoPorId: j.creadoPorId ?? null,
    creadoPor: j.creadoPor ? { idUser: j.creadoPor.idUser, nombreApellido: j.creadoPor.nombreApellido } : null,
    finalizadoPorId: j.finalizadoPorId ?? null,
    finalizadoPor: j.finalizadoPor ? { idUser: j.finalizadoPor.idUser, nombreApellido: j.finalizadoPor.nombreApellido } : null,
    fechaFinalizacion: j.fechaFinalizacion ?? null,
    asignaciones,
    asignadosIds: asignaciones.map((a) => a.usuarioId),
    // compatibilidad v1
    asignadoA: asignaciones.map((a) => a.nombreApellido).filter(Boolean).join(', ') || null,
    formularioActividadId: j.actividadId ?? null,
    FormularioActividad: j.actividad ? { tipoContacto: j.actividad.tipoContacto, empresa: j.empresa?.razonSocial ?? null, fechaHora: j.actividad.fechaHora } : null,
    creadoPorRol: j.creadoPor ? rolDe(j.creadoPor.rol) : null,
    destinatarioRol: asignaciones.some((a) => a.rol === 'vendedor') ? 'vendedor' : asignaciones.length ? 'administrador' : null,
  };
};

// Visible para: administración (todas), asignados y quien la creó.
const visible = async (req, tarea) => {
  if (isAdmin(req) || tarea.creadoPorId === req.user.idUser) return true;
  return Boolean(await TareaAsignado.findOne({ where: { tareaId: tarea.id, usuarioId: req.user.idUser } }));
};

const datosTarea = async (b, transaction, actual = null) => {
  const d = {};
  if (b.titulo !== undefined || b.descripcion !== undefined) d.titulo = texto(b.titulo ?? b.descripcion, 'titulo', 200);
  if (b.descripcion !== undefined) d.descripcion = texto(b.descripcion, 'descripcion', 5000);
  if (b.tipo !== undefined) d.tipo = unoDe(String(b.tipo).toLowerCase(), TIPOS_TAREA, 'tipo');
  if (b.prioridad !== undefined) d.prioridad = unoDe(b.prioridad, NIVELES, 'prioridad');
  if (b.fechaVencimiento !== undefined) d.fechaVencimiento = parseFecha(b.fechaVencimiento, 'fechaVencimiento');
  if (b.horaVencimiento !== undefined) {
    if (b.horaVencimiento && !/^\d{2}:\d{2}$/.test(b.horaVencimiento)) throw badRequest('La hora debe tener el formato HH:MM', { horaVencimiento: 'formato' });
    d.horaVencimiento = b.horaVencimiento || null;
  }
  if (b.notas !== undefined) d.notas = texto(b.notas, 'notas', 5000);
  if (b.empresaId !== undefined) {
    d.empresaId = b.empresaId ? toInt(b.empresaId) : null;
    if (d.empresaId && !(await Empresa.findByPk(d.empresaId, { transaction }))) throw badRequest('La empresa indicada no existe', { empresaId: 'inexistente' });
  } else if (b.empresa !== undefined) {
    // Pantalla v1: nombre de la empresa. Si no está registrada, el nombre queda en las notas.
    const nombre = texto(b.empresa, 'empresa', 150);
    const e = nombre ? await Empresa.findOne({ where: { razonSocial: nombre }, transaction }) : null;
    d.empresaId = e?.id ?? null;
    if (nombre && !e) d.notas = [d.notas ?? b.notas, `Empresa: ${nombre}`].filter(Boolean).join('\n');
  }
  // Contacto de la tarea (P-7): vínculo a un contacto cargado. Tiene que ser de la
  // empresa de la tarea; si la tarea no tiene empresa, toma la del contacto.
  if (b.contactoId) {
    d.contactoId = toInt(b.contactoId);
  } else if (typeof b.contacto === 'string' && b.contacto.trim()) {
    // Pantalla v1: nombre escrito. Se vincula si coincide con un contacto de la empresa;
    // si no, queda en las notas.
    const nombre = texto(b.contacto, 'contacto', 150);
    const c = nombre ? await Contacto.findOne({ where: { nombreApellido: nombre, ...(d.empresaId ? { empresaId: d.empresaId } : {}) }, transaction }) : null;
    d.contactoId = c?.id ?? null;
    if (nombre && !c && !(d.notas || b.notas || '').includes(nombre)) {
      d.notas = [d.notas ?? texto(b.notas, 'notas', 5000), `Contacto: ${nombre}`].filter(Boolean).join('\n');
    }
  } else if (b.contactoId !== undefined || b.contacto !== undefined) {
    d.contactoId = null;
  }
  if (d.contactoId) {
    const c = await Contacto.findByPk(d.contactoId, { transaction });
    if (!c) throw badRequest('El contacto indicado no existe', { contactoId: 'inexistente' });
    const empresaTarea = d.empresaId !== undefined ? d.empresaId : actual?.empresaId ?? null;
    if (empresaTarea && c.empresaId && c.empresaId !== empresaTarea) throw badRequest('El contacto no pertenece a la empresa de la tarea', { contactoId: 'otra empresa' });
    if (!empresaTarea && c.empresaId) d.empresaId = c.empresaId;
  } else if (d.empresaId !== undefined && d.contactoId === undefined && actual?.contactoId) {
    // Cambió la empresa: si el contacto anterior era de otra empresa, se desvincula.
    const c = await Contacto.findByPk(actual.contactoId, { transaction, paranoid: false });
    if (c && c.empresaId !== d.empresaId) d.contactoId = null;
  }
  const actividadId = b.actividadId !== undefined ? b.actividadId : b.formularioActividadId;
  if (actividadId !== undefined) {
    d.actividadId = actividadId ? toInt(actividadId) : null;
    if (d.actividadId && !(await Actividad.findByPk(d.actividadId, { transaction }))) throw badRequest('La actividad indicada no existe', { actividadId: 'inexistente' });
  }
  return d;
};

// Reemplaza los asignados. Devuelve los ids agregados (para notificar y crear eventos).
const sincronizarAsignados = async (tarea, ids, transaction) => {
  if (!Array.isArray(ids)) return [];
  const unicos = [...new Set(ids.filter(Boolean).map(String))];
  if (unicos.length && (await Usuario.count({ where: { idUser: { [Op.in]: unicos } }, transaction })) !== unicos.length) throw badRequest('Algún usuario asignado no existe', { asignadosIds: 'inexistente' });
  const actuales = await TareaAsignado.findAll({ where: { tareaId: tarea.id }, transaction });
  const quitar = actuales.filter((a) => !unicos.includes(a.usuarioId));
  for (const a of quitar) {
    if (a.calendarEventId) deleteCalendarEvent(a.calendarEventId).catch(() => {});
    await a.destroy({ transaction });
  }
  const agregar = unicos.filter((id) => !actuales.some((a) => a.usuarioId === id));
  if (agregar.length) await TareaAsignado.bulkCreate(agregar.map((usuarioId) => ({ tareaId: tarea.id, usuarioId })), { transaction });
  return agregar;
};

// Eventos de calendario y notificaciones, fuera de la transacción (best-effort).
const despuesDeAsignar = async (req, tarea, agregados) => {
  for (const usuarioId of agregados) {
    if (usuarioId !== req.user.idUser) await crearNotificacion(usuarioId, 'tarea_asignada', `${req.user.nombreApellido || 'Te asignaron'}: ${tarea.titulo}`, 'tarea', tarea.id);
    const fila = await TareaAsignado.findOne({ where: { tareaId: tarea.id, usuarioId }, include: [{ model: Usuario, as: 'usuario', attributes: ['idUser', 'nombreApellido', 'email'] }] });
    if (fila?.usuario) {
      const r = await createCalendarEventForAssignee(tarea, fila.usuario);
      if (r.success) await fila.update({ calendarEventId: r.eventId });
    }
  }
};

export const listar = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.estado) where.estado = normalizarEstado(String(req.query.estado));
  if (req.query.empresaId) where.empresaId = toInt(req.query.empresaId);
  if (!isAdmin(req)) {
    const mias = await TareaAsignado.findAll({ where: { usuarioId: req.user.idUser }, attributes: ['tareaId'] });
    where[Op.or] = [{ creadoPorId: req.user.idUser }, { id: { [Op.in]: mias.map((m) => m.tareaId).concat(0) } }];
  } else if (req.query.usuarioId) {
    const de = await TareaAsignado.findAll({ where: { usuarioId: String(req.query.usuarioId) }, attributes: ['tareaId'] });
    where.id = { [Op.in]: de.map((m) => m.tareaId).concat(0) };
  }
  const tareas = await Tarea.findAll({ where, include, order: [['id', 'DESC']] });
  res.json({ data: tareas.map(serializeTarea) });
});

export const obtener = asyncHandler(async (req, res) => {
  const t = await Tarea.findByPk(idParam(req), { include });
  if (!t) throw notFound('Tarea');
  if (!(await visible(req, t))) throw forbidden('No tenés acceso a esta tarea');
  res.json({ data: serializeTarea(t) });
});

export const crear = asyncHandler(async (req, res) => {
  const body = req.body || {};
  let agregados = [];
  const tarea = await sequelize.transaction(async (transaction) => {
    const d = await datosTarea(body, transaction);
    requerido(d, ['titulo']);
    const t = await Tarea.create({ ...d, estado: 'Pendiente', creadoPorId: req.user.idUser }, { transaction });
    const ids = Array.isArray(body.asignadosIds) && body.asignadosIds.length ? body.asignadosIds : [req.user.idUser];
    agregados = await sincronizarAsignados(t, ids, transaction);
    return t;
  });
  await despuesDeAsignar(req, tarea, agregados);
  const full = await Tarea.findByPk(tarea.id, { include });
  res.status(201).json({ message: 'Tarea creada', data: serializeTarea(full) });
});

// Editar: administración o quien la creó. Los asignados solo pueden finalizarla.
export const actualizar = asyncHandler(async (req, res) => {
  const t = await Tarea.findByPk(idParam(req));
  if (!t) throw notFound('Tarea');
  if (!isAdmin(req) && t.creadoPorId !== req.user.idUser) throw forbidden('Solo la administración o quien creó la tarea pueden editarla');
  const body = req.body || {};
  if (body.estado !== undefined && normalizarEstado(body.estado) !== t.estado) {
    throw badRequest('El estado se cambia con "Finalizar" o "Reabrir", no desde la edición', { estado: 'usar endpoint' });
  }
  let agregados = [];
  await sequelize.transaction(async (transaction) => {
    const d = await datosTarea(body, transaction, t);
    if (d.titulo === null) throw badRequest('El título no puede quedar vacío');
    await t.update(d, { transaction });
    agregados = await sincronizarAsignados(t, body.asignadosIds, transaction);
  });
  await despuesDeAsignar(req, t, agregados);
  const full = await Tarea.findByPk(t.id, { include });
  res.json({ message: 'Tarea actualizada', data: serializeTarea(full) });
});

// Finalizar: administración o un usuario asignado.
export const finalizar = asyncHandler(async (req, res) => {
  const t = await Tarea.findByPk(idParam(req));
  if (!t) throw notFound('Tarea');
  if (t.estado === 'Finalizada') throw badRequest('La tarea ya está finalizada');
  const asignado = await TareaAsignado.findOne({ where: { tareaId: t.id, usuarioId: req.user.idUser } });
  if (!isAdmin(req) && !asignado) throw forbidden('Solo los asignados o la administración pueden finalizar esta tarea');
  await t.update({ estado: 'Finalizada', finalizadoPorId: req.user.idUser, fechaFinalizacion: new Date() });
  if (t.creadoPorId && t.creadoPorId !== req.user.idUser) {
    await crearNotificacion(t.creadoPorId, 'tarea_finalizada', `${req.user.nombreApellido || 'Un usuario'} finalizó: ${t.titulo}`, 'tarea', t.id);
  }
  const full = await Tarea.findByPk(t.id, { include });
  res.json({ message: 'Tarea finalizada', data: serializeTarea(full) });
});

// Cambio de estado (compatibilidad): Finalizada pasa por las reglas de finalizar.
export const cambiarEstado = asyncHandler(async (req, res, next) => {
  const estado = unoDe(normalizarEstado(req.body?.estado), ESTADOS_TAREA, 'estado');
  if (estado === 'Finalizada') return finalizar(req, res, next);
  const t = await Tarea.findByPk(idParam(req));
  if (!t) throw notFound('Tarea');
  const asignado = await TareaAsignado.findOne({ where: { tareaId: t.id, usuarioId: req.user.idUser } });
  if (!isAdmin(req) && t.creadoPorId !== req.user.idUser && !asignado) throw forbidden('No tenés acceso a esta tarea');
  if (estado === 'Cancelada' && !isAdmin(req) && t.creadoPorId !== req.user.idUser) throw forbidden('Solo quien creó la tarea o la administración pueden cancelarla');
  await t.update({ estado, finalizadoPorId: null, fechaFinalizacion: null });
  const full = await Tarea.findByPk(t.id, { include });
  res.json({ message: 'Estado actualizado', data: serializeTarea(full) });
});

export const eliminar = asyncHandler(async (req, res) => {
  const t = await Tarea.findByPk(idParam(req));
  if (!t) throw notFound('Tarea');
  if (!isAdmin(req) && t.creadoPorId !== req.user.idUser) throw forbidden('Solo la administración o quien creó la tarea pueden eliminarla');
  const asignaciones = await TareaAsignado.findAll({ where: { tareaId: t.id } });
  await sequelize.transaction(async (transaction) => {
    await TareaAsignado.destroy({ where: { tareaId: t.id }, transaction });
    await t.destroy({ transaction });
  });
  for (const a of asignaciones) if (a.calendarEventId) deleteCalendarEvent(a.calendarEventId).catch(() => {});
  res.json({ message: 'Tarea eliminada', id: t.id });
});
