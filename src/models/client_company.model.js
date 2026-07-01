/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ClientCompany = sequelize.define('ClientCompany', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombEmp: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  desc: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ubicacion: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  estado: {
    type: DataTypes.STRING(20),
    allowNull: false
  }
}, {
  tableName: 'empresas_clientes',
  timestamps: false
});

export default ClientCompany;
