/* eslint-disable */
import { Router } from 'express';
import { 
    createLineaProd,
    getAllLineasProd,
    getLineaProdById,
    updateLineaProdById,
    deleteLineaProdById
} from '../controllers/product_line.controller.js';
import { validateCreateProductLine } from '../middlewares/validateProductLine.middleware.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.use('/lineaProds', verifyToken);

// Cuando hagan un POST a /lineaProds, se ejecutará tu controlador
router.post('/lineaProds', validateCreateProductLine, createLineaProd);

router.get('/lineaProds', getAllLineasProd);

router.get('/lineaProds/:id', getLineaProdById);

router.put('/lineaProds/:id', updateLineaProdById);

router.delete('/lineaProds/:id', deleteLineaProdById);

export default router;