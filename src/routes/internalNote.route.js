/* eslint-disable */
import { Router } from 'express';
import { createInternalNote, getAllInternalNotes } from '../controllers/internalNote.controller.js';

const router = Router();

router.post('/internal-notes', createInternalNote);
router.get('/internal-notes', getAllInternalNotes);

export default router;
