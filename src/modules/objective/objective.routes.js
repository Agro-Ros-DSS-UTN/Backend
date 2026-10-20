// Rutas: Objetivos.
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import { requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import * as objectives from './objective.controller.js';

const router = Router();
const admin = requireAdmin;

router.get('/objectives', objectives.list);
router.get('/objectives/:id', objectives.get);
router.post('/objectives', admin, objectives.create);
router.put('/objectives/:id', admin, objectives.update);
router.patch('/objectives/:id', admin, objectives.update);
router.delete('/objectives/:id', admin, objectives.remove);

export default router;
