/* eslint-disable */
// Validaciones extraídas de productLine.controller.js

// Usado en: POST /productLines (createLineaProd)
export const validateCreateProductLine = (req, res, next) => {
  const { lineaProducto } = req.body;

  if (!lineaProducto) {
    return res.status(400).json({
      message: 'El nombre de la linea de producto es obligatorio'
    });
  }

  next();
};
