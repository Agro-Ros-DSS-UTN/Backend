import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { User, Locality, Province, sequelize } from '../models/index.js';
import { USER_ROLES, ACCOUNT_STATUSES } from '../models/user.model.js';
import { generateToken, invalidateUserCache, isAdmin, normalizeRole } from '../middlewares/auth.middleware.js';
import { AppError, asyncHandler, badRequest, conflict, forbidden, notFound, pick } from '../utils/http.js';
import { dataUrl, parseDate, required, text } from '../utils/validation.js';

const SALT_ROUNDS = 12;
// Hash fijo para comparar aunque el usuario no exista: misma demora en ambos casos.
const DUMMY_HASH = bcrypt.hashSync('usuario-inexistente', SALT_ROUNDS);

const roleDb = (role) => (normalizeRole(role) === 'admin' ? 'administrador' : normalizeRole(role) === 'vendedor' ? 'vendedor' : null);

// Regla única (P-6), la misma que muestran Usuarios y Mi perfil: entre 8 y 64
// caracteres, con al menos una mayúscula, un número y un símbolo.
export const PASSWORD_RULE = 'entre 8 y 64 caracteres, con al menos una mayúscula, un número y un símbolo';
export const validatePassword = (pw) => {
  const s = String(pw || '');
  const ok = s.length >= 8 && s.length <= 64 && /[A-Z]/.test(s) && /\d/.test(s) && /[^A-Za-z0-9]/.test(s);
  if (!ok) throw badRequest(`La contraseña debe tener ${PASSWORD_RULE}`, { password: 'weak' });
  return s;
};

// Respuesta pública de un usuario.
export const serializeUser = (u) => {
  if (!u) return null;
  const j = typeof u.toJSON === 'function' ? u.toJSON() : u;
  return {
    idUser: j.idUser,
    fullName: j.fullName,
    email: j.email ?? null,
    phone: j.phone ?? null,
    role: j.role,
    accountStatus: j.accountStatus,
    hireDate: j.hireDate ?? null,
    seniority: j.seniority ?? null,
    lastLoginAt: j.lastLoginAt ?? null,
    zone: Array.isArray(j.zone) ? j.zone.map((l) => ({ id: l.id, name: l.name, province: l.province?.name ?? null })) : undefined,
    ...(j.profileImage !== undefined ? { profileImage: j.profileImage } : {}),
  };
};

// ── Autenticación ──

export const login = asyncHandler(async (req, res) => {
  const idUser = String(req.body?.idUser || req.body?.id || '').trim();
  const password = String(req.body?.password || '');
  if (!idUser || !password) throw badRequest('Ingresá usuario y contraseña');

  const user = await User.scope('auth').findByPk(idUser);
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  // Mismo mensaje para usuario inexistente o contraseña incorrecta (no revela qué usuarios existen).
  if (!user || !ok) throw new AppError(401, 'Usuario o contraseña incorrectos', { code: 'INVALID_CREDENTIALS' });
  if (user.accountStatus !== 'Activo') throw new AppError(403, 'La cuenta está desactivada. Contactá a la administración.', { code: 'ACCOUNT_DISABLED' });

  // Migración transparente de hashes con costo menor al actual.
  if (Number(user.passwordHash.split('$')[2]) < SALT_ROUNDS) {
    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  }
  user.lastLoginAt = new Date();
  await user.save({ fields: ['passwordHash', 'lastLoginAt'] });

  const long = req.body?.rememberMe === true;
  const full = await User.scope('withImage').findByPk(idUser);
  return res.json({
    message: 'Inicio de sesión exitoso',
    token: generateToken(user, { long }),
    user: { ...serializeUser(full), id: user.idUser },
  });
});

export const me = asyncHandler(async (req, res) => {
  const u = await User.scope('withImage').findByPk(req.user.idUser, {
    include: [{ model: Locality, as: 'zone', through: { attributes: [] }, include: [{ model: Province, as: 'province' }] }],
  });
  if (!u) throw notFound('Usuario');
  res.json({ data: serializeUser(u) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  required({ currentPassword, newPassword }, ['currentPassword', 'newPassword']);
  validatePassword(newPassword);
  const user = await User.scope('auth').findByPk(req.user.idUser);
  if (!(await bcrypt.compare(String(currentPassword), user.passwordHash))) {
    throw badRequest('La contraseña actual no es correcta', { currentPassword: 'incorrect' });
  }
  user.passwordHash = await bcrypt.hash(String(newPassword), SALT_ROUNDS);
  user.tokenVersion += 1; // cierra las sesiones abiertas en otros dispositivos
  await user.save();
  invalidateUserCache(user.idUser);
  res.json({ message: 'Contraseña actualizada', token: generateToken(user) });
});

// ── ABM de usuarios ──

export const list = asyncHandler(async (req, res) => {
  // El vendedor necesita la lista para asignar tareas: solo ve datos mínimos de usuarios activos.
  if (!isAdmin(req)) {
    const users = await User.findAll({ where: { accountStatus: 'Activo' }, attributes: ['idUser', 'fullName', 'role'], order: [['fullName', 'ASC']] });
    return res.json({ data: users.map(serializeUser) });
  }
  const users = await User.findAll({
    include: [{ model: Locality, as: 'zone', through: { attributes: [] }, include: [{ model: Province, as: 'province' }] }],
    order: [['fullName', 'ASC']],
  });
  res.json({ data: users.map(serializeUser) });
});

export const get = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  if (!isAdmin(req) && idUser !== req.user.idUser) throw forbidden();
  const u = await User.findByPk(idUser, {
    include: [{ model: Locality, as: 'zone', through: { attributes: [] }, include: [{ model: Province, as: 'province' }] }],
  });
  if (!u) throw notFound('Usuario');
  res.json({ data: serializeUser(u) });
});

const userData = (body) => {
  const out = pick(body, ['fullName', 'email', 'phone', 'role', 'accountStatus', 'hireDate']);
  if (out.fullName !== undefined) out.fullName = text(out.fullName, 'fullName', 150);
  if (out.email !== undefined) out.email = text(out.email, 'email', 150);
  if (out.phone !== undefined) out.phone = text(out.phone, 'phone', 30);
  if (out.hireDate !== undefined) out.hireDate = parseDate(out.hireDate, 'hireDate');
  if (out.role !== undefined) {
    out.role = roleDb(out.role);
    if (!out.role) throw badRequest(`El rol debe ser uno de: ${USER_ROLES.join(', ')}`, { role: 'invalid' });
  }
  if (out.accountStatus !== undefined) {
    const e = String(out.accountStatus).toLowerCase().startsWith('inact') ? 'Inactivo' : 'Activo';
    out.accountStatus = ACCOUNT_STATUSES.includes(e) ? e : 'Activo';
  }
  return out;
};

export const create = asyncHandler(async (req, res) => {
  const idUser = String(req.body?.idUser || '').trim();
  required({ ...req.body, idUser }, ['idUser', 'fullName', 'password']);
  if (!/^[A-Za-z0-9._-]{3,20}$/.test(idUser)) throw badRequest('El ID de usuario debe tener 3 a 20 caracteres: letras, números, punto, guion o guion bajo', { idUser: 'format' });
  validatePassword(req.body.password);
  if (await User.findByPk(idUser)) throw conflict(`Ya existe un usuario con el ID "${idUser}"`);
  const data = userData(req.body);
  const u = await User.create({ ...data, idUser, role: data.role || 'vendedor', accountStatus: data.accountStatus || 'Activo', passwordHash: await bcrypt.hash(String(req.body.password), SALT_ROUNDS) });
  res.status(201).json({ message: 'Usuario creado', data: serializeUser(u) });
});

export const update = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  const own = idUser === req.user.idUser;
  if (!isAdmin(req) && !own) throw forbidden();
  const u = await User.scope('auth').findByPk(idUser);
  if (!u) throw notFound('Usuario');

  const data = userData(req.body || {});
  if (!isAdmin(req)) {
    // El usuario común solo edita sus datos de contacto.
    delete data.role;
    delete data.accountStatus;
    delete data.hireDate;
  }
  if (own && data.accountStatus === 'Inactivo') throw badRequest('No podés desactivar tu propia cuenta');
  if (own && data.role && data.role !== u.role) throw badRequest('No podés cambiar tu propio rol');

  let invalidate = (data.role && data.role !== u.role) || (data.accountStatus && data.accountStatus !== u.accountStatus);
  if (req.body?.password) {
    validatePassword(req.body.password);
    if (!isAdmin(req) || own) {
      // Para la propia contraseña se exige la actual.
      if (!req.body.currentPassword || !(await bcrypt.compare(String(req.body.currentPassword), u.passwordHash))) {
        throw badRequest('Para cambiar tu contraseña ingresá la contraseña actual', { currentPassword: 'required' });
      }
    } else {
      // La administración confirma con su propia contraseña antes de cambiar la de otro usuario.
      const admin = await User.scope('auth').findByPk(req.user.idUser);
      if (!req.body.adminPassword || !(await bcrypt.compare(String(req.body.adminPassword), admin.passwordHash))) {
        throw badRequest('Confirmá el cambio con tu contraseña de administrador', { adminPassword: 'incorrect' });
      }
    }
    u.passwordHash = await bcrypt.hash(String(req.body.password), SALT_ROUNDS);
    invalidate = true;
  }
  Object.assign(u, data);
  if (invalidate) u.tokenVersion += 1;
  await u.save();
  invalidateUserCache(idUser);
  const fresh = await User.findByPk(idUser);
  res.json({ message: 'Usuario actualizado', data: serializeUser(fresh), ...(own && invalidate ? { token: generateToken(u) } : {}) });
});

export const remove = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  if (idUser === req.user.idUser) throw badRequest('No podés eliminar tu propia cuenta');
  const u = await User.findByPk(idUser);
  if (!u) throw notFound('Usuario');
  try {
    await u.destroy();
  } catch (err) {
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      throw conflict('El usuario tiene actividades, oportunidades u otros registros a su nombre. Desactivá la cuenta en lugar de eliminarla.');
    }
    throw err;
  }
  invalidateUserCache(idUser);
  res.json({ message: 'Usuario eliminado' });
});

export const getImage = asyncHandler(async (req, res) => {
  const u = await User.scope('withImage').findByPk(req.params.idUser, { attributes: ['idUser', 'profileImage'] });
  if (!u) throw notFound('Usuario');
  res.json({ data: { idUser: u.idUser, profileImage: u.profileImage || null } });
});

export const updateImage = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  if (!isAdmin(req) && idUser !== req.user.idUser) throw forbidden();
  const u = await User.findByPk(idUser);
  if (!u) throw notFound('Usuario');
  const img = dataUrl(req.body?.profileImage, 'profileImage', 3);
  if (img && !img.startsWith('data:image/')) throw badRequest('La foto de perfil debe ser una imagen');
  await User.update({ profileImage: img || null }, { where: { idUser } });
  res.json({ message: 'Imagen de perfil actualizada', data: { idUser, profileImage: img || null } });
});

// Zona asignada (localidades) del vendedor.
export const getZone = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  if (!isAdmin(req) && idUser !== req.user.idUser) throw forbidden();
  const u = await User.findByPk(idUser, { include: [{ model: Locality, as: 'zone', through: { attributes: [] }, include: [{ model: Province, as: 'province' }] }] });
  if (!u) throw notFound('Usuario');
  res.json({ data: serializeUser(u).zone });
});

export const updateZone = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  const ids = Array.isArray(req.body?.localityIds) ? [...new Set(req.body.localityIds.map(String))] : null;
  if (!ids) throw badRequest('Enviá localityIds como lista');
  const u = await User.findByPk(idUser);
  if (!u) throw notFound('Usuario');
  const existing = await Locality.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id'] });
  if (existing.length !== ids.length) throw badRequest('Alguna localidad indicada no existe');
  await sequelize.transaction(async (transaction) => {
    await u.setZone(existing, { transaction });
  });
  const fresh = await User.findByPk(idUser, { include: [{ model: Locality, as: 'zone', through: { attributes: [] }, include: [{ model: Province, as: 'province' }] }] });
  res.json({ message: 'Zona actualizada', data: serializeUser(fresh).zone });
});
