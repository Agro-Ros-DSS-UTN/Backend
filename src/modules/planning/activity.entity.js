import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const ACTIVITY_CONTACT_TYPES = ['visita', 'llamada', 'whatsapp', 'email', 'reunion'];
export const ATTACHMENT_TYPES = ['foto', 'audio', 'documento'];

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

export const Attachment = sequelize.define('Attachment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  activityId: { type: DataTypes.INTEGER, allowNull: true },
  serviceOrderId: { type: DataTypes.INTEGER, allowNull: true },
  type: { type: DataTypes.STRING(12), allowNull: false, validate: { isIn: [ATTACHMENT_TYPES] } },
  fileName: { type: DataTypes.STRING(200), allowNull: true },
  mimeType: { type: DataTypes.STRING(100), allowNull: true },
  sizeKb: { type: DataTypes.INTEGER, allowNull: true },
  content: { type: DataTypes.TEXT('long'), allowNull: false },
  uploadedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'attachments',
  defaultScope: { attributes: { exclude: ['content'] } },
  scopes: { withContent: {} },
});
