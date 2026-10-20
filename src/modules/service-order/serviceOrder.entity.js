import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const SERVICE_ORDER_STATUSES = ['Programada', 'En Ejecución', 'Completada', 'Cancelada'];

// Orden de servicio de control de plagas. Baja lógica (paranoid).
export const ServiceOrder = sequelize.define('ServiceOrder', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderNumber: { type: DataTypes.STRING(50), allowNull: false, validate: { notEmpty: true } },
  companyId: { type: DataTypes.INTEGER, allowNull: true },
  serviceId: { type: DataTypes.INTEGER, allowNull: true },
  opportunityId: { type: DataTypes.INTEGER, allowNull: true },
  scheduledDate: { type: DataTypes.DATEONLY, allowNull: false },
  completedDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Programada', validate: { isIn: [SERVICE_ORDER_STATUSES] } },
  // Datos del acta impresa (se conservan tal como figuran en la planilla)
  customerCode: { type: DataTypes.STRING(50), allowNull: true },
  customerName: { type: DataTypes.STRING(150), allowNull: false },
  centerCode: { type: DataTypes.STRING(50), allowNull: true },
  centerName: { type: DataTypes.STRING(150), allowNull: true },
  plantCode: { type: DataTypes.STRING(50), allowNull: true },
  plantName: { type: DataTypes.STRING(150), allowNull: true },
  silo: { type: DataTypes.STRING(200), allowNull: true },
  address: { type: DataTypes.STRING(255), allowNull: true },
  locality: { type: DataTypes.STRING(100), allowNull: true },
  province: { type: DataTypes.STRING(100), allowNull: true },
  workType: { type: DataTypes.STRING(100), allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true },
  recommendations: { type: DataTypes.TEXT, allowNull: true },
  technicianSignature: { type: DataTypes.TEXT('long'), allowNull: true },
  customerSignature: { type: DataTypes.TEXT('long'), allowNull: true },
  originalOrderImage: { type: DataTypes.TEXT('long'), allowNull: true },
  createdById: { type: DataTypes.STRING(20), allowNull: true },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'service_orders', timestamps: true, createdAt: false, updatedAt: false, paranoid: true, deletedAt: 'deletedAt' });



