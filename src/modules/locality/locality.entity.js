import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

// Localidad: toma el código oficial de georef (datos.gob.ar).
// Las localidades cargadas antes de la v2 tienen id sintético "cp-<código postal>".
export const Locality = sequelize.define('Locality', {
  id: { type: DataTypes.STRING(20), primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  postalCode: { type: DataTypes.STRING(10), allowNull: true },
  latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  provinceId: { type: DataTypes.INTEGER, allowNull: true },
}, { tableName: 'localities' });
