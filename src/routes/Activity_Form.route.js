/* eslint-disable */
import { Router } from 'express';
import { 
    createFormularioActividad,
    getAllFormulariosActividad,
    getFormularioActividadById,
    updateFormularioActividadById,
    deleteFormularioActividadById
} from '../controllers/activity_form.controller.js';
<<<<<<< HEAD
=======
import { validateCreateActivityForm } from '../middlewares/validateActivityForm.middleware.js';
>>>>>>> 6b47ab9 (Creacion del middleware)

const router = Router();

// Cuando hagan un POST a /formularios-actividad, se ejecutará tu controlador
<<<<<<< HEAD
router.post('/formularios-actividad', createFormularioActividad);
=======
router.post('/formularios-actividad', validateCreateActivityForm, createFormularioActividad);
>>>>>>> 6b47ab9 (Creacion del middleware)

router.get('/formularios-actividad', getAllFormulariosActividad);

router.get('/formularios-actividad/:id', getFormularioActividadById);

router.put('/formularios-actividad/:id', updateFormularioActividadById);

router.delete('/formularios-actividad/:id', deleteFormularioActividadById);

export default router;