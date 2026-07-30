/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TypeProduct = sequelize.define('TypeProduct', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tipoProducto: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: 'tipos_producto',
  timestamps: false
});

export default TypeProduct;
