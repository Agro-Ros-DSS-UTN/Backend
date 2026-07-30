/* eslint-disable */
import Opportunity from '../models/opportunity.model.js';
import ClientCompany from '../models/client_company.model.js';
import Objective from '../models/objective.model.js';

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
            clientCompanyId 
        } = req.body;

        if (!estado || !fechaInicio || !clientCompanyId) {
            return res.status(400).json({
                message: "El estado, fechaInicio y clientCompanyId son campos obligatorios"
            });
        }

        // Validar que la EmpresaCliente exista
        const clientCompany = await ClientCompany.findByPk(clientCompanyId);
        if (!clientCompany) {
            return res.status(404).json({
                message: "La EmpresaCliente indicada no existe. No se puede crear la oportunidad."
            });
        }

        const newOpportunity = await Opportunity.create({
            estado,
            potencialidadCliente,
            volumenPotencial,
            volumenFacturado,
            fechaInicio,
            fechaUltimaActualizacion,
            clientCompanyId
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
        const opportunities = await Opportunity.findAll({
            include: [
                { model: ClientCompany },
                { model: Objective, through: { attributes: [] } } // Evita traer datos de la tabla intermedia si no son necesarios
            ]
        });

        return res.status(200).json({
            message: "Oportunidades obtenidas exitosamente",
            data: opportunities
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
                { model: Objective, through: { attributes: [] } }
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
            clientCompanyId 
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

        await opportunity.update({
            estado,
            potencialidadCliente,
            volumenPotencial,
            volumenFacturado,
            fechaInicio,
            fechaUltimaActualizacion,
            clientCompanyId
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
