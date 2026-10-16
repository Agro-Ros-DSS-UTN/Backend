import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const ROADMAP_STATUSES = ['planificada', 'en_curso', 'finalizada'];
export const STOP_STATUSES = ['pendiente', 'en_camino', 'completada', 'omitida'];

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
