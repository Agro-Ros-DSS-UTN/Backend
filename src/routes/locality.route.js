/* eslint-disable */
import { Router } from 'express';
import { 
    createLocality,
    getAllLocalities,
    getLocalityById,
    updateLocality,
    deleteLocality
} from '../controllers/locality.controller.js';

const router = Router();

// Cuando hagan un POST a /localidades, se ejecutará tu controlador
router.post('/localidades', createLocality);

router.get('/localidades', getAllLocalities);

router.get('/localidades/:codLocality', getLocalityById);

router.put('/localidades/:codLocality', updateLocality);

router.delete('/localidades/:codLocality', deleteLocality);

export default router;