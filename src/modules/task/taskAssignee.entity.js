import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

// Asignado de una tarea (Tarea N:M Usuario), con su evento de calendario y los
// recordatorios ya enviados. Tabla intermedia: la maneja el repository de tareas.
export const TaskAssignee = sequelize.define('TaskAssignee', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  taskId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.STRING(20), allowNull: false },
  calendarEventId: { type: DataTypes.STRING(255), allowNull: true },
  reminder48hSent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'reminder_48h_sent' },
  reminder24hSent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'reminder_24h_sent' },
}, { tableName: 'task_assignees' });
