import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { Usuario, Localidad, Provincia, sequelize } from '../models/index.js';
import { ROLES_USUARIO, ESTADOS_CUENTA } from '../models/usuario.model.js';
import { generateToken, invalidateUserCache, isAdmin, normalizeRole } from '../middlewares/auth.middleware.js';
import { AppError, asyncHandler, badRequest, conflict, forbidden, notFound, pick } from '../utils/http.js';
import { dataUrl, parseFecha, requerido, texto } from '../utils/validacion.js';

const SALT_ROUNDS = 12;
// Hash fijo para comparar aunque el usuario no exista: misma demora en ambos casos.
const DUMMY_HASH = bcrypt.hashSync('usuario-inexistente', SALT_ROUNDS);

const rolDb = (rol) => (normalizeRole(rol) === 'admin' ? 'administrador' : normalizeRole(rol) === 'vendedor' ? 'vendedor' : null);

export const validarPassword = (pw) => {
  const s = String(pw || '');
  if (s.length < 8 || !/[A-Za-z]/.test(s) || !/\d/.test(s)) {
    throw badRequest('La contraseña debe tener al menos 8 caracteres, con letras y números', { password: 'débil' });
  }
  return s;
};

// Respuesta pública de un usuario. Incluye los nombres v1 (direccionMail, role,
// accountStatement) mientras las pantallas viejas los sigan usando.
export const serializeUsuario = (u) => {
  if (!u) return null;
  const j = typeof u.toJSON === 'function' ? u.toJSON() : u;
  return {
    idUser: j.idUser,
    nombreApellido: j.nombreApellido,
    email: j.email ?? null,
    telefono: j.telefono ?? null,
    rol: j.rol,
    estadoCuenta: j.estadoCuenta,
    fechaIngreso: j.fechaIngreso ?? null,
    antiguedad: j.antiguedad ?? null,
    ultimoAcceso: j.ultimoAcceso ?? null,
    zona: Array.isArray(j.zona) ? j.zona.map((l) => ({ id: l.id, nombre: l.nombre, provincia: l.provincia?.nombre ?? null })) : undefined,
    ...(j.profileImage !== undefined ? { profileImage: j.profileImage } : {}),
    // compatibilidad v1
    direccionMail: j.email ?? null,
    role: j.rol,
    accountStatement: j.estadoCuenta,
  };
};

// ── Autenticación ──

export const login = asyncHandler(async (req, res) => {
  const idUser = String(req.body?.idUser || req.body?.id || '').trim();
  const password = String(req.body?.password || '');
  if (!idUser || !password) throw badRequest('Ingresá usuario y contraseña');

  const user = await Usuario.scope('auth').findByPk(idUser);
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  // Mismo mensaje para usuario inexistente o contraseña incorrecta (no revela qué usuarios existen).
  if (!user || !ok) throw new AppError(401, 'Usuario o contraseña incorrectos', { code: 'INVALID_CREDENTIALS' });
  if (user.estadoCuenta !== 'Activo') throw new AppError(403, 'La cuenta está desactivada. Contactá a la administración.', { code: 'ACCOUNT_DISABLED' });

  // Migración transparente de hashes con costo menor al actual.
  if (Number(user.passwordHash.split('$')[2]) < SALT_ROUNDS) {
    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  }
  user.ultimoAcceso = new Date();
  await user.save({ fields: ['passwordHash', 'ultimoAcceso'] });

  const long = req.body?.mantenerSesion === true;
  const full = await Usuario.scope('conImagen').findByPk(idUser);
  return res.json({
    message: 'Inicio de sesión exitoso',
    token: generateToken(user, { long }),
    user: { ...serializeUsuario(full), id: user.idUser },
  });
});

export const me = asyncHandler(async (req, res) => {
  const u = await Usuario.scope('conImagen').findByPk(req.user.idUser, {
    include: [{ model: Localidad, as: 'zona', through: { attributes: [] }, include: [{ model: Provincia, as: 'provincia' }] }],
  });
  if (!u) throw notFound('Usuario');
  res.json({ data: serializeUsuario(u) });
});

export const cambiarPassword = asyncHandler(async (req, res) => {
  const { passwordActual } = req.body || {};
  const passwordNuevo = req.body?.passwordNuevo ?? req.body?.passwordNueva;
  requerido({ passwordActual, passwordNuevo }, ['passwordActual', 'passwordNuevo']);
  validarPassword(passwordNuevo);
  const user = await Usuario.scope('auth').findByPk(req.user.idUser);
  if (!(await bcrypt.compare(String(passwordActual), user.passwordHash))) {
    throw badRequest('La contraseña actual no es correcta', { passwordActual: 'incorrecta' });
  }
  user.passwordHash = await bcrypt.hash(String(passwordNuevo), SALT_ROUNDS);
  user.tokenVersion += 1; // cierra las sesiones abiertas en otros dispositivos
  await user.save();
  invalidateUserCache(user.idUser);
  res.json({ message: 'Contraseña actualizada', token: generateToken(user) });
});

// ── ABM de usuarios ──

export const listar = asyncHandler(async (req, res) => {
  // El vendedor necesita la lista para asignar tareas: solo ve datos mínimos de usuarios activos.
  if (!isAdmin(req)) {
    const users = await Usuario.findAll({ where: { estadoCuenta: 'Activo' }, attributes: ['idUser', 'nombreApellido', 'rol'], order: [['nombreApellido', 'ASC']] });
    return res.json({ data: users.map(serializeUsuario) });
  }
  const users = await Usuario.findAll({
    include: [{ model: Localidad, as: 'zona', through: { attributes: [] }, include: [{ model: Provincia, as: 'provincia' }] }],
    order: [['nombreApellido', 'ASC']],
  });
  res.json({ data: users.map(serializeUsuario) });
});

export const obtener = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  if (!isAdmin(req) && idUser !== req.user.idUser) throw forbidden();
  const u = await Usuario.findByPk(idUser, {
    include: [{ model: Localidad, as: 'zona', through: { attributes: [] }, include: [{ model: Provincia, as: 'provincia' }] }],
  });
  if (!u) throw notFound('Usuario');
  res.json({ data: serializeUsuario(u) });
});

const datosUsuario = (body) => {
  const b = { ...body, email: body.email ?? body.direccionMail, rol: body.rol ?? body.role, estadoCuenta: body.estadoCuenta ?? body.accountStatement };
  const out = pick(b, ['nombreApellido', 'email', 'telefono', 'rol', 'estadoCuenta', 'fechaIngreso']);
  if (out.nombreApellido !== undefined) out.nombreApellido = texto(out.nombreApellido, 'nombreApellido', 150);
  if (out.email !== undefined) out.email = texto(out.email, 'email', 150);
  if (out.telefono !== undefined) out.telefono = texto(out.telefono, 'telefono', 30);
  if (out.fechaIngreso !== undefined) out.fechaIngreso = parseFecha(out.fechaIngreso, 'fechaIngreso');
  if (out.rol !== undefined) {
    out.rol = rolDb(out.rol);
    if (!out.rol) throw badRequest(`El rol debe ser uno de: ${ROLES_USUARIO.join(', ')}`, { rol: 'inválido' });
  }
  if (out.estadoCuenta !== undefined) {
    const e = String(out.estadoCuenta).toLowerCase().startsWith('inact') ? 'Inactivo' : 'Activo';
    out.estadoCuenta = ESTADOS_CUENTA.includes(e) ? e : 'Activo';
  }
  return out;
};

export const crear = asyncHandler(async (req, res) => {
  const idUser = String(req.body?.idUser || '').trim();
  requerido({ ...req.body, idUser }, ['idUser', 'nombreApellido', 'password']);
  if (!/^[A-Za-z0-9._-]{3,20}$/.test(idUser)) throw badRequest('El ID de usuario debe tener 3 a 20 caracteres: letras, números, punto, guion o guion bajo', { idUser: 'formato' });
  validarPassword(req.body.password);
  if (await Usuario.findByPk(idUser)) throw conflict(`Ya existe un usuario con el ID "${idUser}"`);
  const data = datosUsuario(req.body);
  const u = await Usuario.create({ ...data, idUser, rol: data.rol || 'vendedor', estadoCuenta: data.estadoCuenta || 'Activo', passwordHash: await bcrypt.hash(String(req.body.password), SALT_ROUNDS) });
  res.status(201).json({ message: 'Usuario creado', data: serializeUsuario(u) });
});

export const actualizar = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  const propio = idUser === req.user.idUser;
  if (!isAdmin(req) && !propio) throw forbidden();
  const u = await Usuario.scope('auth').findByPk(idUser);
  if (!u) throw notFound('Usuario');

  const data = datosUsuario(req.body || {});
  if (!isAdmin(req)) {
    // El usuario común solo edita sus datos de contacto.
    delete data.rol;
    delete data.estadoCuenta;
    delete data.fechaIngreso;
  }
  if (propio && data.estadoCuenta === 'Inactivo') throw badRequest('No podés desactivar tu propia cuenta');
  if (propio && data.rol && data.rol !== u.rol) throw badRequest('No podés cambiar tu propio rol');

  let invalidar = (data.rol && data.rol !== u.rol) || (data.estadoCuenta && data.estadoCuenta !== u.estadoCuenta);
  if (req.body?.password) {
    validarPassword(req.body.password);
    if (!isAdmin(req) || propio) {
      // Para la propia contraseña se exige la actual.
      if (!req.body.passwordActual || !(await bcrypt.compare(String(req.body.passwordActual), u.passwordHash))) {
        throw badRequest('Para cambiar tu contraseña ingresá la contraseña actual', { passwordActual: 'requerida' });
      }
    } else {
      // La administración confirma con su propia contraseña antes de cambiar la de otro usuario.
      const admin = await Usuario.scope('auth').findByPk(req.user.idUser);
      if (!req.body.passwordAdmin || !(await bcrypt.compare(String(req.body.passwordAdmin), admin.passwordHash))) {
        throw badRequest('Confirmá el cambio con tu contraseña de administrador', { passwordAdmin: 'incorrecta' });
      }
    }
    u.passwordHash = await bcrypt.hash(String(req.body.password), SALT_ROUNDS);
    invalidar = true;
  }
  Object.assign(u, data);
  if (invalidar) u.tokenVersion += 1;
  await u.save();
  invalidateUserCache(idUser);
  const fresh = await Usuario.findByPk(idUser);
  res.json({ message: 'Usuario actualizado', data: serializeUsuario(fresh), ...(propio && invalidar ? { token: generateToken(u) } : {}) });
});

export const eliminar = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  if (idUser === req.user.idUser) throw badRequest('No podés eliminar tu propia cuenta');
  const u = await Usuario.findByPk(idUser);
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

export const obtenerImagen = asyncHandler(async (req, res) => {
  const u = await Usuario.scope('conImagen').findByPk(req.params.idUser, { attributes: ['idUser', 'profileImage'] });
  if (!u) throw notFound('Usuario');
  res.json({ data: { idUser: u.idUser, profileImage: u.profileImage || null } });
});

export const actualizarImagen = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  if (!isAdmin(req) && idUser !== req.user.idUser) throw forbidden();
  const u = await Usuario.findByPk(idUser);
  if (!u) throw notFound('Usuario');
  const img = dataUrl(req.body?.profileImage, 'profileImage', 3);
  if (img && !img.startsWith('data:image/')) throw badRequest('La foto de perfil debe ser una imagen');
  await Usuario.update({ profileImage: img || null }, { where: { idUser } });
  res.json({ message: 'Imagen de perfil actualizada', data: { idUser, profileImage: img || null } });
});

// Zona asignada (localidades) del vendedor.
export const obtenerZona = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  if (!isAdmin(req) && idUser !== req.user.idUser) throw forbidden();
  const u = await Usuario.findByPk(idUser, { include: [{ model: Localidad, as: 'zona', through: { attributes: [] }, include: [{ model: Provincia, as: 'provincia' }] }] });
  if (!u) throw notFound('Usuario');
  res.json({ data: serializeUsuario(u).zona });
});

export const actualizarZona = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  const ids = Array.isArray(req.body?.localidadIds) ? [...new Set(req.body.localidadIds.map(String))] : null;
  if (!ids) throw badRequest('Enviá localidadIds como lista');
  const u = await Usuario.findByPk(idUser);
  if (!u) throw notFound('Usuario');
  const existentes = await Localidad.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id'] });
  if (existentes.length !== ids.length) throw badRequest('Alguna localidad indicada no existe');
  await sequelize.transaction(async (transaction) => {
    await u.setZona(existentes, { transaction });
  });
  const fresh = await Usuario.findByPk(idUser, { include: [{ model: Localidad, as: 'zona', through: { attributes: [] }, include: [{ model: Provincia, as: 'provincia' }] }] });
  res.json({ message: 'Zona actualizada', data: serializeUsuario(fresh).zona });
});
