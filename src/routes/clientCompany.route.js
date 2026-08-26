/* eslint-disable */
// src/routes/clientCompany.route.js
import { Router } from 'express';
import { getClientCompany } from '../controllers/clientCompany.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', verifyToken, getClientCompany);

export default router;