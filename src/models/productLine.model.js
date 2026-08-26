/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ProductLine = sequelize.define('ProductLine', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  lineaProducto: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: 'lineas_producto',
  timestamps: false
});

export default ProductLine;
