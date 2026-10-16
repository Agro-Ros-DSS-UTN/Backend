import { isAdmin } from '../../shared/middlewares/auth.middleware.js';
import { asyncHandler, idParam } from '../../shared/utils/http.js';
import * as roadmapService from './roadmap.service.js';

export { serializeStop, serializeRoadmap } from './roadmap.service.js';

const authOf = (req) => ({
  admin: isAdmin(req),
  currentUserId: req.user.idUser,
});

export const list = asyncHandler(async (req, res) => {
  const data = await roadmapService.listRoadmaps(req.query, authOf(req));
  res.json({ data });
});

export const get = asyncHandler(async (req, res) => {
  const data = await roadmapService.getRoadmap(idParam(req), authOf(req));
  res.json({ data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await roadmapService.createRoadmap(req.body, authOf(req));
  res.status(201).json({ message: 'Hoja de ruta creada', data });
});

export const update = asyncHandler(async (req, res) => {
  const data = await roadmapService.updateRoadmap(idParam(req), req.body, authOf(req));
  res.json({ message: 'Hoja de ruta actualizada', data });
});

export const updateStop = asyncHandler(async (req, res) => {
  const data = await roadmapService.updateRoadmapStop(idParam(req), req.body, authOf(req));
  res.json({ message: 'Parada actualizada', data });
});

export const start = asyncHandler(async (req, res) => {
  const data = await roadmapService.startRoadmap(idParam(req), authOf(req));
  res.json({ message: 'Hoja de ruta iniciada', data });
});

export const complete = asyncHandler(async (req, res) => {
  const data = await roadmapService.completeRoadmap(idParam(req), authOf(req));
  res.json({ message: 'Hoja de ruta finalizada', data });
});

export const addStop = asyncHandler(async (req, res) => {
  const data = await roadmapService.addRoadmapStop(idParam(req), req.body, authOf(req));
  res.status(201).json({ message: 'Parada agregada', data });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await roadmapService.removeRoadmap(idParam(req), authOf(req));
  res.json(result);
});
