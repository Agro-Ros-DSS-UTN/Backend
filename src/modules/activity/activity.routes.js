// Rutas: Actividades y sus adjuntos.
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import * as activities from './activity.controller.js';

const router = Router();

router.get('/activities', activities.list);
router.post('/activities', activities.create);
router.get('/activities/:id', activities.get);
router.put('/activities/:id', activities.update);
router.delete('/activities/:id', activities.remove);
router.get('/attachments/:id', activities.getAttachment);

export default router;
