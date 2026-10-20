import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

// Promociones a comunicar en un objetivo (Objetivo N:M Promoción).
// Tabla intermedia: la maneja el repository de objetivos.
export const ObjectivePromotion = sequelize.define('ObjectivePromotion', {
  objectiveId: { type: DataTypes.INTEGER, primaryKey: true },
  promotionId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'objective_promotions' });
