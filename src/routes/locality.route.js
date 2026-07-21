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

router.post('/localidades', createLocality);
router.get('/localidades', getAllLocalities);
router.get('/localidades/:codPostal', getLocalityById);
router.put('/localidades/:codPostal', updateLocality);
router.delete('/localidades/:codPostal', deleteLocality);

export default router;