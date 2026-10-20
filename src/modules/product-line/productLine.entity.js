import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const LINE_CATEGORIES = ['insecticida', 'fumigante', 'rodenticida', 'fertilizante', 'otro'];

export const ProductLine = sequelize.define('ProductLine', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(30), allowNull: true },
  name: { type: DataTypes.STRING(100), allowNull: false, validate: { notEmpty: true } },
  category: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'otro', validate: { isIn: [LINE_CATEGORIES] } },
}, { tableName: 'product_lines' });
