import { LINE_CATEGORIES } from '../product-line/productLine.entity.js';
import { SERVICE_TYPES } from '../catalog-item/catalogItem.entity.js';
import * as catalogRepository from './catalog.repository.js';
import { badRequest, conflict, notFound, pick } from '../../shared/utils/http.js';
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

const lineData = (b) => {
  const d = pick({ ...b, name: b.name ?? b.lineName ?? b.description }, ['name', 'code', 'category']);
  if (d.name !== undefined) d.name = text(d.name, 'name', 100);
  if (d.code !== undefined) d.code = text(d.code, 'code', 30);
  if (d.category !== undefined) d.category = oneOf(d.category, LINE_CATEGORIES, 'category');
  return d;
};

export const listProductLines = async () => {
  const productLines = await catalogRepository.findAllProductLines();
  return productLines.map(serializeProductLine);
};

export const getProductLine = async (id) => {
  const l = await catalogRepository.findProductLineById(id, { withItems: true });
  if (!l) throw notFound('Línea de producto');
  return serializeProductLine(l);
};

export const createProductLine = async (body = {}) => {
  const d = lineData(body);
  required(d, ['name']);
  const l = await catalogRepository.createProductLine({ ...d, category: d.category || categoryOf(d.name) });
  return serializeProductLine(l);
};

export const updateProductLine = async (id, body = {}) => {
  const l = await catalogRepository.findProductLineById(id);
  if (!l) throw notFound('Línea de producto');
  await catalogRepository.updateProductLine(l, lineData(body));
  return serializeProductLine(l);
};

export const removeProductLine = async (id) => {
  const l = await catalogRepository.findProductLineById(id);
  if (!l) throw notFound('Línea de producto');
  const used = await catalogRepository.countItemsInProductLine(l.id);
  if (used) throw conflict(`No se puede eliminar: ${used} productos pertenecen a esta línea.`);
  await catalogRepository.destroyProductLine(l);
  return { message: 'Línea eliminada' };
};

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
  const [l] = await catalogRepository.findOrCreateProductLine({ name, category: categoryOf(name) });
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
    if (!(await catalogRepository.findProductLineById(d.productLineId))) {
      throw badRequest('La línea indicada no existe', { productLineId: 'missing' });
    }
  }
  if (d.activeIngredient !== undefined) d.activeIngredient = text(d.activeIngredient, 'activeIngredient', 150);
  if (d.presentation !== undefined) d.presentation = text(d.presentation, 'presentation', 100);
  if (d.serviceType !== undefined) d.serviceType = oneOf(d.serviceType || null, SERVICE_TYPES, 'serviceType');
  if (d.unitOfMeasure !== undefined) d.unitOfMeasure = text(d.unitOfMeasure, 'unitOfMeasure', 30);
  return d;
};

export const listCatalogItems = async (query = {}, forcedType = null) => {
  const type = forcedType || (query.type ? oneOf(String(query.type), ['producto', 'servicio'], 'type') : undefined);
  const active = query.active === '1';
  const productLineId = query.productLineId ? Number(query.productLineId) : undefined;
  const q = String(query.q || '').trim();
  const withoutImage = query.withoutImage === '1';
  const items = await catalogRepository.findAllItems({ type, active, productLineId, q, withoutImage });
  return items.map(serializeItem);
};

export const getCatalogItem = async (id) => {
  const i = await catalogRepository.findItemById(id, { withImage: true, withProductLine: true });
  if (!i) throw notFound('Ítem del catálogo');
  return serializeItem(i);
};

export const createCatalogItem = async (body = {}, forcedType = null) => {
  const d = await itemData({ ...body, name: body.name ?? body.serviceType }, forcedType);
  if (!d.type) d.type = 'producto';
  required(d, ['name']);
  const i = await catalogRepository.createItem(d);
  const full = await catalogRepository.findItemById(i.id, { withImage: true, withProductLine: true });
  return {
    message: d.type === 'servicio' ? 'Servicio creado' : 'Producto creado',
    data: serializeItem(full),
  };
};

export const updateCatalogItem = async (id, body = {}) => {
  const i = await catalogRepository.findItemById(id);
  if (!i) throw notFound('Ítem del catálogo');
  const d = await itemData(body);
  if (d.name === null) throw badRequest('El nombre no puede quedar vacío');
  await catalogRepository.updateItem(i, d);
  const full = await catalogRepository.findItemById(i.id, { withImage: true, withProductLine: true });
  return serializeItem(full);
};

// Si el ítem ya figura en órdenes u oportunidades se desactiva en vez de borrarse.
export const removeCatalogItem = async (id) => {
  const i = await catalogRepository.findItemById(id);
  if (!i) throw notFound('Ítem del catálogo');
  const used = await catalogRepository.countItemUsageInOrders(i.id);
  if (used) {
    await catalogRepository.updateItem(i, { active: false });
    return { message: 'El ítem figura en órdenes de servicio: se desactivó en lugar de eliminarse.', data: { id: i.id, active: false } };
  }
  try {
    await catalogRepository.destroyItem(i);
  } catch (e) {
    if (e.name === 'SequelizeForeignKeyConstraintError') {
      await catalogRepository.updateItem(i, { active: false });
      return { message: 'El ítem está en uso: se desactivó en lugar de eliminarse.', data: { id: i.id, active: false } };
    }
    throw e;
  }
  return { message: 'Ítem eliminado', id: i.id };
};
