/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Opportunity = sequelize.define('Opportunity', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombreNegocio: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  pipeline: {
    type: DataTypes.STRING(120),
    allowNull: true
  },
  etapaComercial: {
    type: DataTypes.STRING(60),
    allowNull: true // clave de etapa del pipeline (ej. 'cita_programada')
  },
  estado: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'Lead'
  },
  prioridad: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'Media'
  },
  tipoNegocio: {
    type: DataTypes.STRING(60),
    allowNull: true
  },
  propietario: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  contactoNombre: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  potencialidadCliente: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  volumenPotencial: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  volumenFacturado: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  fechaInicio: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  fechaCierre: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  fechaUltimaActualizacion: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sellerId: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'oportunidades',
  timestamps: false
});

export default Opportunity;
