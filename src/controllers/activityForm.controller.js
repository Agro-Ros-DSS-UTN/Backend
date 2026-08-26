/* eslint-disable */
import formularioActividad from '../models/activityForm.js';
import { asyncHandler } from '../middlewares/asyncHandler.middleware.js';

// Creación de un formulario de actividad en MySQL
export const createFormularioActividad = asyncHandler(async (req, res) => {
  const {
    tipoContacto,
    descripcion,
    montoVenta,
    fechaHora,
    opportunityId,
    sellerId,
    archivoAdjunto,
    autorNombre
  } = req.body;

  const nuevaActividad = await formularioActividad.create({
    tipoContacto: tipoContacto || 'Visita',
    descripcion: descripcion || '',
    montoVenta: montoVenta ? Number(montoVenta) : 0,
    fechaHora: fechaHora || new Date(),
    opportunityId: (opportunityId && !isNaN(Number(opportunityId))) ? Number(opportunityId) : null,
    sellerId: (sellerId && !isNaN(Number(sellerId))) ? Number(sellerId) : 1,
    archivoAdjunto: typeof archivoAdjunto === 'object' ? JSON.stringify(archivoAdjunto) : (archivoAdjunto || null),
    autorNombre: autorNombre || 'Equipo AgroRos'
  });

  return res.status(201).json({
    message: "Formulario de actividad creado exitosamente",
    data: nuevaActividad,
    ...nuevaActividad.toJSON()
  });
});

// Obtener todos los formularios de actividad de MySQL
export const getAllFormulariosActividad = asyncHandler(async (req, res) => {
  const formularios = await formularioActividad.findAll({
    order: [['idFormulario', 'DESC']]
  });

  return res.status(200).json(formularios);
});

// Obtener un formulario de actividad por su ID
export const getFormularioActividadById = asyncHandler(async (req, res) => {
  const id = req.params.id || req.params.idFormulario;
  const actividad = await formularioActividad.findByPk(id);

  if (!actividad) {
    return res.status(404).json({
      message: "Formulario de actividad no encontrado"
    });
  }

  return res.status(200).json(actividad);
});

// Actualizar un formulario de actividad por su ID
export const updateFormularioActividadById = asyncHandler(async (req, res) => {
  const id = req.params.id || req.params.idFormulario;
  const {
    tipoContacto,
    descripcion,
    montoVenta,
    fechaHora,
    opportunityId,
    sellerId,
    archivoAdjunto,
    autorNombre
  } = req.body;

  const actividad = await formularioActividad.findByPk(id);

  if (!actividad) {
    return res.status(404).json({
      message: "Formulario de actividad no encontrado",
    });
  }

  await actividad.update({
    tipoContacto: tipoContacto ?? actividad.tipoContacto,
    descripcion: descripcion ?? actividad.descripcion,
    montoVenta: montoVenta !== undefined ? Number(montoVenta) : actividad.montoVenta,
    fechaHora: fechaHora ?? actividad.fechaHora,
    opportunityId: opportunityId !== undefined ? opportunityId : actividad.opportunityId,
    sellerId: sellerId !== undefined ? sellerId : actividad.sellerId,
    archivoAdjunto: archivoAdjunto !== undefined ? (typeof archivoAdjunto === 'object' ? JSON.stringify(archivoAdjunto) : archivoAdjunto) : actividad.archivoAdjunto,
    autorNombre: autorNombre ?? actividad.autorNombre
  });

  return res.status(200).json(actividad);
});

// Eliminar un formulario de actividad por su ID (Físico en MySQL)
export const deleteFormularioActividadById = asyncHandler(async (req, res) => {
  const id = req.params.id || req.params.idFormulario;
  const actividad = await formularioActividad.findByPk(id);

  if (!actividad) {
    return res.status(404).json({
      message: "Formulario de actividad no encontrado"
    });
  }

  await actividad.destroy();

  return res.status(200).json({
    message: "Formulario de actividad eliminado exitosamente",
    id: Number(id)
  });
});