/* eslint-disable */
import { Router } from 'express';
import { createRoadmap, getAllRoadmaps, getRoadmapsBySeller } from '../controllers/roadmap.controller.js';

const router = Router();

router.post('/roadmaps', createRoadmap);
router.get('/roadmaps', getAllRoadmaps);
router.get('/roadmaps/seller/:sellerId', getRoadmapsBySeller);

export default router;
