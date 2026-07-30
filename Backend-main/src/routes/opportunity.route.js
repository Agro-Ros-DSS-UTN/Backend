/* eslint-disable */
import { Router } from 'express';
import {
    createOpportunity,
    getAllOpportunities,
    getOpportunityById,
    updateOpportunityById,
    deleteOpportunityById
} from '../controllers/opportunity.controller.js';

const router = Router();

router.post('/oportunidades', createOpportunity);
router.get('/oportunidades', getAllOpportunities);
router.get('/oportunidades/:id', getOpportunityById);
router.put('/oportunidades/:id', updateOpportunityById);
router.delete('/oportunidades/:id', deleteOpportunityById);

export default router;
