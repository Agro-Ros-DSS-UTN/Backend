import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const EVALUATION_RESULTS = ['Sin insectos vivos', 'Con insectos vivos', 'Seguimiento', 'Refumigación'];

// Evaluación posterior de una orden de servicio (1:1). Tabla de detalle: la maneja
// el repository de órdenes de servicio. La eficacia (efectiva, parcial o ineficaz)
// es una regla de negocio: la calcula serviceOrder.service (efficacyOf).
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
}, { tableName: 'service_evaluations' });
