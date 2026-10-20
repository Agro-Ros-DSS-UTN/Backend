import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

// Productos y servicios a los que aplica una promoción (Promoción N:M ItemCatalogo).
// Tabla intermedia: la maneja el repository de promociones.
export const PromotionItem = sequelize.define('PromotionItem', {
  promotionId: { type: DataTypes.INTEGER, primaryKey: true },
  itemId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'promotion_items' });
