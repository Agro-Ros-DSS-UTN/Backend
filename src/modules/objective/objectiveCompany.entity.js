import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

// Empresas a visitar de un objetivo (Objetivo N:M Empresa).
// Tabla intermedia: la maneja el repository de objetivos.
export const ObjectiveCompany = sequelize.define('ObjectiveCompany', {
  objectiveId: { type: DataTypes.INTEGER, primaryKey: true },
  companyId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'objective_companies' });
