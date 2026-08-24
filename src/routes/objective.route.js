import { Router } from 'express';
import {
  getAllObjectives,
  getObjectivesBySeller,
  createObjective,
  updateObjective,
  deleteObjective
} from '../controllers/objective.controller.js';

const router = Router();

router.get('/objectives', getAllObjectives);
router.get('/objectives/seller/:sellerId', getObjectivesBySeller);
router.post('/objectives', createObjective);
router.put('/objectives/:id', updateObjective);
router.patch('/objectives/:id', updateObjective);
router.delete('/objectives/:id', deleteObjective);

export default router;
