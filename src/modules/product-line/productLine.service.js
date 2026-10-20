import { LINE_CATEGORIES } from './productLine.entity.js';
import * as productLineRepository from './productLine.repository.js';
import { conflict, notFound, pick } from '../../shared/utils/http.js';
import { required, text, oneOf } from '../../shared/utils/validation.js';

// Categoría sugerida a partir del nombre de la línea.
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
  const productLines = await productLineRepository.findAll();
  return productLines.map(serializeProductLine);
};

export const getProductLine = async (id) => {
  const l = await productLineRepository.findById(id, { withItems: true });
  if (!l) throw notFound('Línea de producto');
  return serializeProductLine(l);
};

export const createProductLine = async (body = {}) => {
  const d = lineData(body);
  required(d, ['name']);
  const l = await productLineRepository.create({ ...d, category: d.category || categoryOf(d.name) });
  return serializeProductLine(l);
};

export const updateProductLine = async (id, body = {}) => {
  const l = await productLineRepository.findById(id);
  if (!l) throw notFound('Línea de producto');
  await productLineRepository.update(l, lineData(body));
  return serializeProductLine(l);
};

export const removeProductLine = async (id) => {
  const l = await productLineRepository.findById(id);
  if (!l) throw notFound('Línea de producto');
  const used = await productLineRepository.countItems(l.id);
  if (used) throw conflict(`No se puede eliminar: ${used} productos pertenecen a esta línea.`);
  await productLineRepository.destroy(l);
  return { message: 'Línea eliminada' };
};

// Para el alta de productos: id de la línea con ese nombre, creándola si no existe.
export const productLineIdByName = async (name) => {
  if (!name) return null;
  const [l] = await productLineRepository.findOrCreateByName({ name, category: categoryOf(name) });
  return l.id;
};

export const productLineExists = async (id) => Boolean(await productLineRepository.findById(id));
