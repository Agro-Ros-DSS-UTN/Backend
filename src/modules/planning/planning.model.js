import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const ROADMAP_STATUSES = ['planificada', 'en_curso', 'finalizada'];
export const STOP_STATUSES = ['pendiente', 'en_camino', 'completada', 'omitida'];
export const OBJECTIVE_TYPES = ['visitas', 'ventas', 'nuevosClientes', 'cotizaciones', 'servicios'];
export const PERIOD_TYPES = ['semanal', 'mensual'];

export const Roadmap = sequelize.define('Roadmap', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(150), allowNull: true },
  description: { type: DataTypes.STRING(200), allowNull: true },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  plannedStartTime: { type: DataTypes.STRING(20), allowNull: true },
  plannedEndDate: { type: DataTypes.DATEONLY, allowNull: true },
  plannedEndTime: { type: DataTypes.STRING(20), allowNull: true },
  status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'planificada', validate: { isIn: [ROADMAP_STATUSES] } },
  userId: { type: DataTypes.STRING(20), allowNull: true },
  createdById: { type: DataTypes.STRING(20), allowNull: true },
  estimatedDistanceKm: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 },
  notes: { type: DataTypes.TEXT, allowNull: true },
  actualStartAt: { type: DataTypes.DATE, allowNull: true },
  actualEndAt: { type: DataTypes.DATE, allowNull: true },
  createdAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
}, { tableName: 'roadmaps' });

export const RoadmapStop = sequelize.define('RoadmapStop', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  roadmapId: { type: DataTypes.INTEGER, allowNull: false },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  companyId: { type: DataTypes.INTEGER, allowNull: true },
  placeName: { type: DataTypes.STRING(200), allowNull: false },
  address: { type: DataTypes.STRING(255), allowNull: true },
  latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'pendiente', validate: { isIn: [STOP_STATUSES] } },
  estimatedTime: { type: DataTypes.STRING(50), allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  url: { type: DataTypes.STRING(500), allowNull: true, validate: { isUrl: { protocols: ['http', 'https'], require_protocol: true } } },
  source: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'planificada' },
}, { tableName: 'roadmap_stops' });

export const Objective = sequelize.define('Objective', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  description: { type: DataTypes.STRING(150), allowNull: false, validate: { notEmpty: true } },
  objectiveType: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [OBJECTIVE_TYPES] } },
  periodType: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'semanal', validate: { isIn: [PERIOD_TYPES] } },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: false },
  targetAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: true, validate: { min: 0 } },
  userId: { type: DataTypes.STRING(20), allowNull: true },
  createdById: { type: DataTypes.STRING(20), allowNull: true },
  createdAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
}, { tableName: 'objectives' });

export const ObjectiveCompany = sequelize.define('ObjectiveCompany', {
  objectiveId: { type: DataTypes.INTEGER, primaryKey: true },
  companyId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'objective_companies' });

export const ObjectiveItem = sequelize.define('ObjectiveItem', {
  objectiveId: { type: DataTypes.INTEGER, primaryKey: true },
  itemId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'objective_items' });

export const ObjectivePromotion = sequelize.define('ObjectivePromotion', {
  objectiveId: { type: DataTypes.INTEGER, primaryKey: true },
  promotionId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'objective_promotions' });

export const Promotion = sequelize.define('Promotion', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false, validate: { notEmpty: true } },
  description: { type: DataTypes.STRING(255), allowNull: true },
  benefit: { type: DataTypes.STRING(120), allowNull: true },
  conditions: { type: DataTypes.STRING(255), allowNull: true },
  color: { type: DataTypes.STRING(20), allowNull: true, validate: { is: /^#[0-9a-fA-F]{3,8}$/ } },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: false },
  createdById: { type: DataTypes.STRING(20), allowNull: true },
}, { tableName: 'promotions' });

export const PromotionItem = sequelize.define('PromotionItem', {
  promotionId: { type: DataTypes.INTEGER, primaryKey: true },
  itemId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'promotion_items' });

export const InternalNote = sequelize.define('InternalNote', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  category: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'general', validate: { isIn: [['pedido', 'despacho', 'general']] } },
  description: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } },
  status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'abierta', validate: { isIn: [['abierta', 'resuelta']] } },
  createdAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  userId: { type: DataTypes.STRING(20), allowNull: false },
}, { tableName: 'internal_notes' });

export const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.STRING(20), allowNull: false },
  type: { type: DataTypes.STRING(30), allowNull: false },
  message: { type: DataTypes.STRING(255), allowNull: false },
  entity: { type: DataTypes.STRING(30), allowNull: true },
  entityId: { type: DataTypes.STRING(30), allowNull: true },
  isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  occurredAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'notifications' });
