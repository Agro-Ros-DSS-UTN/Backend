import { sequelize, HojaRuta, ParadaRuta, Usuario, Empresa, Actividad, Localidad } from '../models/index.js';
import { ESTADOS_PARADA, ESTADOS_RUTA } from '../models/planificacion.model.js';
import { isAdmin } from '../middlewares/auth.middleware.js';
import { asyncHandler, badRequest, forbidden, idParam, notFound, toInt } from '../utils/http.js';
import { numero, parseFecha, texto, unoDe, urlHttp } from '../utils/validacion.js';
import { crearNotificacion } from './notificacion.controller.js';

const include = [
  {
    model: ParadaRuta, as: 'paradas', include: [
      {
        model: Empresa, as: 'empresa', attributes: ['id', 'razonSocial', 'direccion', 'latitud', 'longitud'], paranoid: false,
        include: [{ model: Localidad, as: 'localidad', attributes: ['id', 'nombre', 'latitud', 'longitud'] }],
      },
      { model: Actividad, as: 'actividad', attributes: ['id', 'tipoContacto', 'fechaHora'] },
    ],
  },
  { model: Usuario, as: 'asignado', attributes: ['idUser', 'nombreApellido', 'rol'] },
  { model: Usuario, as: 'creadoPor', attributes: ['idUser', 'nombreApellido'] },
];
const orden = [['fecha', 'DESC'], [{ model: ParadaRuta, as: 'paradas' }, 'orden', 'ASC']];

const num = (v) => (v !== null && v !== undefined ? Number(v) : null);

export const serializeParada = (p) => {
  const j = typeof p.toJSON === 'function' ? p.toJSON() : p;
  // Sin coordenadas propias: se usan las de la empresa o, si no, las del centro de su localidad.
  const lat = num(j.latitud) ?? num(j.empresa?.latitud) ?? num(j.empresa?.localidad?.latitud);
  const lon = num(j.longitud) ?? num(j.empresa?.longitud) ?? num(j.empresa?.localidad?.longitud);
  return {
    id: j.id,
    hojaRutaId: j.hojaRutaId,
    orden: j.orden,
    empresaId: j.empresaId ?? null,
    empresa: j.empresa?.razonSocial ?? null,
    nombreLugar: j.nombreLugar,
    direccion: j.direccion ?? j.empresa?.direccion ?? null,
    localidad: j.empresa?.localidad?.nombre ?? null,
    latitud: lat,
    longitud: lon,
    coordenadasAproximadas: num(j.latitud) === null && lat !== null,
    estado: j.estado,
    horaEstimada: j.horaEstimada ?? null,
    notas: j.notas ?? null,
    url: j.url ?? null,
    origen: j.origen,
    actividad: j.actividad ?? null,
    // compatibilidad v1
    roadmapId: j.hojaRutaId,
    clientCompanyId: j.empresaId ?? null,
    estadoParada: j.estado,
  };
};

export const serializeHojaRuta = (h) => {
  if (!h) return null;
  const j = typeof h.toJSON === 'function' ? h.toJSON() : h;
  const paradas = (j.paradas || []).map(serializeParada);
  return {
    id: j.id,
    nombre: j.nombre ?? null,
    descripcion: j.descripcion ?? null,
    fecha: j.fecha,
    horaInicioPlan: j.horaInicioPlan ?? null,
    fechaFinPlan: j.fechaFinPlan ?? null,
    horaFinPlan: j.horaFinPlan ?? null,
    estado: j.estado,
    usuarioId: j.usuarioId ?? null,
    asignado: j.asignado ? { idUser: j.asignado.idUser, nombreApellido: j.asignado.nombreApellido, role: j.asignado.rol } : null,
    creadoPorId: j.creadoPorId ?? null,
    creadoPor: j.creadoPor ? { idUser: j.creadoPor.idUser, nombreApellido: j.creadoPor.nombreApellido } : null,
    distanciaEstimadaKm: j.distanciaEstimadaKm ?? 0,
    observaciones: j.observaciones ?? null,
    inicioReal: j.inicioReal ?? null,
    finReal: j.finReal ?? null,
    fechaCreacion: j.fechaCreacion,
    paradas,
    // compatibilidad v1
    nombreZona: j.nombre ?? null,
    fechaRuta: j.fecha,
    horaRuta: j.horaInicioPlan ?? null,
    fechaFinPropuesta: j.fechaFinPlan ?? null,
    horaFinPropuesta: j.horaFinPlan ?? null,
    idUserAsignado: j.usuarioId ?? null,
    fechaHoraInicioReal: j.inicioReal ?? null,
    fechaHoraFinReal: j.finReal ?? null,
  };
};

const hora = (v, campo) => {
  if (v === undefined) return undefined;
  if (!v) return null;
  if (!/^\d{1,2}:\d{2}$/.test(String(v))) throw badRequest(`${campo} debe tener el formato HH:MM`, { [campo]: 'formato' });
  return String(v);
};

const datosParada = (s, i) => {
  const empresaId = toInt(s.empresaId ?? s.clientCompanyId);
  return {
    orden: numero(s.orden, `paradas[${i}].orden`, { entero: true, min: 1 }) || i + 1,
    empresaId: empresaId && !Number.isNaN(empresaId) ? empresaId : null,
    nombreLugar: texto(s.nombreLugar, `paradas[${i}].nombreLugar`, 200) || `Parada #${i + 1}`,
    direccion: texto(s.direccion, `paradas[${i}].direccion`, 255) ?? null,
    latitud: numero(s.latitud, `paradas[${i}].latitud`, { min: -90, max: 90 }),
    longitud: numero(s.longitud, `paradas[${i}].longitud`, { min: -180, max: 180 }),
    estado: unoDe(s.estado ?? s.estadoParada ?? 'pendiente', ESTADOS_PARADA, `paradas[${i}].estado`),
    horaEstimada: texto(s.horaEstimada, `paradas[${i}].horaEstimada`, 50) ?? null,
    notas: texto(s.notas, `paradas[${i}].notas`, 2000) ?? null,
    url: urlHttp(s.url, `paradas[${i}].url`) ?? null,
    origen: 'planificada',
  };
};

const datosHoja = (b) => {
  const d = {};
  const set = (k, v) => { if (v !== undefined) d[k] = v; };
  set('nombre', texto(b.nombre ?? b.nombreZona, 'nombre', 150));
  set('descripcion', texto(b.descripcion, 'descripcion', 200));
  set('fecha', b.fecha !== undefined || b.fechaRuta !== undefined ? parseFecha(b.fecha ?? b.fechaRuta, 'fecha') : undefined);
  set('horaInicioPlan', hora(b.horaInicioPlan ?? b.horaRuta, 'horaInicioPlan'));
  set('fechaFinPlan', b.fechaFinPlan !== undefined || b.fechaFinPropuesta !== undefined ? parseFecha(b.fechaFinPlan ?? b.fechaFinPropuesta, 'fechaFinPlan') : undefined);
  set('horaFinPlan', hora(b.horaFinPlan ?? b.horaFinPropuesta, 'horaFinPlan'));
  set('distanciaEstimadaKm', b.distanciaEstimadaKm !== undefined ? numero(b.distanciaEstimadaKm, 'distanciaEstimadaKm', { min: 0 }) || 0 : undefined);
  set('observaciones', texto(b.observaciones, 'observaciones', 5000));
  return d;
};

const puedeOperar = (req, h) => isAdmin(req) || h.usuarioId === req.user.idUser;

export const listar = asyncHandler(async (req, res) => {
  const where = {};
  // Ruta heredada /roadmaps/user/:idUser y /roadmaps/seller/:id
  const pedido = req.params.idUser ?? req.params.sellerId ?? req.query.usuarioId;
  if (!isAdmin(req)) {
    if (pedido && String(pedido) !== req.user.idUser) throw forbidden('Solo podés ver tus hojas de ruta');
    where.usuarioId = req.user.idUser;
  } else if (pedido) where.usuarioId = String(pedido);
  if (req.query.estado) where.estado = unoDe(String(req.query.estado), ESTADOS_RUTA, 'estado');
  const hojas = await HojaRuta.findAll({ where, include, order: orden });
  res.json({ data: hojas.map(serializeHojaRuta) });
});

const cargar = async (req, id) => {
  const h = await HojaRuta.findByPk(id, { include, order: orden });
  if (!h) throw notFound('Hoja de ruta');
  if (!puedeOperar(req, h)) throw forbidden('Esta hoja de ruta está asignada a otro usuario');
  return h;
};

export const obtener = asyncHandler(async (req, res) => {
  res.json({ data: serializeHojaRuta(await cargar(req, idParam(req))) });
});

export const crear = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const d = datosHoja(b);
  if (!d.fecha) throw badRequest('La fecha de la ruta es obligatoria', { fecha: 'obligatorio' });
  let usuarioId = String(b.usuarioId ?? b.idUserAsignado ?? b.sellerId ?? req.user.idUser);
  if (!isAdmin(req) && usuarioId !== req.user.idUser) throw forbidden('Solo la administración puede asignar hojas de ruta a otros usuarios');
  const asignado = await Usuario.findByPk(usuarioId);
  if (!asignado) throw badRequest('No se encontró el usuario asignado', { usuarioId: 'inexistente' });
  usuarioId = asignado.idUser;
  const paradas = Array.isArray(b.paradas) ? b.paradas.map(datosParada) : [];
  if (paradas.length > 60) throw badRequest('Una hoja de ruta admite hasta 60 paradas');
  const h = await sequelize.transaction(async (transaction) => {
    const ids = [...new Set(paradas.map((p) => p.empresaId).filter(Boolean))];
    if (ids.length && (await Empresa.count({ where: { id: ids }, transaction })) !== ids.length) throw badRequest('Alguna empresa de las paradas no existe');
    const hoja = await HojaRuta.create({ ...d, nombre: d.nombre || 'Recorrido', usuarioId, creadoPorId: req.user.idUser, estado: 'planificada' }, { transaction });
    if (paradas.length) await ParadaRuta.bulkCreate(paradas.map((p) => ({ ...p, hojaRutaId: hoja.id })), { transaction });
    return hoja;
  });
  if (usuarioId !== req.user.idUser) await crearNotificacion(usuarioId, 'hoja_ruta', `Nueva hoja de ruta para el ${d.fecha}: ${h.nombre}`, 'hoja_ruta', h.id);
  res.status(201).json({ message: 'Hoja de ruta creada', data: serializeHojaRuta(await HojaRuta.findByPk(h.id, { include, order: orden })) });
});

export const actualizar = asyncHandler(async (req, res) => {
  const h = await cargar(req, idParam(req));
  if (h.estado === 'finalizada') throw badRequest('La hoja de ruta ya fue finalizada');
  const b = req.body || {};
  const d = datosHoja(b);
  if (b.usuarioId !== undefined || b.idUserAsignado !== undefined) {
    if (!isAdmin(req)) throw forbidden('Solo la administración puede reasignar hojas de ruta');
    const u = await Usuario.findByPk(String(b.usuarioId ?? b.idUserAsignado));
    if (!u) throw badRequest('No se encontró el usuario asignado');
    d.usuarioId = u.idUser;
  }
  await sequelize.transaction(async (transaction) => {
    await h.update(d, { transaction });
    if (Array.isArray(b.paradas) && h.estado === 'planificada') {
      await ParadaRuta.destroy({ where: { hojaRutaId: h.id }, transaction });
      await ParadaRuta.bulkCreate(b.paradas.map(datosParada).map((p) => ({ ...p, hojaRutaId: h.id })), { transaction });
    }
  });
  res.json({ message: 'Hoja de ruta actualizada', data: serializeHojaRuta(await HojaRuta.findByPk(h.id, { include, order: orden })) });
});

export const actualizarParada = asyncHandler(async (req, res) => {
  const p = await ParadaRuta.findByPk(idParam(req, req.params.stopId ? 'stopId' : 'id'), { include: [{ model: HojaRuta, as: 'hojaRuta' }] });
  if (!p) throw notFound('Parada');
  if (!puedeOperar(req, p.hojaRuta)) throw forbidden('Esta parada pertenece a la hoja de ruta de otro usuario');
  const b = req.body || {};
  const cambios = {};
  if (b.estado !== undefined || b.estadoParada !== undefined) cambios.estado = unoDe(b.estado ?? b.estadoParada, ESTADOS_PARADA, 'estado');
  if (b.notas !== undefined) cambios.notas = texto(b.notas, 'notas', 2000);
  await p.update(cambios);
  res.json({ message: 'Parada actualizada', data: serializeParada(p) });
});

export const iniciar = asyncHandler(async (req, res) => {
  const h = await cargar(req, idParam(req));
  if (h.estado === 'finalizada') throw badRequest('Esta hoja de ruta ya fue finalizada');
  await h.update({ estado: 'en_curso', inicioReal: h.inicioReal || new Date() });
  res.json({ message: 'Hoja de ruta iniciada', data: serializeHojaRuta(h) });
});

export const finalizar = asyncHandler(async (req, res) => {
  const h = await cargar(req, idParam(req));
  if (h.estado === 'finalizada') throw badRequest('Esta hoja de ruta ya fue finalizada');
  await h.update({ estado: 'finalizada', finReal: new Date() });
  res.json({ message: 'Hoja de ruta finalizada', data: serializeHojaRuta(h) });
});

// Parada no planificada, agregada en el camino (texto libre + enlace http(s) opcional).
export const agregarParada = asyncHandler(async (req, res) => {
  const h = await cargar(req, idParam(req));
  if (h.estado === 'finalizada') throw badRequest('La hoja de ruta ya fue finalizada');
  const b = req.body || {};
  const nombreLugar = texto(b.texto ?? b.nombreLugar, 'texto', 200);
  if (!nombreLugar) throw badRequest('Ingresá una descripción para la parada', { texto: 'obligatorio' });
  const empresaId = toInt(b.empresaId);
  if (empresaId && !(await Empresa.findByPk(empresaId))) throw badRequest('La empresa indicada no existe');
  const ultimo = (h.paradas || []).reduce((m, p) => Math.max(m, p.orden || 0), 0);
  const p = await ParadaRuta.create({
    hojaRutaId: h.id, orden: ultimo + 1, nombreLugar, empresaId: empresaId || null,
    url: urlHttp(b.url, 'url') ?? null, notas: texto(b.notas, 'notas', 2000) ?? null,
    latitud: numero(b.latitud, 'latitud', { min: -90, max: 90 }), longitud: numero(b.longitud, 'longitud', { min: -180, max: 180 }),
    estado: 'completada', origen: 'adhoc',
  });
  res.status(201).json({ message: 'Parada agregada', data: serializeParada(p) });
});

export const eliminar = asyncHandler(async (req, res) => {
  const h = await HojaRuta.findByPk(idParam(req));
  if (!h) throw notFound('Hoja de ruta');
  if (!isAdmin(req) && h.creadoPorId !== req.user.idUser) throw forbidden('Solo la administración o quien creó la hoja de ruta pueden eliminarla');
  await sequelize.transaction(async (transaction) => {
    const paradas = await ParadaRuta.findAll({ where: { hojaRutaId: h.id }, attributes: ['id'], transaction });
    if (paradas.length) await Actividad.update({ paradaId: null }, { where: { paradaId: paradas.map((p) => p.id) }, transaction });
    await ParadaRuta.destroy({ where: { hojaRutaId: h.id }, transaction });
    await h.destroy({ transaction });
  });
  res.json({ message: 'Hoja de ruta eliminada', id: h.id });
});
