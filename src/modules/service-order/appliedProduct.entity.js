import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

// Una fila del "Detalle del servicio" de la planilla: instalación + producto aplicado.
// Tabla de detalle: la maneja el repository de órdenes de servicio.
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
