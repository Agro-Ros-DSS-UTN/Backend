import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

// Técnicos de una orden de servicio (OrdenServicio N:M Empleado).
// Tabla intermedia: la maneja el repository de órdenes de servicio.
export const ServiceOrderEmployee = sequelize.define('ServiceOrderEmployee', {
  serviceOrderId: { type: DataTypes.INTEGER, primaryKey: true },
  employeeId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'service_order_employees' });
