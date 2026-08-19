/* eslint-disable */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'agroros_crm_super_secret_jwt_key_2026';

// Genera un token firmado a partir de los datos del usuario.
// Se llama desde loginUser (user.controller.js) justo después de
// validar la contraseña.
export const generateToken = (user) => {
  const payload = {
    idUser: user.idUser,
    role: user.role
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });
};

// Middleware que protege rutas: exige un header
//   Authorization: Bearer <token>
// Si el token es válido, cuelga los datos del usuario en req.user
// y deja pasar con next(). Si no, corta con 401/403.
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No se proporcionó un token de autenticación' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'El token expiró, iniciá sesión nuevamente' });
      }
      return res.status(403).json({ message: 'Token inválido' });
    }

    req.user = decoded; // { idUser, role, iat, exp }
    next();
  });
};

// Middleware opcional: además de exigir token válido, restringe por rol.
// Uso: router.delete('/users/:id', verifyToken, requireRole('admin'), deleteUserById)
export const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'No tenés permisos para realizar esta acción' });
  }
  next();
};
