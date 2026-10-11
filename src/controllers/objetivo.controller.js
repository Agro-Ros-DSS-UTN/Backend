import { Op, fn, col } from 'sequelize';
import {
  sequelize, Objetivo, Usuario, Empresa, ItemCatalogo, Promocion, Actividad, Oportunidad, OrdenServicio,
} from '../models/index.js';
import { TIPOS_OBJETIVO, TIPOS_PERIODO } from '../models/planificacion.model.js';
import { isAdmin } from '../middlewares/auth.middleware.js';
import { asyncHandler, badRequest, conflict, forbidden, idParam, notFound, toInt } from '../utils/http.js';
import { numero, parseFecha, texto, unoDe } from '../utils/validacion.js';
import { crearNotificacion } from './notificacion.controller.js';

export const normalizarTipoObjetivo = (t) => {
  if (TIPOS_OBJETIVO.includes(t)) return t;
  const n = String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (!n) return undefined;
  if (n.startsWith('visit')) return 'visitas';
  if (n.startsWith('cotiz')) return 'cotizaciones';
  if (n.includes('nuev') || n.includes('prospec')) return 'nuevosClientes';
  if (n.startsWith('servic')) return 'servicios';
  return 'ventas';
};

const ymd = (d) => d.toISOString().slice(0, 10);
const isoWeekMonday = (year, week) => {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
  return monday;
};
const isoWeek = (fecha) => {
  const t = new Date(`${fecha}T00:00:00Z`);
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  return Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7);
};

// Rango del período: fechas explícitas, o (pantalla v1) número de semana del año en curso.
const rangoDe = (b, tipoPeriodo) => {
  let fechaInicio = parseFecha(b.fechaInicio, 'fechaInicio');
  let fechaFin = parseFecha(b.fechaFin, 'fechaFin');
  if (!fechaInicio && b.periodoSemana) {
    const semana = numero(b.periodoSemana, 'periodoSemana', { entero: true, min: 1, max: 53 });
    const lunes = isoWeekMonday(new Date().getUTCFullYear(), semana);
    fechaInicio = ymd(lunes);
  }
  if (fechaInicio && !fechaFin) {
    const d = new Date(`${fechaInicio}T00:00:00Z`);
    if (tipoPeriodo === 'mensual') { d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); } else d.setUTCDate(d.getUTCDate() + 6);
    fechaFin = ymd(d);
  }
  if (fechaInicio && fechaFin && fechaFin < fechaInicio) throw badRequest('La fecha de fin no puede ser anterior a la de inicio', { fechaFin: 'anterior al inicio' });
  return { fechaInicio, fechaFin };
};

const include = [
  { model: Usuario, as: 'vendedor', attributes: ['idUser', 'nombreApellido', 'rol'] },
  { model: Empresa, as: 'empresas', attributes: ['id', 'razonSocial'], through: { attributes: [] }, paranoid: false },
  { model: ItemCatalogo, as: 'items', attributes: ['id', 'nombre', 'tipo'], through: { attributes: [] } },
  { model: Promocion, as: 'promociones', attributes: ['id', 'nombre', 'color'], through: { attributes: [] } },
];

// Avance real del objetivo dentro de su período, según el tipo.
const calcularAvance = async (o) => {
  if (!o.usuarioId) return 0;
  const desde = new Date(`${o.fechaInicio}T00:00:00-03:00`);
  const hasta = new Date(new Date(`${o.fechaFin}T00:00:00-03:00`).getTime() + 86400000);
  const rango = { [Op.gte]: desde, [Op.lt]: hasta };
  const empresaIds = (o.empresas || []).map((e) => e.id);
  const oppDeEmpresas = empresaIds.length ? { empresaId: { [Op.in]: empresaIds } } : {};
  switch (o.tipoObjetivo) {
    case 'visitas':
      return Actividad.count({
        where: { usuarioId: o.usuarioId, tipoContacto: 'visita', fechaHora: rango },
        include: empresaIds.length ? [{ model: Oportunidad, as: 'oportunidad', where: oppDeEmpresas, attributes: [], paranoid: false }] : [],
      });
    case 'ventas': {
      const r = await Actividad.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('monto_venta')), 0), 'total']],
        where: { usuarioId: o.usuarioId, fechaHora: rango },
        include: empresaIds.length ? [{ model: Oportunidad, as: 'oportunidad', where: oppDeEmpresas, attributes: [], paranoid: false }] : [],
        raw: true,
      });
      return Number(r?.total || 0);
    }
    case 'nuevosClientes':
      return Empresa.count({ where: { creadoPorId: o.usuarioId, fechaRegistro: rango } });
    case 'cotizaciones':
      return Oportunidad.count({ where: { usuarioId: o.usuarioId, estado: { [Op.in]: ['Cotizado', 'Ganada'] }, fechaUltimaActualizacion: rango, ...oppDeEmpresas } });
    case 'servicios':
      return OrdenServicio.count({
        where: { estado: 'Completada', fechaRealizada: { [Op.between]: [o.fechaInicio, o.fechaFin] }, ...(empresaIds.length ? { empresaId: { [Op.in]: empresaIds } } : {}) },
        include: [{ model: Oportunidad, as: 'oportunidad', where: { usuarioId: o.usuarioId }, attributes: [], paranoid: false }],
      });
    default:
      return 0;
  }
};

export const serializeObjetivo = async (o, { conAvance = true } = {}) => {
  const j = o.toJSON();
  const meta = j.cantidadMeta !== null && j.cantidadMeta !== undefined ? Number(j.cantidadMeta) : null;
  const avance = conAvance ? await calcularAvance(o) : null;
  const empresas = (j.empresas || []).map((e) => ({ id: e.id, razonSocial: e.razonSocial }));
  return {
    id: j.id,
    descripcion: j.descripcion,
    tipoObjetivo: j.tipoObjetivo,
    tipoPeriodo: j.tipoPeriodo,
    fechaInicio: j.fechaInicio,
    fechaFin: j.fechaFin,
    cantidadMeta: meta,
    avance,
    porcentaje: meta && avance !== null ? Math.min(999, Math.round((avance / meta) * 100)) : null,
    usuarioId: j.usuarioId ?? null,
    vendedor: j.vendedor ? { idUser: j.vendedor.idUser, nombreApellido: j.vendedor.nombreApellido, role: j.vendedor.rol } : null,
    empresas,
    items: (j.items || []).map((i) => ({ id: i.id, nombre: i.nombre, tipo: i.tipo })),
    promociones: (j.promociones || []).map((p) => ({ id: p.id, nombre: p.nombre, color: p.color })),
    creadoPorId: j.creadoPorId ?? null,
    fechaCreacion: j.fechaCreacion,
    estado: meta && avance >= meta ? 'completado' : j.fechaFin < ymd(new Date(Date.now() - 3 * 3600000)) ? 'vencido' : 'en_proceso',
    // compatibilidad v1
    progresoActual: avance,
    idUser: j.usuarioId ?? null,
    sellerId: j.usuarioId ?? null,
    periodoSemana: j.fechaInicio ? isoWeek(j.fechaInicio) : null,
    clientCompanyId: empresas[0]?.id ?? null,
    ClientCompany: empresas[0] ? { id: empresas[0].id, nombreEmpresa: empresas[0].razonSocial } : null,
  };
};

const listaIds = (v) => (Array.isArray(v) ? [...new Set(v.map((x) => toInt(typeof x === 'object' ? x.id : x)).filter((x) => x && !Number.isNaN(x)))] : undefined);

const guardarRelaciones = async (o, b, transaction) => {
  const empresas = listaIds(b.empresaIds) ?? (b.clientCompanyId !== undefined ? listaIds(b.clientCompanyId ? [b.clientCompanyId] : []) : undefined);
  const items = listaIds(b.itemIds);
  const promos = listaIds(b.promocionIds);
  if (empresas) {
    if (empresas.length && (await Empresa.count({ where: { id: empresas }, transaction })) !== empresas.length) throw badRequest('Alguna empresa no existe');
    await o.setEmpresas(empresas, { transaction });
  }
  if (items) {
    if (items.length && (await ItemCatalogo.count({ where: { id: items }, transaction })) !== items.length) throw badRequest('Algún producto o servicio no existe');
    await o.setItems(items, { transaction });
  }
  if (promos) {
    if (promos.length && (await Promocion.count({ where: { id: promos }, transaction })) !== promos.length) throw badRequest('Alguna promoción no existe');
    await o.setPromociones(promos, { transaction });
  }
};

// Otro objetivo del mismo vendedor y tipo cuyo período se superpone.
const superpuesto = (usuarioId, tipoObjetivo, fechaInicio, fechaFin, excluirId) => Objetivo.findOne({
  where: {
    usuarioId, tipoObjetivo, fechaInicio: { [Op.lte]: fechaFin }, fechaFin: { [Op.gte]: fechaInicio },
    ...(excluirId ? { id: { [Op.ne]: excluirId } } : {}),
  },
});

const datosObjetivo = (b) => {
  const d = {};
  if (b.descripcion !== undefined) d.descripcion = texto(b.descripcion, 'descripcion', 150);
  if (b.tipoObjetivo !== undefined) d.tipoObjetivo = unoDe(normalizarTipoObjetivo(b.tipoObjetivo), TIPOS_OBJETIVO, 'tipoObjetivo');
  if (b.tipoPeriodo !== undefined) d.tipoPeriodo = unoDe(b.tipoPeriodo, TIPOS_PERIODO, 'tipoPeriodo');
  if (b.cantidadMeta !== undefined) d.cantidadMeta = numero(b.cantidadMeta, 'cantidadMeta', { min: 0 });
  return d;
};

export const listar = asyncHandler(async (req, res) => {
  const where = {};
  const pedido = req.params.sellerId ?? req.query.usuarioId;
  if (!isAdmin(req)) where.usuarioId = req.user.idUser;
  else if (pedido) where.usuarioId = String(pedido);
  if (req.query.vigentes === '1') {
    const hoy = ymd(new Date(Date.now() - 3 * 3600000));
    where.fechaInicio = { [Op.lte]: hoy };
    where.fechaFin = { [Op.gte]: hoy };
  }
  const objetivos = await Objetivo.findAll({ where, include, order: [['fechaInicio', 'DESC'], ['id', 'DESC']] });
  res.json({ data: await Promise.all(objetivos.map((o) => serializeObjetivo(o))) });
});

export const obtener = asyncHandler(async (req, res) => {
  const o = await Objetivo.findByPk(idParam(req), { include });
  if (!o) throw notFound('Objetivo');
  if (!isAdmin(req) && o.usuarioId !== req.user.idUser) throw forbidden('Este objetivo es de otro vendedor');
  res.json({ data: await serializeObjetivo(o) });
});

// CUU02 — Asignar un objetivo a un vendedor (solo administración).
export const crear = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const d = datosObjetivo(b);
  d.tipoObjetivo = d.tipoObjetivo || 'ventas';
  d.tipoPeriodo = d.tipoPeriodo || 'semanal';
  const { fechaInicio, fechaFin } = rangoDe(b, d.tipoPeriodo);
  if (!fechaInicio) throw badRequest('Indicá el período del objetivo (fecha de inicio)', { fechaInicio: 'obligatorio' });
  if (!d.cantidadMeta) throw badRequest('La meta debe ser mayor a cero', { cantidadMeta: 'obligatorio' });
  const usuarioId = String(b.usuarioId ?? b.idUser ?? b.sellerId ?? '');
  const vendedor = usuarioId ? await Usuario.findByPk(usuarioId) : null;
  if (!vendedor) throw badRequest('Elegí un vendedor existente para asignar el objetivo', { usuarioId: 'inexistente' });
  if (vendedor.estadoCuenta !== 'Activo') throw badRequest('El vendedor elegido está inactivo', { usuarioId: 'inactivo' });
  const choque = await superpuesto(vendedor.idUser, d.tipoObjetivo, fechaInicio, fechaFin);
  if (choque && !b.forzar) {
    throw conflict(`${vendedor.nombreApellido} ya tiene un objetivo de ${d.tipoObjetivo} entre ${choque.fechaInicio} y ${choque.fechaFin}. ¿Querés crearlo igual?`, { existente: { id: choque.id, descripcion: choque.descripcion, fechaInicio: choque.fechaInicio, fechaFin: choque.fechaFin } });
  }
  const o = await sequelize.transaction(async (transaction) => {
    const obj = await Objetivo.create({ ...d, descripcion: d.descripcion || `Objetivo de ${d.tipoObjetivo}`, fechaInicio, fechaFin, usuarioId: vendedor.idUser, creadoPorId: req.user.idUser }, { transaction });
    await guardarRelaciones(obj, b, transaction);
    return obj;
  });
  await crearNotificacion(vendedor.idUser, 'objetivo', `Nuevo objetivo: ${o.descripcion} (${fechaInicio} a ${fechaFin})`, 'objetivo', o.id);
  const full = await Objetivo.findByPk(o.id, { include });
  res.status(201).json({ message: 'Objetivo asignado', data: await serializeObjetivo(full) });
});

export const actualizar = asyncHandler(async (req, res) => {
  const o = await Objetivo.findByPk(idParam(req));
  if (!o) throw notFound('Objetivo');
  const b = req.body || {};
  const d = datosObjetivo(b);
  if (b.fechaInicio !== undefined || b.fechaFin !== undefined || b.periodoSemana !== undefined) {
    Object.assign(d, rangoDe({ fechaInicio: b.fechaInicio ?? o.fechaInicio, fechaFin: b.fechaFin ?? (b.fechaInicio ? undefined : o.fechaFin), periodoSemana: b.periodoSemana }, d.tipoPeriodo || o.tipoPeriodo));
  }
  if (b.usuarioId !== undefined || b.idUser !== undefined || b.sellerId !== undefined) {
    const u = await Usuario.findByPk(String(b.usuarioId ?? b.idUser ?? b.sellerId));
    if (!u) throw badRequest('Elegí un vendedor existente');
    d.usuarioId = u.idUser;
  }
  const choque = await superpuesto(d.usuarioId || o.usuarioId, d.tipoObjetivo || o.tipoObjetivo, d.fechaInicio || o.fechaInicio, d.fechaFin || o.fechaFin, o.id);
  if (choque && !b.forzar) throw conflict(`Ya hay un objetivo del mismo tipo entre ${choque.fechaInicio} y ${choque.fechaFin}. ¿Guardar igual?`, { existente: { id: choque.id, descripcion: choque.descripcion } });
  await sequelize.transaction(async (transaction) => {
    await o.update(d, { transaction });
    await guardarRelaciones(o, b, transaction);
  });
  const full = await Objetivo.findByPk(o.id, { include });
  res.json({ message: 'Objetivo actualizado', data: await serializeObjetivo(full) });
});

export const eliminar = asyncHandler(async (req, res) => {
  const o = await Objetivo.findByPk(idParam(req));
  if (!o) throw notFound('Objetivo');
  await sequelize.transaction(async (transaction) => {
    await o.setEmpresas([], { transaction });
    await o.setItems([], { transaction });
    await o.setPromociones([], { transaction });
    await o.destroy({ transaction });
  });
  res.json({ message: 'Objetivo eliminado' });
});
