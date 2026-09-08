/* eslint-disable */
import { Router } from 'express';
import {
  getAllServiceOrders,
  getServiceOrderById,
  createServiceOrder,
  updateServiceOrder,
  saveServiceEvaluation,
  deleteServiceOrder
} from '../controllers/serviceOrder.controller.js';

const router = Router();

router.get('/ordenes-servicio', getAllServiceOrders);
router.get('/ordenes-servicio/:id', getServiceOrderById);
router.post('/ordenes-servicio', createServiceOrder);
router.put('/ordenes-servicio/:id', updateServiceOrder);
router.delete('/ordenes-servicio/:id', deleteServiceOrder);
router.post('/ordenes-servicio/:id/evaluacion', saveServiceEvaluation);

export default router;
