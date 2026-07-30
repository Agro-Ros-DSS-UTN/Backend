/* eslint-disable */
import { Router } from 'express';
import { 
    createFormularioActividad,
    getAllFormulariosActividad,
    getFormularioActividadById,
    updateFormularioActividadById,
    deleteFormularioActividadById
} from '../controllers/activity_form.controller.js';

const router = Router();

// Cuando hagan un POST a /formularios-actividad, se ejecutará tu controlador
router.post('/formularios-actividad', createFormularioActividad);

router.get('/formularios-actividad', getAllFormulariosActividad);

router.get('/formularios-actividad/:id', getFormularioActividadById);

router.put('/formularios-actividad/:id', updateFormularioActividadById);

router.delete('/formularios-actividad/:id', deleteFormularioActividadById);

export default router;