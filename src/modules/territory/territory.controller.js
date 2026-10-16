import { asyncHandler } from '../../shared/utils/http.js';
import * as territoryService from './territory.service.js';

export { serializeLocality, resolveLocality } from './territory.service.js';

export const listProvinces = asyncHandler(async (req, res) => {
  const data = await territoryService.listProvinces();
  res.json({ data });
});

export const listLocalities = asyncHandler(async (req, res) => {
  const data = await territoryService.listLocalities(req.query);
  res.json({ data });
});

export const getLocality = asyncHandler(async (req, res) => {
  const data = await territoryService.getLocality(req.params.id);
  res.json({ data });
});

export const createLocality = asyncHandler(async (req, res) => {
  const data = await territoryService.createLocality(req.body);
  res.status(201).json({ message: 'Localidad creada', data });
});

export const updateLocality = asyncHandler(async (req, res) => {
  const data = await territoryService.updateLocality(req.params.id, req.body);
  res.json({ message: 'Localidad actualizada', data });
});

export const removeLocality = asyncHandler(async (req, res) => {
  const result = await territoryService.removeLocality(req.params.id);
  res.json(result);
});
