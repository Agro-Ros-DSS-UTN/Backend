// Rutas: Notas internas (administración).
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import { requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import * as notes from './internalNote.controller.js';

const router = Router();
const admin = requireAdmin;

router.get('/internal-notes', admin, notes.list);
router.post('/internal-notes', admin, notes.create);
router.put('/internal-notes/:id', admin, notes.update);
router.delete('/internal-notes/:id', admin, notes.remove);

export default router;
