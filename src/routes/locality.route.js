/* eslint-disable */
import { Router } from 'express';
import {
    createLocality,
    getAllLocalities,
    getLocalityById,
    updateLocality,
    deleteLocality
} from '../controllers/locality.controller.js';
import { validateCreateLocality } from '../middlewares/validateLocality.middleware.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.use('/localidades', verifyToken);

router.post('/localidades', validateCreateLocality, createLocality);
router.get('/localidades', getAllLocalities);
router.get('/localidades/:codPostal', getLocalityById);
router.put('/localidades/:codPostal', updateLocality);
router.delete('/localidades/:codPostal', deleteLocality);

export default router;