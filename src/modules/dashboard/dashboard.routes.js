// Rutas: Tablero general (administración).
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import { requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import * as dashboard from './dashboard.controller.js';

const router = Router();
const admin = requireAdmin;

router.get('/dashboard', admin, dashboard.general);

export default router;
