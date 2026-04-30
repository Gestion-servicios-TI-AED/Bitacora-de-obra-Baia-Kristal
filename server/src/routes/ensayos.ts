import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { prisma } from '../index';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.resolve(process.env['UPLOAD_DIR'] || './uploads')),
    filename: (_req, file, cb) => cb(null, `ensayo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`),
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Solo se permiten imágenes (jpg, jpeg, png, webp)'));
    },
});

// GET /api/ensayos?bitacora_id=
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { bitacora_id } = req.query;
        if (!bitacora_id) { res.status(400).json({ error: 'bitacora_id requerido' }); return; }

        const ensayos = await (prisma as any).bitacoraEnsayo.findMany({
            where: { bitacoraId: bitacora_id as string },
            orderBy: { createdAt: 'asc' },
        });
        res.json(ensayos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener ensayos' });
    }
});

// POST /api/ensayos
router.post('/', authenticateToken, upload.single('anexoFoto'), async (req: AuthRequest, res: Response) => {
    try {
        const { bitacoraId, ensayoRealizado } = req.body;

        if (!req.file) {
            res.status(400).json({ error: 'La foto del ensayo es obligatoria' });
            return;
        }

        const anexoFotoUrl = `/uploads/${req.file.filename}`;

        const ensayo = await (prisma as any).bitacoraEnsayo.create({
            data: {
                bitacoraId,
                ensayoRealizado,
                anexoFotoUrl,
            },
        });

        res.status(201).json(ensayo);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear ensayo' });
    }
});

// DELETE /api/ensayos/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        await (prisma as any).bitacoraEnsayo.delete({ where: { id: req.params.id as string } });
        res.json({ message: 'Ensayo eliminado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar ensayo' });
    }
});

export default router;
