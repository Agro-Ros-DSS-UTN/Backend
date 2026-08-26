/* eslint-disable */
import Opportunity from '../models/opportunity.model.js';
import ClientCompany from '../models/clientCompany.model.js';
import Objective from '../models/objective.model.js';
import Seller from '../models/seller.model.js';
import User from '../models/user.model.js';
import activityForm from '../models/activityForm.js';
import { asyncHandler } from '../middlewares/asyncHandler.middleware.js';

// Creación de una Oportunidad
export const createOpportunity = asyncHandler(async (req, res) => {
    const {
        estado,
        potencialidadCliente,
        volumenPotencial,
        volumenFacturado,
        fechaInicio,
        fechaUltimaActualizacion,
        clientCompanyId,
        sellerId
    } = req.body;

    // La validación de campos obligatorios y de existencia de
    // EmpresaCliente/Vendedor ya la hace validateCreateOpportunity (middleware)

    const newOpportunity = await Opportunity.create({
        estado,
        potencialidadCliente,
        volumenPotencial,
        volumenFacturado,
        fechaInicio,
        fechaUltimaActualizacion,
        clientCompanyId,
        sellerId
    });

    return res.status(201).json({
        message: "Oportunidad creada exitosamente",
        data: newOpportunity
    });
});


// Obtener todas las oportunidades (con Eager Loading de EmpresaCliente y Objective)
export const getAllOpportunities = asyncHandler(async (req, res) => {
    const { estado, page = 1, limit = 10 } = req.query;

    const whereClause = {};
    if (estado) {
        whereClause.estado = estado;
    }

    const offset = (page - 1) * limit;

    const opportunities = await Opportunity.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        attributes: ['id', 'estado', 'volumenPotencial'],
        include: [
            { model: ClientCompany, attributes: ['id', 'nombreEmpresa', 'descEmpresa'] },
            {
                model: Seller,
                attributes: ['id'],
                include: [{ model: User, attributes: ['nombreApellido'] }]
            }
        ]
    });

    return res.status(200).json({
        message: "Oportunidades obtenidas exitosamente",
        count: opportunities.count,
        totalPages: Math.ceil(opportunities.count / limit),
        currentPage: parseInt(page),
        data: opportunities.rows
    });
});


// Obtener una oportunidad por su ID (con Eager Loading)
export const getOpportunityById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const opportunity = await Opportunity.findByPk(id, {
        include: [
            { model: ClientCompany },
            { model: Objective, through: { attributes: [] } },
            {
                model: Seller,
                include: [{ model: User }]
            },
            { model: activityForm }
        ]
    });

    if (!opportunity) {
        return res.status(404).json({
            message: "Oportunidad no encontrada"
        });
    }

    return res.status(200).json({
        message: "Oportunidad obtenida con éxito",
        data: opportunity
    });
});


// Actualizar una oportunidad por su ID
export const updateOpportunityById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        estado,
        potencialidadCliente,
        volumenPotencial,
        volumenFacturado,
        fechaInicio,
        fechaUltimaActualizacion,
        clientCompanyId,
        sellerId
    } = req.body;

    const opportunity = await Opportunity.findByPk(id);

    if (!opportunity) {
        return res.status(404).json({
            message: "Oportunidad no encontrada",
        });
    }

    // La validación de EmpresaCliente/Vendedor (si se envían) ya la
    // hace validateUpdateOpportunity (middleware)
    await opportunity.update({
        estado,
        potencialidadCliente,
        volumenPotencial,
        volumenFacturado,
        fechaInicio,
        fechaUltimaActualizacion,
        clientCompanyId,
        sellerId
    });

    return res.status(200).json({
        message: "Oportunidad actualizada exitosamente",
        data: opportunity
    });
});


// Eliminar una oportunidad por su ID
export const deleteOpportunityById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const opportunity = await Opportunity.findByPk(id);

    if (!opportunity) {
        return res.status(404).json({
            message: "Oportunidad no encontrada"
        });
    }

    await opportunity.destroy();

    return res.status(200).json({
        message: "Oportunidad eliminada exitosamente"
    });
});
