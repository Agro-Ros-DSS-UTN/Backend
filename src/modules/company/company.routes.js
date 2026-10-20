// Rutas: Empresas.
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import { requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import * as companies from './company.controller.js';

const router = Router();
const admin = requireAdmin;

router.get('/companies', companies.list);
router.post('/companies', companies.create);
router.get('/companies/:id/tree', companies.tree);
router.get('/companies/:id/dashboard', companies.dashboard);
router.post('/companies/:id/restore', admin, companies.restore);
router.get('/companies/:id', companies.get);
router.put('/companies/:id', companies.update);
router.delete('/companies/:id', admin, companies.remove);

export default router;
