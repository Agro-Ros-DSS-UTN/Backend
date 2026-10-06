/* eslint-disable */
import { Task, User, TaskAssignee, activityForm } from '../models/index.js';
import { createCalendarEventForAssignee } from '../services/calendarIntegration.js';

const buildTaskPayload = (body) => {
  const {
    titulo,
    descripcion,
    tipo,
    prioridad,
    fechaVencimiento,
    horaVencimiento,
    empresa,
    contacto,
    notas,
    asignadoA,
    creadoPorRol,
    destinatarioRol,
    estado,
    formularioActividadId
  } = body || {};

  return {
    titulo: titulo || descripcion || 'Tarea sin título',
    descripcion: descripcion || titulo || '',
    tipo: tipo || 'llamada',
    prioridad: prioridad || 'Media',
    fechaVencimiento: fechaVencimiento || null,
    horaVencimiento: horaVencimiento || null,
    empresa: empresa || null,
    contacto: contacto || null,
    notas: notas || null,
    asignadoA: asignadoA || null,
    creadoPorRol: creadoPorRol || 'administrador',
    destinatarioRol: destinatarioRol || 'vendedor',
    estado: estado || 'Pendiente',
    formularioActividadId: (formularioActividadId && !isNaN(Number(formularioActividadId)))
      ? Number(formularioActividadId)
      : null
  };
};

const finalizadoPorInclude = {
  model: User,
  as: 'finalizadoPor',
  required: false,
  attributes: ['idUser', 'nombreApellido', 'role']
};

const actividadInclude = {
  model: activityForm,
  required: false,
  attributes: ['idFormulario', 'tipoContacto', 'empresa', 'fechaHora', 'descripcion']
};

const asignacionesInclude = {
  model: TaskAssignee,
  as: 'asignaciones',
  required: false,
  include: [{ model: User, attributes: ['idUser', 'nombreApellido', 'role', 'direccionMail'] }]
};

// Reemplaza el set de usuarios enganchados a una tarea por `idUsers` (array de
// id_user). Crea las filas nuevas (disparando el alta en Google Calendar para
// cada una) y borra las que ya no corresponden. Devuelve un texto plano
// "Nombre1, Nombre2" para mantener compatibilidad con el campo `asignadoA`
// que ya consumen las vistas en lista.
const syncAssignees = async (task, idUsers) => {
  if (!Array.isArray(idUsers)) return null;

  const uniqueIds = [...new Set(idUsers.filter(Boolean).map(String))];
  const existing = await TaskAssignee.findAll({ where: { taskId: task.id } });
  const existingIds = existing.map((e) => e.idUser);

  const toRemove = existing.filter((e) => !uniqueIds.includes(e.idUser));
  const toAddIds = uniqueIds.filter((id) => !existingIds.includes(id));

  if (toRemove.length > 0) {
    await TaskAssignee.destroy({ where: { id: toRemove.map((e) => e.id) } });
  }

  const users = uniqueIds.length > 0
    ? await User.findAll({ where: { idUser: uniqueIds } })
    : [];

  for (const idUser of toAddIds) {
    const user = users.find((u) => u.idUser === idUser);
    const row = await TaskAssignee.create({ taskId: task.id, idUser });
    if (user) {
      // Best-effort: si Google Calendar no está configurado, esto no hace nada
      // (ver services/calendarIntegration.js) y no interrumpe el alta de la tarea.
      const result = await createCalendarEventForAssignee(task, user);
      if (result.success) {
        row.calendarEventId = result.eventId;
        await row.save();
      }
    }
  }

  const names = users
    .filter((u) => uniqueIds.includes(u.idUser))
    .map((u) => u.nombreApellido)
    .join(', ');
  return names || null;
};

export const createTask = async (req, res) => {
  try {
    const payload = buildTaskPayload(req.body);

    if (!payload.titulo || payload.titulo === 'Tarea sin título') {
      if (!req.body?.titulo && !req.body?.descripcion) {
        return res.status(400).json({ message: 'El título de la tarea es obligatorio' });
      }
    }

    const newTask = await Task.create(payload);

    if (Array.isArray(req.body?.asignadosIds) && req.body.asignadosIds.length > 0) {
      const names = await syncAssignees(newTask, req.body.asignadosIds);
      if (names) await newTask.update({ asignadoA: names });
    }

    const fullTask = await Task.findByPk(newTask.id, { include: [asignacionesInclude, finalizadoPorInclude, actividadInclude] });

    return res.status(201).json({ message: 'Tarea creada con éxito', data: fullTask });
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear la tarea', error: error.message });
  }
};

export const getAllTasks = async (req, res) => {
  try {
    const { rol, destinatarioRol, creadoPorRol } = req.query;
    const where = {};

    if (destinatarioRol) where.destinatarioRol = destinatarioRol;
    if (creadoPorRol) where.creadoPorRol = creadoPorRol;

    const tasks = await Task.findAll({
      where,
      include: [asignacionesInclude, finalizadoPorInclude, actividadInclude],
      order: [['id', 'DESC']]
    });

    // Filtro adicional por "rol": devuelve las tareas visibles para ese rol
    let result = tasks;
    if (rol === 'vendedor') {
      result = tasks.filter(
        (t) => t.destinatarioRol === 'vendedor' || t.creadoPorRol === 'vendedor'
      );
    } else if (rol === 'administrador') {
      result = tasks.filter(
        (t) => t.destinatarioRol === 'administrador' || t.creadoPorRol === 'administrador'
      );
    }

    return res.json({ data: result });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener tareas', error: error.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });

    const payload = buildTaskPayload({ ...task.toJSON(), ...req.body });

    await task.update(payload);

    if (Array.isArray(req.body?.asignadosIds)) {
      const names = await syncAssignees(task, req.body.asignadosIds);
      await task.update({ asignadoA: names ?? payload.asignadoA });
    }

    const fullTask = await Task.findByPk(task.id, { include: [asignacionesInclude, finalizadoPorInclude, actividadInclude] });

    return res.json({ message: 'Tarea actualizada con éxito', data: fullTask });
  } catch (error) {
    return res.status(500).json({ message: 'Error al actualizar la tarea', error: error.message });
  }
};

const isFinalEstado = (estado) => /finaliz|complet/i.test(String(estado || ''));

// Un vendedor solo puede finalizar tareas en las que está asociado; un admin puede finalizar cualquiera.
const canFinalize = async (task, user) => {
  if (!user) return false;
  if (String(user.role || '').toLowerCase() === 'admin') return true;
  const linked = await TaskAssignee.findOne({ where: { taskId: task.id, idUser: user.idUser } });
  return Boolean(linked);
};

export const finalizeTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });
    if (isFinalEstado(task.estado)) {
      return res.status(400).json({ message: 'La tarea ya está finalizada' });
    }
    if (!(await canFinalize(task, req.user))) {
      return res.status(403).json({ code: 'FORBIDDEN_ACTION', message: 'No tiene acceso a finalizar dicha tarea' });
    }

    await task.update({
      estado: 'Finalizada',
      finalizadoPorId: req.user.idUser,
      fechaFinalizacion: new Date(),
    });
    const fullTask = await Task.findByPk(task.id, { include: [asignacionesInclude, finalizadoPorInclude, actividadInclude] });
    return res.json({ message: 'Tarea finalizada', data: fullTask });
  } catch (error) {
    return res.status(500).json({ message: 'Error al finalizar la tarea', error: error.message });
  }
};

export const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });

    // Finalizar siempre pasa por el control de permisos.
    if (isFinalEstado(estado)) return finalizeTask(req, res);

    await task.update({ estado, finalizadoPorId: null, fechaFinalizacion: null });
    return res.json({ message: 'Estado de tarea actualizado', data: task });
  } catch (error) {
    return res.status(500).json({ message: 'Error al actualizar tarea', error: error.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });

    await task.destroy();
    return res.json({ message: 'Tarea eliminada con éxito', id: Number(id) });
  } catch (error) {
    return res.status(500).json({ message: 'Error al eliminar la tarea', error: error.message });
  }
};
