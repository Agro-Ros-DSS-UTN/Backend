/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Provider = sequelize.define('Provider', {
  numDoc: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    allowNull: false
  },
  nombreApellido: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  direccionMail: {
    type: DataTypes.STRING(150),
    allowNull: true
  }
}, {
  tableName: 'proveedores',
  timestamps: false
});

export default Provider;
