import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/torres
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { proyecto_id } = req.query;
        const where: any = {};
        if (proyecto_id) where.proyectoId = proyecto_id as string;

        const torres = await prisma.torre.findMany({
            where,
            include: { proyecto: true },
            orderBy: { nombre: 'asc' },
        });
        res.json(torres);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener torres' });
    }
});

// GET /api/torres/:id
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const torre = await prisma.torre.findUnique({
            where: { id: req.params.id as string },
            include: { proyecto: true },
        });
        if (!torre) { res.status(404).json({ error: 'Torre no encontrada' }); return; }
        res.json(torre);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener torre' });
    }
});

// POST /api/torres
router.post('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
        const { nombre, proyectoId, abreviatura, etapaConstructiva, frente, folioActual } = req.body;
        const torre = await prisma.torre.create({
            data: {
                nombre, proyectoId,
                abreviatura: abreviatura || null,
                etapaConstructiva: etapaConstructiva || null,
                frente: frente || null,
                folioActual: folioActual !== undefined ? Number(folioActual) : 0,
            },
        });
        res.status(201).json(torre);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear torre' });
    }
});

// PUT /api/torres/:id
router.put('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
        const { nombre, activo, abreviatura, etapaConstructiva, frente, folioActual } = req.body;
        const data: any = {};
        if (nombre !== undefined) data.nombre = nombre;
        if (abreviatura !== undefined) data.abreviatura = abreviatura || null;
        if (etapaConstructiva !== undefined) data.etapaConstructiva = etapaConstructiva || null;
        if (frente !== undefined) data.frente = frente || null;
        if (activo !== undefined) data.activo = activo;
        if (folioActual !== undefined) data.folioActual = Number(folioActual);
        const torre = await prisma.torre.update({ where: { id: req.params.id as string }, data });
        res.json(torre);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar torre' });
    }
});

// DELETE /api/torres/:id — admin only
router.delete('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
        await prisma.torre.delete({ where: { id: req.params.id as string } });
        res.json({ message: 'Frente eliminado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar frente' });
    }
});

export default router;
