import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export const ESTADOS_RUTA = ['planificada', 'en_curso', 'finalizada'];
export const ESTADOS_PARADA = ['pendiente', 'en_camino', 'completada', 'omitida'];
export const TIPOS_OBJETIVO = ['visitas', 'ventas', 'nuevosClientes', 'cotizaciones', 'servicios'];
export const TIPOS_PERIODO = ['semanal', 'mensual'];

export const HojaRuta = sequelize.define('HojaRuta', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(150), allowNull: true },
  descripcion: { type: DataTypes.STRING(200), allowNull: true },
  fecha: { type: DataTypes.DATEONLY, allowNull: false },
  horaInicioPlan: { type: DataTypes.STRING(20), allowNull: true },
  fechaFinPlan: { type: DataTypes.DATEONLY, allowNull: true },
  horaFinPlan: { type: DataTypes.STRING(20), allowNull: true },
  estado: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'planificada', validate: { isIn: [ESTADOS_RUTA] } },
  usuarioId: { type: DataTypes.STRING(20), allowNull: true },
  creadoPorId: { type: DataTypes.STRING(20), allowNull: true },
  distanciaEstimadaKm: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 },
  observaciones: { type: DataTypes.TEXT, allowNull: true },
  inicioReal: { type: DataTypes.DATE, allowNull: true },
  finReal: { type: DataTypes.DATE, allowNull: true },
  fechaCreacion: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
}, { tableName: 'hojas_ruta' });

export const ParadaRuta = sequelize.define('ParadaRuta', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  hojaRutaId: { type: DataTypes.INTEGER, allowNull: false },
  orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  empresaId: { type: DataTypes.INTEGER, allowNull: true },
  nombreLugar: { type: DataTypes.STRING(200), allowNull: false },
  direccion: { type: DataTypes.STRING(255), allowNull: true },
  latitud: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitud: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  estado: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'pendiente', validate: { isIn: [ESTADOS_PARADA] } },
  horaEstimada: { type: DataTypes.STRING(50), allowNull: true },
  notas: { type: DataTypes.TEXT, allowNull: true },
  url: { type: DataTypes.STRING(500), allowNull: true, validate: { isUrl: { protocols: ['http', 'https'], require_protocol: true } } },
  origen: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'planificada' },
}, { tableName: 'paradas_ruta' });

export const Objetivo = sequelize.define('Objetivo', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  descripcion: { type: DataTypes.STRING(150), allowNull: false, validate: { notEmpty: true } },
  tipoObjetivo: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [TIPOS_OBJETIVO] } },
  tipoPeriodo: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'semanal', validate: { isIn: [TIPOS_PERIODO] } },
  fechaInicio: { type: DataTypes.DATEONLY, allowNull: false },
  fechaFin: { type: DataTypes.DATEONLY, allowNull: false },
  cantidadMeta: { type: DataTypes.DECIMAL(10, 2), allowNull: true, validate: { min: 0 } },
  usuarioId: { type: DataTypes.STRING(20), allowNull: true },
  creadoPorId: { type: DataTypes.STRING(20), allowNull: true },
  fechaCreacion: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
}, { tableName: 'objetivos' });

export const ObjetivoEmpresa = sequelize.define('ObjetivoEmpresa', {
  objetivoId: { type: DataTypes.INTEGER, primaryKey: true },
  empresaId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'objetivo_empresas' });

export const ObjetivoItem = sequelize.define('ObjetivoItem', {
  objetivoId: { type: DataTypes.INTEGER, primaryKey: true },
  itemId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'objetivo_items' });

export const ObjetivoPromocion = sequelize.define('ObjetivoPromocion', {
  objetivoId: { type: DataTypes.INTEGER, primaryKey: true },
  promocionId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'objetivo_promociones' });

export const Promocion = sequelize.define('Promocion', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false, validate: { notEmpty: true } },
  descripcion: { type: DataTypes.STRING(255), allowNull: true },
  beneficio: { type: DataTypes.STRING(120), allowNull: true },
  condiciones: { type: DataTypes.STRING(255), allowNull: true },
  color: { type: DataTypes.STRING(20), allowNull: true, validate: { is: /^#[0-9a-fA-F]{3,8}$/ } },
  fechaInicio: { type: DataTypes.DATEONLY, allowNull: false },
  fechaFin: { type: DataTypes.DATEONLY, allowNull: false },
  creadoPorId: { type: DataTypes.STRING(20), allowNull: true },
}, { tableName: 'promociones' });

export const PromocionItem = sequelize.define('PromocionItem', {
  promocionId: { type: DataTypes.INTEGER, primaryKey: true },
  itemId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'promocion_items' });

export const NotaInterna = sequelize.define('NotaInterna', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  categoria: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'general', validate: { isIn: [['pedido', 'despacho', 'general']] } },
  descripcion: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } },
  estado: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'abierta', validate: { isIn: [['abierta', 'resuelta']] } },
  fechaNota: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  usuarioId: { type: DataTypes.STRING(20), allowNull: false },
}, { tableName: 'notas_internas' });

export const Notificacion = sequelize.define('Notificacion', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId: { type: DataTypes.STRING(20), allowNull: false },
  tipo: { type: DataTypes.STRING(30), allowNull: false },
  mensaje: { type: DataTypes.STRING(255), allowNull: false },
  entidad: { type: DataTypes.STRING(30), allowNull: true },
  entidadId: { type: DataTypes.STRING(30), allowNull: true },
  leida: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  fechaHora: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'notificaciones' });
