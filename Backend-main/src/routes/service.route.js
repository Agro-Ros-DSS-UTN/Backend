/* eslint-disable */
import { Router } from 'express';
import { 
    createService,
    getAllServices,
    getServiceById,
    updateServiceById,
    deleteServiceById
} from '../controllers/service.controller.js';

const router = Router();

// Cuando hagan un POST a /servicios, se ejecutará tu controlador
router.post('/servicios', createService);

router.get('/servicios', getAllServices);

router.get('/servicios/:id', getServiceById);

router.put('/servicios/:id', updateServiceById);

router.delete('/servicios/:id', deleteServiceById);

export default router;