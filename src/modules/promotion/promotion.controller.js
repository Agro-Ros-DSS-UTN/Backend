import { asyncHandler, idParam } from '../../shared/utils/http.js';
import * as promotionService from './promotion.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await promotionService.listPromotions(req.query);
  res.json({ data });
});

export const get = asyncHandler(async (req, res) => {
  const data = await promotionService.getPromotion(idParam(req));
  res.json({ data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await promotionService.createPromotion(req.body, {
    currentUserId: req.user.idUser,
  });
  res.status(201).json({ message: 'Promoción creada', data });
});

export const update = asyncHandler(async (req, res) => {
  const data = await promotionService.updatePromotion(idParam(req), req.body);
  res.json({ message: 'Promoción actualizada', data });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await promotionService.removePromotion(idParam(req));
  res.json(result);
});
