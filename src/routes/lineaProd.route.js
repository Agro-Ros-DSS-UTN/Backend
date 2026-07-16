/* eslint-disable */
import { Router } from 'express';
import { 
    createlineaProd,
    getAlllineaProds,
    getlineaProdById,
    updatelineaProd,
    deletelineaProd
} from '../controllers/lineaProd.controller.js';

const router = Router();

// Cuando hagan un POST a /lineaProds, se ejecutará tu controlador
router.post('/lineaProds', createlineaProd);

router.get('/lineaProds', getAlllineaProds);

router.get('/lineaProds/:codLinea', getlineaProdById);

router.put('/lineaProds/:codLinea', updatelineaProd);

router.delete('/lineaProds/:codLinea', deletelineaProd);

export default router;