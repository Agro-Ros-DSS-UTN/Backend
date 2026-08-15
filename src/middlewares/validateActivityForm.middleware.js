/* eslint-disable */
// Validaciones extraídas de activity_form.controller.js

// Usado en: POST /formulario-actividad (createFormularioActividad)
export const validateCreateActivityForm = (req, res, next) => {
  const { tipoContacto, fechaHora, opportunityId } = req.body;

  if (!tipoContacto || !fechaHora || !opportunityId) {
    return res.status(400).json({
      message: 'El tipo de contacto, fecha/hora y opportunityId son obligatorios'
    });
  }

  next();
};
