/* eslint-disable */
// Validaciones para el recurso Producto

// Usado en: POST /productos (createProduct)
export const validateCreateProduct = (req, res, next) => {
  const { nombre, tipoProducto } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({
      message: 'El nombre del producto es obligatorio'
    });
  }

  if (!tipoProducto || !tipoProducto.trim()) {
    return res.status(400).json({
      message: 'El tipo / categoría del producto es obligatorio'
    });
  }

  next();
};
