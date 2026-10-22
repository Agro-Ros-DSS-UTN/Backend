import * as promotionRepository from './promotion.repository.js';
import { badRequest, notFound, toInt } from '../../shared/utils/http.js';
import { parseDate, text } from '../../shared/utils/validation.js';

export const serializePromotion = (p) => {
  if (!p) return null;
  const j = typeof p.toJSON === 'function' ? p.toJSON() : p;
  const today = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  return {
    ...j,
    items: (j.items || []).map((i) => ({ id: i.id, name: i.name, type: i.type, productLine: i.productLine?.name ?? null })),
    current: j.startDate <= today && j.endDate >= today,
  };
};

const promotionData = (b) => {
  const d = {};
  const set = (k, v) => { if (v !== undefined) d[k] = v; };
  set('name', text(b.name, 'name', 100));
  set('description', text(b.description, 'description', 255));
  set('benefit', text(b.benefit, 'benefit', 120));
  set('conditions', text(b.conditions, 'conditions', 255));
  if (b.color !== undefined) {
    if (b.color && !/^#[0-9a-fA-F]{3,8}$/.test(b.color)) throw badRequest('El color debe ser un código hexadecimal (#RRGGBB)', { color: 'format' });
    d.color = b.color || null;
  }
  set('startDate', b.startDate !== undefined ? parseDate(b.startDate, 'startDate') : undefined);
  set('endDate', b.endDate !== undefined ? parseDate(b.endDate, 'endDate') : undefined);
  return d;
};

const saveItems = async (p, b, transaction) => {
  let ids;
  if (Array.isArray(b.itemIds)) ids = b.itemIds;
  else if (Array.isArray(b.productLineIds)) {
    // Promoción por línea completa: se asocian todos los productos activos de esas líneas.
    const items = await promotionRepository.findActiveItemsByProductLineIds(b.productLineIds.map(Number), transaction);
    ids = items.map((i) => i.id);
  }
  if (!ids) return;
  const unique = [...new Set(ids.map((x) => toInt(x)).filter(Boolean))];
  if (unique.length && (await promotionRepository.countCatalogItemsByIds(unique, transaction)) !== unique.length) {
    throw badRequest('Algún producto no existe');
  }
  await promotionRepository.setItems(p, unique, transaction);
};

export const listPromotions = async (query = {}) => {
  const activeDate = query.active === '1'
    ? new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10)
    : undefined;
  const promos = await promotionRepository.findAll({
    activeDate,
    page: query.page,
    limit: query.limit,
  });
  return promos.map(serializePromotion);
};

export const getPromotion = async (id) => {
  const p = await promotionRepository.findByIdFull(id);
  if (!p) throw notFound('Promoción');
  return serializePromotion(p);
};

export const createPromotion = async (body = {}, { currentUserId }) => {
  const d = promotionData(body);
  if (!d.name) throw badRequest('El nombre de la promoción es obligatorio', { name: 'required' });
  if (!d.startDate || !d.endDate) throw badRequest('Indicá la vigencia (fecha de inicio y fin)', { startDate: 'required' });
  if (d.endDate < d.startDate) throw badRequest('La fecha de fin no puede ser anterior a la de inicio', { endDate: 'beforeStart' });
  const p = await promotionRepository.runTransaction(async (transaction) => {
    const promo = await promotionRepository.create({ ...d, createdById: currentUserId }, { transaction });
    await saveItems(promo, body, transaction);
    return promo;
  });
  return serializePromotion(await promotionRepository.findByIdFull(p.id));
};

export const updatePromotion = async (id, body = {}) => {
  const p = await promotionRepository.findById(id);
  if (!p) throw notFound('Promoción');
  const d = promotionData(body);
  if (d.name === null) throw badRequest('El nombre no puede quedar vacío');
  const ini = d.startDate || p.startDate;
  const end = d.endDate || p.endDate;
  if (end < ini) throw badRequest('La fecha de fin no puede ser anterior a la de inicio');
  await promotionRepository.runTransaction(async (transaction) => {
    await promotionRepository.update(p, d, { transaction });
    await saveItems(p, body, transaction);
  });
  return serializePromotion(await promotionRepository.findByIdFull(p.id));
};

export const removePromotion = async (id) => {
  const p = await promotionRepository.findById(id);
  if (!p) throw notFound('Promoción');
  await promotionRepository.destroyWithRelations(p);
  return { message: 'Promoción eliminada' };
};
