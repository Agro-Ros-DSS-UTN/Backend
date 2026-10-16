import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

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
