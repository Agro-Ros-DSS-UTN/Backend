import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';
import { EMPLOYEE_ROLES, ORDER_EXECUTOR_ROLES, Employee } from '../company/employee.entity.js';

export { EMPLOYEE_ROLES, ORDER_EXECUTOR_ROLES, Employee };
export const SERVICE_ORDER_STATUSES = ['Programada', 'En Ejecución', 'Completada', 'Cancelada'];
export const EVALUATION_RESULTS = ['Sin insectos vivos', 'Con insectos vivos', 'Seguimiento', 'Refumigación'];

// Eficacia derivada del resultado de la planilla (para el tablero por empresa).
export const efficacyOf = (result) => {
  if (result === 'Sin insectos vivos') return 'effective';
  if (result === 'Seguimiento') return 'partial';
  if (result) return 'ineffective';
  return null;
};

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

export const ServiceOrderEmployee = sequelize.define('ServiceOrderEmployee', {
  serviceOrderId: { type: DataTypes.INTEGER, primaryKey: true },
  employeeId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'service_order_employees' });

// Una fila del "Detalle del servicio" de la planilla: instalación + producto aplicado.
export const AppliedProduct = sequelize.define('AppliedProduct', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  serviceOrderId: { type: DataTypes.INTEGER, allowNull: false },
  itemId: { type: DataTypes.INTEGER, allowNull: true },
  facilityType: { type: DataTypes.STRING(40), allowNull: true },
  number: { type: DataTypes.STRING(20), allowNull: true },
  capacityTn: { type: DataTypes.STRING(20), allowNull: true },
  grain: { type: DataTypes.STRING(60), allowNull: true },
  quantityTn: { type: DataTypes.STRING(20), allowNull: true },
  grainCondition: { type: DataTypes.STRING(10), allowNull: true },
  facilityCondition: { type: DataTypes.STRING(10), allowNull: true },
  infestationLevel: { type: DataTypes.STRING(10), allowNull: true },
  product: { type: DataTypes.STRING(150), allowNull: true },
  activeIngredient: { type: DataTypes.STRING(150), allowNull: true },
  dose: { type: DataTypes.STRING(100), allowNull: true },
  batch: { type: DataTypes.STRING(100), allowNull: true },
  withdrawalPeriod: { type: DataTypes.STRING(100), allowNull: true },
  totalQuantity: { type: DataTypes.STRING(100), allowNull: true },
}, { tableName: 'applied_products' });

export const ServiceEvaluation = sequelize.define('ServiceEvaluation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  serviceOrderId: { type: DataTypes.INTEGER, allowNull: false },
  evaluationDate: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
  grainCondition: { type: DataTypes.STRING(5), allowNull: false, defaultValue: 'A' },
  samplingPoint: { type: DataTypes.STRING(150), allowNull: false, defaultValue: 'Superficie' },
  result: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Sin insectos vivos', validate: { isIn: [EVALUATION_RESULTS] } },
  ppmPH3: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'ppm_ph3' },
  notes: { type: DataTypes.TEXT, allowNull: true },
  recommendations: { type: DataTypes.TEXT, allowNull: true },
  details: { type: DataTypes.TEXT('long'), allowNull: true },
  photos: { type: DataTypes.TEXT('long'), allowNull: true },
  customerSignature: { type: DataTypes.TEXT('long'), allowNull: true },
  technicianSignature: { type: DataTypes.TEXT('long'), allowNull: true },
  customerSatisfaction: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 1, max: 5 } },
  customerComment: { type: DataTypes.TEXT, allowNull: true },
  efficacy: { type: DataTypes.VIRTUAL, get() { return efficacyOf(this.getDataValue('result')); } },
}, { tableName: 'service_evaluations' });
