import { ROADMAP_STATUSES } from './roadmap.entity.js';
import { STOP_STATUSES } from './roadmapStop.entity.js';
import * as roadmapRepository from './roadmap.repository.js';
import { badRequest, forbidden, notFound, toInt } from '../../shared/utils/http.js';
import { number, parseDate, text, oneOf, urlHttp } from '../../shared/utils/validation.js';
import { createNotification } from '../notification/notification.service.js';

const num = (v) => (v !== null && v !== undefined ? Number(v) : null);

export const serializeStop = (p) => {
  const j = typeof p.toJSON === 'function' ? p.toJSON() : p;
  // Sin coordenadas propias: se usan las de la empresa o, si no, las del centro de su localidad
  // (estas últimas se marcan como aproximadas para que el mapa no las muestre como el lugar real).
  const pair = (o) => (num(o?.latitude) !== null && num(o?.longitude) !== null ? [num(o.latitude), num(o.longitude)] : null);
  const own = pair(j);
  const fromCompany = own ? null : pair(j.company);
  const fromLocality = own || fromCompany ? null : pair(j.company?.locality);
  const [lat, lon] = own ?? fromCompany ?? fromLocality ?? [null, null];
  const locationSource = own ? 'parada' : fromCompany ? 'empresa' : fromLocality ? 'localidad' : null;
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
    approximateCoordinates: locationSource === 'localidad',
    locationSource,
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

const canOperate = ({ admin, currentUserId }, h) => admin || h.userId === currentUserId;

const load = async (auth, id) => {
  const h = await roadmapRepository.findByIdFull(id);
  if (!h) throw notFound('Hoja de ruta');
  if (!canOperate(auth, h)) throw forbidden('Esta hoja de ruta está asignada a otro usuario');
  return h;
};

export const listRoadmaps = async (query = {}, { admin, currentUserId }) => {
  const requested = query.userId;
  let userId;
  if (!admin) {
    if (requested && String(requested) !== currentUserId) throw forbidden('Solo podés ver tus hojas de ruta');
    userId = currentUserId;
  } else if (requested) {
    userId = String(requested);
  }
  const status = query.status ? oneOf(String(query.status), ROADMAP_STATUSES, 'status') : undefined;
  const roadmaps = await roadmapRepository.findAll({ userId, status });
  return roadmaps.map(serializeRoadmap);
};

export const getRoadmap = async (id, auth) => serializeRoadmap(await load(auth, id));

export const createRoadmap = async (body = {}, { admin, currentUserId }) => {
  const d = roadmapData(body);
  if (!d.date) throw badRequest('La fecha de la ruta es obligatoria', { date: 'required' });
  let userId = String(body.userId ?? body.assignedUserId ?? body.sellerId ?? currentUserId);
  if (!admin && userId !== currentUserId) throw forbidden('Solo la administración puede asignar hojas de ruta a otros usuarios');
  const assigned = await roadmapRepository.findUserById(userId);
  if (!assigned) throw badRequest('No se encontró el usuario asignado', { userId: 'missing' });
  userId = assigned.idUser;
  const stops = Array.isArray(body.stops) ? body.stops.map(stopData) : [];
  if (stops.length > 60) throw badRequest('Una hoja de ruta admite hasta 60 paradas');
  const h = await roadmapRepository.runTransaction(async (transaction) => {
    const ids = [...new Set(stops.map((p) => p.companyId).filter(Boolean))];
    if (ids.length && (await roadmapRepository.countCompaniesByIds(ids, transaction)) !== ids.length) {
      throw badRequest('Alguna empresa de las paradas no existe');
    }
    const roadmap = await roadmapRepository.create(
      { ...d, name: d.name || 'Recorrido', userId, createdById: currentUserId, status: 'planificada' },
      { transaction }
    );
    if (stops.length) {
      await roadmapRepository.bulkCreateStops(stops.map((p) => ({ ...p, roadmapId: roadmap.id })), transaction);
    }
    return roadmap;
  });
  if (userId !== currentUserId) {
    await createNotification(userId, 'hoja_ruta', `Nueva hoja de ruta para el ${d.date}: ${h.name}`, 'hoja_ruta', h.id);
  }
  return serializeRoadmap(await roadmapRepository.findByIdFull(h.id));
};

export const updateRoadmap = async (id, body = {}, auth) => {
  const h = await load(auth, id);
  if (h.status === 'finalizada') throw badRequest('La hoja de ruta ya fue finalizada');
  const d = roadmapData(body);
  if (body.userId !== undefined || body.assignedUserId !== undefined) {
    if (!auth.admin) throw forbidden('Solo la administración puede reasignar hojas de ruta');
    const u = await roadmapRepository.findUserById(String(body.userId ?? body.assignedUserId));
    if (!u) throw badRequest('No se encontró el usuario asignado');
    d.userId = u.idUser;
  }
  await roadmapRepository.runTransaction(async (transaction) => {
    await roadmapRepository.update(h, d, { transaction });
    if (Array.isArray(body.stops) && h.status === 'planificada') {
      await roadmapRepository.replaceStops(h.id, body.stops.map(stopData), transaction);
    }
  });
  return serializeRoadmap(await roadmapRepository.findByIdFull(h.id));
};

export const updateRoadmapStop = async (id, body = {}, auth) => {
  const p = await roadmapRepository.findStopWithRoadmap(id);
  if (!p) throw notFound('Parada');
  if (!canOperate(auth, p.roadmap)) throw forbidden('Esta parada pertenece a la hoja de ruta de otro usuario');
  const changes = {};
  if (body.status !== undefined || body.stopStatus !== undefined) {
    changes.status = oneOf(body.status ?? body.stopStatus, STOP_STATUSES, 'status');
  }
  if (body.notes !== undefined) changes.notes = text(body.notes, 'notes', 2000);
  await roadmapRepository.updateStop(p, changes);
  return serializeStop(p);
};

export const startRoadmap = async (id, auth) => {
  const h = await load(auth, id);
  if (h.status === 'finalizada') throw badRequest('Esta hoja de ruta ya fue finalizada');
  await roadmapRepository.update(h, { status: 'en_curso', actualStartAt: h.actualStartAt || new Date() });
  return serializeRoadmap(h);
};

export const completeRoadmap = async (id, auth) => {
  const h = await load(auth, id);
  if (h.status === 'finalizada') throw badRequest('Esta hoja de ruta ya fue finalizada');
  await roadmapRepository.update(h, { status: 'finalizada', actualEndAt: new Date() });
  return serializeRoadmap(h);
};

// Parada no planificada, agregada en el camino (texto libre + enlace http(s) opcional).
export const addRoadmapStop = async (id, body = {}, auth) => {
  const h = await load(auth, id);
  if (h.status === 'finalizada') throw badRequest('La hoja de ruta ya fue finalizada');
  const placeName = text(body.text ?? body.placeName, 'text', 200);
  if (!placeName) throw badRequest('Ingresá una descripción para la parada', { text: 'required' });
  const companyId = toInt(body.companyId);
  if (companyId && !(await roadmapRepository.findCompanyById(companyId))) {
    throw badRequest('La empresa indicada no existe');
  }
  const last = (h.stops || []).reduce((m, p) => Math.max(m, p.sortOrder || 0), 0);
  const p = await roadmapRepository.createStop({
    roadmapId: h.id,
    sortOrder: last + 1,
    placeName,
    companyId: companyId || null,
    url: urlHttp(body.url, 'url') ?? null,
    notes: text(body.notes, 'notes', 2000) ?? null,
    latitude: number(body.latitude, 'latitude', { min: -90, max: 90 }),
    longitude: number(body.longitude, 'longitude', { min: -180, max: 180 }),
    status: 'completada',
    source: 'adhoc',
  });
  return serializeStop(p);
};

export const removeRoadmap = async (id, { admin, currentUserId }) => {
  const h = await roadmapRepository.findById(id);
  if (!h) throw notFound('Hoja de ruta');
  if (!admin && h.createdById !== currentUserId) {
    throw forbidden('Solo la administración o quien creó la hoja de ruta pueden eliminarla');
  }
  await roadmapRepository.destroyWithStops(h);
  return { message: 'Hoja de ruta eliminada', id: h.id };
};
