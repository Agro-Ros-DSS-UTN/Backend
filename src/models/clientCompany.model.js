/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ClientCompany = sequelize.define('ClientCompany', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombreEmpresa: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  descEmpresa: {
    type: DataTypes.TEXT,
    allowNull: true // [0..1]
  },
  direccionEmpresa: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  fechaRegistro: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  cuit: {
    type: DataTypes.STRING(20),
    allowNull: false
    // Sin `unique` a propósito: una región o subsede comparte el CUIT de su
    // empresa madre (misma entidad legal), ver `parentCompanyId`/`nivelEmpresa`.
  },
  proveedorActual: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  superficieHa: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true // [0..N] -> ver nota abajo
  },
  tipoEmpresa: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  localityCodPostal: {
  type: DataTypes.STRING(10),
  allowNull: false,
  references: {
    model: 'localidades',
  }
},
  // Quién registró la empresa (admin o vendedor) — idUser del usuario,
  // mismo patrón liviano que `creadoPorId` en Roadmap/Task (sin FK estricta).
  creadoPorId: {
    type: DataTypes.STRING(20),
    allowNull: true
  },

  // ── Jerarquía de empresas (Empresa Madre → Región → Subsede) ──
  // Patrón estándar de CRM (ej. "Account Hierarchy" de Salesforce): cada
  // nivel es una fila más de ClientCompany, auto-referenciada por
  // `parentCompanyId`. Los "encargados" de cada nivel son Contactos
  // (Client) comunes, vinculados vía el `clientCompanyId` que ya existía.
  parentCompanyId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  nivelEmpresa: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'independiente' // 'independiente' | 'madre' | 'region' | 'subsede'
  }

}, {
  tableName: 'empresas_clientes',
  timestamps: false
});

export default ClientCompany;
