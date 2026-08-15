/* eslint-disable */
// src/routes/client_company.route.js
import { Router } from 'express';
import { getClientCompany } from '../controllers/client_company.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', verifyToken, getClientCompany);

export default router;