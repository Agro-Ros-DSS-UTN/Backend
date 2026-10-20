import { asyncHandler, idParam } from '../../shared/utils/http.js';
import * as productLineService from './productLine.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await productLineService.listProductLines();
  res.json({ data });
});

export const get = asyncHandler(async (req, res) => {
  const data = await productLineService.getProductLine(idParam(req));
  res.json({ data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await productLineService.createProductLine(req.body);
  res.status(201).json({ message: 'Línea creada', data });
});

export const update = asyncHandler(async (req, res) => {
  const data = await productLineService.updateProductLine(idParam(req), req.body);
  res.json({ message: 'Línea actualizada', data });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await productLineService.removeProductLine(idParam(req));
  res.json(result);
});
