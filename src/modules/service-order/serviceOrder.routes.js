// Rutas: Órdenes de servicio (administración).
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import { requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import * as orders from './serviceOrder.controller.js';

const router = Router();
const admin = requireAdmin;

router.get('/service-orders', admin, orders.list);
router.get('/service-orders/:id', admin, orders.get);
router.post('/service-orders', admin, orders.create);
router.put('/service-orders/:id', admin, orders.update);
router.post('/service-orders/:id/evaluation', admin, orders.saveEvaluation);
router.post('/service-orders/:id/restore', admin, orders.restore);
router.delete('/service-orders/:id', admin, orders.remove);

export default router;
