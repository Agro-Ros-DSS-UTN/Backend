import { OBJECTIVE_TYPES, PERIOD_TYPES } from './objective.entity.js';
import * as objectiveRepository from './objective.repository.js';
import { badRequest, conflict, forbidden, notFound, toInt } from '../../shared/utils/http.js';
import { number, parseDate, text, oneOf } from '../../shared/utils/validation.js';
import { createNotification } from '../notifications/notification.service.js';

export const normalizeObjectiveType = (t) => {
  if (OBJECTIVE_TYPES.includes(t)) return t;
  const n = String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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

// Avance real del objetivo dentro de su período, según el tipo.
const calculateProgress = async (o) => {
  if (!o.userId) return 0;
  const from = new Date(`${o.startDate}T00:00:00-03:00`);
  const to = new Date(new Date(`${o.endDate}T00:00:00-03:00`).getTime() + 86400000);
  const companyIds = (o.companies || []).map((e) => e.id);
  switch (o.objectiveType) {
    case 'visitas':
      return objectiveRepository.countVisitActivities({ userId: o.userId, from, to, companyIds });
    case 'ventas':
      return objectiveRepository.sumSalesActivities({ userId: o.userId, from, to, companyIds });
    case 'nuevosClientes':
      return objectiveRepository.countNewCompaniesBySeller({ userId: o.userId, from, to });
    case 'cotizaciones':
      return objectiveRepository.countQuotedOpportunities({ userId: o.userId, from, to, companyIds });
    case 'servicios':
      return objectiveRepository.countCompletedServiceOrders({ userId: o.userId, startDate: o.startDate, endDate: o.endDate, companyIds });
    default:
      return 0;
  }
};

export const serializeObjective = async (o, { withProgress = true } = {}) => {
  const j = typeof o.toJSON === 'function' ? o.toJSON() : o;
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
    if (companies.length && (await objectiveRepository.countCompaniesByIds(companies, transaction)) !== companies.length) {
      throw badRequest('Alguna empresa no existe');
    }
    await objectiveRepository.setCompanies(o, companies, transaction);
  }
  if (items) {
    if (items.length && (await objectiveRepository.countCatalogItemsByIds(items, transaction)) !== items.length) {
      throw badRequest('Algún producto o servicio no existe');
    }
    await objectiveRepository.setItems(o, items, transaction);
  }
  if (promos) {
    if (promos.length && (await objectiveRepository.countPromotionsByIds(promos, transaction)) !== promos.length) {
      throw badRequest('Alguna promoción no existe');
    }
    await objectiveRepository.setPromotions(o, promos, transaction);
  }
};

const objectiveData = (b) => {
  const d = {};
  if (b.description !== undefined) d.description = text(b.description, 'description', 150);
  if (b.objectiveType !== undefined) d.objectiveType = oneOf(normalizeObjectiveType(b.objectiveType), OBJECTIVE_TYPES, 'objectiveType');
  if (b.periodType !== undefined) d.periodType = oneOf(b.periodType, PERIOD_TYPES, 'periodType');
  if (b.targetAmount !== undefined) d.targetAmount = number(b.targetAmount, 'targetAmount', { min: 0 });
  return d;
};

export const listObjectives = async (query = {}, { admin, currentUserId }) => {
  const requested = query.userId;
  const userId = !admin ? currentUserId : (requested ? String(requested) : undefined);
  const activeDate = query.active === '1' ? ymd(new Date(Date.now() - 3 * 3600000)) : undefined;
  const objectives = await objectiveRepository.findAll({ userId, activeDate });
  return Promise.all(objectives.map((o) => serializeObjective(o)));
};

export const getObjective = async (id, { admin, currentUserId }) => {
  const o = await objectiveRepository.findByIdFull(id);
  if (!o) throw notFound('Objetivo');
  if (!admin && o.userId !== currentUserId) throw forbidden('Este objetivo es de otro vendedor');
  return serializeObjective(o);
};

// CUU02 — Asignar un objetivo a un vendedor (solo administración).
export const createObjective = async (body = {}, { currentUserId }) => {
  const d = objectiveData(body);
  d.objectiveType = d.objectiveType || 'ventas';
  d.periodType = d.periodType || 'semanal';
  const { startDate, endDate } = rangeOf(body, d.periodType);
  if (!startDate) throw badRequest('Indicá el período del objetivo (fecha de inicio)', { startDate: 'required' });
  if (!d.targetAmount) throw badRequest('La meta debe ser mayor a cero', { targetAmount: 'required' });
  const userId = String(body.userId ?? body.idUser ?? body.sellerId ?? '');
  const seller = userId ? await objectiveRepository.findUserById(userId) : null;
  if (!seller) throw badRequest('Elegí un vendedor existente para asignar el objetivo', { userId: 'missing' });
  if (seller.accountStatus !== 'Activo') throw badRequest('El vendedor elegido está inactivo', { userId: 'inactive' });
  const overlap = await objectiveRepository.findOverlapping(seller.idUser, d.objectiveType, startDate, endDate);
  if (overlap && !body.force) {
    throw conflict(`${seller.fullName} ya tiene un objetivo de ${d.objectiveType} entre ${overlap.startDate} y ${overlap.endDate}. ¿Querés crearlo igual?`, {
      existing: { id: overlap.id, description: overlap.description, startDate: overlap.startDate, endDate: overlap.endDate },
    });
  }
  const o = await objectiveRepository.runTransaction(async (transaction) => {
    const obj = await objectiveRepository.create(
      { ...d, description: d.description || `Objetivo de ${d.objectiveType}`, startDate, endDate, userId: seller.idUser, createdById: currentUserId },
      { transaction }
    );
    await saveRelations(obj, body, transaction);
    return obj;
  });
  await createNotification(seller.idUser, 'objetivo', `Nuevo objetivo: ${o.description} (${startDate} a ${endDate})`, 'objetivo', o.id);
  const full = await objectiveRepository.findByIdFull(o.id);
  return serializeObjective(full);
};

export const updateObjective = async (id, body = {}) => {
  const o = await objectiveRepository.findById(id);
  if (!o) throw notFound('Objetivo');
  const d = objectiveData(body);
  if (body.startDate !== undefined || body.endDate !== undefined || body.weekPeriod !== undefined) {
    Object.assign(d, rangeOf({ startDate: body.startDate ?? o.startDate, endDate: body.endDate ?? (body.startDate ? undefined : o.endDate), weekPeriod: body.weekPeriod }, d.periodType || o.periodType));
  }
  if (body.userId !== undefined || body.idUser !== undefined || body.sellerId !== undefined) {
    const u = await objectiveRepository.findUserById(String(body.userId ?? body.idUser ?? body.sellerId));
    if (!u) throw badRequest('Elegí un vendedor existente');
    d.userId = u.idUser;
  }
  const overlap = await objectiveRepository.findOverlapping(d.userId || o.userId, d.objectiveType || o.objectiveType, d.startDate || o.startDate, d.endDate || o.endDate, o.id);
  if (overlap && !body.force) {
    throw conflict(`Ya hay un objetivo del mismo tipo entre ${overlap.startDate} y ${overlap.endDate}. ¿Guardar igual?`, {
      existing: { id: overlap.id, description: overlap.description },
    });
  }
  await objectiveRepository.runTransaction(async (transaction) => {
    await objectiveRepository.update(o, d, { transaction });
    await saveRelations(o, body, transaction);
  });
  const full = await objectiveRepository.findByIdFull(o.id);
  return serializeObjective(full);
};

export const removeObjective = async (id) => {
  const o = await objectiveRepository.findById(id);
  if (!o) throw notFound('Objetivo');
  await objectiveRepository.destroyWithRelations(o);
  return { message: 'Objetivo eliminado' };
};
