import { asyncHandler, idParam } from '../../shared/utils/http.js';
import * as catalogItemService from './catalogItem.service.js';

// Ítems del catálogo (productos y servicios). /catalog y /products listan ambos
// tipos; /services solo servicios.
const listOf = (type) => asyncHandler(async (req, res) => {
  const data = await catalogItemService.listCatalogItems(req.query, type);
  res.json({ data });
});

export const list = listOf(null);
export const listServices = listOf('servicio');

export const get = asyncHandler(async (req, res) => {
  const data = await catalogItemService.getCatalogItem(idParam(req));
  res.json({ data });
});

const createOf = (forcedType) => asyncHandler(async (req, res) => {
  const result = await catalogItemService.createCatalogItem(req.body, forcedType);
  res.status(201).json(result);
});

export const create = createOf(null);
export const createService = createOf('servicio');

export const update = asyncHandler(async (req, res) => {
  const data = await catalogItemService.updateCatalogItem(idParam(req), req.body);
  res.json({ message: 'Ítem actualizado', data });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await catalogItemService.removeCatalogItem(idParam(req));
  res.json(result);
});
