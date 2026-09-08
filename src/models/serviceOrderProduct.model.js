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
  producto: {
    type: DataTypes.STRING(150),
    allowNull: false
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
