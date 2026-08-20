/* eslint-disable */
import { Router } from 'express';
import {
    createProduct,
    getAllProducts,
    getProductById,
    updateProductById,
    deleteProductById
} from '../controllers/product.controller.js';
import { validateCreateProduct } from '../middlewares/validateProduct.middleware.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(verifyToken);

// POST /productos -> crea un producto nuevo
router.post('/', validateCreateProduct, createProduct);

// GET /productos -> lista todos los productos
router.get('/', getAllProducts);

// GET /productos/:id -> obtiene un producto puntual
router.get('/:id', getProductById);

// PUT /productos/:id -> actualiza un producto (incluye toggle de estado activo)
router.put('/:id', updateProductById);

// DELETE /productos/:id -> elimina un producto
router.delete('/:id', deleteProductById);

export default router;
