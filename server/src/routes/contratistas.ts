import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/contratistas
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { proyecto_id } = req.query;
        const where: any = {};
        if (proyecto_id) where.proyectoId = proyecto_id as string;

        const contratistas = await prisma.contratista.findMany({
            where,
            include: { proyecto: true },
            orderBy: { nombre: 'asc' },
        });
        res.json(contratistas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener contratistas' });
    }
});

// POST /api/contratistas
router.post('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
        const { nombre, proyectoId } = req.body;
        const contratista = await prisma.contratista.create({ data: { nombre, proyectoId } });
        res.status(201).json(contratista);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear contratista' });
    }
});

// PUT /api/contratistas/:id
router.put('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
        const { nombre, activo } = req.body;
        const data: any = {};
        if (nombre !== undefined) data.nombre = nombre;
        if (activo !== undefined) data.activo = activo;
        const contratista = await prisma.contratista.update({ where: { id: req.params.id as string }, data });
        res.json(contratista);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar contratista' });
    }
});

export default router;
