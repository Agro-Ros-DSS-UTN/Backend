/* eslint-disable */
// Validaciones extraídas de locality.controller.js

// Usado en: POST /localities (createLocality)
export const validateCreateLocality = (req, res, next) => {
  const { codPostal, nomLocalidad } = req.body;

  if (!codPostal || !nomLocalidad) {
    return res.status(400).json({
      message: 'El codigo postal y el nombre de la localidad son obligatorios'
    });
  }

  next();
};
