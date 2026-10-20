import { isAdmin } from '../../shared/middlewares/auth.middleware.js';
import { asyncHandler, idParam } from '../../shared/utils/http.js';
import * as companyService from './company.service.js';

export { serializeCompany } from './company.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await companyService.listCompanies(req.query, {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.json({ data });
});

export const get = asyncHandler(async (req, res) => {
  const data = await companyService.getCompany(idParam(req), { admin: isAdmin(req) });
  res.json({ data });
});

export const tree = asyncHandler(async (req, res) => {
  const data = await companyService.getCompanyTree(idParam(req));
  res.json({ data });
});

export const create = asyncHandler(async (req, res) => {
  const result = await companyService.createCompany(req.body, {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.status(201).json({ message: 'Empresa registrada', ...result });
});

export const update = asyncHandler(async (req, res) => {
  const data = await companyService.updateCompany(idParam(req), req.body, {
    admin: isAdmin(req),
    currentUserId: req.user.idUser,
  });
  res.json({ message: 'Empresa actualizada', data });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await companyService.removeCompany(idParam(req));
  res.json(result);
});

export const restore = asyncHandler(async (req, res) => {
  const data = await companyService.restoreCompany(idParam(req));
  res.json({ message: 'Empresa restaurada', data });
});

export const dashboard = asyncHandler(async (req, res) => {
  const data = await companyService.getCompanyDashboard(idParam(req), req.query);
  res.json({ data });
});
