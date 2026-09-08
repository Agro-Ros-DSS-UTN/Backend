/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ServiceEvaluation = sequelize.define('ServiceEvaluation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ordenServicioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'ordenes_servicio',
      key: 'id'
    }
  },
  calificacion: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5
  },
  conformidad: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'Conforme'
  },
  cumplimientoEPP: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  puntualidad: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  limpiezaArea: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  observacionesTecnicas: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  responsableReceptor: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  dniReceptor: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  cargoReceptor: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  fechaEvaluacion: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'evaluaciones_servicio',
  timestamps: false
});

export default ServiceEvaluation;
