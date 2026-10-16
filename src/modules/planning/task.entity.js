import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const TASK_TYPES = ['llamada', 'visita', 'correo', 'reunion', 'tarea'];
export const TASK_STATUSES = ['Pendiente', 'Finalizada', 'Cancelada'];
export const LEVELS = ['Alta', 'Media', 'Baja'];

// Tarea: algo que hay que hacer, con responsables y vencimiento.
export const Task = sequelize.define('Task', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(200), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  type: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'llamada', validate: { isIn: [TASK_TYPES] } },
  priority: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'Media', validate: { isIn: [LEVELS] } },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  dueDate: { type: DataTypes.DATEONLY, allowNull: true },
  dueTime: { type: DataTypes.STRING(10), allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Pendiente', validate: { isIn: [TASK_STATUSES] } },
  companyId: { type: DataTypes.INTEGER, allowNull: true },
  contactId: { type: DataTypes.INTEGER, allowNull: true },
  activityId: { type: DataTypes.INTEGER, allowNull: true },
  createdById: { type: DataTypes.STRING(20), allowNull: true },
  completedById: { type: DataTypes.STRING(20), allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'tasks' });

export const TaskAssignee = sequelize.define('TaskAssignee', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  taskId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.STRING(20), allowNull: false },
  calendarEventId: { type: DataTypes.STRING(255), allowNull: true },
  reminder48hSent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'reminder_48h_sent' },
  reminder24hSent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'reminder_24h_sent' },
}, { tableName: 'task_assignees' });
