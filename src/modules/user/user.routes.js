// Rutas: Autenticación y usuarios.
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import { requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import { loginLimiterByIp, loginLimiterByUser } from '../../shared/middlewares/security.middleware.js';
import * as users from './user.controller.js';

const router = Router();
const admin = requireAdmin;

router.post('/auth/login', loginLimiterByIp, loginLimiterByUser, users.login);
router.get('/auth/me', users.me);
router.post('/auth/change-password', users.changePassword);

router.get('/users', users.list);
router.post('/users', admin, users.create);
router.get('/users/:idUser', users.get);
router.put('/users/:idUser', users.update); // propio o admin (lo decide el service)
router.delete('/users/:idUser', admin, users.remove);
router.get('/users/:idUser/image', users.getImage);
router.put('/users/:idUser/image', users.updateImage);
router.get('/users/:idUser/zone', users.getZone);
router.put('/users/:idUser/zone', admin, users.updateZone);

export default router;
