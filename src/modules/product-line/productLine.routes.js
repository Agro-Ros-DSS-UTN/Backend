// Rutas: Líneas de producto.
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import { requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import * as productLines from './productLine.controller.js';

const router = Router();
const admin = requireAdmin;

router.get('/product-lines', productLines.list);
router.get('/product-lines/:id', productLines.get);
router.post('/product-lines', admin, productLines.create);
router.put('/product-lines/:id', admin, productLines.update);
router.delete('/product-lines/:id', admin, productLines.remove);

export default router;
