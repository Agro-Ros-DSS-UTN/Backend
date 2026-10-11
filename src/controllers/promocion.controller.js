import { Op } from 'sequelize';
import { sequelize, Promocion, ItemCatalogo, LineaProducto } from '../models/index.js';
import { asyncHandler, badRequest, idParam, notFound, toInt } from '../utils/http.js';
import { parseFecha, texto } from '../utils/validacion.js';

const include = [{ model: ItemCatalogo, as: 'items', attributes: ['id', 'nombre', 'tipo', 'lineaId'], through: { attributes: [] }, include: [{ model: LineaProducto, as: 'linea', attributes: ['id', 'nombre'] }] }];

const serialize = (p) => {
  const j = typeof p.toJSON === 'function' ? p.toJSON() : p;
  const hoy = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  return {
    ...j,
    items: (j.items || []).map((i) => ({ id: i.id, nombre: i.nombre, tipo: i.tipo, linea: i.linea?.nombre ?? null })),
    vigente: j.fechaInicio <= hoy && j.fechaFin >= hoy,
  };
};

const datos = (b) => {
  const d = {};
  const set = (k, v) => { if (v !== undefined) d[k] = v; };
  set('nombre', texto(b.nombre, 'nombre', 100));
  set('descripcion', texto(b.descripcion, 'descripcion', 255));
  set('beneficio', texto(b.beneficio, 'beneficio', 120));
  set('condiciones', texto(b.condiciones, 'condiciones', 255));
  if (b.color !== undefined) {
    if (b.color && !/^#[0-9a-fA-F]{3,8}$/.test(b.color)) throw badRequest('El color debe ser un código hexadecimal (#RRGGBB)', { color: 'formato' });
    d.color = b.color || null;
  }
  set('fechaInicio', b.fechaInicio !== undefined ? parseFecha(b.fechaInicio, 'fechaInicio') : undefined);
  set('fechaFin', b.fechaFin !== undefined ? parseFecha(b.fechaFin, 'fechaFin') : undefined);
  return d;
};

const guardarItems = async (p, b, transaction) => {
  let ids;
  if (Array.isArray(b.itemIds)) ids = b.itemIds;
  else if (Array.isArray(b.lineaIds)) {
    // Promoción por línea completa: se asocian todos los productos activos de esas líneas.
    const items = await ItemCatalogo.findAll({ where: { lineaId: { [Op.in]: b.lineaIds.map(Number) }, activo: true }, attributes: ['id'], transaction });
    ids = items.map((i) => i.id);
  }
  if (!ids) return;
  const unicos = [...new Set(ids.map((x) => toInt(x)).filter(Boolean))];
  if (unicos.length && (await ItemCatalogo.count({ where: { id: unicos }, transaction })) !== unicos.length) throw badRequest('Algún producto no existe');
  await p.setItems(unicos, { transaction });
};

export const listar = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.vigentes === '1') {
    const hoy = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    where.fechaInicio = { [Op.lte]: hoy };
    where.fechaFin = { [Op.gte]: hoy };
  }
  const promos = await Promocion.findAll({ where, include, order: [['fechaInicio', 'DESC'], ['id', 'DESC']] });
  res.json({ data: promos.map(serialize) });
});

export const obtener = asyncHandler(async (req, res) => {
  const p = await Promocion.findByPk(idParam(req), { include });
  if (!p) throw notFound('Promoción');
  res.json({ data: serialize(p) });
});

export const crear = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const d = datos(b);
  if (!d.nombre) throw badRequest('El nombre de la promoción es obligatorio', { nombre: 'obligatorio' });
  if (!d.fechaInicio || !d.fechaFin) throw badRequest('Indicá la vigencia (fecha de inicio y fin)', { fechaInicio: 'obligatorio' });
  if (d.fechaFin < d.fechaInicio) throw badRequest('La fecha de fin no puede ser anterior a la de inicio', { fechaFin: 'anterior al inicio' });
  const p = await sequelize.transaction(async (transaction) => {
    const promo = await Promocion.create({ ...d, creadoPorId: req.user.idUser }, { transaction });
    await guardarItems(promo, b, transaction);
    return promo;
  });
  res.status(201).json({ message: 'Promoción creada', data: serialize(await Promocion.findByPk(p.id, { include })) });
});

export const actualizar = asyncHandler(async (req, res) => {
  const p = await Promocion.findByPk(idParam(req));
  if (!p) throw notFound('Promoción');
  const b = req.body || {};
  const d = datos(b);
  if (d.nombre === null) throw badRequest('El nombre no puede quedar vacío');
  const ini = d.fechaInicio || p.fechaInicio;
  const fin = d.fechaFin || p.fechaFin;
  if (fin < ini) throw badRequest('La fecha de fin no puede ser anterior a la de inicio');
  await sequelize.transaction(async (transaction) => {
    await p.update(d, { transaction });
    await guardarItems(p, b, transaction);
  });
  res.json({ message: 'Promoción actualizada', data: serialize(await Promocion.findByPk(p.id, { include })) });
});

export const eliminar = asyncHandler(async (req, res) => {
  const p = await Promocion.findByPk(idParam(req));
  if (!p) throw notFound('Promoción');
  await sequelize.transaction(async (transaction) => {
    await p.setItems([], { transaction });
    await p.setObjetivos([], { transaction });
    await p.destroy({ transaction });
  });
  res.json({ message: 'Promoción eliminada' });
});
