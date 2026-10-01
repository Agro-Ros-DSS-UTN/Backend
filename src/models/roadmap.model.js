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
  horaRuta: {
    type: DataTypes.STRING(20),
    allowNull: true // hora de inicio propuesta, ej "09:00"
  },
  fechaFinPropuesta: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  horaFinPropuesta: {
    type: DataTypes.STRING(20),
    allowNull: true
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
  // La persona asignada puede ser un admin O un vendedor (User.idUser real).
  // sellerId se mantiene por compatibilidad con las consultas "mis rutas"
  // existentes y se autocompleta cuando el asignado es un vendedor.
  idUserAsignado: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  sellerId: {
    type: DataTypes.INTEGER,
    allowNull: true
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
  },
  // Ciclo de vida real (distinto de la planificación de arriba)
  fechaHoraInicioReal: {
    type: DataTypes.DATE,
    allowNull: true
  },
  fechaHoraFinReal: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'hojas_ruta',
  timestamps: false
});

export default Roadmap;
