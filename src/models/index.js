/* eslint-disable */
import sequelize from '../config/database.js';
import Client from './client.model.js';
import User from './user.model.js';
import ClientPhone from './clientPhone.model.js';
import UserPhone from './userPhone.model.js';
import ClientCompany from './clientCompany.model.js';
import Locality from './locality.model.js';
import Province from './province.model.js';
import TypeProduct from './typeProduct.model.js';
import ProductLine from './productLine.model.js';
import Product from './product.model.js';
import CultivationType from './cultivationType.model.js';
import Seller from './seller.model.js';
import activityForm from './activityForm.js';
import Opportunity from './opportunity.model.js';
import Objective from './objective.model.js';
import service from './service.model.js';
import attachmentFA from './attachmentFA.model.js';
import Promotion from './promotion.js';
import Task from './task.model.js';
import Roadmap from './roadmap.model.js';
import RoadmapStop from './roadmapStop.model.js';
import InternalNote from './internalNote.model.js';
import ServiceOrder from './serviceOrder.model.js';
import ServiceOrderProduct from './serviceOrderProduct.model.js';
import ServiceEvaluation from './serviceEvaluation.model.js';
import Employee from './employee.model.js';

// Relación Cliente -> Telefonos (1..n)
Client.hasMany(ClientPhone, { foreignKey: 'clientNumDoc', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
ClientPhone.belongsTo(Client, { foreignKey: 'clientNumDoc' });

// Relación Usuario -> Telefonos (1..n)
User.hasMany(UserPhone, { foreignKey: 'idUser', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
UserPhone.belongsTo(User, { foreignKey: 'idUser' });

// Relación EmpresaCliente -> Cliente/Contacto (1..n)
ClientCompany.hasMany(Client, { foreignKey: 'clientCompanyId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Client.belongsTo(ClientCompany, { foreignKey: 'clientCompanyId' });

// Relación Localidad -> Cliente (1..n)
Locality.hasMany(Client, { foreignKey: 'localityCodPostal', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Client.belongsTo(Locality, { foreignKey: 'localityCodPostal' });

// Relación Provincia -> Localidad (1..n)
Province.hasMany(Locality, { foreignKey: 'provinceId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Locality.belongsTo(Province, { foreignKey: 'provinceId' });

// Relación Localidad -> EmpresaCliente (1..n)
Locality.hasMany(ClientCompany, { foreignKey: 'localityCodPostal', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
ClientCompany.belongsTo(Locality, { foreignKey: 'localityCodPostal' });

// Relación TipoProducto -> LineaProducto (1..n)
TypeProduct.hasMany(ProductLine, { foreignKey: 'typeProductId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
ProductLine.belongsTo(TypeProduct, { foreignKey: 'typeProductId' });

// Relación EmpresaCliente <-> LineaProd (muchos a muchos)
ClientCompany.belongsToMany(ProductLine, {
  through: 'empresa_linea_producto',
  foreignKey: 'clientCompanyId',
  otherKey: 'productLineId'
});
ProductLine.belongsToMany(ClientCompany, {
  through: 'empresa_linea_producto',
  foreignKey: 'productLineId',
  otherKey: 'clientCompanyId'
});

// Relación EmpresaCliente <-> TipoCultivo (muchos a muchos)
ClientCompany.belongsToMany(CultivationType, {
  through: 'empresa_tipo_cultivo',
  foreignKey: 'clientCompanyId',
  otherKey: 'cultivationTypeId'
});
CultivationType.belongsToMany(ClientCompany, {
  through: 'empresa_tipo_cultivo',
  foreignKey: 'cultivationTypeId',
  otherKey: 'clientCompanyId'
});

// Relación Promoción <-> LineaProd (muchos a muchos)
Promotion.belongsToMany(ProductLine, {
  through: 'promocion_linea_producto',
  foreignKey: 'promotionId',
  otherKey: 'productLineId'
});
ProductLine.belongsToMany(Promotion, {
  through: 'promocion_linea_producto',
  foreignKey: 'productLineId',
  otherKey: 'promotionId'
});

// Relación Objetivo <-> Promoción (muchos a muchos)
Objective.belongsToMany(Promotion, {
  through: 'objetivo_promocion',
  foreignKey: 'objectiveId',
  otherKey: 'promotionId'
});
Promotion.belongsToMany(Objective, {
  through: 'objetivo_promocion',
  foreignKey: 'promotionId',
  otherKey: 'objectiveId'
});

// Relación Usuario -> Vendedor (1..1)
User.hasOne(Seller, { foreignKey: 'idUser', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Seller.belongsTo(User, { foreignKey: 'idUser' });

// Relación Usuario -> Notas Internas (1..n)
User.hasMany(InternalNote, { foreignKey: 'idUser', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
InternalNote.belongsTo(User, { foreignKey: 'idUser' });

// Relación Vendedor -> FormularioActividad (1..n)
Seller.hasMany(activityForm, { foreignKey: 'sellerId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
activityForm.belongsTo(Seller, { foreignKey: 'sellerId' });

// Relación Vendedor -> Objetivo (1..n)
Seller.hasMany(Objective, { foreignKey: 'sellerId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Objective.belongsTo(Seller, { foreignKey: 'sellerId' });

// Relación Vendedor -> HojaRuta (1..n)
Seller.hasMany(Roadmap, { foreignKey: 'sellerId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Roadmap.belongsTo(Seller, { foreignKey: 'sellerId' });

// Relación HojaRuta -> Paradas (1..n)
Roadmap.hasMany(RoadmapStop, { foreignKey: 'roadmapId', as: 'paradas', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
RoadmapStop.belongsTo(Roadmap, { foreignKey: 'roadmapId' });

// Relación Vendedor -> Tareas Asignadas (1..n)
Seller.hasMany(Task, { foreignKey: 'sellerId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Task.belongsTo(Seller, { foreignKey: 'sellerId' });

// Relación EmpresaCliente -> Oportunidad (1..n)
ClientCompany.hasMany(Opportunity, { foreignKey: 'clientCompanyId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Opportunity.belongsTo(ClientCompany, { foreignKey: 'clientCompanyId' });

// Relación EmpresaCliente -> Objetivo (1..n)
ClientCompany.hasMany(Objective, { foreignKey: 'clientCompanyId', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Objective.belongsTo(ClientCompany, { foreignKey: 'clientCompanyId' });

// Relación Vendedor -> Oportunidad (1..n)
Seller.hasMany(Opportunity, { foreignKey: 'sellerId', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
Opportunity.belongsTo(Seller, { foreignKey: 'sellerId' });

// Relación Oportunidad -> FormularioActividad (1..n)
Opportunity.hasMany(activityForm, { foreignKey: 'opportunityId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
activityForm.belongsTo(Opportunity, { foreignKey: 'opportunityId' });

// Relación FormularioActividad -> Tareas de Seguimiento (1..n)
activityForm.hasMany(Task, { foreignKey: 'formularioActividadId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Task.belongsTo(activityForm, { foreignKey: 'formularioActividadId' });

// Relación FormularioActividad -> Archivos Adjuntos (1..n)
activityForm.hasMany(attachmentFA, {
  foreignKey: 'formularioActividadId',
  as: 'archivos'
});
attachmentFA.belongsTo(activityForm, {
  foreignKey: 'formularioActividadId'
});

// Relación FormularioActividad -> Servicio (1..n)
activityForm.hasMany(service, {
  foreignKey: 'formularioActividadId',
  onDelete: 'CASCADE', 
  onUpdate: 'CASCADE'
});
service.belongsTo(activityForm, {
  foreignKey: 'formularioActividadId'
});


// ── Relaciones Órdenes de Servicio ──
ServiceOrder.hasMany(ServiceOrderProduct, {
  as: 'productosAplicados',
  foreignKey: 'ordenServicioId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
ServiceOrderProduct.belongsTo(ServiceOrder, {
  foreignKey: 'ordenServicioId'
});

ServiceOrder.hasOne(ServiceEvaluation, {
  as: 'evaluacion',
  foreignKey: 'ordenServicioId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
ServiceEvaluation.belongsTo(ServiceOrder, {
  foreignKey: 'ordenServicioId'
});

export {
  sequelize,
  Client,
  User,
  ClientPhone,
  UserPhone,
  ClientCompany,
  Locality,
  Province,
  TypeProduct,
  ProductLine,
  Product,
  CultivationType,
  Seller,
  activityForm,
  Opportunity,
  Objective,
  service,
  attachmentFA,
  Promotion,
  Task,
  Roadmap,
  RoadmapStop,
  InternalNote,
  ServiceOrder,
  ServiceOrderProduct,
  ServiceEvaluation,
  Employee
};
