import { Op, fn, col } from 'sequelize';
import {
  sequelize, Objective, User, Company, CatalogItem, Promotion, Activity, Opportunity, ServiceOrder,
} from '../models/index.js';
import { OBJECTIVE_TYPES, PERIOD_TYPES } from '../models/planning.model.js';
import { isAdmin } from '../middlewares/auth.middleware.js';
import { asyncHandler, badRequest, conflict, forbidden, idParam, notFound, toInt } from '../utils/http.js';
import { number, parseDate, text, oneOf } from '../utils/validation.js';
import { createNotification } from './notification.controller.js';

export const normalizeObjectiveType = (t) => {
  if (OBJECTIVE_TYPES.includes(t)) return t;
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
const isoWeek = (date) => {
  const t = new Date(`${date}T00:00:00Z`);
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  return Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7);
};

// Rango del período: fechas explícitas, o (pantalla v1) número de semana del año en curso.
const rangeOf = (b, periodType) => {
  let startDate = parseDate(b.startDate, 'startDate');
  let endDate = parseDate(b.endDate, 'endDate');
  if (!startDate && b.weekPeriod) {
    const week = number(b.weekPeriod, 'weekPeriod', { integer: true, min: 1, max: 53 });
    const monday = isoWeekMonday(new Date().getUTCFullYear(), week);
    startDate = ymd(monday);
  }
  if (startDate && !endDate) {
    const d = new Date(`${startDate}T00:00:00Z`);
    if (periodType === 'mensual') { d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); } else d.setUTCDate(d.getUTCDate() + 6);
    endDate = ymd(d);
  }
  if (startDate && endDate && endDate < startDate) throw badRequest('La fecha de fin no puede ser anterior a la de inicio', { endDate: 'beforeStart' });
  return { startDate, endDate };
};

const include = [
  { model: User, as: 'seller', attributes: ['idUser', 'fullName', 'role'] },
  { model: Company, as: 'companies', attributes: ['id', 'legalName'], through: { attributes: [] }, paranoid: false },
  { model: CatalogItem, as: 'items', attributes: ['id', 'name', 'type'], through: { attributes: [] } },
  { model: Promotion, as: 'promotions', attributes: ['id', 'name', 'color'], through: { attributes: [] } },
];

// Avance real del objetivo dentro de su período, según el tipo.
const calculateProgress = async (o) => {
  if (!o.userId) return 0;
  const from = new Date(`${o.startDate}T00:00:00-03:00`);
  const to = new Date(new Date(`${o.endDate}T00:00:00-03:00`).getTime() + 86400000);
  const range = { [Op.gte]: from, [Op.lt]: to };
  const companyIds = (o.companies || []).map((e) => e.id);
  const companyOpps = companyIds.length ? { companyId: { [Op.in]: companyIds } } : {};
  switch (o.objectiveType) {
    case 'visitas':
      return Activity.count({
        where: { userId: o.userId, contactType: 'visita', occurredAt: range },
        include: companyIds.length ? [{ model: Opportunity, as: 'opportunity', where: companyOpps, attributes: [], paranoid: false }] : [],
      });
    case 'ventas': {
      const r = await Activity.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('sale_amount')), 0), 'total']],
        where: { userId: o.userId, occurredAt: range },
        include: companyIds.length ? [{ model: Opportunity, as: 'opportunity', where: companyOpps, attributes: [], paranoid: false }] : [],
        raw: true,
      });
      return Number(r?.total || 0);
    }
    case 'nuevosClientes':
      return Company.count({ where: { createdById: o.userId, createdAt: range } });
    case 'cotizaciones':
      return Opportunity.count({ where: { userId: o.userId, status: { [Op.in]: ['Cotizado', 'Ganada'] }, lastActivityAt: range, ...companyOpps } });
    case 'servicios':
      return ServiceOrder.count({
        where: { status: 'Completada', completedDate: { [Op.between]: [o.startDate, o.endDate] }, ...(companyIds.length ? { companyId: { [Op.in]: companyIds } } : {}) },
        include: [{ model: Opportunity, as: 'opportunity', where: { userId: o.userId }, attributes: [], paranoid: false }],
      });
    default:
      return 0;
  }
};

export const serializeObjective = async (o, { withProgress = true } = {}) => {
  const j = o.toJSON();
  const target = j.targetAmount !== null && j.targetAmount !== undefined ? Number(j.targetAmount) : null;
  const progress = withProgress ? await calculateProgress(o) : null;
  const companies = (j.companies || []).map((e) => ({ id: e.id, legalName: e.legalName }));
  return {
    id: j.id,
    description: j.description,
    objectiveType: j.objectiveType,
    periodType: j.periodType,
    startDate: j.startDate,
    endDate: j.endDate,
    targetAmount: target,
    progress,
    percentage: target && progress !== null ? Math.min(999, Math.round((progress / target) * 100)) : null,
    userId: j.userId ?? null,
    seller: j.seller ? { idUser: j.seller.idUser, fullName: j.seller.fullName, role: j.seller.role } : null,
    companies,
    items: (j.items || []).map((i) => ({ id: i.id, name: i.name, type: i.type })),
    promotions: (j.promotions || []).map((p) => ({ id: p.id, name: p.name, color: p.color })),
    createdById: j.createdById ?? null,
    createdAt: j.createdAt,
    status: target && progress >= target ? 'completed' : j.endDate < ymd(new Date(Date.now() - 3 * 3600000)) ? 'overdue' : 'in_progress',
    // compatibilidad v1
    currentProgress: progress,
    idUser: j.userId ?? null,
    sellerId: j.userId ?? null,
    weekPeriod: j.startDate ? isoWeek(j.startDate) : null,
    clientCompanyId: companies[0]?.id ?? null,
    ClientCompany: companies[0] ? { id: companies[0].id, companyName: companies[0].legalName } : null,
  };
};

const idList = (v) => (Array.isArray(v) ? [...new Set(v.map((x) => toInt(typeof x === 'object' ? x.id : x)).filter((x) => x && !Number.isNaN(x)))] : undefined);

const saveRelations = async (o, b, transaction) => {
  const companies = idList(b.companyIds) ?? (b.clientCompanyId !== undefined ? idList(b.clientCompanyId ? [b.clientCompanyId] : []) : undefined);
  const items = idList(b.itemIds);
  const promos = idList(b.promotionIds);
  if (companies) {
    if (companies.length && (await Company.count({ where: { id: companies }, transaction })) !== companies.length) throw badRequest('Alguna empresa no existe');
    await o.setCompanies(companies, { transaction });
  }
  if (items) {
    if (items.length && (await CatalogItem.count({ where: { id: items }, transaction })) !== items.length) throw badRequest('Algún producto o servicio no existe');
    await o.setItems(items, { transaction });
  }
  if (promos) {
    if (promos.length && (await Promotion.count({ where: { id: promos }, transaction })) !== promos.length) throw badRequest('Alguna promoción no existe');
    await o.setPromotions(promos, { transaction });
  }
};

// Otro objetivo del mismo vendedor y tipo cuyo período se superpone.
const overlapping = (userId, objectiveType, startDate, endDate, excludeId) => Objective.findOne({
  where: {
    userId, objectiveType, startDate: { [Op.lte]: endDate }, endDate: { [Op.gte]: startDate },
    ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
  },
});

const objectiveData = (b) => {
  const d = {};
  if (b.description !== undefined) d.description = text(b.description, 'description', 150);
  if (b.objectiveType !== undefined) d.objectiveType = oneOf(normalizeObjectiveType(b.objectiveType), OBJECTIVE_TYPES, 'objectiveType');
  if (b.periodType !== undefined) d.periodType = oneOf(b.periodType, PERIOD_TYPES, 'periodType');
  if (b.targetAmount !== undefined) d.targetAmount = number(b.targetAmount, 'targetAmount', { min: 0 });
  return d;
};

export const list = asyncHandler(async (req, res) => {
  const where = {};
  const requested = req.query.userId;
  if (!isAdmin(req)) where.userId = req.user.idUser;
  else if (requested) where.userId = String(requested);
  if (req.query.active === '1') {
    const today = ymd(new Date(Date.now() - 3 * 3600000));
    where.startDate = { [Op.lte]: today };
    where.endDate = { [Op.gte]: today };
  }
  const objectives = await Objective.findAll({ where, include, order: [['startDate', 'DESC'], ['id', 'DESC']] });
  res.json({ data: await Promise.all(objectives.map((o) => serializeObjective(o))) });
});

export const get = asyncHandler(async (req, res) => {
  const o = await Objective.findByPk(idParam(req), { include });
  if (!o) throw notFound('Objetivo');
  if (!isAdmin(req) && o.userId !== req.user.idUser) throw forbidden('Este objetivo es de otro vendedor');
  res.json({ data: await serializeObjective(o) });
});

// CUU02 — Asignar un objetivo a un vendedor (solo administración).
export const create = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const d = objectiveData(b);
  d.objectiveType = d.objectiveType || 'ventas';
  d.periodType = d.periodType || 'semanal';
  const { startDate, endDate } = rangeOf(b, d.periodType);
  if (!startDate) throw badRequest('Indicá el período del objetivo (fecha de inicio)', { startDate: 'required' });
  if (!d.targetAmount) throw badRequest('La meta debe ser mayor a cero', { targetAmount: 'required' });
  const userId = String(b.userId ?? b.idUser ?? b.sellerId ?? '');
  const seller = userId ? await User.findByPk(userId) : null;
  if (!seller) throw badRequest('Elegí un vendedor existente para asignar el objetivo', { userId: 'missing' });
  if (seller.accountStatus !== 'Activo') throw badRequest('El vendedor elegido está inactivo', { userId: 'inactive' });
  const overlap = await overlapping(seller.idUser, d.objectiveType, startDate, endDate);
  if (overlap && !b.force) {
    throw conflict(`${seller.fullName} ya tiene un objetivo de ${d.objectiveType} entre ${overlap.startDate} y ${overlap.endDate}. ¿Querés crearlo igual?`, { existing: { id: overlap.id, description: overlap.description, startDate: overlap.startDate, endDate: overlap.endDate } });
  }
  const o = await sequelize.transaction(async (transaction) => {
    const obj = await Objective.create({ ...d, description: d.description || `Objetivo de ${d.objectiveType}`, startDate, endDate, userId: seller.idUser, createdById: req.user.idUser }, { transaction });
    await saveRelations(obj, b, transaction);
    return obj;
  });
  await createNotification(seller.idUser, 'objetivo', `Nuevo objetivo: ${o.description} (${startDate} a ${endDate})`, 'objetivo', o.id);
  const full = await Objective.findByPk(o.id, { include });
  res.status(201).json({ message: 'Objetivo asignado', data: await serializeObjective(full) });
});

export const update = asyncHandler(async (req, res) => {
  const o = await Objective.findByPk(idParam(req));
  if (!o) throw notFound('Objetivo');
  const b = req.body || {};
  const d = objectiveData(b);
  if (b.startDate !== undefined || b.endDate !== undefined || b.weekPeriod !== undefined) {
    Object.assign(d, rangeOf({ startDate: b.startDate ?? o.startDate, endDate: b.endDate ?? (b.startDate ? undefined : o.endDate), weekPeriod: b.weekPeriod }, d.periodType || o.periodType));
  }
  if (b.userId !== undefined || b.idUser !== undefined || b.sellerId !== undefined) {
    const u = await User.findByPk(String(b.userId ?? b.idUser ?? b.sellerId));
    if (!u) throw badRequest('Elegí un vendedor existente');
    d.userId = u.idUser;
  }
  const overlap = await overlapping(d.userId || o.userId, d.objectiveType || o.objectiveType, d.startDate || o.startDate, d.endDate || o.endDate, o.id);
  if (overlap && !b.force) throw conflict(`Ya hay un objetivo del mismo tipo entre ${overlap.startDate} y ${overlap.endDate}. ¿Guardar igual?`, { existing: { id: overlap.id, description: overlap.description } });
  await sequelize.transaction(async (transaction) => {
    await o.update(d, { transaction });
    await saveRelations(o, b, transaction);
  });
  const full = await Objective.findByPk(o.id, { include });
  res.json({ message: 'Objetivo actualizado', data: await serializeObjective(full) });
});

export const remove = asyncHandler(async (req, res) => {
  const o = await Objective.findByPk(idParam(req));
  if (!o) throw notFound('Objetivo');
  await sequelize.transaction(async (transaction) => {
    await o.setCompanies([], { transaction });
    await o.setItems([], { transaction });
    await o.setPromotions([], { transaction });
    await o.destroy({ transaction });
  });
  res.json({ message: 'Objetivo eliminado' });
});
