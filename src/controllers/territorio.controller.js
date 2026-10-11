import { Op } from 'sequelize';
import { Provincia, Localidad, Empresa } from '../models/index.js';
import { asyncHandler, badRequest, conflict, notFound, pick, toInt } from '../utils/http.js';
import { numero, requerido, texto } from '../utils/validacion.js';

export const serializeLocalidad = (l) => {
  if (!l) return null;
  const j = typeof l.toJSON === 'function' ? l.toJSON() : l;
  return {
    id: j.id,
    nombre: j.nombre,
    codigoPostal: j.codigoPostal ?? null,
    latitud: j.latitud !== null && j.latitud !== undefined ? Number(j.latitud) : null,
    longitud: j.longitud !== null && j.longitud !== undefined ? Number(j.longitud) : null,
    provinciaId: j.provinciaId ?? null,
    provincia: j.provincia ? { id: j.provincia.id, nombre: j.provincia.nombre } : null,
    // compatibilidad v1
    nomLocalidad: j.nombre,
    codPostal: j.codigoPostal ?? null,
    Province: j.provincia ? { nomProvincia: j.provincia.nombre } : null,
  };
};

export const listarProvincias = asyncHandler(async (req, res) => {
  const provincias = await Provincia.findAll({ order: [['nombre', 'ASC']] });
  res.json({ data: provincias });
});

// Búsqueda para el selector: ?q=texto&provinciaId=82&limit=20
export const listarLocalidades = asyncHandler(async (req, res) => {
  const where = {};
  const q = String(req.query.q || '').trim();
  if (q) where[Op.or] = [{ nombre: { [Op.like]: `%${q}%` } }, { codigoPostal: { [Op.like]: `${q}%` } }];
  const provinciaId = toInt(req.query.provinciaId);
  if (provinciaId) where.provinciaId = provinciaId;
  const limit = Math.min(Number(req.query.limit) || (q ? 30 : 500), 2000);
  const localidades = await Localidad.findAll({
    where,
    include: [{ model: Provincia, as: 'provincia' }],
    order: [['nombre', 'ASC']],
    limit,
  });
  res.json({ data: localidades.map(serializeLocalidad) });
});

export const obtenerLocalidad = asyncHandler(async (req, res) => {
  const l = await Localidad.findByPk(req.params.id, { include: [{ model: Provincia, as: 'provincia' }] });
  if (!l) throw notFound('Localidad');
  res.json({ data: serializeLocalidad(l) });
});

const datosLocalidad = (b) => {
  const d = pick({ ...b, nombre: b.nombre ?? b.nomLocalidad, codigoPostal: b.codigoPostal ?? b.codPostal }, ['nombre', 'codigoPostal', 'provinciaId', 'latitud', 'longitud']);
  if (d.nombre !== undefined) d.nombre = texto(d.nombre, 'nombre', 100);
  if (d.codigoPostal !== undefined) d.codigoPostal = texto(d.codigoPostal, 'codigoPostal', 10);
  if (d.provinciaId !== undefined) d.provinciaId = numero(d.provinciaId, 'provinciaId', { entero: true });
  if (d.latitud !== undefined) d.latitud = numero(d.latitud, 'latitud', { min: -90, max: 90 });
  if (d.longitud !== undefined) d.longitud = numero(d.longitud, 'longitud', { min: -180, max: 180 });
  return d;
};

export const crearLocalidad = asyncHandler(async (req, res) => {
  const d = datosLocalidad(req.body || {});
  requerido(d, ['nombre']);
  if (d.provinciaId && !(await Provincia.findByPk(d.provinciaId))) throw badRequest('La provincia no existe');
  const id = String(req.body.id || `m-${Date.now().toString(36)}`).slice(0, 20);
  if (await Localidad.findByPk(id)) throw conflict('Ya existe una localidad con ese id');
  const l = await Localidad.create({ ...d, id });
  res.status(201).json({ message: 'Localidad creada', data: serializeLocalidad(l) });
});

export const actualizarLocalidad = asyncHandler(async (req, res) => {
  const l = await Localidad.findByPk(req.params.id);
  if (!l) throw notFound('Localidad');
  await l.update(datosLocalidad(req.body || {}));
  res.json({ message: 'Localidad actualizada', data: serializeLocalidad(l) });
});

export const eliminarLocalidad = asyncHandler(async (req, res) => {
  const l = await Localidad.findByPk(req.params.id);
  if (!l) throw notFound('Localidad');
  const usadas = await Empresa.count({ where: { localidadId: l.id }, paranoid: false });
  if (usadas) throw conflict(`No se puede eliminar: ${usadas} empresas están en esta localidad.`);
  await l.destroy();
  res.json({ message: 'Localidad eliminada' });
});

// Resuelve la localidad de un formulario: id explícito, o nombre (+ código postal)
// para las pantallas que todavía mandan texto. Si no existe, se crea como
// localidad manual (luego seed-localidades la une con la oficial).
export const resolverLocalidad = async ({ localidadId, localidad, codigoPostal }, { transaction } = {}) => {
  if (localidadId) {
    const l = await Localidad.findByPk(String(localidadId), { transaction });
    if (!l) throw badRequest('La localidad indicada no existe', { localidadId: 'inexistente' });
    return l.id;
  }
  const nombre = texto(localidad, 'localidad', 100);
  const cp = texto(codigoPostal, 'codigoPostal', 10);
  if (!nombre && !cp) return undefined;
  const where = {};
  if (nombre) where.nombre = nombre;
  if (cp) where.codigoPostal = cp;
  let l = await Localidad.findOne({ where, transaction });
  if (!l && nombre) l = await Localidad.findOne({ where: { nombre }, transaction });
  if (l) return l.id;
  if (!nombre) throw badRequest('Indicá el nombre de la localidad', { localidad: 'obligatoria' });
  const id = cp && !(await Localidad.findByPk(`cp-${cp}`, { transaction })) ? `cp-${cp}` : `m-${Date.now().toString(36)}`;
  l = await Localidad.create({ id, nombre, codigoPostal: cp || null }, { transaction });
  return l.id;
};
