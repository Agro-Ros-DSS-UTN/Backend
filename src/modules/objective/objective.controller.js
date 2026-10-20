import { isAdmin } from '../../shared/middlewares/auth.middleware.js';
import { asyncHandler, idParam } from '../../shared/utils/http.js';
import * as objectiveService from './objective.service.js';

export { normalizeObjectiveType, serializeObjective } from './objective.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await objectiveService.listObjectives(req.query, {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.json({ data });
});

export const get = asyncHandler(async (req, res) => {
  const data = await objectiveService.getObjective(idParam(req), {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.json({ data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await objectiveService.createObjective(req.body, {
    currentUserId: req.user.idUser,
  });
  res.status(201).json({ message: 'Objetivo asignado', data });
});

export const update = asyncHandler(async (req, res) => {
  const data = await objectiveService.updateObjective(idParam(req), req.body);
  res.json({ message: 'Objetivo actualizado', data });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await objectiveService.removeObjective(idParam(req));
  res.json(result);
});
