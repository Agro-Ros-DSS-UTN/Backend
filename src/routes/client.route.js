/* eslint-disable */
import { Router } from 'express';
import { 
    createClient,
    getAllClients,
    getClientById,
    updateClient,
    deleteClient
} from '../controllers/client.controller.js';

const router = Router();

// Cuando hagan un POST a /clientes, se ejecutará tu controlador
router.post('/clientes', createClient);

router.get('/clientes', getAllClients);

router.get('/clientes/:numDoc', getClientById);

router.put('/clientes/:numDoc', updateClient);

router.delete('/clientes/:numDoc', deleteClient);

export default router;