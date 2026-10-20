import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

// Persona de una empresa (antes Cliente). Clave numérica propia; el DNI es opcional.
export const Contact = sequelize.define('Contact', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nationalId: { type: DataTypes.STRING(20), allowNull: true },
  fullName: { type: DataTypes.STRING(150), allowNull: false, validate: { notEmpty: true } },
  jobTitle: { type: DataTypes.STRING(50), allowNull: true },
  email: { type: DataTypes.STRING(150), allowNull: true, validate: { isEmail: true } },
  isPrimary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  notes: { type: DataTypes.TEXT, allowNull: true },
  companyId: { type: DataTypes.INTEGER, allowNull: true },
  createdAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
}, { tableName: 'contacts', timestamps: true, createdAt: false, updatedAt: false, paranoid: true, deletedAt: 'deletedAt' });

export const ContactPhone = sequelize.define('ContactPhone', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  contactId: { type: DataTypes.INTEGER, allowNull: false },
  number: { type: DataTypes.STRING(30), allowNull: false },
}, { tableName: 'contact_phones' });
