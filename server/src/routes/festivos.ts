import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/festivos?anio=
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const anio = parseInt(req.query.anio as string) || new Date().getFullYear();
        const festivos = await prisma.festivoColombia.findMany({
            where: { anio },
            orderBy: { fecha: 'asc' },
        });
        res.json(festivos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener festivos' });
    }
});

// POST /api/festivos/sync
router.post('/sync', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const anio = parseInt(req.body.anio as string) || new Date().getFullYear();

        // Call Nager.Date API
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${anio}/CO`);
        if (!response.ok) {
            res.status(502).json({ error: 'No se pudo obtener los festivos de la API externa' });
            return;
        }

        const holidays = await response.json() as Array<{ date: string; localName: string }>;

        // Upsert each holiday
        let count = 0;
        for (const h of holidays) {
            await prisma.festivoColombia.upsert({
                where: { fecha: h.date },
                create: { fecha: h.date, nombre: h.localName, anio },
                update: { nombre: h.localName, anio },
            });
            count++;
        }

        res.json({ message: `Se sincronizaron ${count} festivos para el año ${anio}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al sincronizar festivos' });
    }
});

export default router;
