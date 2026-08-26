/* eslint-disable */
// Validaciones para formularios de actividad
export const validateCreateActivityForm = (req, res, next) => {
  const { tipoContacto, descripcion } = req.body;

  if (!tipoContacto && !descripcion) {
    return res.status(400).json({
      message: 'El tipo de contacto o la descripción de la actividad es obligatoria'
    });
  }

  next();
};