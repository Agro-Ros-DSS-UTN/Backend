// Rutas: Ítems del catálogo (productos y servicios).
// La sesión se exige para toda la API en server.js (authenticateAll); acá se
// agregan los permisos por rol. Las reglas de propiedad están en el service.
import { Router } from 'express';
import { requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import { cacheFor } from '../../shared/middlewares/security.middleware.js';
import * as catalogItems from './catalogItem.controller.js';

const router = Router();
const admin = requireAdmin;

router.get('/catalog', cacheFor(300), catalogItems.list);
router.get('/products', cacheFor(300), catalogItems.list); // la pantalla de productos muestra ambos tipos
router.get('/services', cacheFor(300), catalogItems.listServices);
for (const base of ['/catalog', '/products', '/services']) {
  router.get(`${base}/:id`, cacheFor(300), catalogItems.get);
  router.put(`${base}/:id`, admin, catalogItems.update);
  router.delete(`${base}/:id`, admin, catalogItems.remove);
}
router.post('/catalog', admin, catalogItems.create);
router.post('/products', admin, catalogItems.create);
router.post('/services', admin, catalogItems.createService);

export default router;
