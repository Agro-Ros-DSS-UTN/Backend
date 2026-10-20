import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const OBJECTIVE_TYPES = ['visitas', 'ventas', 'nuevosClientes', 'cotizaciones', 'servicios'];
export const PERIOD_TYPES = ['semanal', 'mensual'];

export const Objective = sequelize.define('Objective', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  description: { type: DataTypes.STRING(150), allowNull: false, validate: { notEmpty: true } },
  objectiveType: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [OBJECTIVE_TYPES] } },
  periodType: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'semanal', validate: { isIn: [PERIOD_TYPES] } },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: false },
  targetAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: true, validate: { min: 0 } },
  userId: { type: DataTypes.STRING(20), allowNull: true },
  createdById: { type: DataTypes.STRING(20), allowNull: true },
  createdAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
}, { tableName: 'objectives' });



