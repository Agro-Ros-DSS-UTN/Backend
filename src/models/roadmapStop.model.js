/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const RoadmapStop = sequelize.define('RoadmapStop', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  roadmapId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  orden: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  clientCompanyId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  nombreLugar: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  direccion: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  latitud: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  longitud: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  estadoParada: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'pendiente' // 'pendiente' | 'en_camino' | 'completada' | 'omitida'
  },
  horaEstimada: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'hoja_ruta_paradas',
  timestamps: false
});

export default RoadmapStop;
