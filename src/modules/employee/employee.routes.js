// Rutas: Empleados (administración).
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import { requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import * as employees from './employee.controller.js';

const router = Router();
const admin = requireAdmin;

router.get('/employees', admin, employees.list);
router.get('/employees/:id', admin, employees.get);
router.post('/employees', admin, employees.create);
router.put('/employees/:id', admin, employees.update);
router.delete('/employees/:id', admin, employees.remove);

export default router;
