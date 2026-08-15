/* eslint-disable */
import { Router } from 'express';
import { 
    createLineaProd,
    getAllLineasProd,
    getLineaProdById,
    updateLineaProdById,
    deleteLineaProdById
} from '../controllers/product_line.controller.js';
<<<<<<< HEAD
=======
import { validateCreateProductLine } from '../middlewares/validateProductLine.middleware.js';
>>>>>>> 6b47ab9 (Creacion del middleware)

const router = Router();

// Cuando hagan un POST a /lineaProds, se ejecutará tu controlador
<<<<<<< HEAD
router.post('/lineaProds', createLineaProd);
=======
router.post('/lineaProds', validateCreateProductLine, createLineaProd);
>>>>>>> 6b47ab9 (Creacion del middleware)

router.get('/lineaProds', getAllLineasProd);

router.get('/lineaProds/:id', getLineaProdById);

router.put('/lineaProds/:id', updateLineaProdById);

router.delete('/lineaProds/:id', deleteLineaProdById);

export default router;