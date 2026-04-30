import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/folios/siguiente?torre_id=&fecha=
router.get('/siguiente', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { torre_id, fecha } = req.query;
        if (!torre_id || !fecha) {
            res.status(400).json({ error: 'torre_id y fecha son requeridos' });
            return;
        }

        const torreId = torre_id as string;
        const fechaStr = fecha as string;

        // Find last folio for this tower
        const lastFolio = await prisma.folioControl.findMany({
            where: { torreId },
            orderBy: { fecha: 'desc' },
            take: 1,
        });

        let nextFolio = 1;
        if (lastFolio.length > 0) {
            const lastDate = new Date(lastFolio[0]!.fecha);
            const currentDate = new Date(fechaStr);
            const daysDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            nextFolio = lastFolio[0]!.numeroFolio + Math.max(daysDiff, 1);
        }

        res.json({ folio: nextFolio });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al calcular folio' });
    }
});

export default router;
