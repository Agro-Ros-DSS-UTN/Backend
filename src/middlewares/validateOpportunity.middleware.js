/* eslint-disable */
import ClientCompany from '../models/clientCompany.model.js';

// Usado en: POST /opportunities (createOpportunity)
export const validateCreateOpportunity = async (req, res, next) => {
  try {
    const { nombreNegocio, estado } = req.body;

    if (!nombreNegocio && !estado) {
      return res.status(400).json({
        message: 'El nombre del negocio es obligatorio'
      });
    }

    if (!req.body.fechaCierre) {
      return res.status(400).json({ message: 'La fecha de cierre es obligatoria' });
    }

    // La empresa y el vendedor son opcionales; el controlador resuelve/omite
    // los ids que no existan para no romper las FK.
    next();
  } catch (error) {
    console.error('Error al validar la oportunidad:', error);
    return res.status(500).json({
      message: 'Hubo un error interno en el servidor',
      error: error.message
    });
  }
};

// Usado en: PUT /opportunities/:id (updateOpportunityById)
// Solo valida EmpresaCliente/Vendedor si el usuario intenta cambiarlos
export const validateUpdateOpportunity = async (req, res, next) => {
  try {
    const { clientCompanyId } = req.body;

    if (clientCompanyId) {
      const clientCompany = await ClientCompany.findByPk(clientCompanyId);
      if (!clientCompany) {
        return res.status(404).json({
          message: 'La EmpresaCliente indicada no existe.'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Error al validar la actualización de la oportunidad:', error);
    return res.status(500).json({
      message: 'Hubo un error interno en el servidor',
      error: error.message
    });
  }
};
