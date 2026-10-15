// Utilidades HTTP comunes a todos los controladores.

export class AppError extends Error {
  constructor(status, message, { code, fields } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const badRequest = (message, fields) => new AppError(400, message, { code: 'VALIDATION', fields });
export const forbidden = (message = 'No tenés permisos para realizar esta acción') => new AppError(403, message, { code: 'FORBIDDEN_ACTION' });
export const notFound = (what = 'Recurso') => new AppError(404, `${what} no encontrado`, { code: 'NOT_FOUND' });
export const conflict = (message, extra = {}) => Object.assign(new AppError(409, message, { code: 'CONFLICT' }), extra);

// Envuelve un controlador async y deriva cualquier error al errorHandler.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Copia solo los campos permitidos (evita asignación masiva desde req.body).
export const pick = (obj, keys) => {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
};

export const toInt = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};

export const idParam = (req, name = 'id') => {
  const n = toInt(req.params[name]);
  if (!n || Number.isNaN(n) || n < 1) throw badRequest(`El parámetro ${name} no es válido`);
  return n;
};

export const ok = (res, data, extra = {}) => res.json({ data, ...extra });
export const created = (res, data, message) => res.status(201).json({ message, data });
