import { isAdmin } from '../../shared/middlewares/auth.middleware.js';
import { asyncHandler, idParam } from '../../shared/utils/http.js';
import * as opportunityService from './opportunity.service.js';

export { includeOpportunity, serializeOpportunity, createOpportunity } from './opportunity.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await opportunityService.listOpportunities(req.query, {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.json({ data });
});

export const get = asyncHandler(async (req, res) => {
  const data = await opportunityService.getOpportunity(idParam(req), {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.json({ data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await opportunityService.createNewOpportunity(req.body, {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.status(201).json({ message: 'Oportunidad creada', data });
});

export const update = asyncHandler(async (req, res) => {
  const data = await opportunityService.updateOpportunity(idParam(req), req.body, {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.json({ message: 'Oportunidad actualizada', data });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await opportunityService.removeOpportunity(idParam(req), {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.json(result);
});

export const restore = asyncHandler(async (req, res) => {
  const data = await opportunityService.restoreOpportunity(idParam(req));
  res.json({ message: 'Oportunidad restaurada', data });
});
