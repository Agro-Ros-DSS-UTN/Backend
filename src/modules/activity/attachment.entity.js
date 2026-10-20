import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const ATTACHMENT_TYPES = ['foto', 'audio', 'documento'];

// Adjunto de una actividad (o de una orden de servicio). El archivo se guarda como
// data URL en `content`, que no se trae salvo con el scope `withContent`.
// Tabla de detalle: la maneja el repository de actividades.
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
