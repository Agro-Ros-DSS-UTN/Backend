import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const EMPLOYEE_ROLES = ['tecnico', 'supervisor', 'ayudante', 'chofer', 'administrativo'];
// Roles que pueden figurar como técnicos de una orden de servicio.
export const ORDER_EXECUTOR_ROLES = ['tecnico', 'supervisor'];

// Personal operativo: no ingresa al sistema, figura en las órdenes. Solo el rol
// "tecnico" o "supervisor" puede ejecutar una orden de servicio.
export const Employee = sequelize.define('Employee', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fullName: { type: DataTypes.STRING(150), allowNull: false, validate: { notEmpty: true } },
  nationalId: { type: DataTypes.STRING(30), allowNull: true },
  licenseNumber: { type: DataTypes.STRING(50), allowNull: true },
  role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ayudante', validate: { isIn: [EMPLOYEE_ROLES] } },
  jobTitle: { type: DataTypes.STRING(100), allowNull: true },
  phone: { type: DataTypes.STRING(50), allowNull: true },
  email: { type: DataTypes.STRING(150), allowNull: true },
  company: { type: DataTypes.STRING(150), allowNull: true },
  hireDate: { type: DataTypes.DATEONLY, allowNull: true },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  profileImage: { type: DataTypes.TEXT('long'), allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'employees' });
