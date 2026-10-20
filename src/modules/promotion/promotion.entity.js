import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

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
