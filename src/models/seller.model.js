/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Seller = sequelize.define('Seller', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  productoOfrecido: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  zonaAsignada: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  antiguedad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  seguimientoCliente: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'vendedores',
  timestamps: false
});

export default Seller;