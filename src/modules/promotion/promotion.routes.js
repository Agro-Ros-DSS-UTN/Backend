// Rutas: Promociones.
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import { requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import * as promotions from './promotion.controller.js';

const router = Router();
const admin = requireAdmin;

router.get('/promotions', promotions.list);
router.get('/promotions/:id', promotions.get);
router.post('/promotions', admin, promotions.create);
router.put('/promotions/:id', admin, promotions.update);
router.delete('/promotions/:id', admin, promotions.remove);

export default router;
