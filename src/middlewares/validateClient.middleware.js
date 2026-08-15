/* eslint-disable */
import Locality from '../models/locality.model.js';

// Usado en: POST /clients (createClient)
export const validateCreateClient = async (req, res, next) => {
  try {
    const { numDoc, nombreApellido, tipoClient, codigoPostal } = req.body;

    if (!numDoc || !nombreApellido || !tipoClient || !codigoPostal) {
      return res.status(400).json({
        message: 'El numero de documento, nombre y apellido, tipo cliente y codigo postal son obligatorios'
      });
    }

    // El cliente depende de que la localidad exista
    const locality = await Locality.findByPk(codigoPostal);
    if (!locality) {
      return res.status(404).json({
        message: 'La localidad indicada no existe. Cree la localidad antes de asignarla a un cliente.'
      });
    }

    next();
  } catch (error) {
    console.error('Error al validar el cliente:', error);
    return res.status(500).json({
      message: 'Hubo un error interno en el servidor',
      error: error.message
    });
  }
};

// Usado en: PUT /clients/:numDoc (updateClientById)
// Solo valida la localidad si el usuario intenta cambiarla
export const validateUpdateClient = async (req, res, next) => {
  try {
    const { codigoPostal } = req.body;

    if (codigoPostal) {
      const locality = await Locality.findByPk(codigoPostal);
      if (!locality) {
        return res.status(404).json({
          message: 'La localidad indicada no existe.'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Error al validar la actualización del cliente:', error);
    return res.status(500).json({
      message: 'Hubo un error interno en el servidor',
      error: error.message
    });
  }
};
