import { Router } from 'express';
import {
  getEmpresasInterventoria,
  createEmpresaInterventoria,
  updateEmpresaInterventoria,
  deleteEmpresaInterventoria,
} from '../controllers/empresasInterventoriaController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Protect all routes
router.use(authenticateToken);

router.get('/', getEmpresasInterventoria);
router.post('/', createEmpresaInterventoria);
router.put('/:id', updateEmpresaInterventoria);
router.delete('/:id', deleteEmpresaInterventoria);

export default router;
