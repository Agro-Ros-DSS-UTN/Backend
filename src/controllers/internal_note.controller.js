/* eslint-disable */
import InternalNote from '../models/internal_note.model.js';

export const createInternalNote = async (req, res) => {
  try {
    const { descripcion, categoria, idUser } = req.body;
    if (!descripcion || !idUser) {
      return res.status(400).json({ message: 'Descripción y ID de usuario son obligatorios' });
    }

    const note = await InternalNote.create({
      descripcion,
      categoria: categoria || 'general',
      idUser
    });

    return res.status(201).json({ message: 'Nota interna creada con éxito', data: note });
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear nota', error: error.message });
  }
};

export const getAllInternalNotes = async (req, res) => {
  try {
    const notes = await InternalNote.findAll({ order: [['fechaNota', 'DESC']] });
    return res.json({ data: notes });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener notas', error: error.message });
  }
};
