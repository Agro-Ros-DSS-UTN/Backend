/* eslint-disable */
import User from '../models/user.model.js';
import bcrypt from 'bcrypt';
<<<<<<< HEAD

// 1. Creación de un usuario
export const createUser = async (req, res) => {
  try {
    const { idUser, nombreApellido, direccionMail, password, accountStatement, role } = req.body;

    // Validar campos obligatorios según el modelo
    if (!idUser || !nombreApellido || !password || !accountStatement || !role) {
      return res.status(400).json({
        message: 'El ID, nombre y apellido, contraseña, estado de cuenta y rol son obligatorios'
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await User.create({
      idUser,
      nombreApellido,
      direccionMail,
      password: hashedPassword,
      accountStatement,
      role
    });

    return res.status(201).json({
      message: 'Usuario creado exitosamente',
      data: newUser
    });

  } catch (error) {
    console.error('Error al crear el usuario:', error);
    return res.status(500).json({
      message: 'Hubo un error interno en el servidor',
      error: error.message
    });
  }
};


// 2. Obtener todos los usuarios
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();

    return res.status(200).json({
      message: 'Usuarios obtenidos exitosamente',
      data: users
    });
  } catch (error) {
    console.error('Error al obtener los usuarios:', error);
    return res.status(500).json({
      message: 'Hubo un error interno en el servidor',
      error: error.message
    });
  }
};


// 3. Obtener un usuario por su idUser
export const getUserById = async (req, res) => {
  try {
    const { idUser } = req.params;
    const user = await User.findByPk(idUser);

    if (!user) {
      return res.status(404).json({
        message: 'Usuario no encontrado'
      });
    }

    return res.status(200).json({
      message: 'Usuario obtenido con éxito',
      data: user
    });

  } catch (error) {
    console.error('Error al obtener el usuario:', error);
    return res.status(500).json({
      message: 'Hubo un error interno en el servidor',
      error: error.message
    });
  }
};


// 4. Actualizar un usuario por su idUser
export const updateUserById = async (req, res) => {
  try {
    const { idUser } = req.params;
    const { nombreApellido, direccionMail, password, accountStatement, role } = req.body;

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

  } catch (error) {
    console.error('Error al actualizar el usuario:', error);
    return res.status(500).json({
      message: 'Hubo un error interno en el servidor',
      error: error.message
    });
  }
};


// 5. Eliminar un usuario por su idUser
export const deleteUserById = async (req, res) => {
  try {
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

  } catch (error) {
    console.error('Error al eliminar el usuario:', error);
    return res.status(500).json({
      message: 'Hubo un error interno en el servidor',
      error: error.message
    });
  }
};


// 6. Login de usuario por ID y contraseña
export const loginUser = async (req, res) => {
  try {
    // Permite recibir idUser o id por compatibilidad desde el body
    const { idUser, id, password } = req.body;
    const userIdToSearch = idUser || id;

    if (!userIdToSearch || !password) {
      return res.status(400).json({ message: 'El ID y la contraseña son obligatorios' });
    }

    // Busca por la PK actual (idUser)
    const user = await User.findByPk(userIdToSearch);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    return res.json({
      message: 'Inicio de sesión exitoso',
      user: {
        id: user.idUser,
        idUser: user.idUser,
        nombreApellido: user.nombreApellido,
        direccionMail: user.direccionMail,
        accountStatement: user.accountStatement,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Error en loginUser:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};
=======
import { asyncHandler } from '../middlewares/asyncHandler.middleware.js';

// 1. Creación de un usuario
export const createUser = asyncHandler(async (req, res) => {
  const { idUser, nombreApellido, direccionMail, password, accountStatement, role } = req.body;

  // La validación de campos obligatorios ya la hace validateCreateUser (middleware)
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const newUser = await User.create({
    idUser,
    nombreApellido,
    direccionMail,
    password: hashedPassword,
    accountStatement,
    role
  });

  return res.status(201).json({
    message: 'Usuario creado exitosamente',
    data: newUser
  });
});


// 2. Obtener todos los usuarios
export const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.findAll();

  return res.status(200).json({
    message: 'Usuarios obtenidos exitosamente',
    data: users
  });
});


// 3. Obtener un usuario por su idUser
export const getUserById = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  const user = await User.findByPk(idUser);

  if (!user) {
    return res.status(404).json({
      message: 'Usuario no encontrado'
    });
  }

  return res.status(200).json({
    message: 'Usuario obtenido con éxito',
    data: user
  });
});


// 4. Actualizar un usuario por su idUser
export const updateUserById = asyncHandler(async (req, res) => {
  const { idUser } = req.params;
  const { nombreApellido, direccionMail, password, accountStatement, role } = req.body;

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


// 6. Login de usuario por ID y contraseña
export const loginUser = asyncHandler(async (req, res) => {
  // Permite recibir idUser o id por compatibilidad desde el body
  const { idUser, id, password } = req.body;
  const userIdToSearch = idUser || id;
  // La validación de campos obligatorios ya la hace validateLogin (middleware)

  // Busca por la PK actual (idUser)
  const user = await User.findByPk(userIdToSearch);

  if (!user) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Contraseña incorrecta' });
  }

  return res.json({
    message: 'Inicio de sesión exitoso',
    user: {
      id: user.idUser,
      idUser: user.idUser,
      nombreApellido: user.nombreApellido,
      direccionMail: user.direccionMail,
      accountStatement: user.accountStatement,
      role: user.role
    }
  });
});
>>>>>>> 6b47ab9 (Creacion del middleware)
