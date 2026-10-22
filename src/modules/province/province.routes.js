// Rutas: Provincias.
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import { cacheFor } from '../../shared/middlewares/security.middleware.js';
import * as provinces from './province.controller.js';

const router = Router();

router.get('/provinces', cacheFor(300), provinces.list);

export default router;
