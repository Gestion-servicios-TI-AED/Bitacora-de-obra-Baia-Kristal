import { Router } from 'express';
import {
  getEmpresasContratantes,
  createEmpresaContratante,
  updateEmpresaContratante,
  deleteEmpresaContratante,
} from '../controllers/empresasContratantesController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Protect all routes
router.use(authenticateToken);

router.get('/', getEmpresasContratantes);
router.post('/', createEmpresaContratante);
router.put('/:id', updateEmpresaContratante);
router.delete('/:id', deleteEmpresaContratante);

export default router;
