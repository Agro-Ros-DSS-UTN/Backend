/* eslint-disable */
import { Router } from 'express';
import { 
    createUser,
    getAllUsers,
    getUserById,
    updateUserById,
    deleteUserById,
    loginUser,
    getProfileImage,
    updateProfileImage
} from '../controllers/user.controller.js';
import {
    validateCreateUser,
    validateUpdateUser,
    validateLogin
} from '../middlewares/validateUser.middleware.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Login: ruta publica, es la unica forma de conseguir un token
router.post('/users/login', validateLogin, loginUser);

// A partir de aca, todas las rutas exigen un token valido
router.post('/users', verifyToken, validateCreateUser, createUser);

router.get('/users', verifyToken, getAllUsers);

router.get('/users/:idUser', verifyToken, getUserById);

router.put('/users/:idUser', verifyToken, validateUpdateUser, updateUserById);

router.delete('/users/:idUser', verifyToken, deleteUserById);

// Rutas de imagen de perfil
router.get('/users/:idUser/profile-image', verifyToken, getProfileImage);
router.put('/users/:idUser/profile-image', verifyToken, updateProfileImage);

export default router;
