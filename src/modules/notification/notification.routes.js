// Rutas: Notificaciones.
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import * as notifications from './notification.controller.js';

const router = Router();

router.get('/notifications', notifications.list);
router.patch('/notifications/read', notifications.markAllRead);
router.patch('/notifications/:id/read', notifications.markRead);
router.delete('/notifications/read', notifications.clearRead);

export default router;
