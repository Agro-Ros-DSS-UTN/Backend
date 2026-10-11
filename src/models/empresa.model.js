import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export const NIVELES_EMPRESA = ['independiente', 'madre', 'region', 'subsede'];

// Empresa cliente (antes EmpresaCliente). Baja lógica con fecha_baja (paranoid):
// las consultas normales no la ven, pero su historial queda intacto.
export const Empresa = sequelize.define('Empresa', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  razonSocial: { type: DataTypes.STRING(150), allowNull: false, validate: { notEmpty: true } },
  nombreFantasia: { type: DataTypes.STRING(150), allowNull: true },
  descripcion: { type: DataTypes.TEXT, allowNull: true },
  cuit: { type: DataTypes.STRING(20), allowNull: false },
  direccion: { type: DataTypes.STRING(150), allowNull: true },
  tipoEmpresa: { type: DataTypes.STRING(50), allowNull: false },
  superficieHa: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  proveedorActual: { type: DataTypes.STRING(150), allowNull: true },
  nivel: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'independiente', validate: { isIn: [NIVELES_EMPRESA] } },
  empresaPadreId: { type: DataTypes.INTEGER, allowNull: true },
  localidadId: { type: DataTypes.STRING(20), allowNull: true },
  latitud: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitud: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  creadoPorId: { type: DataTypes.STRING(20), allowNull: true },
  fechaRegistro: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'empresas', timestamps: true, createdAt: false, updatedAt: false, paranoid: true, deletedAt: 'fechaBaja' });

export const Cultivo = sequelize.define('Cultivo', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false },
  mesesNecesidad: { type: DataTypes.STRING(40), allowNull: true },
}, { tableName: 'cultivos' });

export const EmpresaCultivo = sequelize.define('EmpresaCultivo', {
  empresaId: { type: DataTypes.INTEGER, primaryKey: true },
  cultivoId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'empresa_cultivos' });

// Persona de una empresa (antes Cliente). Clave numérica propia; el DNI es opcional.
export const Contacto = sequelize.define('Contacto', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dni: { type: DataTypes.STRING(20), allowNull: true },
  nombreApellido: { type: DataTypes.STRING(150), allowNull: false, validate: { notEmpty: true } },
  cargo: { type: DataTypes.STRING(50), allowNull: true },
  email: { type: DataTypes.STRING(150), allowNull: true, validate: { isEmail: true } },
  esPrincipal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  observaciones: { type: DataTypes.TEXT, allowNull: true },
  empresaId: { type: DataTypes.INTEGER, allowNull: true },
  fechaAlta: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
}, { tableName: 'contactos', timestamps: true, createdAt: false, updatedAt: false, paranoid: true, deletedAt: 'fechaBaja' });

export const ContactoTelefono = sequelize.define('ContactoTelefono', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  contactoId: { type: DataTypes.INTEGER, allowNull: false },
  numero: { type: DataTypes.STRING(30), allowNull: false },
}, { tableName: 'contacto_telefonos' });
