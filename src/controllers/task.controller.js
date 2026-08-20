/* eslint-disable */
import Task from '../models/task.model.js';

export const createTask = async (req, res) => {
  try {
    const { descripcion, fechaVencimiento, destinatarioRol, estado, sellerId, formularioActividadId } = req.body;
    
    if (!descripcion) {
      return res.status(400).json({ message: 'La descripción de la tarea es obligatoria' });
    }

    const newTask = await Task.create({
      descripcion,
      fechaVencimiento,
      destinatarioRol: destinatarioRol || 'vendedor',
      estado: estado || 'pendiente',
      sellerId,
      formularioActividadId
    });

    return res.status(201).json({ message: 'Tarea creada con éxito', data: newTask });
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear la tarea', error: error.message });
  }
};

export const getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.findAll();
    return res.json({ data: tasks });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener tareas', error: error.message });
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
