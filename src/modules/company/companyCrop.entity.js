import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

// Empresa N:M Cultivo. Tabla intermedia: la maneja el repository de empresas.
export const CompanyCrop = sequelize.define('CompanyCrop', {
  companyId: { type: DataTypes.INTEGER, primaryKey: true },
  cropId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'company_crops' });
