/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Evaluación de Servicio digital — vinculada 1:1 a una Orden de Servicio existente.
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
  fechaEvaluacion: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  estadoCereal: {
    type: DataTypes.STRING(5),
    allowNull: false,
    defaultValue: 'A' // 'A' | 'B' | 'C'
  },
  lugarToma: {
    type: DataTypes.STRING(150),
    allowNull: false,
    defaultValue: 'Superficie'
  },
  resultado: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'Sin insectos vivos'
    // 'Sin insectos vivos' | 'Con insectos vivos' | 'Seguimiento' | 'Refumigación'
  },
  ppmPH3: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  recomendaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  fotos: {
    type: DataTypes.TEXT('long'),
    allowNull: true // JSON array de imágenes en base64
  },
  firmaCliente: {
    type: DataTypes.TEXT('long'),
    allowNull: true // imagen de firma digital en base64
  },
  firmaTecnico: {
    type: DataTypes.TEXT('long'),
    allowNull: true // imagen de firma digital en base64 (obligatoria a nivel de UI)
  }
}, {
  tableName: 'evaluaciones_servicio',
  timestamps: false
});

export default ServiceEvaluation;
