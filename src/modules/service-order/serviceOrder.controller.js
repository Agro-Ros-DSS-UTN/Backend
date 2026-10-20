import { asyncHandler, idParam } from '../../shared/utils/http.js';
import * as serviceOrderService from './serviceOrder.service.js';

export { serializeServiceOrder } from './serviceOrder.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await serviceOrderService.listServiceOrders(req.query);
  res.json({ data });
});

export const get = asyncHandler(async (req, res) => {
  const data = await serviceOrderService.getServiceOrder(idParam(req));
  res.json({ data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await serviceOrderService.createServiceOrder(req.body, {
    currentUserId: req.user.idUser,
  });
  res.status(201).json({ message: 'Orden de servicio creada', data });
});

export const update = asyncHandler(async (req, res) => {
  const data = await serviceOrderService.updateServiceOrder(idParam(req), req.body);
  res.json({ message: 'Orden de servicio actualizada', data });
});

export const saveEvaluation = asyncHandler(async (req, res) => {
  const data = await serviceOrderService.saveServiceOrderEvaluation(idParam(req), req.body);
  res.json({ message: 'Evaluación guardada', data });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await serviceOrderService.removeServiceOrder(idParam(req));
  res.json(result);
});

export const restore = asyncHandler(async (req, res) => {
  const data = await serviceOrderService.restoreServiceOrder(idParam(req));
  res.json({ message: 'Orden restaurada', data });
});
