/* eslint-disable */
// Validaciones extraídas de user.controller.js

// Usado en: POST /users (createUser)
export const validateCreateUser = (req, res, next) => {
  const { idUser, nombreApellido, password, accountStatement, role } = req.body || {};

  if (!idUser || !nombreApellido || !password || !accountStatement || !role) {
    return res.status(400).json({
      message: 'El ID, nombre y apellido, contraseña, estado de cuenta y rol son obligatorios'
    });
  }

  next();
};

// Usado en: PUT /users/:idUser (updateUserById)
export const validateUpdateUser = (req, res, next) => {
  const { nombreApellido, direccionMail, password, accountStatement, role } = req.body || {};

  if (!nombreApellido && !direccionMail && !password && !accountStatement && !role) {
    return res.status(400).json({
      message: 'Debe enviar al menos un campo para actualizar'
    });
  }

  next();
};

// Usado en: POST /users/login (loginUser)
export const validateLogin = (req, res, next) => {
  const { idUser, id, password } = req.body || {};
  const userIdToSearch = idUser || id;

  if (!userIdToSearch || !password) {
    return res.status(400).json({ message: 'El ID y la contraseña son obligatorios' });
  }

  next();
};
