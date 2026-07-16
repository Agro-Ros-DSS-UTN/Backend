/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Client = sequelize.define('Client', {
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
  },
  tipoClient: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  codigoPostal: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  nota: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  fechaAgregado: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'clientes',
  timestamps: false
});

export default Client;
