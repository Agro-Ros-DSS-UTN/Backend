/* eslint-disable */
import { Router } from 'express';
import { 
    createService,
    getAllServices,
    getServiceById,
    updateServiceById,
    deleteServiceById
} from '../controllers/service.controller.js';
<<<<<<< HEAD
=======
import { validateCreateService } from '../middlewares/validateService.middleware.js';
>>>>>>> 6b47ab9 (Creacion del middleware)

const router = Router();

// Cuando hagan un POST a /servicios, se ejecutará tu controlador
<<<<<<< HEAD
router.post('/servicios', createService);
=======
router.post('/servicios', validateCreateService, createService);
>>>>>>> 6b47ab9 (Creacion del middleware)

router.get('/servicios', getAllServices);

router.get('/servicios/:id', getServiceById);

router.put('/servicios/:id', updateServiceById);

router.delete('/servicios/:id', deleteServiceById);

export default router;