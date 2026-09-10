/* eslint-disable */
import { Task, Seller, User } from '../models/index.js';

// Resuelve un sellerId válido (id de la tabla sellers). Si no existe, devuelve null
// para no violar la FK tareas.seller_id -> sellers.id.
const resolveSellerId = async (rawSellerId) => {
  if (rawSellerId === undefined || rawSellerId === null || rawSellerId === '') return null;
  try {
    if (!isNaN(Number(rawSellerId))) {
      const byPk = await Seller.findByPk(Number(rawSellerId));
      if (byPk) return byPk.id;
    }
    const byUser = await Seller.findOne({ where: { idUser: String(rawSellerId) } });
    return byUser ? byUser.id : null;
  } catch (_) {
    return null;
  }
};

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

const sellerInclude = {
  model: Seller,
  required: false,
  include: [{ model: User, attributes: ['idUser', 'nombreApellido', 'role'] }]
};

export const createTask = async (req, res) => {
  try {
    const payload = buildTaskPayload(req.body);

    if (!payload.titulo || payload.titulo === 'Tarea sin título') {
      if (!req.body?.titulo && !req.body?.descripcion) {
        return res.status(400).json({ message: 'El título de la tarea es obligatorio' });
      }
    }

    payload.sellerId = await resolveSellerId(req.body?.sellerId);

    const newTask = await Task.create(payload);
    const fullTask = await Task.findByPk(newTask.id, { include: [sellerInclude] });

    return res.status(201).json({ message: 'Tarea creada con éxito', data: fullTask });
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear la tarea', error: error.message });
  }
};

export const getAllTasks = async (req, res) => {
  try {
    const { rol, destinatarioRol, sellerId, creadoPorRol } = req.query;
    const where = {};

    if (destinatarioRol) where.destinatarioRol = destinatarioRol;
    if (creadoPorRol) where.creadoPorRol = creadoPorRol;
    if (sellerId && !isNaN(Number(sellerId))) where.sellerId = Number(sellerId);

    const tasks = await Task.findAll({
      where,
      include: [sellerInclude],
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
    if (req.body?.sellerId !== undefined) {
      payload.sellerId = await resolveSellerId(req.body.sellerId);
    }

    await task.update(payload);
    const fullTask = await Task.findByPk(task.id, { include: [sellerInclude] });

    return res.json({ message: 'Tarea actualizada con éxito', data: fullTask });
  } catch (error) {
    return res.status(500).json({ message: 'Error al actualizar la tarea', error: error.message });
  }
};

export const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });

    await task.update({ estado });
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
