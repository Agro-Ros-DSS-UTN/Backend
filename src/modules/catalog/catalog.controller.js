import { asyncHandler, idParam } from '../../shared/utils/http.js';
import * as catalogService from './catalog.service.js';

export { serializeProductLine, serializeItem } from './catalog.service.js';

// ── Líneas de producto ──

export const listProductLines = asyncHandler(async (req, res) => {
  const data = await catalogService.listProductLines();
  res.json({ data });
});

export const getProductLine = asyncHandler(async (req, res) => {
  const data = await catalogService.getProductLine(idParam(req));
  res.json({ data });
});

export const createProductLine = asyncHandler(async (req, res) => {
  const data = await catalogService.createProductLine(req.body);
  res.status(201).json({ message: 'Línea creada', data });
});

export const updateProductLine = asyncHandler(async (req, res) => {
  const data = await catalogService.updateProductLine(idParam(req), req.body);
  res.json({ message: 'Línea actualizada', data });
});

export const removeProductLine = asyncHandler(async (req, res) => {
  const result = await catalogService.removeProductLine(idParam(req));
  res.json(result);
});

// ── Ítems del catálogo (productos y servicios) ──

const listItemsOf = (type) => asyncHandler(async (req, res) => {
  const data = await catalogService.listCatalogItems(req.query, type);
  res.json({ data });
});

export const listItems = listItemsOf(null);
export const listProducts = listItemsOf('producto');
export const listServices = listItemsOf('servicio');

export const getItem = asyncHandler(async (req, res) => {
  const data = await catalogService.getCatalogItem(idParam(req));
  res.json({ data });
});

const createItemFrom = (forcedType) => asyncHandler(async (req, res) => {
  const result = await catalogService.createCatalogItem(req.body, forcedType);
  res.status(201).json(result);
});

export const createItem = createItemFrom(null);
export const createService = createItemFrom('servicio');

export const updateItem = asyncHandler(async (req, res) => {
  const data = await catalogService.updateCatalogItem(idParam(req), req.body);
  res.json({ message: 'Ítem actualizado', data });
});

export const removeItem = asyncHandler(async (req, res) => {
  const result = await catalogService.removeCatalogItem(idParam(req));
  res.json(result);
});
