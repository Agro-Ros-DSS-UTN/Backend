/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ProviderPhone = sequelize.define('ProviderPhone', {
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
  tableName: 'telefonos_proveedor',
  timestamps: false
});

export default ProviderPhone;
