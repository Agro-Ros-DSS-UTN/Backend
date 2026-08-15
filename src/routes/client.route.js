/* eslint-disable */
import { Router } from 'express';
import { 
    createClient,
    getAllClients,
    getClientById,
    updateClientById,
    deleteClientById
} from '../controllers/client.controller.js';
import {
    validateCreateClient,
    validateUpdateClient
} from '../middlewares/validateClient.middleware.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Todas las rutas de clientes exigen un token válido
router.use('/clientes', verifyToken);

// Cuando hagan un POST a /clientes, se ejecutará tu controlador
router.post('/clientes', validateCreateClient, createClient);

router.get('/clientes', getAllClients);

router.get('/clientes/:numDoc', getClientById);

router.put('/clientes/:numDoc', validateUpdateClient, updateClientById);

router.delete('/clientes/:numDoc', deleteClientById);

export default router;