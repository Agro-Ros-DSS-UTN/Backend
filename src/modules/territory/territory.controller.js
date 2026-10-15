import { Op } from 'sequelize';
import { Province, Locality, Company } from '../../shared/models/index.js';
import { asyncHandler, badRequest, conflict, notFound, pick, toInt } from '../../shared/utils/http.js';
import { number, required, text } from '../../shared/utils/validation.js';

export const serializeLocality = (l) => {
  if (!l) return null;
  const j = typeof l.toJSON === 'function' ? l.toJSON() : l;
  return {
    id: j.id,
    name: j.name,
    postalCode: j.postalCode ?? null,
    latitude: j.latitude !== null && j.latitude !== undefined ? Number(j.latitude) : null,
    longitude: j.longitude !== null && j.longitude !== undefined ? Number(j.longitude) : null,
    provinceId: j.provinceId ?? null,
    province: j.province ? { id: j.province.id, name: j.province.name } : null,
    // compatibilidad con las pantallas que usan la forma v1
    localityName: j.name,
    Province: j.province ? { provinceName: j.province.name } : null,
  };
};

export const listProvinces = asyncHandler(async (req, res) => {
  const provinces = await Province.findAll({ order: [['name', 'ASC']] });
  res.json({ data: provinces });
});

// Búsqueda para el selector: ?q=texto&provinceId=82&limit=20
export const listLocalities = asyncHandler(async (req, res) => {
  const where = {};
  const q = String(req.query.q || '').trim();
  if (q) where[Op.or] = [{ name: { [Op.like]: `%${q}%` } }, { postalCode: { [Op.like]: `${q}%` } }];
  const provinceId = toInt(req.query.provinceId);
  if (provinceId) where.provinceId = provinceId;
  const limit = Math.min(Number(req.query.limit) || (q ? 30 : 500), 2000);
  const localities = await Locality.findAll({
    where,
    include: [{ model: Province, as: 'province' }],
    order: [['name', 'ASC']],
    limit,
  });
  res.json({ data: localities.map(serializeLocality) });
});

export const getLocality = asyncHandler(async (req, res) => {
  const l = await Locality.findByPk(req.params.id, { include: [{ model: Province, as: 'province' }] });
  if (!l) throw notFound('Localidad');
  res.json({ data: serializeLocality(l) });
});

const localityData = (b) => {
  const d = pick(b, ['name', 'postalCode', 'provinceId', 'latitude', 'longitude']);
  if (d.name !== undefined) d.name = text(d.name, 'name', 100);
  if (d.postalCode !== undefined) d.postalCode = text(d.postalCode, 'postalCode', 10);
  if (d.provinceId !== undefined) d.provinceId = number(d.provinceId, 'provinceId', { integer: true });
  if (d.latitude !== undefined) d.latitude = number(d.latitude, 'latitude', { min: -90, max: 90 });
  if (d.longitude !== undefined) d.longitude = number(d.longitude, 'longitude', { min: -180, max: 180 });
  return d;
};

export const createLocality = asyncHandler(async (req, res) => {
  const d = localityData(req.body || {});
  required(d, ['name']);
  if (d.provinceId && !(await Province.findByPk(d.provinceId))) throw badRequest('La provincia no existe');
  const id = String(req.body.id || `m-${Date.now().toString(36)}`).slice(0, 20);
  if (await Locality.findByPk(id)) throw conflict('Ya existe una localidad con ese id');
  const l = await Locality.create({ ...d, id });
  res.status(201).json({ message: 'Localidad creada', data: serializeLocality(l) });
});

export const updateLocality = asyncHandler(async (req, res) => {
  const l = await Locality.findByPk(req.params.id);
  if (!l) throw notFound('Localidad');
  await l.update(localityData(req.body || {}));
  res.json({ message: 'Localidad actualizada', data: serializeLocality(l) });
});

export const removeLocality = asyncHandler(async (req, res) => {
  const l = await Locality.findByPk(req.params.id);
  if (!l) throw notFound('Localidad');
  const used = await Company.count({ where: { localityId: l.id }, paranoid: false });
  if (used) throw conflict(`No se puede eliminar: ${used} empresas están en esta localidad.`);
  await l.destroy();
  res.json({ message: 'Localidad eliminada' });
});

// Resuelve la localidad de un formulario: id explícito, o nombre (+ código postal)
// para las pantallas que todavía mandan texto. Si no existe, se crea como
// localidad manual (luego seed-localities la une con la oficial).
export const resolveLocality = async ({ localityId, locality, postalCode }, { transaction } = {}) => {
  if (localityId) {
    const l = await Locality.findByPk(String(localityId), { transaction });
    if (!l) throw badRequest('La localidad indicada no existe', { localityId: 'missing' });
    return l.id;
  }
  const name = text(locality, 'locality', 100);
  const cp = text(postalCode, 'postalCode', 10);
  if (!name && !cp) return undefined;
  const where = {};
  if (name) where.name = name;
  if (cp) where.postalCode = cp;
  let l = await Locality.findOne({ where, transaction });
  if (!l && name) l = await Locality.findOne({ where: { name }, transaction });
  if (l) return l.id;
  if (!name) throw badRequest('Indicá el nombre de la localidad', { locality: 'required' });
  const id = cp && !(await Locality.findByPk(`cp-${cp}`, { transaction })) ? `cp-${cp}` : `m-${Date.now().toString(36)}`;
  l = await Locality.create({ id, name, postalCode: cp || null }, { transaction });
  return l.id;
};
