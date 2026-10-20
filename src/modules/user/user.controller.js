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
  const result = await userService.changeUserPassword(req.user.idUser, req.body);
  res.json(result);
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
