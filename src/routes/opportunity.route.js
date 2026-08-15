/* eslint-disable */
import { Router } from 'express';
import {
    createOpportunity,
    getAllOpportunities,
    getOpportunityById,
    updateOpportunityById,
    deleteOpportunityById
} from '../controllers/opportunity.controller.js';
<<<<<<< HEAD

const router = Router();

router.post('/oportunidades', createOpportunity);
router.get('/oportunidades', getAllOpportunities);
router.get('/oportunidades/:id', getOpportunityById);
router.put('/oportunidades/:id', updateOpportunityById);
=======
import {
    validateCreateOpportunity,
    validateUpdateOpportunity
} from '../middlewares/validateOpportunity.middleware.js';

const router = Router();

router.post('/oportunidades', validateCreateOpportunity, createOpportunity);
router.get('/oportunidades', getAllOpportunities);
router.get('/oportunidades/:id', getOpportunityById);
router.put('/oportunidades/:id', validateUpdateOpportunity, updateOpportunityById);
>>>>>>> 6b47ab9 (Creacion del middleware)
router.delete('/oportunidades/:id', deleteOpportunityById);

export default router;
