/* eslint-disable */
import User from '../models/user.model.js';
import bcrypt from 'bcrypt';
import { asyncHandler } from '../middlewares/asyncHandler.middleware.js';
import { generateToken } from '../middlewares/auth.middleware.js';

// 1. Creacion de un usuario
export const createUser = asyncHandler(async (req, res) => {
  const { idUser, nombreApellido, direccionMail, password, accountStatement, role } = req.body || {};

  const existingUser = await User.findByPk(idUser);
  if (existingUser) {
    return res.status(409).json({
      message: 'Ya existe un usuario registrado con el ID "' + idUser + '"'
    });
  }

  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const newUser = await User.create({
    idUser,
    nombreApellido,
    direccionMail: direccionMail || null,
    password: hashedPassword,
    accountStatement: accountStatement || 'Activo',
    role
  });

  return res.status(201).json({
    message: 'Usuario creado exitosamente',
    data: {
      idUser: newUser.idUser,
      nombreApellido: newUser.nombreApellido,
      direccionMail: newUser.direccionMail,
      accountStatement: newUser.accountStatement,
      role: newUser.role
    }
  });
});

// 2. Obtener todos los usuarios
export const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.findAll({
    attributes: { exclude: ['password', 'profileImage'] }
  });

  return res.status(200).json({
    message: 'Usuarios obtenidos exitosamente',
    data: users
  });
});

// 3. Obtener un usuario por su idUser
export const getUserById = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  const user = await User.findByPk(idUser, {
    attributes: { exclude: ['password'] }
  });

  if (!user) {
    return res.status(404).json({
      message: 'Usuario no encontrado'
    });
  }

  return res.status(200).json({
    message: 'Usuario obtenido con exito',
    data: user
  });
});

// 4. Actualizar un usuario por su idUser
export const updateUserById = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  const { nombreApellido, direccionMail, password, accountStatement, role } = req.body || {};

  const user = await User.findByPk(idUser);

  if (!user) {
    return res.status(404).json({
      message: 'Usuario no encontrado'
    });
  }

  const updateData = {
    nombreApellido,
    direccionMail,
    accountStatement,
    role
  };

  if (password) {
    updateData.password = await bcrypt.hash(password, 10);
  }

  await user.update(updateData);

  return res.status(200).json({
    message: 'Usuario actualizado exitosamente',
    data: user
  });
});

// 5. Eliminar un usuario por su idUser
export const deleteUserById = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  const user = await User.findByPk(idUser);

  if (!user) {
    return res.status(404).json({
      message: 'Usuario no encontrado'
    });
  }

  await user.destroy();

  return res.status(200).json({
    message: 'Usuario eliminado exitosamente'
  });
});

// 6. Login de usuario por ID y contrasena
export const loginUser = asyncHandler(async (req, res) => {
  const { idUser, id, password } = req.body || {};
  const userIdToSearch = idUser || id;

  const user = await User.findByPk(userIdToSearch);

  if (!user) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Contrasena incorrecta' });
  }

  const token = generateToken(user);

  return res.json({
    message: 'Inicio de sesion exitoso',
    token,
    user: {
      id: user.idUser,
      idUser: user.idUser,
      nombreApellido: user.nombreApellido,
      direccionMail: user.direccionMail,
      accountStatement: user.accountStatement,
      role: user.role,
      profileImage: user.profileImage || null
    }
  });
});

// 7. Obtener foto de perfil de un usuario
export const getProfileImage = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  const user = await User.findByPk(idUser, {
    attributes: ['idUser', 'profileImage']
  });

  if (!user) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  return res.status(200).json({
    message: 'Imagen de perfil obtenida',
    data: {
      idUser: user.idUser,
      profileImage: user.profileImage || null
    }
  });
});

// 8. Actualizar foto de perfil de un usuario
export const updateProfileImage = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  const { profileImage } = req.body || {};

  const user = await User.findByPk(idUser);

  if (!user) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  await user.update({ profileImage: profileImage || null });

  return res.status(200).json({
    message: 'Imagen de perfil actualizada exitosamente',
    data: {
      idUser: user.idUser,
      profileImage: user.profileImage || null
    }
  });
});
