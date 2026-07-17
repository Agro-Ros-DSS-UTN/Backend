/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ClientCompany = sequelize.define('ClientCompany', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombreEmpresa: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  descEmpresa: {
    type: DataTypes.TEXT,
    allowNull: true // [0..1]
  },
  direccionEmpresa: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  fechaRegistro: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  cuit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true
  },
  proveedorActual: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  superficieHa: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true // [0..N] -> ver nota abajo
  },
  tipoEmpresa: {
    type: DataTypes.STRING(50),
    allowNull: false
  }
}, {
  tableName: 'empresas_clientes',
  timestamps: false
});

export default ClientCompany;
