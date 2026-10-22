// Rutas: Cultivos.
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import { requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import { cacheFor } from '../../shared/middlewares/security.middleware.js';
import * as crops from './crop.controller.js';

const router = Router();
const admin = requireAdmin;

router.get('/crops', cacheFor(300), crops.list);
router.post('/crops', admin, crops.create);

export default router;
