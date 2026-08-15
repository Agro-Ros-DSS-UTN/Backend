/* eslint-disable */
import { Router } from 'express';
import { 
    createClient,
    getAllClients,
    getClientById,
    updateClientById,
    deleteClientById
} from '../controllers/client.controller.js';
<<<<<<< HEAD
=======
import {
    validateCreateClient,
    validateUpdateClient
} from '../middlewares/validateClient.middleware.js';
>>>>>>> 6b47ab9 (Creacion del middleware)

const router = Router();

// Cuando hagan un POST a /clientes, se ejecutará tu controlador
<<<<<<< HEAD
router.post('/clientes', createClient);
=======
router.post('/clientes', validateCreateClient, createClient);
>>>>>>> 6b47ab9 (Creacion del middleware)

router.get('/clientes', getAllClients);

router.get('/clientes/:numDoc', getClientById);

<<<<<<< HEAD
router.put('/clientes/:numDoc', updateClientById);
=======
router.put('/clientes/:numDoc', validateUpdateClient, updateClientById);
>>>>>>> 6b47ab9 (Creacion del middleware)

router.delete('/clientes/:numDoc', deleteClientById);

export default router;