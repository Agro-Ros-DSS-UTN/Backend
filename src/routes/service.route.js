/* eslint-disable */
import { Router } from 'express';
import { 
    createService,
    getAllServices,
    getServiceById,
    updateService,
    deleteService
} from '../controllers/service.controller.js';

const router = Router();

// Cuando hagan un POST a /servicios, se ejecutará tu controlador
router.post('/servicios', createService);

router.get('/servicios', getAllServices);

router.get('/servicios/:id', getServiceById);

router.put('/servicios/:id', updateService);

router.delete('/servicios/:id', deleteService);

export default router;