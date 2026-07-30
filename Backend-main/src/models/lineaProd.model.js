/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const lineaProd = sequelize.define('lineaProd', {
  nombreLinea: {
    type: DataTypes.STRING(100),
    primaryKey: false,
    allowNull: false
  },
  codLinea: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  categoria: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: 'lineas_prod',
  timestamps: false
});

export default lineaProd;