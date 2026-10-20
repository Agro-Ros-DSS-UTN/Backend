// Rutas: Localidades.
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import { requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import * as localities from './locality.controller.js';

const router = Router();
const admin = requireAdmin;

router.get('/localities', localities.list);
router.get('/localities/:id', localities.get);
router.post('/localities', admin, localities.create);
router.put('/localities/:id', admin, localities.update);
router.delete('/localities/:id', admin, localities.remove);

export default router;
