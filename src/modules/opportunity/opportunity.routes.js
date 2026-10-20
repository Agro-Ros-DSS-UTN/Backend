// Rutas: Oportunidades.
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import { requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import * as opportunities from './opportunity.controller.js';

const router = Router();
const admin = requireAdmin;

router.get('/opportunities', opportunities.list);
router.post('/opportunities', opportunities.create);
router.post('/opportunities/:id/restore', admin, opportunities.restore);
router.get('/opportunities/:id', opportunities.get);
router.put('/opportunities/:id', opportunities.update);
router.delete('/opportunities/:id', opportunities.remove);

export default router;
