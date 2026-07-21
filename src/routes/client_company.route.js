/* eslint-disable */
// src/routes/client.route.js
import { Router } from 'express';
import { getEmpresasClientes } from '../controllers/client.controller.js';

const router = Router();

router.get('/', getEmpresasClientes);

export default router;