import { asyncHandler } from '../../shared/utils/http.js';
import * as cropService from './crop.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await cropService.listCrops();
  res.json({ data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await cropService.createCrop(req.body);
  res.status(201).json({ message: 'Cultivo creado', data });
});
