/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Tabla puente Tarea <-> Usuario (vendedor o administrador). Permite
// "enganchar" una tarea a varias personas a la vez. Cada fila también
// guarda el estado de los recordatorios de Google Calendar / email para
// ESE usuario puntual (cada asignado recibe su propio evento/recordatorio).
const TaskAssignee = sequelize.define('TaskAssignee', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  taskId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'task_id'
  },
  idUser: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'id_user'
  },
  calendarEventId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'calendar_event_id'
  },
  recordatorio48hEnviado: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'recordatorio_48h_enviado'
  },
  recordatorio24hEnviado: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'recordatorio_24h_enviado'
  }
}, {
  tableName: 'tareas_asignados',
  timestamps: false
});

export default TaskAssignee;
