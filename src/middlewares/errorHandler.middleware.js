import { env } from '../config/env.js';
import { AppError } from '../utils/http.js';

// Manejo centralizado de errores: el cliente recibe un mensaje claro en
// español; el detalle técnico (SQL, stack) queda solo en el log del servidor.
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message, code: err.code, fields: err.fields, ...(err.existente ? { existente: err.existente } : {}) });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'El contenido enviado es demasiado grande', code: 'PAYLOAD_TOO_LARGE' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'El cuerpo del pedido no es un JSON válido', code: 'BAD_JSON' });
  }

  switch (err.name) {
    case 'SequelizeValidationError':
      return res.status(400).json({
        message: 'Hay datos inválidos',
        code: 'VALIDATION',
        fields: Object.fromEntries((err.errors || []).map((e) => [e.path, e.validatorKey || e.message])),
      });
    case 'SequelizeUniqueConstraintError':
      return res.status(409).json({ message: 'Ya existe un registro con esos datos', code: 'DUPLICATE', fields: Object.fromEntries((err.errors || []).map((e) => [e.path, 'duplicado'])) });
    case 'SequelizeForeignKeyConstraintError': {
      const borrando = req.method === 'DELETE';
      return res.status(409).json({
        message: borrando
          ? 'No se puede eliminar porque tiene registros asociados. Podés darlo de baja en su lugar.'
          : 'Alguna referencia indicada no existe',
        code: 'FOREIGN_KEY',
      });
    }
    default:
      break;
  }

  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  return res.status(500).json({
    message: 'Hubo un error interno en el servidor',
    code: 'INTERNAL',
    ...(env.isProd ? {} : { detail: err.message }),
  });
};

export const notFoundHandler = (req, res) => res.status(404).json({ message: `La ruta ${req.method} ${req.path} no existe`, code: 'NOT_FOUND' });
