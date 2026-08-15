/* eslint-disable */
// Envuelve un controller async: si la promesa rechaza (error de DB, etc.),
// el error se pasa a next(error) y lo termina resolviendo errorHandler.middleware.js
// en vez de tener que repetir un try/catch en cada controller.
//
// Uso:
//   export const getAllUsers = asyncHandler(async (req, res) => {
//     const users = await User.findAll();
//     return res.status(200).json({ message: 'Usuarios obtenidos exitosamente', data: users });
//   });
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
