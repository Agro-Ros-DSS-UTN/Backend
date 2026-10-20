// Rutas: Hojas de ruta y sus paradas.
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import * as roadmaps from './roadmap.controller.js';

const router = Router();

router.get('/roadmaps', roadmaps.list);
router.post('/roadmaps', roadmaps.create);
router.patch('/stops/:id', roadmaps.updateStop);
router.get('/roadmaps/:id', roadmaps.get);
router.put('/roadmaps/:id', roadmaps.update);
router.put('/roadmaps/:id/start', roadmaps.start);
router.put('/roadmaps/:id/complete', roadmaps.complete);
router.post('/roadmaps/:id/stops', roadmaps.addStop);
router.delete('/roadmaps/:id', roadmaps.remove);

export default router;
