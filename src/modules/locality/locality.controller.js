import { asyncHandler } from '../../shared/utils/http.js';
import * as localityService from './locality.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await localityService.listLocalities(req.query);
  res.json({ data });
});

export const get = asyncHandler(async (req, res) => {
  const data = await localityService.getLocality(req.params.id);
  res.json({ data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await localityService.createLocality(req.body);
  res.status(201).json({ message: 'Localidad creada', data });
});

export const update = asyncHandler(async (req, res) => {
  const data = await localityService.updateLocality(req.params.id, req.body);
  res.json({ message: 'Localidad actualizada', data });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await localityService.removeLocality(req.params.id);
  res.json(result);
});
