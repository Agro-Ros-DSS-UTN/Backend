/* eslint-disable */
// Middleware centralizado de manejo de errores.
// Debe registrarse en server.js DESPUÉS de todas las rutas (app.use(errorHandler) al final),
// porque Express solo lo invoca cuando algo llama a next(error) o un controller
// envuelto en asyncHandler rechaza una promesa.
export const errorHandler = (err, req, res, next) => {
  console.error('Error no controlado:', err);

  const statusCode = err.statusCode || 500;

  return res.status(statusCode).json({
    message: statusCode === 500 ? 'Hubo un error interno en el servidor' : err.message,
    error: err.message
  });
};

// Middleware para rutas que no existen (404). Se registra ANTES del errorHandler
// pero DESPUÉS de todas las rutas.
export const notFoundHandler = (req, res, next) => {
  return res.status(404).json({
    message: `La ruta ${req.method} ${req.originalUrl} no existe`
  });
};
