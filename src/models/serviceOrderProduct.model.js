/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ServiceOrderProduct = sequelize.define('ServiceOrderProduct', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ordenServicioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'ordenes_servicio',
      key: 'id'
    }
  },
  // Columnas de la planilla "Detalle del servicio" (una fila por instalación)
  tipoInstalacion: { type: DataTypes.STRING(40), allowNull: true },
  numero: { type: DataTypes.STRING(20), allowNull: true },
  capacidadTn: { type: DataTypes.STRING(20), allowNull: true },
  grano: { type: DataTypes.STRING(60), allowNull: true },
  cantidadTn: { type: DataTypes.STRING(20), allowNull: true },
  estadoCereal: { type: DataTypes.STRING(10), allowNull: true },
  estadoInstalaciones: { type: DataTypes.STRING(10), allowNull: true },
  estadoInfestacion: { type: DataTypes.STRING(10), allowNull: true },
  producto: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  principioActivo: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  dosis: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  lote: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  tiempoCarencia: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  cantidadTotal: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}, {
  tableName: 'orden_servicio_productos',
  timestamps: false
});

export default ServiceOrderProduct;
