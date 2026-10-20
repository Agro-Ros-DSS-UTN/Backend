// Rutas: Provincias.
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import * as provinces from './province.controller.js';

const router = Router();

router.get('/provinces', provinces.list);

export default router;
