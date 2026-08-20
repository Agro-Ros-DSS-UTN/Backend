/* eslint-disable */
import { Router } from 'express';
import {
    createOpportunity,
    getAllOpportunities,
    getOpportunityById,
    updateOpportunityById,
    deleteOpportunityById
} from '../controllers/opportunity.controller.js';
import {
    validateCreateOpportunity,
    validateUpdateOpportunity
} from '../middlewares/validateOpportunity.middleware.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.use('/oportunidades', verifyToken);

router.post('/oportunidades', validateCreateOpportunity, createOpportunity);
router.get('/oportunidades', getAllOpportunities);
router.get('/oportunidades/:id', getOpportunityById);
router.put('/oportunidades/:id', validateUpdateOpportunity, updateOpportunityById);
router.delete('/oportunidades/:id', deleteOpportunityById);

export default router;
