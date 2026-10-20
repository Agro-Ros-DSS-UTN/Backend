import bcrypt from 'bcrypt';
import { USER_ROLES, ACCOUNT_STATUSES } from './user.entity.js';
import * as userRepository from './user.repository.js';
import { generateToken, invalidateUserCache, normalizeRole } from '../../shared/middlewares/auth.middleware.js';
import { AppError, badRequest, conflict, forbidden, notFound, pick } from '../../shared/utils/http.js';
import { dataUrl, parseDate, required, text } from '../../shared/utils/validation.js';

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

// ── Autenticación ──

export const loginUser = async (body) => {
  const idUser = String(body?.idUser || body?.id || '').trim();
  const password = String(body?.password || '');
  if (!idUser || !password) throw badRequest('Ingresá usuario y contraseña');

  const user = await userRepository.findAuthById(idUser);
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  // Mismo mensaje para usuario inexistente o contraseña incorrecta (no revela qué usuarios existen).
  if (!user || !ok) throw new AppError(401, 'Usuario o contraseña incorrectos', { code: 'INVALID_CREDENTIALS' });
  if (user.accountStatus !== 'Activo') throw new AppError(403, 'La cuenta está desactivada. Contactá a la administración.', { code: 'ACCOUNT_DISABLED' });

  // Migración transparente de hashes con costo menor al actual.
  if (Number(user.passwordHash.split('$')[2]) < SALT_ROUNDS) {
    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  }
  user.lastLoginAt = new Date();
  await userRepository.save(user, { fields: ['passwordHash', 'lastLoginAt'] });

  const long = body?.rememberMe === true;
  const full = await userRepository.findWithImageById(idUser);
  return {
    message: 'Inicio de sesión exitoso',
    token: generateToken(user, { long }),
    user: { ...serializeUser(full), id: user.idUser },
  };
};

export const getCurrentUser = async (idUser) => {
  const u = await userRepository.findByIdWithZone(idUser, { withImage: true });
  if (!u) throw notFound('Usuario');
  return serializeUser(u);
};

export const changeUserPassword = async (idUser, body) => {
  const { currentPassword, newPassword } = body || {};
  required({ currentPassword, newPassword }, ['currentPassword', 'newPassword']);
  validatePassword(newPassword);
  const user = await userRepository.findAuthById(idUser);
  if (!(await bcrypt.compare(String(currentPassword), user.passwordHash))) {
    throw badRequest('La contraseña actual no es correcta', { currentPassword: 'incorrect' });
  }
  user.passwordHash = await bcrypt.hash(String(newPassword), SALT_ROUNDS);
  user.tokenVersion += 1; // cierra las sesiones abiertas en otros dispositivos
  await userRepository.save(user);
  invalidateUserCache(user.idUser);
  return { message: 'Contraseña actualizada', token: generateToken(user) };
};

// ── ABM de usuarios ──

export const listUsers = async ({ admin }) => {
  // El vendedor necesita la lista para asignar tareas: solo ve datos mínimos de usuarios activos.
  if (!admin) {
    const users = await userRepository.findAllActiveMinimal();
    return users.map(serializeUser);
  }
  const users = await userRepository.findAllWithZone();
  return users.map(serializeUser);
};

export const getUser = async (idUser, { admin, currentUserId }) => {
  if (!admin && idUser !== currentUserId) throw forbidden();
  const u = await userRepository.findByIdWithZone(idUser);
  if (!u) throw notFound('Usuario');
  return serializeUser(u);
};

export const createUser = async (body) => {
  const idUser = String(body?.idUser || '').trim();
  required({ ...body, idUser }, ['idUser', 'fullName', 'password']);
  if (!/^[A-Za-z0-9._-]{3,20}$/.test(idUser)) throw badRequest('El ID de usuario debe tener 3 a 20 caracteres: letras, números, punto, guion o guion bajo', { idUser: 'format' });
  validatePassword(body.password);
  if (await userRepository.findById(idUser)) throw conflict(`Ya existe un usuario con el ID "${idUser}"`);
  const data = userData(body);
  const u = await userRepository.create({
    ...data,
    idUser,
    role: data.role || 'vendedor',
    accountStatus: data.accountStatus || 'Activo',
    passwordHash: await bcrypt.hash(String(body.password), SALT_ROUNDS),
  });
  return serializeUser(u);
};

export const updateUser = async (idUser, body, { admin, currentUserId }) => {
  const own = idUser === currentUserId;
  if (!admin && !own) throw forbidden();
  const u = await userRepository.findAuthById(idUser);
  if (!u) throw notFound('Usuario');

  const data = userData(body || {});
  if (!admin) {
    // El usuario común solo edita sus datos de contacto.
    delete data.role;
    delete data.accountStatus;
    delete data.hireDate;
  }
  if (own && data.accountStatus === 'Inactivo') throw badRequest('No podés desactivar tu propia cuenta');
  if (own && data.role && data.role !== u.role) throw badRequest('No podés cambiar tu propio rol');

  let invalidate = (data.role && data.role !== u.role) || (data.accountStatus && data.accountStatus !== u.accountStatus);
  if (body?.password) {
    validatePassword(body.password);
    if (!admin || own) {
      // Para la propia contraseña se exige la actual.
      if (!body.currentPassword || !(await bcrypt.compare(String(body.currentPassword), u.passwordHash))) {
        throw badRequest('Para cambiar tu contraseña ingresá la contraseña actual', { currentPassword: 'required' });
      }
    } else {
      // La administración confirma con su propia contraseña antes de cambiar la de otro usuario.
      const adminUser = await userRepository.findAuthById(currentUserId);
      if (!body.adminPassword || !(await bcrypt.compare(String(body.adminPassword), adminUser.passwordHash))) {
        throw badRequest('Confirmá el cambio con tu contraseña de administrador', { adminPassword: 'incorrect' });
      }
    }
    u.passwordHash = await bcrypt.hash(String(body.password), SALT_ROUNDS);
    invalidate = true;
  }
  Object.assign(u, data);
  if (invalidate) u.tokenVersion += 1;
  await userRepository.save(u);
  invalidateUserCache(idUser);
  const fresh = await userRepository.findById(idUser);
  return {
    message: 'Usuario actualizado',
    data: serializeUser(fresh),
    ...(own && invalidate ? { token: generateToken(u) } : {}),
  };
};

export const removeUser = async (idUser, { currentUserId }) => {
  if (idUser === currentUserId) throw badRequest('No podés eliminar tu propia cuenta');
  const u = await userRepository.findById(idUser);
  if (!u) throw notFound('Usuario');
  try {
    await userRepository.destroy(u);
  } catch (err) {
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      throw conflict('El usuario tiene actividades, oportunidades u otros registros a su nombre. Desactivá la cuenta en lugar de eliminarla.');
    }
    throw err;
  }
  invalidateUserCache(idUser);
  return { message: 'Usuario eliminado' };
};

export const getUserImage = async (idUser) => {
  const u = await userRepository.findWithImageById(idUser, { attributes: ['idUser', 'profileImage'] });
  if (!u) throw notFound('Usuario');
  return { idUser: u.idUser, profileImage: u.profileImage || null };
};

export const updateUserImage = async (idUser, body, { admin, currentUserId }) => {
  if (!admin && idUser !== currentUserId) throw forbidden();
  const u = await userRepository.findById(idUser);
  if (!u) throw notFound('Usuario');
  const img = dataUrl(body?.profileImage, 'profileImage', 3);
  if (img && !img.startsWith('data:image/')) throw badRequest('La foto de perfil debe ser una imagen');
  await userRepository.updateProfileImage(idUser, img || null);
  return { idUser, profileImage: img || null };
};

export const getUserZone = async (idUser, { admin, currentUserId }) => {
  if (!admin && idUser !== currentUserId) throw forbidden();
  const u = await userRepository.findByIdWithZone(idUser);
  if (!u) throw notFound('Usuario');
  return serializeUser(u).zone;
};

export const updateUserZone = async (idUser, body) => {
  const ids = Array.isArray(body?.localityIds) ? [...new Set(body.localityIds.map(String))] : null;
  if (!ids) throw badRequest('Enviá localityIds como lista');
  const u = await userRepository.findById(idUser);
  if (!u) throw notFound('Usuario');
  const existing = await userRepository.findLocalitiesByIds(ids);
  if (existing.length !== ids.length) throw badRequest('Alguna localidad indicada no existe');
  await userRepository.replaceUserZone(u, existing);
  const fresh = await userRepository.findByIdWithZone(idUser);
  return serializeUser(fresh).zone;
};
