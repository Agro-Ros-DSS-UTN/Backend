/* eslint-disable */
import { Router } from 'express';
import { 
    createClient,
    getAllClients,
    getClientById,
    updateClientById,
    deleteClientById
} from '../controllers/client.controller.js';

const router = Router();

// Cuando hagan un POST a /clientes, se ejecutará tu controlador
router.post('/clientes', createClient);

router.get('/clientes', getAllClients);

router.get('/clientes/:numDoc', getClientById);

router.put('/clientes/:numDoc', updateClientById);

router.delete('/clientes/:numDoc', deleteClientById);

export default router;