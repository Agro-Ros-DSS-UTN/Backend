/* eslint-disable */
import { Router } from 'express';
import {
  createRoadmap,
  getAllRoadmaps,
  getRoadmapsBySeller,
  getRoadmapById,
  updateStopStatus,
  deleteRoadmap
} from '../controllers/roadmap.controller.js';

const router = Router();

router.post('/roadmaps', createRoadmap);
router.get('/roadmaps', getAllRoadmaps);
router.get('/roadmaps/:id', getRoadmapById);
router.get('/roadmaps/seller/:sellerId', getRoadmapsBySeller);
router.patch('/roadmaps/stops/:stopId/status', updateStopStatus);
router.delete('/roadmaps/:id', deleteRoadmap);

export default router;
