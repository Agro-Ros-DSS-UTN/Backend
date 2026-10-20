import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const ROADMAP_STATUSES = ['planificada', 'en_curso', 'finalizada'];

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

