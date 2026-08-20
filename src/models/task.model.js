/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  fechaCreacion: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  fechaVencimiento: {
    type: DataTypes.DATE,
    allowNull: true
  },
  destinatarioRol: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'vendedor' // 'vendedor' | 'administrador'
  },
  estado: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'pendiente' // 'pendiente' | 'en_progreso' | 'completada' | 'cancelada'
  },
  sellerId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  formularioActividadId: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'tareas',
  timestamps: false
});

export default Task;
