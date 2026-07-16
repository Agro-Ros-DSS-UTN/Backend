/* eslint-disable */
import { Router } from 'express';
import { 
    createProvider,
    getAllProviders,
    getProviderById,
    updateProviderById,
    deleteProviderById
} from '../controllers/provider.controller.js';

const router = Router();

// Cuando hagan un POST a /providers, se ejecutará tu controlador
router.post('/providers', createProvider);

router.get('/providers', getAllProviders);

router.get('/providers/:numDoc', getProviderById);

router.put('/providers/:numDoc', updateProviderById);

router.delete('/providers/:numDoc', deleteProviderById);

export default router;