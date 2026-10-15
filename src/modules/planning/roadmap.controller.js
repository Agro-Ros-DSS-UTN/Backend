import { sequelize, Roadmap, RoadmapStop, User, Company, Activity, Locality } from '../../shared/models/index.js';
import { STOP_STATUSES, ROADMAP_STATUSES } from './planning.model.js';
import { isAdmin } from '../../shared/middlewares/auth.middleware.js';
import { asyncHandler, badRequest, forbidden, idParam, notFound, toInt } from '../../shared/utils/http.js';
import { number, parseDate, text, oneOf, urlHttp } from '../../shared/utils/validation.js';
import { createNotification } from '../notifications/notification.controller.js';

const include = [
  {
    model: RoadmapStop, as: 'stops', include: [
      {
        model: Company, as: 'company', attributes: ['id', 'legalName', 'address', 'latitude', 'longitude'], paranoid: false,
        include: [{ model: Locality, as: 'locality', attributes: ['id', 'name', 'latitude', 'longitude'] }],
      },
      { model: Activity, as: 'activity', attributes: ['id', 'contactType', 'occurredAt'] },
    ],
  },
  { model: User, as: 'assigned', attributes: ['idUser', 'fullName', 'role'] },
  { model: User, as: 'createdBy', attributes: ['idUser', 'fullName'] },
];
const order = [['date', 'DESC'], [{ model: RoadmapStop, as: 'stops' }, 'sortOrder', 'ASC']];

const num = (v) => (v !== null && v !== undefined ? Number(v) : null);

export const serializeStop = (p) => {
  const j = typeof p.toJSON === 'function' ? p.toJSON() : p;
  // Sin coordenadas propias: se usan las de la empresa o, si no, las del centro de su localidad.
  const lat = num(j.latitude) ?? num(j.company?.latitude) ?? num(j.company?.locality?.latitude);
  const lon = num(j.longitude) ?? num(j.company?.longitude) ?? num(j.company?.locality?.longitude);
  return {
    id: j.id,
    roadmapId: j.roadmapId,
    order: j.sortOrder,
    companyId: j.companyId ?? null,
    company: j.company?.legalName ?? null,
    placeName: j.placeName,
    address: j.address ?? j.company?.address ?? null,
    locality: j.company?.locality?.name ?? null,
    latitude: lat,
    longitude: lon,
    approximateCoordinates: num(j.latitude) === null && lat !== null,
    status: j.status,
    estimatedTime: j.estimatedTime ?? null,
    notes: j.notes ?? null,
    url: j.url ?? null,
    source: j.source,
    activity: j.activity ?? null,
    // compatibilidad con las pantallas que usan la forma v1
    clientCompanyId: j.companyId ?? null,
    stopStatus: j.status,
  };
};

export const serializeRoadmap = (h) => {
  if (!h) return null;
  const j = typeof h.toJSON === 'function' ? h.toJSON() : h;
  const stops = (j.stops || []).map(serializeStop);
  return {
    id: j.id,
    name: j.name ?? null,
    description: j.description ?? null,
    date: j.date,
    plannedStartTime: j.plannedStartTime ?? null,
    plannedEndDate: j.plannedEndDate ?? null,
    plannedEndTime: j.plannedEndTime ?? null,
    status: j.status,
    userId: j.userId ?? null,
    assigned: j.assigned ? { idUser: j.assigned.idUser, fullName: j.assigned.fullName, role: j.assigned.role } : null,
    createdById: j.createdById ?? null,
    createdBy: j.createdBy ? { idUser: j.createdBy.idUser, fullName: j.createdBy.fullName } : null,
    estimatedDistanceKm: j.estimatedDistanceKm ?? 0,
    notes: j.notes ?? null,
    actualStartAt: j.actualStartAt ?? null,
    actualEndAt: j.actualEndAt ?? null,
    createdAt: j.createdAt,
    stops,
    // compatibilidad v1
    zoneName: j.name ?? null,
    roadmapDate: j.date,
    roadmapTime: j.plannedStartTime ?? null,
    proposedEndDate: j.plannedEndDate ?? null,
    proposedEndTime: j.plannedEndTime ?? null,
    assignedUserId: j.userId ?? null,
    actualStartDateTime: j.actualStartAt ?? null,
    actualEndDateTime: j.actualEndAt ?? null,
  };
};

const time = (v, field) => {
  if (v === undefined) return undefined;
  if (!v) return null;
  if (!/^\d{1,2}:\d{2}$/.test(String(v))) throw badRequest(`${field} debe tener el formato HH:MM`, { [field]: 'format' });
  return String(v);
};

const stopData = (s, i) => {
  const companyId = toInt(s.companyId ?? s.clientCompanyId);
  return {
    sortOrder: number(s.order, `stops[${i}].order`, { integer: true, min: 1 }) || i + 1,
    companyId: companyId && !Number.isNaN(companyId) ? companyId : null,
    placeName: text(s.placeName, `stops[${i}].placeName`, 200) || `Parada #${i + 1}`,
    address: text(s.address, `stops[${i}].address`, 255) ?? null,
    latitude: number(s.latitude, `stops[${i}].latitude`, { min: -90, max: 90 }),
    longitude: number(s.longitude, `stops[${i}].longitude`, { min: -180, max: 180 }),
    status: oneOf(s.status ?? s.stopStatus ?? 'pendiente', STOP_STATUSES, `stops[${i}].status`),
    estimatedTime: text(s.estimatedTime, `stops[${i}].estimatedTime`, 50) ?? null,
    notes: text(s.notes, `stops[${i}].notes`, 2000) ?? null,
    url: urlHttp(s.url, `stops[${i}].url`) ?? null,
    source: 'planificada',
  };
};

const roadmapData = (b) => {
  const d = {};
  const set = (k, v) => { if (v !== undefined) d[k] = v; };
  set('name', text(b.name ?? b.zoneName, 'name', 150));
  set('description', text(b.description, 'description', 200));
  set('date', b.date !== undefined || b.roadmapDate !== undefined ? parseDate(b.date ?? b.roadmapDate, 'date') : undefined);
  set('plannedStartTime', time(b.plannedStartTime ?? b.roadmapTime, 'plannedStartTime'));
  set('plannedEndDate', b.plannedEndDate !== undefined || b.proposedEndDate !== undefined ? parseDate(b.plannedEndDate ?? b.proposedEndDate, 'plannedEndDate') : undefined);
  set('plannedEndTime', time(b.plannedEndTime ?? b.proposedEndTime, 'plannedEndTime'));
  set('estimatedDistanceKm', b.estimatedDistanceKm !== undefined ? number(b.estimatedDistanceKm, 'estimatedDistanceKm', { min: 0 }) || 0 : undefined);
  set('notes', text(b.notes, 'notes', 5000));
  return d;
};

const canOperate = (req, h) => isAdmin(req) || h.userId === req.user.idUser;

export const list = asyncHandler(async (req, res) => {
  const where = {};
  const requested = req.query.userId;
  if (!isAdmin(req)) {
    if (requested && String(requested) !== req.user.idUser) throw forbidden('Solo podés ver tus hojas de ruta');
    where.userId = req.user.idUser;
  } else if (requested) where.userId = String(requested);
  if (req.query.status) where.status = oneOf(String(req.query.status), ROADMAP_STATUSES, 'status');
  const roadmaps = await Roadmap.findAll({ where, include, order: order });
  res.json({ data: roadmaps.map(serializeRoadmap) });
});

const load = async (req, id) => {
  const h = await Roadmap.findByPk(id, { include, order: order });
  if (!h) throw notFound('Hoja de ruta');
  if (!canOperate(req, h)) throw forbidden('Esta hoja de ruta está asignada a otro usuario');
  return h;
};

export const get = asyncHandler(async (req, res) => {
  res.json({ data: serializeRoadmap(await load(req, idParam(req))) });
});

export const create = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const d = roadmapData(b);
  if (!d.date) throw badRequest('La fecha de la ruta es obligatoria', { date: 'required' });
  let userId = String(b.userId ?? b.assignedUserId ?? b.sellerId ?? req.user.idUser);
  if (!isAdmin(req) && userId !== req.user.idUser) throw forbidden('Solo la administración puede asignar hojas de ruta a otros usuarios');
  const assigned = await User.findByPk(userId);
  if (!assigned) throw badRequest('No se encontró el usuario asignado', { userId: 'missing' });
  userId = assigned.idUser;
  const stops = Array.isArray(b.stops) ? b.stops.map(stopData) : [];
  if (stops.length > 60) throw badRequest('Una hoja de ruta admite hasta 60 paradas');
  const h = await sequelize.transaction(async (transaction) => {
    const ids = [...new Set(stops.map((p) => p.companyId).filter(Boolean))];
    if (ids.length && (await Company.count({ where: { id: ids }, transaction })) !== ids.length) throw badRequest('Alguna empresa de las paradas no existe');
    const roadmap = await Roadmap.create({ ...d, name: d.name || 'Recorrido', userId, createdById: req.user.idUser, status: 'planificada' }, { transaction });
    if (stops.length) await RoadmapStop.bulkCreate(stops.map((p) => ({ ...p, roadmapId: roadmap.id })), { transaction });
    return roadmap;
  });
  if (userId !== req.user.idUser) await createNotification(userId, 'hoja_ruta', `Nueva hoja de ruta para el ${d.date}: ${h.name}`, 'hoja_ruta', h.id);
  res.status(201).json({ message: 'Hoja de ruta creada', data: serializeRoadmap(await Roadmap.findByPk(h.id, { include, order: order })) });
});

export const update = asyncHandler(async (req, res) => {
  const h = await load(req, idParam(req));
  if (h.status === 'finalizada') throw badRequest('La hoja de ruta ya fue finalizada');
  const b = req.body || {};
  const d = roadmapData(b);
  if (b.userId !== undefined || b.assignedUserId !== undefined) {
    if (!isAdmin(req)) throw forbidden('Solo la administración puede reasignar hojas de ruta');
    const u = await User.findByPk(String(b.userId ?? b.assignedUserId));
    if (!u) throw badRequest('No se encontró el usuario asignado');
    d.userId = u.idUser;
  }
  await sequelize.transaction(async (transaction) => {
    await h.update(d, { transaction });
    if (Array.isArray(b.stops) && h.status === 'planificada') {
      await RoadmapStop.destroy({ where: { roadmapId: h.id }, transaction });
      await RoadmapStop.bulkCreate(b.stops.map(stopData).map((p) => ({ ...p, roadmapId: h.id })), { transaction });
    }
  });
  res.json({ message: 'Hoja de ruta actualizada', data: serializeRoadmap(await Roadmap.findByPk(h.id, { include, order: order })) });
});

export const updateStop = asyncHandler(async (req, res) => {
  const p = await RoadmapStop.findByPk(idParam(req), { include: [{ model: Roadmap, as: 'roadmap' }] });
  if (!p) throw notFound('Parada');
  if (!canOperate(req, p.roadmap)) throw forbidden('Esta parada pertenece a la hoja de ruta de otro usuario');
  const b = req.body || {};
  const changes = {};
  if (b.status !== undefined || b.stopStatus !== undefined) changes.status = oneOf(b.status ?? b.stopStatus, STOP_STATUSES, 'status');
  if (b.notes !== undefined) changes.notes = text(b.notes, 'notes', 2000);
  await p.update(changes);
  res.json({ message: 'Parada actualizada', data: serializeStop(p) });
});

export const start = asyncHandler(async (req, res) => {
  const h = await load(req, idParam(req));
  if (h.status === 'finalizada') throw badRequest('Esta hoja de ruta ya fue finalizada');
  await h.update({ status: 'en_curso', actualStartAt: h.actualStartAt || new Date() });
  res.json({ message: 'Hoja de ruta iniciada', data: serializeRoadmap(h) });
});

export const complete = asyncHandler(async (req, res) => {
  const h = await load(req, idParam(req));
  if (h.status === 'finalizada') throw badRequest('Esta hoja de ruta ya fue finalizada');
  await h.update({ status: 'finalizada', actualEndAt: new Date() });
  res.json({ message: 'Hoja de ruta finalizada', data: serializeRoadmap(h) });
});

// Parada no planificada, agregada en el camino (texto libre + enlace http(s) opcional).
export const addStop = asyncHandler(async (req, res) => {
  const h = await load(req, idParam(req));
  if (h.status === 'finalizada') throw badRequest('La hoja de ruta ya fue finalizada');
  const b = req.body || {};
  const placeName = text(b.text ?? b.placeName, 'text', 200);
  if (!placeName) throw badRequest('Ingresá una descripción para la parada', { text: 'required' });
  const companyId = toInt(b.companyId);
  if (companyId && !(await Company.findByPk(companyId))) throw badRequest('La empresa indicada no existe');
  const last = (h.stops || []).reduce((m, p) => Math.max(m, p.sortOrder || 0), 0);
  const p = await RoadmapStop.create({
    roadmapId: h.id, sortOrder: last + 1, placeName, companyId: companyId || null,
    url: urlHttp(b.url, 'url') ?? null, notes: text(b.notes, 'notes', 2000) ?? null,
    latitude: number(b.latitude, 'latitude', { min: -90, max: 90 }), longitude: number(b.longitude, 'longitude', { min: -180, max: 180 }),
    status: 'completada', source: 'adhoc',
  });
  res.status(201).json({ message: 'Parada agregada', data: serializeStop(p) });
});

export const remove = asyncHandler(async (req, res) => {
  const h = await Roadmap.findByPk(idParam(req));
  if (!h) throw notFound('Hoja de ruta');
  if (!isAdmin(req) && h.createdById !== req.user.idUser) throw forbidden('Solo la administración o quien creó la hoja de ruta pueden eliminarla');
  await sequelize.transaction(async (transaction) => {
    const stops = await RoadmapStop.findAll({ where: { roadmapId: h.id }, attributes: ['id'], transaction });
    if (stops.length) await Activity.update({ roadmapStopId: null }, { where: { roadmapStopId: stops.map((p) => p.id) }, transaction });
    await RoadmapStop.destroy({ where: { roadmapId: h.id }, transaction });
    await h.destroy({ transaction });
  });
  res.json({ message: 'Hoja de ruta eliminada', id: h.id });
});
