/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  ref: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: false
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tipoProducto: {
    type: DataTypes.STRING(50),
    field: 'tipo_producto',
    allowNull: false
  },
  frecuenciaFacturacion: {
    type: DataTypes.STRING(50),
    field: 'frecuencia_facturacion',
    allowNull: false,
    defaultValue: 'Pago único'
  },
  precioUnitario: {
    type: DataTypes.DECIMAL(12, 2),
    field: 'precio_unitario',
    allowNull: false,
    defaultValue: 0
  },
  costeUnidad: {
    type: DataTypes.DECIMAL(12, 2),
    field: 'coste_unidad',
    allowNull: false,
    defaultValue: 0
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  imagenUrl: {
    type: DataTypes.TEXT('long'),
    field: 'imagen_url',
    allowNull: true
  },
  stockDisponible: {
    type: DataTypes.INTEGER,
    field: 'stock_disponible',
    allowNull: true,
    defaultValue: 0
  },
  fechaCreacion: {
    type: DataTypes.DATEONLY,
    field: 'fecha_creacion',
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'productos',
  timestamps: false
});

export default Product;