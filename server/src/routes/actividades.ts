import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import { prisma } from '../index';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.resolve(process.env['UPLOAD_DIR'] || './uploads')),
    filename: (_req, file, cb) => cb(null, `actividad-${Date.now()}-${Math.random().toString(36).slice(2, 11)}${path.extname(file.originalname)}`),
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

// GET /api/actividades?bitacora_id=
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { bitacora_id } = req.query;
        if (!bitacora_id) { res.status(400).json({ error: 'bitacora_id requerido' }); return; }

        const actividades = await prisma.bitacoraActividad.findMany({
            where: { bitacoraId: bitacora_id as string },
            include: { contratista: true },
            orderBy: { createdAt: 'asc' },
        });
        res.json(actividades);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener actividades' });
    }
});

// POST /api/actividades
router.post('/', authenticateToken, upload.fields([
    { name: 'foto1', maxCount: 1 },
    { name: 'foto2', maxCount: 1 },
]), async (req: AuthRequest, res: Response) => {
    try {
        const {
            bitacoraId, actividadEjecutada, porcentajeCompletado,
            contratistaId, trabajadoresEnObra, horasTrabajadas,
            climaManana, climaTarde, notasGenerales,
            esVisita, descripcionVisita, numeroPersonasVisita, duracionVisita,
        } = req.body;

        const isVisita = esVisita === 'true' || esVisita === true;

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const foto1Url = files?.foto1?.[0] ? `/uploads/${files.foto1[0].filename}` : null;
        const foto2Url = files?.foto2?.[0] ? `/uploads/${files.foto2[0].filename}` : null;

        const dataBase = { bitacoraId, esVisita: isVisita, foto1Url, foto2Url };

        const dataVisita = {
            ...dataBase,
            actividadEjecutada: descripcionVisita ?? '',
            descripcionVisita: descripcionVisita ?? null,
            numeroPersonasVisita: numeroPersonasVisita ? parseInt(numeroPersonasVisita) : null,
            duracionVisita: duracionVisita ? parseInt(duracionVisita) : null,
        };

        const dataActividad = {
            ...dataBase,
            actividadEjecutada,
            porcentajeCompletado: parseInt(porcentajeCompletado),
            contratistaId,
            trabajadoresEnObra: parseInt(trabajadoresEnObra),
            horasTrabajadas: parseInt(horasTrabajadas),
            climaManana,
            climaTarde,
            notasGenerales,
        };

        const actividad = await prisma.bitacoraActividad.create({
            data: (isVisita ? dataVisita : dataActividad) as Prisma.BitacoraActividadUncheckedCreateInput,
            include: { contratista: true },
        });

        res.status(201).json(actividad);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear actividad' });
    }
});

// PUT /api/actividades/:id — solo admin
router.put('/:id', authenticateToken, upload.fields([
    { name: 'foto1', maxCount: 1 },
    { name: 'foto2', maxCount: 1 },
]), async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.tipoUsuario !== 'admin') {
            res.status(403).json({ error: 'Solo el administrador puede editar actividades registradas' });
            return;
        }
        const actividadId = req.params['id'] as string;
        const {
            actividadEjecutada, porcentajeCompletado, contratistaId,
            trabajadoresEnObra, horasTrabajadas, climaManana, climaTarde, notasGenerales,
        } = req.body;

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const data: any = {};
        if (actividadEjecutada  !== undefined) data.actividadEjecutada  = actividadEjecutada;
        if (porcentajeCompletado !== undefined) data.porcentajeCompletado = parseInt(porcentajeCompletado);
        if (contratistaId       !== undefined) data.contratistaId       = contratistaId || null;
        if (trabajadoresEnObra  !== undefined) data.trabajadoresEnObra  = parseInt(trabajadoresEnObra);
        if (horasTrabajadas     !== undefined) data.horasTrabajadas     = parseInt(horasTrabajadas);
        if (climaManana         !== undefined) data.climaManana         = climaManana;
        if (climaTarde          !== undefined) data.climaTarde          = climaTarde;
        if (notasGenerales      !== undefined) data.notasGenerales      = notasGenerales || null;
        if (files?.foto1?.[0]) data.foto1Url = `/uploads/${files.foto1[0].filename}`;
        if (files?.foto2?.[0]) data.foto2Url = `/uploads/${files.foto2[0].filename}`;

        const updated = await prisma.bitacoraActividad.update({
            where: { id: actividadId },
            data,
            include: { contratista: true },
        });
        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar actividad' });
    }
});

// DELETE /api/actividades/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        await prisma.bitacoraActividad.delete({ where: { id: req.params.id as string } });
        res.json({ message: 'Actividad eliminada' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar actividad' });
    }
});

export default router;
