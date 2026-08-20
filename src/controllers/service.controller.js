/* eslint-disable */
import Service from '../models/service.model.js';
import { asyncHandler } from '../middlewares/asyncHandler.middleware.js';

// Cracion de un servicio
export const createService = asyncHandler(async (req, res) => {
    const { tipoServicio, desc, formularioActividadId, id } = req.body;

    // La validación de campos obligatorios ya la hace
    // validateCreateService (middleware)
    const newService = await Service.create({
        tipoServicio,
        desc,
        formularioActividadId
    });

    return res.status(201).json({
        message: "Servicio creado exitosamente",
        data: newService
    });
});

// Obtener todos los servicios
export const getAllServices = asyncHandler(async (req, res) => {
    const services = await Service.findAll();

    return res.status(200).json({
        message: "Servicios obtenidos exitosamente",
        data: services
    });
});

// Obtener un servicio por su ID
export const getServiceById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const service = await Service.findByPk(id);

    if (!service) {
        return res.status(404).json({
            message: "Servicio no encontrado"
        });
    }

    return res.status(200).json({
        message: "Servicio obtenido exitosamente",
        data: service
    });
});

// Actualizar un servicio por su ID
export const updateServiceById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { tipoServicio, desc, formularioActividadId } = req.body;

    const service = await Service.findByPk(id);

    if (!service) {
        return res.status(404).json({
            message: "Servicio no encontrado"
        });
    }
    await service.update({
        tipoServicio,
        desc,
        formularioActividadId
    });

    return res.status(200).json({
        message: "Servicio actualizado exitosamente",
        data: service
    });
});

// Eliminar un servicio por su ID
export const deleteServiceById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const service = await Service.findByPk(id);
    if (!service) {
        return res.status(404).json({
            message: "Servicio no encontrado"
        });
    }
    await service.destroy();

    return res.status(200).json({
        message: "Servicio eliminado exitosamente"
    });
});
