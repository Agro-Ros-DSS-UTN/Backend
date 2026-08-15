/* eslint-disable */
import { Router } from 'express';
import {
    createLocality,
    getAllLocalities,
    getLocalityById,
    updateLocality,
    deleteLocality
} from '../controllers/locality.controller.js';
<<<<<<< HEAD

const router = Router();

router.post('/localidades', createLocality);
=======
import { validateCreateLocality } from '../middlewares/validateLocality.middleware.js';

const router = Router();

router.post('/localidades', validateCreateLocality, createLocality);
>>>>>>> 6b47ab9 (Creacion del middleware)
router.get('/localidades', getAllLocalities);
router.get('/localidades/:codPostal', getLocalityById);
router.put('/localidades/:codPostal', updateLocality);
router.delete('/localidades/:codPostal', deleteLocality);

export default router;