// Rutas de la API: cada entidad define las suyas en src/modules/<entidad>/<entidad>.routes.js
// y acá solo se montan, en este orden. La autenticación se aplica globalmente
// (authenticateAll en server.js); los permisos por rol están en cada archivo de rutas y
// las reglas de propiedad (un vendedor solo ve lo suyo) en cada service.
import { Router } from 'express';
import userRoutes from '../../modules/user/user.routes.js';
import provinceRoutes from '../../modules/province/province.routes.js';
import localityRoutes from '../../modules/locality/locality.routes.js';
import companyRoutes from '../../modules/company/company.routes.js';
import cropRoutes from '../../modules/crop/crop.routes.js';
import contactRoutes from '../../modules/contact/contact.routes.js';
import productLineRoutes from '../../modules/product-line/productLine.routes.js';
import catalogItemRoutes from '../../modules/catalog-item/catalogItem.routes.js';
import opportunityRoutes from '../../modules/opportunity/opportunity.routes.js';
import activityRoutes from '../../modules/activity/activity.routes.js';
import taskRoutes from '../../modules/task/task.routes.js';
import roadmapRoutes from '../../modules/roadmap/roadmap.routes.js';
import objectiveRoutes from '../../modules/objective/objective.routes.js';
import promotionRoutes from '../../modules/promotion/promotion.routes.js';
import internalNoteRoutes from '../../modules/internal-note/internalNote.routes.js';
import notificationRoutes from '../../modules/notification/notification.routes.js';
import employeeRoutes from '../../modules/employee/employee.routes.js';
import serviceOrderRoutes from '../../modules/service-order/serviceOrder.routes.js';
import dashboardRoutes from '../../modules/dashboard/dashboard.routes.js';
import searchRoutes from '../../modules/search/search.routes.js';

const router = Router();

router.use(userRoutes);
router.use(provinceRoutes);
router.use(localityRoutes);
router.use(companyRoutes);
router.use(cropRoutes);
router.use(contactRoutes);
router.use(productLineRoutes);
router.use(catalogItemRoutes);
router.use(opportunityRoutes);
router.use(activityRoutes);
router.use(taskRoutes);
router.use(roadmapRoutes);
router.use(objectiveRoutes);
router.use(promotionRoutes);
router.use(internalNoteRoutes);
router.use(notificationRoutes);
router.use(employeeRoutes);
router.use(serviceOrderRoutes);
router.use(dashboardRoutes);
router.use(searchRoutes);

export default router;
