/* eslint-disable */
import formularioActividad from '../models/activityForm.js';
import Seller from '../models/seller.model.js';
import { asyncHandler } from '../middlewares/asyncHandler.middleware.js';

// Resuelve el id real de `sellers` (id numérico o idUser del vendedor). null si no existe,
// para no violar la FK formularios_actividad.seller_id -> sellers.id
const resolveSellerId = async (rawId) => {
  if (rawId === undefined || rawId === null || rawId === '') return null;
  try {
    if (!isNaN(Number(rawId))) {
      const byPk = await Seller.findByPk(Number(rawId));
      if (byPk) return byPk.id;
    }
    const byUser = await Seller.findOne({ where: { idUser: String(rawId) } });
    return byUser ? byUser.id : null;
  } catch (_) {
    return null;
  }
};

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
    autorNombre,
    empresa
  } = req.body;

  const nuevaActividad = await formularioActividad.create({
    tipoContacto: tipoContacto || 'Visita',
    descripcion: descripcion || '',
    montoVenta: montoVenta ? Number(montoVenta) : 0,
    fechaHora: fechaHora || new Date(),
    empresa: empresa || null,
    opportunityId: (opportunityId && !isNaN(Number(opportunityId))) ? Number(opportunityId) : null,
    sellerId: await resolveSellerId(sellerId),
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
    autorNombre,
    empresa
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
    empresa: empresa !== undefined ? empresa : actividad.empresa,
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