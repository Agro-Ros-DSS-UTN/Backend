import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

export const SERVICE_TYPES = ['fumigacionSilo', 'silobolsa', 'contenedor', 'buque', 'plagasUrbanas', 'monitoreo', 'otro'];

// ItemCatalogo (abstracta) con herencia en una sola tabla: `tipo` decide si la
// fila es un Producto o un Servicio. Los scopes `productos` y `servicios`
// representan las dos subclases.
export const CatalogItem = sequelize.define('CatalogItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  type: { type: DataTypes.STRING(10), allowNull: false, validate: { isIn: [['producto', 'servicio']] } },
  name: { type: DataTypes.STRING(150), allowNull: false, validate: { notEmpty: true } },
  code: { type: DataTypes.STRING(50), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  referencePrice: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  unitCost: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  billingFrequency: { type: DataTypes.STRING(50), allowNull: true },
  stockAvailable: { type: DataTypes.INTEGER, allowNull: true },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  image: { type: DataTypes.TEXT('long'), allowNull: true },
  // Producto
  productLineId: { type: DataTypes.INTEGER, allowNull: true },
  activeIngredient: { type: DataTypes.STRING(150), allowNull: true },
  presentation: { type: DataTypes.STRING(100), allowNull: true },
  // Servicio
  serviceType: { type: DataTypes.STRING(30), allowNull: true, validate: { isIn: [SERVICE_TYPES] } },
  unitOfMeasure: { type: DataTypes.STRING(30), allowNull: true },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'catalog_items',
  defaultScope: { attributes: { exclude: ['image'] } },
  scopes: {
    withImage: {},
    products: { where: { type: 'producto' } },
    services: { where: { type: 'servicio' } },
    active: { where: { active: true } },
  },
});
