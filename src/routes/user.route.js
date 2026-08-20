/* eslint-disable */
import { Router } from 'express';
import { 
    createUser,
    getAllUsers,
    getUserById,
    updateUserById,
    deleteUserById,
    loginUser
} from '../controllers/user.controller.js';
import {
    validateCreateUser,
    validateUpdateUser,
    validateLogin
} from '../middlewares/validateUser.middleware.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Login: ruta pública, es la única forma de conseguir un token
router.post('/users/login', validateLogin, loginUser);

// A partir de acá, todas las rutas exigen un token válido
router.post('/users', verifyToken, validateCreateUser, createUser);

router.get('/users', verifyToken, getAllUsers);

router.get('/users/:idUser', verifyToken, getUserById);

router.put('/users/:idUser', verifyToken, validateUpdateUser, updateUserById);

router.delete('/users/:idUser', verifyToken, deleteUserById);

export default router;