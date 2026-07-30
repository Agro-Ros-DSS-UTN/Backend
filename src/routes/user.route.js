/* eslint-disable */
import { Router } from 'express';
import { 
    createUser,
    getAllUsers,
    getUserById,
    updateUserById,
    deleteUserById
} from '../controllers/user.controller.js';

const router = Router();

// Cuando hagan un POST a /users, se ejecutará tu controlador
router.post('/users', createUser);

router.get('/users', getAllUsers);

router.get('/users/:numDoc', getUserById);

router.put('/users/:numDoc', updateUserById);

router.delete('/users/:numDoc', deleteUserById);

export default router;