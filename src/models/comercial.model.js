import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export const ESTADOS_OPORTUNIDAD = ['Prospecto', 'Contactado', 'Cotizado', 'Ganada', 'Perdida'];
export const ESTADOS_ABIERTOS = ['Prospecto', 'Contactado', 'Cotizado'];
export const NIVELES = ['Alta', 'Media', 'Baja'];
export const TIPOS_CONTACTO = ['visita', 'llamada', 'whatsapp', 'email', 'reunion'];
export const TIPOS_TAREA = ['llamada', 'visita', 'correo', 'reunion', 'tarea'];
export const ESTADOS_TAREA = ['Pendiente', 'Finalizada', 'Cancelada'];
export const TIPOS_ADJUNTO = ['foto', 'audio', 'documento'];

const paranoid = { timestamps: true, createdAt: false, updatedAt: false, paranoid: true, deletedAt: 'fechaBaja' };

export const Oportunidad = sequelize.define('Oportunidad', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  titulo: { type: DataTypes.STRING(200), allowNull: false, validate: { notEmpty: true } },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'Prospecto', validate: { isIn: [ESTADOS_OPORTUNIDAD] } },
  potencialidad: { type: DataTypes.STRING(50), allowNull: true },
  volumenPotencial: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  volumenFacturado: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  fechaInicio: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  fechaCierreEstimada: { type: DataTypes.DATEONLY, allowNull: true },
  fechaUltimaActualizacion: { type: DataTypes.DATE, allowNull: true },
  motivoPerdida: { type: DataTypes.STRING(255), allowNull: true },
  empresaId: { type: DataTypes.INTEGER, allowNull: true },
  usuarioId: { type: DataTypes.STRING(20), allowNull: true },
  contactoId: { type: DataTypes.INTEGER, allowNull: true },
  // Derivado: días desde el último movimiento (actividad o cambio).
  diasSinContacto: {
    type: DataTypes.VIRTUAL,
    get() {
      const f = this.getDataValue('fechaUltimaActualizacion') || this.getDataValue('fechaInicio');
      return f ? Math.floor((Date.now() - new Date(f).getTime()) / 86400000) : null;
    },
  },
}, { tableName: 'oportunidades', ...paranoid });

export const OportunidadItem = sequelize.define('OportunidadItem', {
  oportunidadId: { type: DataTypes.INTEGER, primaryKey: true },
  itemId: { type: DataTypes.INTEGER, primaryKey: true },
  cantidad: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
}, { tableName: 'oportunidad_items' });

// Actividad: algo que ya pasó. Pertenece a una Oportunidad o a una OrdenServicio
// (visita técnica), nunca a las dos; la regla se valida en el controlador.
export const Actividad = sequelize.define('Actividad', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipoContacto: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'visita', validate: { isIn: [TIPOS_CONTACTO] } },
  fechaHora: { type: DataTypes.DATE, allowNull: true },
  descripcion: { type: DataTypes.TEXT, allowNull: true },
  resultado: { type: DataTypes.STRING(255), allowNull: true },
  montoVenta: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  sinSeguimiento: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  oportunidadId: { type: DataTypes.INTEGER, allowNull: true },
  ordenServicioId: { type: DataTypes.INTEGER, allowNull: true },
  paradaId: { type: DataTypes.INTEGER, allowNull: true },
  usuarioId: { type: DataTypes.STRING(20), allowNull: true },
  fechaRegistro: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  clientUuid: { type: DataTypes.STRING(36), allowNull: true },
}, { tableName: 'actividades' });

export const Adjunto = sequelize.define('Adjunto', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  actividadId: { type: DataTypes.INTEGER, allowNull: true },
  ordenServicioId: { type: DataTypes.INTEGER, allowNull: true },
  tipo: { type: DataTypes.STRING(12), allowNull: false, validate: { isIn: [TIPOS_ADJUNTO] } },
  nombreArchivo: { type: DataTypes.STRING(200), allowNull: true },
  mimeType: { type: DataTypes.STRING(100), allowNull: true },
  tamanioKb: { type: DataTypes.INTEGER, allowNull: true },
  contenido: { type: DataTypes.TEXT('long'), allowNull: false },
  fechaCarga: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'adjuntos',
  defaultScope: { attributes: { exclude: ['contenido'] } },
  scopes: { conContenido: {} },
});

// Tarea: algo que hay que hacer, con responsables y vencimiento.
export const Tarea = sequelize.define('Tarea', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  titulo: { type: DataTypes.STRING(200), allowNull: true },
  descripcion: { type: DataTypes.TEXT, allowNull: true },
  tipo: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'llamada', validate: { isIn: [TIPOS_TAREA] } },
  prioridad: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'Media', validate: { isIn: [NIVELES] } },
  fechaCreacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  fechaVencimiento: { type: DataTypes.DATEONLY, allowNull: true },
  horaVencimiento: { type: DataTypes.STRING(10), allowNull: true },
  notas: { type: DataTypes.TEXT, allowNull: true },
  estado: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Pendiente', validate: { isIn: [ESTADOS_TAREA] } },
  empresaId: { type: DataTypes.INTEGER, allowNull: true },
  actividadId: { type: DataTypes.INTEGER, allowNull: true },
  creadoPorId: { type: DataTypes.STRING(20), allowNull: true },
  finalizadoPorId: { type: DataTypes.STRING(20), allowNull: true },
  fechaFinalizacion: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'tareas' });

export const TareaAsignado = sequelize.define('TareaAsignado', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tareaId: { type: DataTypes.INTEGER, allowNull: false },
  usuarioId: { type: DataTypes.STRING(20), allowNull: false },
  calendarEventId: { type: DataTypes.STRING(255), allowNull: true },
  recordatorio48hEnviado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'recordatorio_48h_enviado' },
  recordatorio24hEnviado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'recordatorio_24h_enviado' },
}, { tableName: 'tarea_asignados' });
