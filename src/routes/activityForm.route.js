/* eslint-disable */
import { Router } from 'express';
import { 
  createFormularioActividad,
  getAllFormulariosActividad,
  getFormularioActividadById,
  updateFormularioActividadById,
  deleteFormularioActividadById
} from '../controllers/activityForm.controller.js';
import { validateCreateActivityForm } from '../middlewares/validateActivityForm.middleware.js';

const router = Router();

// Soporte para endpoints plurales y singulares
const paths = [
  '/formularios-actividad',
  '/formulario-actividad',
  '/formularioActividad',
  '/activities'
];

paths.forEach(p => {
  router.get(p, getAllFormulariosActividad);
  router.post(p, validateCreateActivityForm, createFormularioActividad);
  router.get(`${p}/:id`, getFormularioActividadById);
  router.put(`${p}/:id`, updateFormularioActividadById);
  router.delete(`${p}/:id`, deleteFormularioActividadById);
});

export default router;