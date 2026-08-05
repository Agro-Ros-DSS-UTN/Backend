/* eslint-disable */
import Opportunity from '../models/opportunity.model.js';
import ClientCompany from '../models/client_company.model.js';
import Objective from '../models/objective.model.js';
import Seller from '../models/seller.model.js';
import User from '../models/user.model.js';
import activityForm from '../models/activityForm.js';

// Creación de una Oportunidad
export const createOpportunity = async (req, res) => {
    try {
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

        if (!estado || !fechaInicio || !clientCompanyId || !sellerId) {
            return res.status(400).json({
                message: "El estado, fechaInicio, clientCompanyId y sellerId son campos obligatorios"
            });
        }

        // Validar que la EmpresaCliente exista
        const clientCompany = await ClientCompany.findByPk(clientCompanyId);
        if (!clientCompany) {
            return res.status(404).json({
                message: "La EmpresaCliente indicada no existe. No se puede crear la oportunidad."
            });
        }

        // Validar que el Vendedor exista
        const seller = await Seller.findByPk(sellerId);
        if (!seller) {
            return res.status(404).json({
                message: "El Vendedor indicado no existe. No se puede crear la oportunidad."
            });
        }

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

    } catch (error) {
        console.error("Error al crear la oportunidad:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};


// Obtener todas las oportunidades (con Eager Loading de EmpresaCliente y Objective)
export const getAllOpportunities = async (req, res) => {
    try {
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
    } catch (error) {
        console.error("Error al obtener las oportunidades:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};


// Obtener una oportunidad por su ID (con Eager Loading)
export const getOpportunityById = async (req, res) => {
    try {
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

    } catch (error) {
        console.error("Error al obtener la oportunidad:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};


// Actualizar una oportunidad por su ID
export const updateOpportunityById = async (req, res) => {
    try {
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

        // Si se quiere cambiar la empresa cliente, validar que exista
        if (clientCompanyId) {
            const clientCompany = await ClientCompany.findByPk(clientCompanyId);
            if (!clientCompany) {
                return res.status(404).json({
                    message: "La EmpresaCliente indicada no existe."
                });
            }
        }

        // Si se quiere cambiar el vendedor, validar que exista
        if (sellerId) {
            const seller = await Seller.findByPk(sellerId);
            if (!seller) {
                return res.status(404).json({
                    message: "El Vendedor indicado no existe."
                });
            }
        }

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

    } catch (error) {
        console.error("Error al actualizar la oportunidad:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};


// Eliminar una oportunidad por su ID
export const deleteOpportunityById = async (req, res) => {
    try {
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

    } catch (error) {
        console.error("Error al eliminar la oportunidad:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};
