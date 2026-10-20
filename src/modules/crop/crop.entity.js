import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

// Cultivo que siembra una empresa (meses de necesidad del servicio).
export const Crop = sequelize.define('Crop', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  demandMonths: { type: DataTypes.STRING(40), allowNull: true },
}, { tableName: 'crops' });
