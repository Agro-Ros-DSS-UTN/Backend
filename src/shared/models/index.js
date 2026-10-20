// Modelo de dominio v2 (ver docs/DiagramaMD-DSS-v2.1.drawio).
// Las reglas ON DELETE de la base las define la migración 0009; acá se declaran
// las asociaciones con `constraints: false` para que Sequelize nunca intente
// crear o alterar FKs por su cuenta.
import sequelize from '../config/database.js';
import User from '../../modules/user/user.entity.js';
import { Province, Locality, UserLocality } from '../../modules/territory/territory.entity.js';
import { Company, Crop, CompanyCrop } from '../../modules/company/company.entity.js';
import { Contact, ContactPhone } from '../../modules/contact/contact.entity.js';
import { Employee } from '../../modules/employee/employee.entity.js';
import { ProductLine, CatalogItem } from '../../modules/catalog/catalog.entity.js';
import { Opportunity, OpportunityItem } from '../../modules/opportunity/opportunity.entity.js';
import { Promotion, PromotionItem } from '../../modules/promotion/promotion.entity.js';
import { Activity, Attachment } from '../../modules/activity/activity.entity.js';
import { Task, TaskAssignee } from '../../modules/task/task.entity.js';
import { Roadmap, RoadmapStop } from '../../modules/roadmap/roadmap.entity.js';
import { Objective, ObjectiveCompany, ObjectiveItem, ObjectivePromotion } from '../../modules/objective/objective.entity.js';
import { InternalNote } from '../../modules/internal-note/internalNote.entity.js';
import { Notification } from '../../modules/notification/notification.entity.js';
import { ServiceOrder, ServiceOrderEmployee, AppliedProduct, ServiceEvaluation } from '../../modules/service-order/serviceOrder.entity.js';

const nc = { constraints: false };

// ── Territorio ──
Province.hasMany(Locality, { foreignKey: 'provinceId', as: 'localities', ...nc });
Locality.belongsTo(Province, { foreignKey: 'provinceId', as: 'province', ...nc });
User.belongsToMany(Locality, { through: UserLocality, foreignKey: 'userId', otherKey: 'localityId', as: 'zone', ...nc });
Locality.belongsToMany(User, { through: UserLocality, foreignKey: 'localityId', otherKey: 'userId', as: 'sellers', ...nc });

// ── Empresas y contactos ──
Locality.hasMany(Company, { foreignKey: 'localityId', as: 'companies', ...nc });
Company.belongsTo(Locality, { foreignKey: 'localityId', as: 'locality', ...nc });
Company.hasMany(Company, { foreignKey: 'parentCompanyId', as: 'branches', ...nc });
Company.belongsTo(Company, { foreignKey: 'parentCompanyId', as: 'parentCompany', ...nc });
Company.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy', ...nc });
Company.belongsToMany(Crop, { through: CompanyCrop, foreignKey: 'companyId', otherKey: 'cropId', as: 'crops', ...nc });
Crop.belongsToMany(Company, { through: CompanyCrop, foreignKey: 'cropId', otherKey: 'companyId', as: 'companies', ...nc });
Company.hasMany(Contact, { foreignKey: 'companyId', as: 'contacts', ...nc });
Contact.belongsTo(Company, { foreignKey: 'companyId', as: 'company', ...nc });
Contact.hasMany(ContactPhone, { foreignKey: 'contactId', as: 'phones', ...nc });
ContactPhone.belongsTo(Contact, { foreignKey: 'contactId', ...nc });

// ── Catálogo ──
ProductLine.hasMany(CatalogItem, { foreignKey: 'productLineId', as: 'items', ...nc });
CatalogItem.belongsTo(ProductLine, { foreignKey: 'productLineId', as: 'productLine', ...nc });

// ── Gestión comercial ──
Company.hasMany(Opportunity, { foreignKey: 'companyId', as: 'opportunities', ...nc });
Opportunity.belongsTo(Company, { foreignKey: 'companyId', as: 'company', ...nc });
Opportunity.belongsTo(User, { foreignKey: 'userId', as: 'owner', ...nc });
User.hasMany(Opportunity, { foreignKey: 'userId', as: 'opportunities', ...nc });
Opportunity.belongsTo(Contact, { foreignKey: 'contactId', as: 'contact', ...nc });
Opportunity.belongsToMany(CatalogItem, { through: OpportunityItem, foreignKey: 'opportunityId', otherKey: 'itemId', as: 'items', ...nc });
CatalogItem.belongsToMany(Opportunity, { through: OpportunityItem, foreignKey: 'itemId', otherKey: 'opportunityId', as: 'opportunities', ...nc });

Opportunity.hasMany(Activity, { foreignKey: 'opportunityId', as: 'activities', ...nc });
Activity.belongsTo(Opportunity, { foreignKey: 'opportunityId', as: 'opportunity', ...nc });
Activity.belongsTo(User, { foreignKey: 'userId', as: 'author', ...nc });
User.hasMany(Activity, { foreignKey: 'userId', as: 'activities', ...nc });
Activity.hasMany(Attachment, { foreignKey: 'activityId', as: 'attachments', ...nc });
Attachment.belongsTo(Activity, { foreignKey: 'activityId', as: 'activity', ...nc });
Activity.hasMany(Task, { foreignKey: 'activityId', as: 'tasks', ...nc });
Task.belongsTo(Activity, { foreignKey: 'activityId', as: 'activity', ...nc });

Task.belongsTo(Company, { foreignKey: 'companyId', as: 'company', ...nc });
Task.belongsTo(Contact, { foreignKey: 'contactId', as: 'contact', ...nc });
Task.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy', ...nc });
Task.belongsTo(User, { foreignKey: 'completedById', as: 'completedBy', ...nc });
Task.hasMany(TaskAssignee, { foreignKey: 'taskId', as: 'assignments', ...nc });
TaskAssignee.belongsTo(Task, { foreignKey: 'taskId', as: 'task', ...nc });
TaskAssignee.belongsTo(User, { foreignKey: 'userId', as: 'user', ...nc });
User.hasMany(TaskAssignee, { foreignKey: 'userId', as: 'assignments', ...nc });

// ── Planificación ──
Roadmap.belongsTo(User, { foreignKey: 'userId', as: 'assigned', ...nc });
Roadmap.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy', ...nc });
Roadmap.hasMany(RoadmapStop, { foreignKey: 'roadmapId', as: 'stops', ...nc });
RoadmapStop.belongsTo(Roadmap, { foreignKey: 'roadmapId', as: 'roadmap', ...nc });
RoadmapStop.belongsTo(Company, { foreignKey: 'companyId', as: 'company', ...nc });
RoadmapStop.hasOne(Activity, { foreignKey: 'roadmapStopId', as: 'activity', ...nc });
Activity.belongsTo(RoadmapStop, { foreignKey: 'roadmapStopId', as: 'stop', ...nc });

Objective.belongsTo(User, { foreignKey: 'userId', as: 'seller', ...nc });
Objective.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy', ...nc });
User.hasMany(Objective, { foreignKey: 'userId', as: 'objectives', ...nc });
Objective.belongsToMany(Company, { through: ObjectiveCompany, foreignKey: 'objectiveId', otherKey: 'companyId', as: 'companies', ...nc });
Company.belongsToMany(Objective, { through: ObjectiveCompany, foreignKey: 'companyId', otherKey: 'objectiveId', as: 'objectives', ...nc });
Objective.belongsToMany(CatalogItem, { through: ObjectiveItem, foreignKey: 'objectiveId', otherKey: 'itemId', as: 'items', ...nc });
Objective.belongsToMany(Promotion, { through: ObjectivePromotion, foreignKey: 'objectiveId', otherKey: 'promotionId', as: 'promotions', ...nc });
Promotion.belongsToMany(Objective, { through: ObjectivePromotion, foreignKey: 'promotionId', otherKey: 'objectiveId', as: 'objectives', ...nc });
Promotion.belongsToMany(CatalogItem, { through: PromotionItem, foreignKey: 'promotionId', otherKey: 'itemId', as: 'items', ...nc });
CatalogItem.belongsToMany(Promotion, { through: PromotionItem, foreignKey: 'itemId', otherKey: 'promotionId', as: 'promotions', ...nc });

InternalNote.belongsTo(User, { foreignKey: 'userId', as: 'author', ...nc });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user', ...nc });

// ── Servicios de control de plagas ──
Company.hasMany(ServiceOrder, { foreignKey: 'companyId', as: 'serviceOrders', ...nc });
ServiceOrder.belongsTo(Company, { foreignKey: 'companyId', as: 'company', ...nc });
ServiceOrder.belongsTo(CatalogItem, { foreignKey: 'serviceId', as: 'service', ...nc });
ServiceOrder.belongsTo(Opportunity, { foreignKey: 'opportunityId', as: 'opportunity', ...nc });
Opportunity.hasMany(ServiceOrder, { foreignKey: 'opportunityId', as: 'serviceOrders', ...nc });
ServiceOrder.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy', ...nc });
ServiceOrder.belongsToMany(Employee, { through: ServiceOrderEmployee, foreignKey: 'serviceOrderId', otherKey: 'employeeId', as: 'technicians', ...nc });
Employee.belongsToMany(ServiceOrder, { through: ServiceOrderEmployee, foreignKey: 'employeeId', otherKey: 'serviceOrderId', as: 'orders', ...nc });
ServiceOrder.hasMany(AppliedProduct, { foreignKey: 'serviceOrderId', as: 'appliedProducts', ...nc });
AppliedProduct.belongsTo(ServiceOrder, { foreignKey: 'serviceOrderId', ...nc });
AppliedProduct.belongsTo(CatalogItem, { foreignKey: 'itemId', as: 'item', ...nc });
ServiceOrder.hasOne(ServiceEvaluation, { foreignKey: 'serviceOrderId', as: 'evaluation', ...nc });
ServiceEvaluation.belongsTo(ServiceOrder, { foreignKey: 'serviceOrderId', ...nc });
ServiceOrder.hasMany(Activity, { foreignKey: 'serviceOrderId', as: 'technicalVisits', ...nc });
Activity.belongsTo(ServiceOrder, { foreignKey: 'serviceOrderId', as: 'serviceOrder', ...nc });
ServiceOrder.hasMany(Attachment, { foreignKey: 'serviceOrderId', as: 'attachments', ...nc });
Attachment.belongsTo(ServiceOrder, { foreignKey: 'serviceOrderId', as: 'serviceOrder', ...nc });

export {
  sequelize,
  User, Province, Locality, UserLocality,
  Company, Crop, CompanyCrop, Contact, ContactPhone,
  ProductLine, CatalogItem,
  Opportunity, OpportunityItem, Activity, Attachment, Task, TaskAssignee,
  Roadmap, RoadmapStop, Objective, ObjectiveCompany, ObjectiveItem, ObjectivePromotion,
  Promotion, PromotionItem, InternalNote, Notification,
  Employee, ServiceOrder, ServiceOrderEmployee, AppliedProduct, ServiceEvaluation,
};
