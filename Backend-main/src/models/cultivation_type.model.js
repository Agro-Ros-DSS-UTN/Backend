/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CultivationType = sequelize.define('CultivationType', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tipoCultivo: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: 'tipos_cultivo',
  timestamps: false
});

export default CultivationType;
