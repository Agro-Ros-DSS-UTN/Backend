/* eslint-disable */
import { Router } from 'express';
import { 
  getClientCompany, 
  createClientCompany, 
  updateClientCompany, 
  deleteClientCompany 
} from '../controllers/clientCompany.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', verifyToken, getClientCompany);
router.post('/', verifyToken, createClientCompany);
router.put('/:id', verifyToken, updateClientCompany);
router.delete('/:id', verifyToken, deleteClientCompany);

export default router;
