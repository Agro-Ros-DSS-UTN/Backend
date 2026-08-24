/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Roadmap = sequelize.define('Roadmap', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombreZona: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  descripcion: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  fechaRuta: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  fechaNota: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  estado: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'planificada' // 'planificada' | 'en_curso' | 'finalizada'
  },
  sellerId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  creadoPorId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  distanciaEstimadaKm: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'hojas_ruta',
  timestamps: false
});

export default Roadmap;
