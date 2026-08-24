import { Router } from 'express';
import {
  getAllPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion
} from '../controllers/promotion.controller.js';

const router = Router();

router.get('/promotions', getAllPromotions);
router.post('/promotions', createPromotion);
router.put('/promotions/:id', updatePromotion);
router.delete('/promotions/:id', deletePromotion);

export default router;
