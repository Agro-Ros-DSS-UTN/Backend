import { isAdmin } from '../../shared/middlewares/auth.middleware.js';
import { asyncHandler, idParam } from '../../shared/utils/http.js';
import * as activityService from './activity.service.js';

export { serializeActivity } from './activity.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await activityService.listActivities(req.query, {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.json({ data });
});

export const get = asyncHandler(async (req, res) => {
  const data = await activityService.getActivity(idParam(req), {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.json({ data });
});

export const create = asyncHandler(async (req, res) => {
  const { status, payload } = await activityService.createActivity(req.body, {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.status(status).json(payload);
});

export const update = asyncHandler(async (req, res) => {
  const data = await activityService.updateActivity(idParam(req), req.body, {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.json({ message: 'Actividad actualizada', data });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await activityService.removeActivity(idParam(req), {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.json(result);
});

export const getAttachment = asyncHandler(async (req, res) => {
  const data = await activityService.getActivityAttachment(idParam(req), {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.json({ data });
});
