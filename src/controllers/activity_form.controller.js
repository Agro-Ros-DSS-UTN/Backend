/* eslint-disable */
import formularioActividad from '../models/activityForm.js';
import { asyncHandler } from '../middlewares/asyncHandler.middleware.js';

// Creacion de un formulario de actividad
export const createFormularioActividad = asyncHandler(async (req, res) => {
    const { tipoContacto, descripcion, montoVenta, fechaHora, opportunityId } = req.body;

    // La validación de campos obligatorios ya la hace
    // validateCreateActivityForm (middleware)

    const nuevaActividad = await formularioActividad.create({
        tipoContacto,
        descripcion,
        montoVenta,
        fechaHora,
        opportunityId
    });

    return res.status(201).json({
        message: "Formulario de actividad creado exitosamente",
        data: nuevaActividad
    });
});


// Obtener todos los formularios de actividad
export const getAllFormulariosActividad = asyncHandler(async (req, res) => {
    const formularios = await formularioActividad.findAll();

    return res.status(200).json({
        message: "Formularios de actividad obtenidos exitosamente",
        data: formularios
    });
});


// Obtener un formulario de actividad por su ID
export const getFormularioActividadById = asyncHandler(async (req, res) => {
    const { idFormulario } = req.params;
    const actividad = await formularioActividad.findByPk(idFormulario);

    if (!actividad) {
        return res.status(404).json({
            message: "Formulario de actividad no encontrado"
        });
    }

    return res.status(200).json({
        message: "Formulario de actividad obtenido con exito",
        data: actividad
    });
});


// Actualizar un formulario de actividad por su ID
export const updateFormularioActividadById = asyncHandler(async (req, res) => {
    const { idFormulario } = req.params;
    const { tipoContacto, descripcion, montoVenta, fechaHora, opportunityId } = req.body;

    const actividad = await formularioActividad.findByPk(idFormulario);

    if (!actividad) {
        return res.status(404).json({
            message: "Formulario de actividad no encontrado",
        });
    }

    await actividad.update({
        tipoContacto,
        descripcion,
        montoVenta,
        fechaHora,
        opportunityId
    });

    return res.status(200).json({
        message: "Formulario de actividad actualizado exitosamente",
        data: actividad
    });
});


// Eliminar un formulario de actividad por su ID
export const deleteFormularioActividadById = asyncHandler(async (req, res) => {
    const { idFormulario } = req.params;
    const actividad = await formularioActividad.findByPk(idFormulario);

    if (!actividad) {
        return res.status(404).json({
            message: "Formulario de actividad no encontrado"
        });
    }

    await actividad.destroy();

    return res.status(200).json({
        message: "Formulario de actividad eliminado exitosamente"
    });
});
