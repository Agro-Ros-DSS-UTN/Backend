import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const OPPORTUNITY_STATUSES = ['Prospecto', 'Contactado', 'Cotizado', 'Ganada', 'Perdida'];
export const OPEN_STATUSES = ['Prospecto', 'Contactado', 'Cotizado'];
export const LEVELS = ['Alta', 'Media', 'Baja'];
export const ACTIVITY_CONTACT_TYPES = ['visita', 'llamada', 'whatsapp', 'email', 'reunion'];
export const TASK_TYPES = ['llamada', 'visita', 'correo', 'reunion', 'tarea'];
export const TASK_STATUSES = ['Pendiente', 'Finalizada', 'Cancelada'];
export const ATTACHMENT_TYPES = ['foto', 'audio', 'documento'];

const paranoid = { timestamps: true, createdAt: false, updatedAt: false, paranoid: true, deletedAt: 'deletedAt' };

export const Opportunity = sequelize.define('Opportunity', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(200), allowNull: false, validate: { notEmpty: true } },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'Prospecto', validate: { isIn: [OPPORTUNITY_STATUSES] } },
  potential: { type: DataTypes.STRING(50), allowNull: true },
  potentialVolume: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  billedVolume: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  startDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  expectedCloseDate: { type: DataTypes.DATEONLY, allowNull: true },
  lastActivityAt: { type: DataTypes.DATE, allowNull: true },
  lossReason: { type: DataTypes.STRING(255), allowNull: true },
  companyId: { type: DataTypes.INTEGER, allowNull: true },
  userId: { type: DataTypes.STRING(20), allowNull: true },
  contactId: { type: DataTypes.INTEGER, allowNull: true },
  // Quien la cargó (puede diferir del responsable si la crea la administración).
  createdById: { type: DataTypes.STRING(20), allowNull: true },
  // Derivado: días desde el último movimiento (actividad o cambio).
  daysWithoutContact: {
    type: DataTypes.VIRTUAL,
    get() {
      const f = this.getDataValue('lastActivityAt') || this.getDataValue('startDate');
      return f ? Math.floor((Date.now() - new Date(f).getTime()) / 86400000) : null;
    },
  },
}, { tableName: 'opportunities', ...paranoid });

export const OpportunityItem = sequelize.define('OpportunityItem', {
  opportunityId: { type: DataTypes.INTEGER, primaryKey: true },
  itemId: { type: DataTypes.INTEGER, primaryKey: true },
  quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
}, { tableName: 'opportunity_items' });

// Actividad: algo que ya pasó. Pertenece a una Oportunidad o a una OrdenServicio
// (visita técnica), nunca a las dos; la regla se valida en el controlador.
export const Activity = sequelize.define('Activity', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  contactType: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'visita', validate: { isIn: [ACTIVITY_CONTACT_TYPES] } },
  occurredAt: { type: DataTypes.DATE, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  result: { type: DataTypes.STRING(255), allowNull: true },
  saleAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  noFollowUp: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  opportunityId: { type: DataTypes.INTEGER, allowNull: true },
  serviceOrderId: { type: DataTypes.INTEGER, allowNull: true },
  roadmapStopId: { type: DataTypes.INTEGER, allowNull: true },
  userId: { type: DataTypes.STRING(20), allowNull: true },
  createdAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  clientUuid: { type: DataTypes.STRING(36), allowNull: true },
}, { tableName: 'activities' });

export const Attachment = sequelize.define('Attachment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  activityId: { type: DataTypes.INTEGER, allowNull: true },
  serviceOrderId: { type: DataTypes.INTEGER, allowNull: true },
  type: { type: DataTypes.STRING(12), allowNull: false, validate: { isIn: [ATTACHMENT_TYPES] } },
  fileName: { type: DataTypes.STRING(200), allowNull: true },
  mimeType: { type: DataTypes.STRING(100), allowNull: true },
  sizeKb: { type: DataTypes.INTEGER, allowNull: true },
  content: { type: DataTypes.TEXT('long'), allowNull: false },
  uploadedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'attachments',
  defaultScope: { attributes: { exclude: ['content'] } },
  scopes: { withContent: {} },
});

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
