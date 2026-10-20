import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

// Productos y servicios a ofrecer en un objetivo (Objetivo N:M ItemCatalogo).
// Tabla intermedia: la maneja el repository de objetivos.
export const ObjectiveItem = sequelize.define('ObjectiveItem', {
  objectiveId: { type: DataTypes.INTEGER, primaryKey: true },
  itemId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'objective_items' });
