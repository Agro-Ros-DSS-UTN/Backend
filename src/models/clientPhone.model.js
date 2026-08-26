/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ClientPhone = sequelize.define('ClientPhone', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  numero: {
    type: DataTypes.STRING(20),
    allowNull: false
  }
}, {
  tableName: 'telefonos_cliente',
  timestamps: false
});

export default ClientPhone;
