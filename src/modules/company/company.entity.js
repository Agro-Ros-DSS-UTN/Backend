import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const COMPANY_LEVELS = ['independiente', 'madre', 'region', 'subsede'];

// Empresa cliente (antes EmpresaCliente). Baja lógica con fecha_baja (paranoid):
// las consultas normales no la ven, pero su historial queda intacto.
export const Company = sequelize.define('Company', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  legalName: { type: DataTypes.STRING(150), allowNull: false, validate: { notEmpty: true } },
  tradeName: { type: DataTypes.STRING(150), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  cuit: { type: DataTypes.STRING(20), allowNull: false },
  address: { type: DataTypes.STRING(150), allowNull: true },
  companyType: { type: DataTypes.STRING(50), allowNull: false },
  areaHa: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  currentSupplier: { type: DataTypes.STRING(150), allowNull: true },
  level: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'independiente', validate: { isIn: [COMPANY_LEVELS] } },
  parentCompanyId: { type: DataTypes.INTEGER, allowNull: true },
  localityId: { type: DataTypes.STRING(20), allowNull: true },
  latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  createdById: { type: DataTypes.STRING(20), allowNull: true },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'companies', timestamps: true, createdAt: false, updatedAt: false, paranoid: true, deletedAt: 'deletedAt' });
