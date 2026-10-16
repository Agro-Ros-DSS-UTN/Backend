import * as territoryRepository from './territory.repository.js';
import { badRequest, conflict, notFound, pick, toInt } from '../../shared/utils/http.js';
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

const localityData = (b) => {
  const d = pick(b, ['name', 'postalCode', 'provinceId', 'latitude', 'longitude']);
  if (d.name !== undefined) d.name = text(d.name, 'name', 100);
  if (d.postalCode !== undefined) d.postalCode = text(d.postalCode, 'postalCode', 10);
  if (d.provinceId !== undefined) d.provinceId = number(d.provinceId, 'provinceId', { integer: true });
  if (d.latitude !== undefined) d.latitude = number(d.latitude, 'latitude', { min: -90, max: 90 });
  if (d.longitude !== undefined) d.longitude = number(d.longitude, 'longitude', { min: -180, max: 180 });
  return d;
};

export const listProvinces = async () => territoryRepository.findAllProvinces();

// Búsqueda para el selector: ?q=texto&provinceId=82&limit=20
export const listLocalities = async (query = {}) => {
  const q = String(query.q || '').trim();
  const provinceId = toInt(query.provinceId);
  const limit = Math.min(Number(query.limit) || (q ? 30 : 500), 2000);
  const localities = await territoryRepository.findAllLocalities({ q, provinceId, limit });
  return localities.map(serializeLocality);
};

export const getLocality = async (id) => {
  const l = await territoryRepository.findLocalityByIdWithProvince(id);
  if (!l) throw notFound('Localidad');
  return serializeLocality(l);
};

export const createLocality = async (body = {}) => {
  const d = localityData(body);
  required(d, ['name']);
  if (d.provinceId && !(await territoryRepository.findProvinceById(d.provinceId))) throw badRequest('La provincia no existe');
  const id = String(body.id || `m-${Date.now().toString(36)}`).slice(0, 20);
  if (await territoryRepository.findLocalityById(id)) throw conflict('Ya existe una localidad con ese id');
  const l = await territoryRepository.createLocality({ ...d, id });
  return serializeLocality(l);
};

export const updateLocality = async (id, body = {}) => {
  const l = await territoryRepository.findLocalityById(id);
  if (!l) throw notFound('Localidad');
  await territoryRepository.updateLocality(l, localityData(body));
  return serializeLocality(l);
};

export const removeLocality = async (id) => {
  const l = await territoryRepository.findLocalityById(id);
  if (!l) throw notFound('Localidad');
  const used = await territoryRepository.countCompaniesInLocality(l.id);
  if (used) throw conflict(`No se puede eliminar: ${used} empresas están en esta localidad.`);
  await territoryRepository.destroyLocality(l);
  return { message: 'Localidad eliminada' };
};

// Resuelve la localidad de un formulario: id explícito, o nombre (+ código postal)
// para las pantallas que todavía mandan texto. Si no existe, se crea como
// localidad manual (luego seed-localities la une con la oficial).
export const resolveLocality = async ({ localityId, locality, postalCode }, { transaction } = {}) => {
  if (localityId) {
    const l = await territoryRepository.findLocalityById(String(localityId), { transaction });
    if (!l) throw badRequest('La localidad indicada no existe', { localityId: 'missing' });
    return l.id;
  }
  const name = text(locality, 'locality', 100);
  const cp = text(postalCode, 'postalCode', 10);
  if (!name && !cp) return undefined;
  const where = {};
  if (name) where.name = name;
  if (cp) where.postalCode = cp;
  let l = await territoryRepository.findLocalityOne(where, { transaction });
  if (!l && name) l = await territoryRepository.findLocalityOne({ name }, { transaction });
  if (l) return l.id;
  if (!name) throw badRequest('Indicá el nombre de la localidad', { locality: 'required' });
  const id = cp && !(await territoryRepository.findLocalityById(`cp-${cp}`, { transaction })) ? `cp-${cp}` : `m-${Date.now().toString(36)}`;
  l = await territoryRepository.createLocality({ id, name, postalCode: cp || null }, { transaction });
  return l.id;
};
