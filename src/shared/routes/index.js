// Rutas de la API. La autenticación se aplica globalmente (authenticateAll en
// server.js); acá se agregan los permisos por rol. Las reglas de propiedad (un
// vendedor solo ve lo suyo) están en cada controlador.
import { Router } from 'express';
import { requireAdmin } from '../middlewares/auth.middleware.js';
import { loginLimiterByIp, loginLimiterByUser } from '../middlewares/security.middleware.js';
import * as users from '../../modules/user/user.controller.js';
import * as provinces from '../../modules/province/province.controller.js';
import * as localities from '../../modules/locality/locality.controller.js';
import * as companies from '../../modules/company/company.controller.js';
import * as crops from '../../modules/crop/crop.controller.js';
import * as contacts from '../../modules/contact/contact.controller.js';
import * as productLines from '../../modules/product-line/productLine.controller.js';
import * as catalogItems from '../../modules/catalog-item/catalogItem.controller.js';
import * as opportunities from '../../modules/opportunity/opportunity.controller.js';
import * as activities from '../../modules/activity/activity.controller.js';
import * as tasks from '../../modules/task/task.controller.js';
import * as roadmaps from '../../modules/roadmap/roadmap.controller.js';
import * as objectives from '../../modules/objective/objective.controller.js';
import * as promotions from '../../modules/promotion/promotion.controller.js';
import * as notes from '../../modules/internal-note/internalNote.controller.js';
import * as notifications from '../../modules/notification/notification.controller.js';
import * as employees from '../../modules/employee/employee.controller.js';
import * as orders from '../../modules/service-order/serviceOrder.controller.js';
import * as dashboard from '../../modules/dashboard/dashboard.controller.js';

const router = Router();
const admin = requireAdmin;

// ── Autenticación y usuarios ──
router.post('/auth/login', loginLimiterByIp, loginLimiterByUser, users.login);
router.get('/auth/me', users.me);
router.post('/auth/change-password', users.changePassword);

router.get('/users', users.list);
router.post('/users', admin, users.create);
router.get('/users/:idUser', users.get);
router.put('/users/:idUser', users.update); // propio o admin (controlador)
router.delete('/users/:idUser', admin, users.remove);
router.get('/users/:idUser/image', users.getImage);
router.put('/users/:idUser/image', users.updateImage);
router.get('/users/:idUser/zone', users.getZone);
router.put('/users/:idUser/zone', admin, users.updateZone);

// ── Territorio ──
router.get('/provinces', provinces.list);
router.get('/localities', localities.list);
router.get('/localities/:id', localities.get);
router.post('/localities', admin, localities.create);
router.put('/localities/:id', admin, localities.update);
router.delete('/localities/:id', admin, localities.remove);

// ── Empresas y contactos ──
router.get('/companies', companies.list);
router.post('/companies', companies.create);
router.get('/companies/:id/tree', companies.tree);
router.get('/companies/:id/dashboard', companies.dashboard);
router.post('/companies/:id/restore', admin, companies.restore);
router.get('/companies/:id', companies.get);
router.put('/companies/:id', companies.update);
router.delete('/companies/:id', admin, companies.remove);
router.get('/crops', crops.list);
router.post('/crops', admin, crops.create);

router.get('/contacts', contacts.list);
router.post('/contacts', contacts.create);
router.post('/contacts/:id/restore', admin, contacts.restore);
router.get('/contacts/:id', contacts.get);
router.put('/contacts/:id', contacts.update);
router.delete('/contacts/:id', admin, contacts.remove);

// ── Catálogo ──
router.get('/product-lines', productLines.list);
router.get('/product-lines/:id', productLines.get);
router.post('/product-lines', admin, productLines.create);
router.put('/product-lines/:id', admin, productLines.update);
router.delete('/product-lines/:id', admin, productLines.remove);
router.get('/catalog', catalogItems.list);
router.get('/products', catalogItems.list); // la pantalla de productos muestra ambos tipos
router.get('/services', catalogItems.listServices);
for (const base of ['/catalog', '/products', '/services']) {
  router.get(`${base}/:id`, catalogItems.get);
  router.put(`${base}/:id`, admin, catalogItems.update);
  router.delete(`${base}/:id`, admin, catalogItems.remove);
}
router.post('/catalog', admin, catalogItems.create);
router.post('/products', admin, catalogItems.create);
router.post('/services', admin, catalogItems.createService);

// ── Gestión comercial ──
router.get('/opportunities', opportunities.list);
router.post('/opportunities', opportunities.create);
router.post('/opportunities/:id/restore', admin, opportunities.restore);
router.get('/opportunities/:id', opportunities.get);
router.put('/opportunities/:id', opportunities.update);
router.delete('/opportunities/:id', opportunities.remove);

router.get('/activities', activities.list);
router.post('/activities', activities.create);
router.get('/activities/:id', activities.get);
router.put('/activities/:id', activities.update);
router.delete('/activities/:id', activities.remove);
router.get('/attachments/:id', activities.getAttachment);

router.get('/tasks', tasks.list);
router.post('/tasks', tasks.create);
router.get('/tasks/:id', tasks.get);
router.put('/tasks/:id', tasks.update);
router.patch('/tasks/:id/complete', tasks.complete);
router.patch('/tasks/:id/status', tasks.changeStatus);
router.delete('/tasks/:id', tasks.remove);

// ── Planificación ──
router.get('/roadmaps', roadmaps.list);
router.post('/roadmaps', roadmaps.create);
router.patch('/stops/:id', roadmaps.updateStop);
router.get('/roadmaps/:id', roadmaps.get);
router.put('/roadmaps/:id', roadmaps.update);
router.put('/roadmaps/:id/start', roadmaps.start);
router.put('/roadmaps/:id/complete', roadmaps.complete);
router.post('/roadmaps/:id/stops', roadmaps.addStop);
router.delete('/roadmaps/:id', roadmaps.remove);

router.get('/objectives', objectives.list);
router.get('/objectives/:id', objectives.get);
router.post('/objectives', admin, objectives.create);
router.put('/objectives/:id', admin, objectives.update);
router.patch('/objectives/:id', admin, objectives.update);
router.delete('/objectives/:id', admin, objectives.remove);

router.get('/promotions', promotions.list);
router.get('/promotions/:id', promotions.get);
router.post('/promotions', admin, promotions.create);
router.put('/promotions/:id', admin, promotions.update);
router.delete('/promotions/:id', admin, promotions.remove);

router.get('/internal-notes', admin, notes.list);
router.post('/internal-notes', admin, notes.create);
router.put('/internal-notes/:id', admin, notes.update);
router.delete('/internal-notes/:id', admin, notes.remove);

router.get('/notifications', notifications.list);
router.patch('/notifications/read', notifications.markAllRead);
router.patch('/notifications/:id/read', notifications.markRead);
router.delete('/notifications/read', notifications.clearRead);

// ── Servicios de control de plagas (administración) ──
router.get('/employees', admin, employees.list);
router.get('/employees/:id', admin, employees.get);
router.post('/employees', admin, employees.create);
router.put('/employees/:id', admin, employees.update);
router.delete('/employees/:id', admin, employees.remove);

router.get('/service-orders', admin, orders.list);
router.get('/service-orders/:id', admin, orders.get);
router.post('/service-orders', admin, orders.create);
router.put('/service-orders/:id', admin, orders.update);
router.post('/service-orders/:id/evaluation', admin, orders.saveEvaluation);
router.post('/service-orders/:id/restore', admin, orders.restore);
router.delete('/service-orders/:id', admin, orders.remove);

// ── Tablero general ──
router.get('/dashboard', admin, dashboard.general);

export default router;
