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
<<<<<<< HEAD
=======
import {
    validateCreateUser,
    validateUpdateUser,
    validateLogin
} from '../middlewares/validateUser.middleware.js';
>>>>>>> 6b47ab9 (Creacion del middleware)

const router = Router();

// Cuando hagan un POST a /users, se ejecutará tu controlador
<<<<<<< HEAD
router.post('/users', createUser);
=======
router.post('/users', validateCreateUser, createUser);
>>>>>>> 6b47ab9 (Creacion del middleware)

router.get('/users', getAllUsers);

router.get('/users/:idUser', getUserById);

<<<<<<< HEAD
router.put('/users/:idUser', updateUserById);

router.delete('/users/:idUser', deleteUserById);

router.post('/users/login', loginUser);
=======
router.put('/users/:idUser', validateUpdateUser, updateUserById);

router.delete('/users/:idUser', deleteUserById);

router.post('/users/login', validateLogin, loginUser);
>>>>>>> 6b47ab9 (Creacion del middleware)

export default router;