import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const OPPORTUNITY_STATUSES = ['Prospecto', 'Contactado', 'Cotizado', 'Ganada', 'Perdida'];
export const OPEN_STATUSES = ['Prospecto', 'Contactado', 'Cotizado'];
export const LEVELS = ['Alta', 'Media', 'Baja'];

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

