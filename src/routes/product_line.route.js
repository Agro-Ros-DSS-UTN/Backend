/* eslint-disable */
import { Router } from 'express';
import { 
    createLineaProd,
    getAllLineasProd,
    getLineaProdById,
    updateLineaProdById,
    deleteLineaProdById
} from '../controllers/product_line.controller.js';

const router = Router();

// Cuando hagan un POST a /lineaProds, se ejecutará tu controlador
router.post('/lineaProds', createLineaProd);

router.get('/lineaProds', getAllLineasProd);

router.get('/lineaProds/:id', getLineaProdById);

router.put('/lineaProds/:id', updateLineaProdById);

router.delete('/lineaProds/:id', deleteLineaProdById);

export default router;