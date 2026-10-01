/* eslint-disable */
import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import {
  createRoadmap,
  getAllRoadmaps,
  getRoadmapsBySeller,
  getRoadmapsByUser,
  getRoadmapById,
  updateStopStatus,
  startRoadmap,
  endRoadmap,
  addAdHocStop,
  deleteRoadmap
} from '../controllers/roadmap.controller.js';

const router = Router();

router.post('/roadmaps', createRoadmap);
router.get('/roadmaps', getAllRoadmaps);
router.get('/roadmaps/seller/:sellerId', getRoadmapsBySeller);
router.get('/roadmaps/user/:idUser', getRoadmapsByUser);
router.get('/roadmaps/:id', getRoadmapById);
router.patch('/roadmaps/stops/:stopId/status', updateStopStatus);
router.put('/roadmaps/:id/start', startRoadmap);
router.put('/roadmaps/:id/end', endRoadmap);
router.post('/roadmaps/:id/stops', addAdHocStop);
// Requiere token para poder aplicar permisos por rol (vendedor: solo las
// propias; admin: las de vendedores o las propias, nunca las de otro admin).
router.delete('/roadmaps/:id', verifyToken, deleteRoadmap);

export default router;
