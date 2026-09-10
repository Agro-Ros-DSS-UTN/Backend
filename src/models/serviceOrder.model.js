/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ServiceOrder = sequelize.define('ServiceOrder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  numeroOrden: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  clienteId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  clienteNombre: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  centroId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  centroNombre: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  plantaId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  plantaNombre: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  silo: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  direccion: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  localidad: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  provincia: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  tipoTrabajo: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  estado: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'Programada'
  },
  tecnicoAplicador: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  observacionesOrden: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  fechaCreacion: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'ordenes_servicio',
  timestamps: false
});

export default ServiceOrder;
