import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { prisma } from '../index';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.resolve(process.env['UPLOAD_DIR'] || './uploads')),
    filename: (_req, file, cb) => cb(null, `proyecto-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/proyectos
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const proyectos = await prisma.proyecto.findMany({
            include: { 
                torres: true, 
                _count: { select: { torres: true, contratistas: true } },
                empresaContratante: true
            },
            orderBy: { nombre: 'asc' },
        });
        res.json(proyectos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener proyectos' });
    }
});

// GET /api/proyectos/:id
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const proyecto = await prisma.proyecto.findUnique({
            where: { id: req.params.id as string },
            include: { torres: true, contratistas: true, empresaContratante: true },
        });
        if (!proyecto) { res.status(404).json({ error: 'Proyecto no encontrado' }); return; }
        res.json(proyecto);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener proyecto' });
    }
});

// POST /api/proyectos
router.post('/', authenticateToken, requireRole('admin'), upload.single('logo'), async (req: AuthRequest, res: Response) => {
    try {
        const { nombre, direccion, ciudad, abreviatura, empresaContratanteId } = req.body;
        const logoUrl = req.file ? `/uploads/${req.file.filename}` : null;
        const proyecto = await prisma.proyecto.create({ data: { nombre, abreviatura: abreviatura || null, direccion, ciudad: ciudad || null, logoUrl, empresaContratanteId: empresaContratanteId || null } });
        res.status(201).json(proyecto);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear proyecto' });
    }
});

// PUT /api/proyectos/:id
router.put('/:id', authenticateToken, requireRole('admin'), upload.single('logo'), async (req: AuthRequest, res: Response) => {
    try {
        console.log('PUT /api/proyectos body:', req.body);
        const { nombre, direccion, ciudad, activo, abreviatura, empresaContratanteId } = req.body;
        const data: any = { nombre, direccion };
        if (ciudad !== undefined) data.ciudad = ciudad || null;
        if (abreviatura !== undefined) data.abreviatura = abreviatura || null;
        if (activo !== undefined) data.activo = activo === 'true' || activo === true;
        
        if (empresaContratanteId !== undefined) {
            if (empresaContratanteId && empresaContratanteId !== '' && empresaContratanteId !== 'null') {
                data.empresaContratante = { connect: { id: empresaContratanteId } };
            } else {
                data.empresaContratante = { disconnect: true };
            }
        }

        if (req.file) data.logoUrl = `/uploads/${req.file.filename}`;
        const proyecto = await prisma.proyecto.update({ where: { id: req.params.id as string }, data });
        res.json(proyecto);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar proyecto' });
    }
});

export default router;
