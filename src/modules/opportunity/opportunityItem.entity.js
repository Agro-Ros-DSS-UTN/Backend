import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

// Productos y servicios ofrecidos en una oportunidad (Oportunidad N:M ItemCatalogo).
// Tabla de detalle: la maneja el repository de oportunidades.
export const OpportunityItem = sequelize.define('OpportunityItem', {
  opportunityId: { type: DataTypes.INTEGER, primaryKey: true },
  itemId: { type: DataTypes.INTEGER, primaryKey: true },
  quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
}, { tableName: 'opportunity_items' });
