/* eslint-disable */
import { Router } from 'express';
import { 
    createService,
    getAllServices,
    getServiceById,
    updateServiceById,
    deleteServiceById
} from '../controllers/service.controller.js';
import { validateCreateService } from '../middlewares/validateService.middleware.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.use('/servicios', verifyToken);

// Cuando hagan un POST a /servicios, se ejecutará tu controlador
router.post('/servicios', validateCreateService, createService);

router.get('/servicios', getAllServices);

router.get('/servicios/:id', getServiceById);

router.put('/servicios/:id', updateServiceById);

router.delete('/servicios/:id', deleteServiceById);

export default router;