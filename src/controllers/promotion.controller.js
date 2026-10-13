import { Op } from 'sequelize';
import { sequelize, Promotion, CatalogItem, ProductLine } from '../models/index.js';
import { asyncHandler, badRequest, idParam, notFound, toInt } from '../utils/http.js';
import { parseDate, text } from '../utils/validation.js';

const include = [{ model: CatalogItem, as: 'items', attributes: ['id', 'name', 'type', 'productLineId'], through: { attributes: [] }, include: [{ model: ProductLine, as: 'productLine', attributes: ['id', 'name'] }] }];

const serialize = (p) => {
  const j = typeof p.toJSON === 'function' ? p.toJSON() : p;
  const today = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  return {
    ...j,
    items: (j.items || []).map((i) => ({ id: i.id, name: i.name, type: i.type, productLine: i.productLine?.name ?? null })),
    current: j.startDate <= today && j.endDate >= today,
  };
};

const data = (b) => {
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
    const items = await CatalogItem.findAll({ where: { productLineId: { [Op.in]: b.productLineIds.map(Number) }, active: true }, attributes: ['id'], transaction });
    ids = items.map((i) => i.id);
  }
  if (!ids) return;
  const unique = [...new Set(ids.map((x) => toInt(x)).filter(Boolean))];
  if (unique.length && (await CatalogItem.count({ where: { id: unique }, transaction })) !== unique.length) throw badRequest('Algún producto no existe');
  await p.setItems(unique, { transaction });
};

export const list = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.active === '1') {
    const today = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    where.startDate = { [Op.lte]: today };
    where.endDate = { [Op.gte]: today };
  }
  const promos = await Promotion.findAll({ where, include, order: [['startDate', 'DESC'], ['id', 'DESC']] });
  res.json({ data: promos.map(serialize) });
});

export const get = asyncHandler(async (req, res) => {
  const p = await Promotion.findByPk(idParam(req), { include });
  if (!p) throw notFound('Promoción');
  res.json({ data: serialize(p) });
});

export const create = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const d = data(b);
  if (!d.name) throw badRequest('El nombre de la promoción es obligatorio', { name: 'required' });
  if (!d.startDate || !d.endDate) throw badRequest('Indicá la vigencia (fecha de inicio y fin)', { startDate: 'required' });
  if (d.endDate < d.startDate) throw badRequest('La fecha de fin no puede ser anterior a la de inicio', { endDate: 'beforeStart' });
  const p = await sequelize.transaction(async (transaction) => {
    const promo = await Promotion.create({ ...d, createdById: req.user.idUser }, { transaction });
    await saveItems(promo, b, transaction);
    return promo;
  });
  res.status(201).json({ message: 'Promoción creada', data: serialize(await Promotion.findByPk(p.id, { include })) });
});

export const update = asyncHandler(async (req, res) => {
  const p = await Promotion.findByPk(idParam(req));
  if (!p) throw notFound('Promoción');
  const b = req.body || {};
  const d = data(b);
  if (d.name === null) throw badRequest('El nombre no puede quedar vacío');
  const ini = d.startDate || p.startDate;
  const end = d.endDate || p.endDate;
  if (end < ini) throw badRequest('La fecha de fin no puede ser anterior a la de inicio');
  await sequelize.transaction(async (transaction) => {
    await p.update(d, { transaction });
    await saveItems(p, b, transaction);
  });
  res.json({ message: 'Promoción actualizada', data: serialize(await Promotion.findByPk(p.id, { include })) });
});

export const remove = asyncHandler(async (req, res) => {
  const p = await Promotion.findByPk(idParam(req));
  if (!p) throw notFound('Promoción');
  await sequelize.transaction(async (transaction) => {
    await p.setItems([], { transaction });
    await p.setObjectives([], { transaction });
    await p.destroy({ transaction });
  });
  res.json({ message: 'Promoción eliminada' });
});
