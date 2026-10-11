import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Usuario } from '../models/index.js';
import { AppError, forbidden } from '../utils/http.js';

// Rol canónico: la base guarda "administrador" | "vendedor"; en código se usa
// "admin" | "vendedor" para no repetir comparaciones con variantes.
export const normalizeRole = (rol) => {
  const r = String(rol || '').trim().toLowerCase();
  if (['admin', 'administrador', 'administracion', 'administración'].includes(r)) return 'admin';
  if (r === 'vendedor') return 'vendedor';
  return 'desconocido';
};

export const generateToken = (usuario, { long = false } = {}) =>
  jwt.sign(
    { sub: usuario.idUser, role: normalizeRole(usuario.rol), tv: usuario.tokenVersion || 0 },
    env.jwt.secret,
    { algorithm: 'HS256', expiresIn: long ? env.jwt.longExpiresIn : env.jwt.expiresIn, issuer: env.jwt.issuer, audience: env.jwt.audience }
  );

// Caché corta de usuarios para no consultar la base en cada request, pero
// reflejar en segundos una baja, un cambio de rol o de contraseña.
const cache = new Map();
const TTL_MS = 30 * 1000;
export const invalidateUserCache = (idUser) => cache.delete(String(idUser));

const loadUser = async (idUser) => {
  const hit = cache.get(idUser);
  if (hit && hit.expires > Date.now()) return hit.user;
  const u = await Usuario.scope('auth').findByPk(idUser, { attributes: ['idUser', 'nombreApellido', 'rol', 'estadoCuenta', 'tokenVersion'] });
  const user = u ? { idUser: u.idUser, nombreApellido: u.nombreApellido, role: normalizeRole(u.rol), activo: u.estadoCuenta === 'Activo', tokenVersion: u.tokenVersion } : null;
  cache.set(idUser, { user, expires: Date.now() + TTL_MS });
  return user;
};

const unauthorized = (message) => new AppError(401, message, { code: 'UNAUTHORIZED' });

// Exige "Authorization: Bearer <token>" válido, de un usuario existente y activo,
// y con la versión de token vigente (se invalida al cambiar contraseña, rol o estado).
export const verifyToken = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) throw unauthorized('No se proporcionó un token de autenticación');
    let payload;
    try {
      payload = jwt.verify(header.slice(7), env.jwt.secret, { algorithms: ['HS256'], issuer: env.jwt.issuer, audience: env.jwt.audience });
    } catch (err) {
      throw unauthorized(err.name === 'TokenExpiredError' ? 'La sesión expiró, iniciá sesión nuevamente' : 'Token inválido');
    }
    const user = await loadUser(String(payload.sub));
    if (!user) throw unauthorized('El usuario ya no existe');
    if (!user.activo) throw unauthorized('La cuenta está desactivada');
    if ((payload.tv || 0) !== (user.tokenVersion || 0)) throw unauthorized('La sesión fue cerrada por un cambio de credenciales');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

// Rutas que no requieren sesión. Todo lo demás pasa por verifyToken.
const PUBLIC = [
  ['POST', /^\/(auth|users)\/login\/?$/],
  ['GET', /^\/api\/health\/?$/],
];

export const authenticateAll = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  if (PUBLIC.some(([m, re]) => m === req.method && re.test(req.path))) return next();
  return verifyToken(req, res, next);
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(forbidden());
  next();
};

export const requireAdmin = requireRole('admin');
export const isAdmin = (req) => req.user?.role === 'admin';
