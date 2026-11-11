import { isAdmin } from '../../shared/middlewares/auth.middleware.js';
import { asyncHandler } from '../../shared/utils/http.js';
import * as userService from './user.service.js';

export { PASSWORD_RULE, validatePassword, serializeUser } from './user.service.js';

// ── Autenticación ──

export const login = asyncHandler(async (req, res) => {
  const result = await userService.loginUser(req.body);
  return res.json(result);
});

export const me = asyncHandler(async (req, res) => {
  const data = await userService.getCurrentUser(req.user.idUser);
  res.json({ data });
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await userService.changeUserPassword(req.user.idUser, req.body, { long: req.tokenPayload?.lng === 1 });
  res.json(result);
});

// Renueva la sesión mientras se usa: quien trabaja todos los días no vuelve a poner la contraseña.
export const refresh = asyncHandler(async (req, res) => {
  res.json(userService.refreshSession(req.user, { long: req.tokenPayload?.lng === 1 }));
});

// Cierra la sesión en todos los dispositivos (celular perdido, equipo compartido).
export const logoutAll = asyncHandler(async (req, res) => {
  res.json(await userService.logoutEverywhere(req.user.idUser));
});

// ── ABM de usuarios ──

export const list = asyncHandler(async (req, res) => {
  const data = await userService.listUsers({ admin: isAdmin(req) });
  res.json({ data });
});

export const get = asyncHandler(async (req, res) => {
  const data = await userService.getUser(req.params.idUser, {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.json({ data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await userService.createUser(req.body);
  res.status(201).json({ message: 'Usuario creado', data });
});

export const update = asyncHandler(async (req, res) => {
  const result = await userService.updateUser(req.params.idUser, req.body, {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.json(result);
});

export const remove = asyncHandler(async (req, res) => {
  const result = await userService.removeUser(req.params.idUser, {
    currentUserId: req.user.idUser,
  });
  res.json(result);
});

export const getImage = asyncHandler(async (req, res) => {
  const data = await userService.getUserImage(req.params.idUser);
  res.json({ data });
});

export const updateImage = asyncHandler(async (req, res) => {
  const data = await userService.updateUserImage(req.params.idUser, req.body, {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.json({ message: 'Imagen de perfil actualizada', data });
});

// Zona asignada (localidades) del vendedor.
export const getZone = asyncHandler(async (req, res) => {
  const data = await userService.getUserZone(req.params.idUser, {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.json({ data });
});

export const updateZone = asyncHandler(async (req, res) => {
  const data = await userService.updateUserZone(req.params.idUser, req.body);
  res.json({ message: 'Zona actualizada', data });
});
