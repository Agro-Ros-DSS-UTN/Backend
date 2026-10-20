import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const ACTIVITY_CONTACT_TYPES = ['visita', 'llamada', 'whatsapp', 'email', 'reunion'];

// Actividad: algo que ya pasó. Pertenece a una Oportunidad o a una OrdenServicio
// (visita técnica), nunca a las dos; la regla se valida en el servicio.
export const Activity = sequelize.define('Activity', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  contactType: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'visita', validate: { isIn: [ACTIVITY_CONTACT_TYPES] } },
  occurredAt: { type: DataTypes.DATE, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  result: { type: DataTypes.STRING(255), allowNull: true },
  saleAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  noFollowUp: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  opportunityId: { type: DataTypes.INTEGER, allowNull: true },
  serviceOrderId: { type: DataTypes.INTEGER, allowNull: true },
  roadmapStopId: { type: DataTypes.INTEGER, allowNull: true },
  userId: { type: DataTypes.STRING(20), allowNull: true },
  createdAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  clientUuid: { type: DataTypes.STRING(36), allowNull: true },
}, { tableName: 'activities' });

