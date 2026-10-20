import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

// Provincia: toma el código oficial de georef (datos.gob.ar).
export const Province = sequelize.define('Province', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
  name: { type: DataTypes.STRING(100), allowNull: false },
}, { tableName: 'provinces' });
