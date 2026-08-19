/* eslint-disable */
import Roadmap from '../models/roadmap.model.js';

export const createRoadmap = async (req, res) => {
  try {
    const { descripcion, fechaRuta, sellerId, estado } = req.body;
    if (!descripcion || !fechaRuta || !sellerId) {
      return res.status(400).json({ message: 'Descripción, fecha de ruta y ID de vendedor son obligatorios' });
    }

    const newRoadmap = await Roadmap.create({
      descripcion,
      fechaRuta,
      sellerId,
      estado: estado || 'planificada'
    });

    return res.status(201).json({ message: 'Hoja de ruta creada con éxito', data: newRoadmap });
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear hoja de ruta', error: error.message });
  }
};

export const getRoadmapsBySeller = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const roadmaps = await Roadmap.findAll({ where: { sellerId } });
    return res.json({ data: roadmaps });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener hojas de ruta', error: error.message });
  }
};

export const getAllRoadmaps = async (req, res) => {
  try {
    const roadmaps = await Roadmap.findAll();
    return res.json({ data: roadmaps });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener hojas de ruta', error: error.message });
  }
};
