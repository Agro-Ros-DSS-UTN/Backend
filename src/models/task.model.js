/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  titulo: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tipo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'llamada' // 'llamada' | 'visita' | 'correo' | 'reunion' | 'tarea'
  },
  prioridad: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'Media' // 'Alta' | 'Media' | 'Baja'
  },
  fechaCreacion: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  fechaVencimiento: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  horaVencimiento: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  empresa: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  contacto: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  asignadoA: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  creadoPorRol: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'administrador' // 'administrador' | 'vendedor'
  },
  destinatarioRol: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'vendedor' // 'vendedor' | 'administrador'
  },
  estado: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'Pendiente' // 'Pendiente' | 'En progreso' | 'Completada' | 'Cancelada'
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
