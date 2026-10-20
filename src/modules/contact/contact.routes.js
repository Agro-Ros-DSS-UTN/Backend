// Rutas: Contactos.
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import { requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import * as contacts from './contact.controller.js';

const router = Router();
const admin = requireAdmin;

router.get('/contacts', contacts.list);
router.post('/contacts', contacts.create);
router.post('/contacts/:id/restore', admin, contacts.restore);
router.get('/contacts/:id', contacts.get);
router.put('/contacts/:id', contacts.update);
router.delete('/contacts/:id', admin, contacts.remove);

export default router;
