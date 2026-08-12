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

const router = Router();

// Cuando hagan un POST a /users, se ejecutará tu controlador
router.post('/users', createUser);

router.get('/users', getAllUsers);

router.get('/users/:idUser', getUserById);

router.put('/users/:idUser', updateUserById);

router.delete('/users/:idUser', deleteUserById);

router.post('/users/login', loginUser);

export default router;