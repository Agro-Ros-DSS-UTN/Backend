/* eslint-disable */
// src/routes/client_company.route.js
import { Router } from 'express';
import { getClientCompany } from '../controllers/client_company.controller.js';

const router = Router();

router.get('/', getClientCompany);

export default router;