import { Op } from 'sequelize';
import { ProductLine, CatalogItem, ServiceOrder, AppliedProduct } from '../../shared/models/index.js';
import { LINE_CATEGORIES, SERVICE_TYPES } from './catalog.model.js';
import { asyncHandler, badRequest, conflict, idParam, notFound, pick } from '../../shared/utils/http.js';
import { dataUrl, number, required, text, oneOf, urlHttp } from '../../shared/utils/validation.js';

const V1_SERVICE = 'Servicio Agronómico';

// ── Líneas de producto ──
const categoryOf = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('fumig') || n.includes('fosf')) return 'fumigante';
  if (n.includes('roden') || n.includes('cebo')) return 'rodenticida';
  if (n.includes('insect')) return 'insecticida';
  if (n.includes('fertil') || n.includes('foliar')) return 'fertilizante';
  return 'otro';
};

export const serializeProductLine = (l) => {
  const j = typeof l.toJSON === 'function' ? l.toJSON() : l;
  return { ...j, lineName: j.name, itemCount: j.itemCount !== undefined ? Number(j.itemCount) : undefined };
};

export const listProductLines = asyncHandler(async (req, res) => {
  const productLines = await ProductLine.findAll({ order: [['name', 'ASC']] });
  res.json({ data: productLines.map(serializeProductLine) });
});

export const getProductLine = asyncHandler(async (req, res) => {
  const l = await ProductLine.findByPk(idParam(req), { include: [{ model: CatalogItem, as: 'items' }] });
  if (!l) throw notFound('Línea de producto');
  res.json({ data: serializeProductLine(l) });
});

const lineData = (b) => {
  const d = pick({ ...b, name: b.name ?? b.lineName ?? b.description }, ['name', 'code', 'category']);
  if (d.name !== undefined) d.name = text(d.name, 'name', 100);
  if (d.code !== undefined) d.code = text(d.code, 'code', 30);
  if (d.category !== undefined) d.category = oneOf(d.category, LINE_CATEGORIES, 'category');
  return d;
};

export const createProductLine = asyncHandler(async (req, res) => {
  const d = lineData(req.body || {});
  required(d, ['name']);
  const l = await ProductLine.create({ ...d, category: d.category || categoryOf(d.name) });
  res.status(201).json({ message: 'Línea creada', data: serializeProductLine(l) });
});

export const updateProductLine = asyncHandler(async (req, res) => {
  const l = await ProductLine.findByPk(idParam(req));
  if (!l) throw notFound('Línea de producto');
  await l.update(lineData(req.body || {}));
  res.json({ message: 'Línea actualizada', data: serializeProductLine(l) });
});

export const removeProductLine = asyncHandler(async (req, res) => {
  const l = await ProductLine.findByPk(idParam(req));
  if (!l) throw notFound('Línea de producto');
  const used = await CatalogItem.count({ where: { productLineId: l.id } });
  if (used) throw conflict(`No se puede eliminar: ${used} productos pertenecen a esta línea.`);
  await l.destroy();
  res.json({ message: 'Línea eliminada' });
});

// ── Ítems del catálogo (productos y servicios) ──
export const serializeItem = (i) => {
  if (!i) return null;
  const j = typeof i.toJSON === 'function' ? i.toJSON() : i;
  const price = j.referencePrice !== null && j.referencePrice !== undefined ? Number(j.referencePrice) : null;
  return {
    id: j.id,
    type: j.type,
    name: j.name,
    code: j.code ?? null,
    description: j.description ?? null,
    referencePrice: price,
    unitCost: j.unitCost !== null && j.unitCost !== undefined ? Number(j.unitCost) : null,
    billingFrequency: j.billingFrequency ?? null,
    stockAvailable: j.stockAvailable ?? null,
    active: Boolean(j.active),
    image: j.image ?? undefined,
    productLineId: j.productLineId ?? null,
    productLine: j.productLine ? { id: j.productLine.id, name: j.productLine.name, category: j.productLine.category } : null,
    activeIngredient: j.activeIngredient ?? null,
    presentation: j.presentation ?? null,
    serviceType: j.serviceType ?? null,
    unitOfMeasure: j.unitOfMeasure ?? null,
    createdAt: j.createdAt,
    // compatibilidad v1 (pantalla de productos)
    ref: j.code ?? null,
    unitPrice: price ?? 0,
    costPerUnit: j.unitCost !== null && j.unitCost !== undefined ? Number(j.unitCost) : 0,
    imageUrl: j.image ?? null,
    productType: j.type === 'servicio' ? V1_SERVICE : (j.productLine?.name ?? null),
    serviceTypeName: j.type === 'servicio' ? j.name : undefined,
  };
};

const lineByName = async (name) => {
  if (!name) return null;
  const [l] = await ProductLine.findOrCreate({ where: { name }, defaults: { name, category: categoryOf(name) } });
  return l.id;
};

const itemData = async (b, forcedType) => {
  const d = pick({
    ...b,
    code: b.code !== undefined ? b.code : b.ref,
    referencePrice: b.referencePrice !== undefined ? b.referencePrice : b.unitPrice,
    unitCost: b.unitCost !== undefined ? b.unitCost : b.costPerUnit,
    image: b.image !== undefined ? b.image : b.imageUrl,
  }, ['type', 'name', 'code', 'description', 'referencePrice', 'unitCost', 'billingFrequency', 'stockAvailable', 'active', 'image', 'productLineId', 'activeIngredient', 'presentation', 'serviceType', 'unitOfMeasure']);
  if (forcedType) d.type = forcedType;
  // La pantalla v1 manda "productType": un servicio o el nombre de una línea.
  if (b.productType !== undefined && !forcedType) {
    if (/servicio/i.test(b.productType)) d.type = 'servicio';
    else {
      d.type = d.type || 'producto';
      if (d.productLineId === undefined) d.productLineId = await lineByName(text(b.productType, 'productType', 100));
    }
  }
  if (d.type !== undefined) d.type = oneOf(d.type, ['producto', 'servicio'], 'type');
  if (d.name !== undefined) d.name = text(d.name, 'name', 150);
  if (d.code !== undefined) d.code = text(d.code, 'code', 50);
  if (d.description !== undefined) d.description = text(d.description, 'description', 5000);
  if (d.referencePrice !== undefined) d.referencePrice = number(d.referencePrice, 'referencePrice', { min: 0 });
  if (d.unitCost !== undefined) d.unitCost = number(d.unitCost, 'unitCost', { min: 0 });
  if (d.billingFrequency !== undefined) d.billingFrequency = text(d.billingFrequency, 'billingFrequency', 50);
  if (d.stockAvailable !== undefined) d.stockAvailable = number(d.stockAvailable, 'stockAvailable', { integer: true, min: 0 });
  if (d.active !== undefined) d.active = Boolean(d.active);
  if (d.image !== undefined) {
    // Imagen embebida (data URL) o enlace http(s); nunca javascript: u otros esquemas.
    d.image = d.image && String(d.image).startsWith('data:') ? dataUrl(d.image, 'image', 3) : urlHttp(d.image, 'image');
  }
  if (d.productLineId !== undefined && d.productLineId !== null) {
    d.productLineId = number(d.productLineId, 'productLineId', { integer: true });
    if (!(await ProductLine.findByPk(d.productLineId))) throw badRequest('La línea indicada no existe', { productLineId: 'missing' });
  }
  if (d.activeIngredient !== undefined) d.activeIngredient = text(d.activeIngredient, 'activeIngredient', 150);
  if (d.presentation !== undefined) d.presentation = text(d.presentation, 'presentation', 100);
  if (d.serviceType !== undefined) d.serviceType = oneOf(d.serviceType || null, SERVICE_TYPES, 'serviceType');
  if (d.unitOfMeasure !== undefined) d.unitOfMeasure = text(d.unitOfMeasure, 'unitOfMeasure', 30);
  return d;
};

const listItemsOf = (type) => asyncHandler(async (req, res) => {
  const where = {};
  if (type) where.type = type;
  else if (req.query.type) where.type = oneOf(String(req.query.type), ['producto', 'servicio'], 'type');
  if (req.query.active === '1') where.active = true;
  if (req.query.productLineId) where.productLineId = Number(req.query.productLineId);
  const q = String(req.query.q || '').trim();
  if (q) where[Op.or] = [{ name: { [Op.like]: `%${q}%` } }, { code: { [Op.like]: `%${q}%` } }, { activeIngredient: { [Op.like]: `%${q}%` } }];
  const scope = req.query.withoutImage === '1' ? 'defaultScope' : 'withImage';
  const items = await CatalogItem.scope(scope).findAll({ where, include: [{ model: ProductLine, as: 'productLine' }], order: [['name', 'ASC']] });
  res.json({ data: items.map(serializeItem) });
});

export const listItems = listItemsOf(null);
export const listProducts = listItemsOf('producto');
export const listServices = listItemsOf('servicio');

export const getItem = asyncHandler(async (req, res) => {
  const i = await CatalogItem.scope('withImage').findByPk(idParam(req), { include: [{ model: ProductLine, as: 'productLine' }] });
  if (!i) throw notFound('Ítem del catálogo');
  res.json({ data: serializeItem(i) });
});

const createItemFrom = (forcedType) => asyncHandler(async (req, res) => {
  const body = req.body || {};
  const d = await itemData({ ...body, name: body.name ?? body.serviceType }, forcedType);
  if (!d.type) d.type = 'producto';
  required(d, ['name']);
  const i = await CatalogItem.create(d);
  const full = await CatalogItem.scope('withImage').findByPk(i.id, { include: [{ model: ProductLine, as: 'productLine' }] });
  res.status(201).json({ message: d.type === 'servicio' ? 'Servicio creado' : 'Producto creado', data: serializeItem(full) });
});

export const createItem = createItemFrom(null);
export const createService = createItemFrom('servicio');

export const updateItem = asyncHandler(async (req, res) => {
  const i = await CatalogItem.findByPk(idParam(req));
  if (!i) throw notFound('Ítem del catálogo');
  const d = await itemData(req.body || {});
  if (d.name === null) throw badRequest('El nombre no puede quedar vacío');
  await i.update(d);
  const full = await CatalogItem.scope('withImage').findByPk(i.id, { include: [{ model: ProductLine, as: 'productLine' }] });
  res.json({ message: 'Ítem actualizado', data: serializeItem(full) });
});

// Si el ítem ya figura en órdenes u oportunidades se desactiva en vez de borrarse.
export const removeItem = asyncHandler(async (req, res) => {
  const i = await CatalogItem.findByPk(idParam(req));
  if (!i) throw notFound('Ítem del catálogo');
  const used = (await ServiceOrder.count({ where: { serviceId: i.id }, paranoid: false })) + (await AppliedProduct.count({ where: { itemId: i.id } }));
  if (used) {
    await i.update({ active: false });
    return res.json({ message: 'El ítem figura en órdenes de servicio: se desactivó en lugar de eliminarse.', data: { id: i.id, active: false } });
  }
  try {
    await i.destroy();
  } catch (e) {
    if (e.name === 'SequelizeForeignKeyConstraintError') {
      await i.update({ active: false });
      return res.json({ message: 'El ítem está en uso: se desactivó en lugar de eliminarse.', data: { id: i.id, active: false } });
    }
    throw e;
  }
  res.json({ message: 'Ítem eliminado', id: i.id });
});
