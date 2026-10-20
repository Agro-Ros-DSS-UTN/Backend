// Rutas: Tareas.
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import * as tasks from './task.controller.js';

const router = Router();

router.get('/tasks', tasks.list);
router.post('/tasks', tasks.create);
router.get('/tasks/:id', tasks.get);
router.put('/tasks/:id', tasks.update);
router.patch('/tasks/:id/complete', tasks.complete);
router.patch('/tasks/:id/status', tasks.changeStatus);
router.delete('/tasks/:id', tasks.remove);

export default router;
