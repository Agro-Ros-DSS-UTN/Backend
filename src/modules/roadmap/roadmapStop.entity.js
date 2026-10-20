import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const STOP_STATUSES = ['pendiente', 'en_camino', 'completada', 'omitida'];

// Parada de una hoja de ruta. Tabla de detalle: la maneja el repository de hojas de ruta.
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
