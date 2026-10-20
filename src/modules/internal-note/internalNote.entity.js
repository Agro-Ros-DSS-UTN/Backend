import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const INTERNAL_NOTE_CATEGORIES = ['pedido', 'despacho', 'general'];
export const INTERNAL_NOTE_STATUSES = ['abierta', 'resuelta'];

export const InternalNote = sequelize.define('InternalNote', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  category: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'general', validate: { isIn: [INTERNAL_NOTE_CATEGORIES] } },
  description: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } },
  status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'abierta', validate: { isIn: [INTERNAL_NOTE_STATUSES] } },
  createdAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  userId: { type: DataTypes.STRING(20), allowNull: false },
}, { tableName: 'internal_notes' });
