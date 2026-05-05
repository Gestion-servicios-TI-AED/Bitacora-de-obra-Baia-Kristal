import { Router, Response } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { syncContratistas } from '../services/sharepointSync';

const router = Router();

// POST /api/sync-contratistas
// Solo administradores. Body: { proyectoId: string }
router.post('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    const { proyectoId } = req.body as { proyectoId?: string };

    if (!proyectoId) {
        res.status(400).json({ error: 'proyectoId es requerido' });
        return;
    }

    try {
        const result = await syncContratistas(proyectoId);
        res.json({
            message: 'Sincronización completada exitosamente',
            agregados: result.added,
            actualizados: result.updated,
            omitidos: result.skipped,
        });
    } catch (error: any) {
        const axiosData = error?.response?.data;
        // Azure AD devuelve error_description; Graph API devuelve error.message o message
        const detail: string =
            axiosData?.error_description ??
            axiosData?.error?.message ??
            axiosData?.message ??
            axiosData?.error ??
            error?.message ??
            'Error al sincronizar contratistas desde SharePoint';
        console.error('Error en sincronización de contratistas:', JSON.stringify(axiosData ?? error?.message));
        res.status(500).json({ error: detail });
    }
});

export default router;
