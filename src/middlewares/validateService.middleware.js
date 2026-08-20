/* eslint-disable */
// Validaciones extraídas de service.controller.js

// Usado en: POST /services (createService)
export const validateCreateService = (req, res, next) => {
  const { tipoServicio, formularioActividadId } = req.body;

  if (!tipoServicio || !formularioActividadId) {
    return res.status(400).json({
      message: 'El tipo de servicio y el formulario de actividad son obligatorios'
    });
  }

  next();
};
