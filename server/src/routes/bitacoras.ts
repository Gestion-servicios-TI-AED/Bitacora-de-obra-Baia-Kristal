import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { prisma } from '../index';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/bitacoras
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { proyecto_id, torre_id, estado, fecha_desde, fecha_hasta } = req.query;
        const user = req.user!;
        const where: any = {};

        if (proyecto_id) where.proyectoId = proyecto_id as string;
        if (torre_id) where.torreId = torre_id as string;
        if (estado) where.estadoDiligencia = estado as string;
        if (fecha_desde || fecha_hasta) {
            where.fechaRegistro = {};
            if (fecha_desde) where.fechaRegistro.gte = fecha_desde as string;
            if (fecha_hasta) where.fechaRegistro.lte = fecha_hasta as string;
        }

        // Role-based filtering
        if (user.tipoUsuario === 'residente_obra') {
            where.creadoPorUsuarioId = user.id;
        } else if (user.tipoUsuario === 'director_obra' || user.tipoUsuario === 'director_obra_general' || user.tipoUsuario === 'interventoria') {
            const userTorres = await prisma.usuarioTorre.findMany({
                where: { usuarioId: user.id },
                select: { torreId: true },
            });
            const torreIds = userTorres.map(ut => ut.torreId);
            if (torre_id) {
                if (!torreIds.includes(torre_id as string)) {
                    res.json([]);
                    return;
                }
            } else {
                where.torreId = { in: torreIds };
            }
        }
        // admin sees all

        const bitacoras = await prisma.bitacora.findMany({
            where,
            include: {
                torre: true,
                proyecto: true,
                creadoPor: { select: { id: true, nombre: true, apellido: true, cargo: true, email: true, tipoUsuario: true } },
                _count: { select: { actividades: true } },
            },
            orderBy: { fechaRegistro: 'desc' },
        });

        res.json(bitacoras);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener bitácoras' });
    }
});

// GET /api/bitacoras/:id
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const bitacora = await prisma.bitacora.findUnique({
            where: { id: req.params.id as string },
            include: {
                torre: {
                    include: {
                        usuarioTorres: {
                            include: {
                                usuario: {
                                    include: {
                                        empresaInterventoria: true,
                                    },
                                },
                            },
                        },
                    },
                },
                proyecto: {
                    include: {
                        empresaContratante: true,
                    },
                },
                creadoPor: { select: { id: true, nombre: true, apellido: true, cargo: true, email: true, cedula: true, tipoUsuario: true } },
                actividades: { include: { contratista: true }, orderBy: { createdAt: 'asc' } },
                ensayos: { orderBy: { createdAt: 'asc' } } as any,
            },
        });
        if (!bitacora) { res.status(404).json({ error: 'Bitácora no encontrada' }); return; }
        res.json(bitacora);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener bitácora' });
    }
});

// POST /api/bitacoras
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user!;
        const {
            torreId, estadoObra, diaLaborable, razonNoLaboral, explicacionNoLaboral,
            fechaRegistro, notasGenerales,
            ordenesImpartidas, cambiosAprobados, coordinacionesTecnicas,
            accidentesFallas, fotoAccidenteUrl, reclamosComunidad
        } = req.body;

        // Get torre to find project
        const torre = await prisma.torre.findUnique({ where: { id: torreId }, include: { proyecto: true } });
        if (!torre) { res.status(404).json({ error: 'Torre no encontrada' }); return; }

        const fecha = fechaRegistro || new Date().toISOString().split('T')[0];
        const hora = new Date().toTimeString().split(' ')[0] as string;

        // Check duplicate
        const existing = await prisma.bitacora.findUnique({
            where: { torreId_fechaRegistro: { torreId, fechaRegistro: fecha } },
        });
        if (existing) {
            res.status(400).json({ error: 'Esta torre ya cuenta con un registro de bitácora para este día.' });
            return;
        }

        // Calculate folio
        const lastFolio = await prisma.folioControl.findMany({
            where: { torreId },
            orderBy: { fecha: 'desc' },
            take: 1,
        });

        let nextFolio = (torre.folioActual || 0) + 1;
        if (lastFolio.length > 0) {
            const lastDate = new Date(lastFolio[0]!.fecha);
            const currentDate = new Date(fecha);
            const daysDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            nextFolio = lastFolio[0]!.numeroFolio + Math.max(daysDiff, 1);
        }

        const omitirFirmaResidente = user.tipoUsuario === 'director_obra' || user.tipoUsuario === 'director_obra_general';

        const bitacora = await prisma.bitacora.create({
            data: {
                torreId,
                proyectoId: torre.proyectoId,
                numeroFolio: nextFolio,
                fechaRegistro: fecha,
                horaRegistro: hora,
                estadoObra,
                diaLaborable: diaLaborable ?? true,
                razonNoLaboral: diaLaborable ? null : razonNoLaboral,
                explicacionNoLaboral: diaLaborable ? null : explicacionNoLaboral,
                creadoPorUsuarioId: user.id,
                omitirFirmaResidente,
                notasGenerales: notasGenerales || null,
                ordenesImpartidas: ordenesImpartidas || null,
                cambiosAprobados: cambiosAprobados || null,
                coordinacionesTecnicas: coordinacionesTecnicas || null,
                accidentesFallas: accidentesFallas || null,
                fotoAccidenteUrl: fotoAccidenteUrl || null,
                reclamosComunidad: reclamosComunidad || null,
                estadoDiligencia: 'nuevo',
            } as any,
            include: {
                torre: true,
                proyecto: true,
                creadoPor: { select: { id: true, nombre: true, apellido: true, cargo: true, email: true, tipoUsuario: true } },
            },
        });

        // Record folio
        await prisma.folioControl.create({
            data: { torreId, fecha, numeroFolio: nextFolio },
        });

        // Update torre folio
        await prisma.torre.update({
            where: { id: torreId },
            data: { folioActual: nextFolio },
        });

        res.status(201).json(bitacora);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear bitácora' });
    }
});

// Helper to recalculate estado
function calcularEstadoDiligencia(bitacora: any): string {
    const tieneResidente = bitacora.omitirFirmaResidente || !!bitacora.firmaResidenteData;
    const tieneDirector = !!bitacora.firmaDirectorData;
    const tieneInterventor = !!bitacora.firmaInterventorData;

    if (tieneResidente && tieneDirector && tieneInterventor) return 'completado';
    if (tieneResidente && !tieneDirector && !tieneInterventor) return 'pendiente_ambos';
    if (tieneResidente && tieneDirector && !tieneInterventor) return 'pendiente_interventor';
    if (tieneResidente && !tieneDirector && tieneInterventor) return 'pendiente_director';
    if (!tieneResidente && tieneDirector && tieneInterventor) return 'completado';
    if (!tieneResidente && tieneDirector && !tieneInterventor) return 'pendiente_interventor';
    return 'nuevo';
}

// PATCH /api/bitacoras/:id/firma-residente
router.patch('/:id/firma-residente', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user!;
        const bitacora = await prisma.bitacora.findUnique({ where: { id: req.params.id as string } });
        if (!bitacora) { res.status(404).json({ error: 'Bitácora no encontrada' }); return; }

        if (user.tipoUsuario !== 'residente_obra' || bitacora.creadoPorUsuarioId !== user.id) {
            res.status(403).json({ error: 'Solo el residente que creó esta bitácora puede firmar' });
            return;
        }

        const firmaData = JSON.stringify({
            nombre: `${user.nombre} ${user.apellido}`,
            email: user.email,
            cedula: user.cedula,
            cargo: user.cargo,
        });

        const updated = await prisma.bitacora.update({
            where: { id: req.params.id as string },
            data: { firmaResidenteData: firmaData, firmaResidenteTimestamp: new Date() },
        });

        const estado = calcularEstadoDiligencia(updated);
        const final = await prisma.bitacora.update({
            where: { id: req.params.id as string },
            data: { estadoDiligencia: estado },
            include: { torre: true, proyecto: true, actividades: { include: { contratista: true } } },
        });
        res.json(final);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al firmar' });
    }
});

// PATCH /api/bitacoras/:id/firma-director
router.patch('/:id/firma-director', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user!;
        if (user.tipoUsuario !== 'director_obra' && user.tipoUsuario !== 'director_obra_general') {
            res.status(403).json({ error: 'Solo el director de obra puede firmar aquí' });
            return;
        }

        const { comentariosDirector } = req.body;
        if (!comentariosDirector?.trim()) {
            res.status(400).json({ error: 'Los comentarios del director son requeridos para emitir el aval' });
            return;
        }

        const bitacora = await prisma.bitacora.findUnique({ where: { id: req.params.id as string } });
        if (!bitacora) { res.status(404).json({ error: 'Bitácora no encontrada' }); return; }

        // Check director is assigned to this torre
        const assigned = await prisma.usuarioTorre.findUnique({
            where: { usuarioId_torreId: { usuarioId: user.id, torreId: bitacora.torreId } },
        });
        if (!assigned) {
            res.status(403).json({ error: 'No está asignado a esta torre' });
            return;
        }

        const firmaData = JSON.stringify({
            nombre: `${user.nombre} ${user.apellido}`,
            email: user.email,
            cedula: user.cedula,
            cargo: user.cargo,
        });

        const updated = await prisma.bitacora.update({
            where: { id: req.params.id as string },
            data: { firmaDirectorData: firmaData, firmaDirectorTimestamp: new Date(), comentariosDirector: comentariosDirector.trim() },
        });

        const estado = calcularEstadoDiligencia(updated);
        const final = await prisma.bitacora.update({
            where: { id: req.params.id as string },
            data: { estadoDiligencia: estado },
            include: { torre: true, proyecto: true, actividades: { include: { contratista: true } } },
        });
        res.json(final);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al firmar' });
    }
});

// PATCH /api/bitacoras/:id/firma-interventor
router.patch('/:id/firma-interventor', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user!;
        if (user.tipoUsuario !== 'interventoria' && user.tipoUsuario !== 'director_obra_general') {
            res.status(403).json({ error: 'Solo el interventor o director general puede firmar aquí' });
            return;
        }

        const { comentariosInterventor } = req.body;
        if (!comentariosInterventor?.trim()) {
            res.status(400).json({ error: 'Los comentarios del interventor son requeridos para emitir el aval' });
            return;
        }

        const bitacora = await prisma.bitacora.findUnique({ where: { id: req.params.id as string } });
        if (!bitacora) { res.status(404).json({ error: 'Bitácora no encontrada' }); return; }

        const assigned = await prisma.usuarioTorre.findUnique({
            where: { usuarioId_torreId: { usuarioId: user.id, torreId: bitacora.torreId } },
        });
        if (!assigned) {
            res.status(403).json({ error: 'No está asignado a esta torre' });
            return;
        }

        const firmaData = JSON.stringify({
            nombre: `${user.nombre} ${user.apellido}`,
            email: user.email,
            cedula: user.cedula,
            cargo: user.cargo,
        });

        const updated = await prisma.bitacora.update({
            where: { id: req.params.id as string },
            data: { firmaInterventorData: firmaData, firmaInterventorTimestamp: new Date(), comentariosInterventor: comentariosInterventor.trim() },
        });

        const estado = calcularEstadoDiligencia(updated);
        const final = await prisma.bitacora.update({
            where: { id: req.params.id as string },
            data: { estadoDiligencia: estado },
            include: { torre: true, proyecto: true, actividades: { include: { contratista: true } } },
        });
        res.json(final);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al firmar' });
    }
});

// DELETE /api/bitacoras/:id — admin only
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.tipoUsuario !== 'admin') {
            res.status(403).json({ error: 'Solo el administrador puede eliminar bitácoras' });
            return;
        }

        const bitacora = await prisma.bitacora.findUnique({ where: { id: req.params.id as string } });
        if (!bitacora) { res.status(404).json({ error: 'Bitácora no encontrada' }); return; }

        const { torreId, fechaRegistro } = bitacora;

        // Delete bitácora (cascades to actividades and ensayos)
        await prisma.bitacora.delete({ where: { id: req.params.id as string } });

        // Free the folio slot
        await prisma.folioControl.deleteMany({ where: { torreId, fecha: fechaRegistro } });

        // Sync torre.folioActual to the most recent remaining folio
        const lastRemaining = await prisma.folioControl.findFirst({
            where: { torreId },
            orderBy: { fecha: 'desc' },
        });
        await prisma.torre.update({
            where: { id: torreId },
            data: { folioActual: lastRemaining ? lastRemaining.numeroFolio : 0 },
        });

        res.json({ message: 'Bitácora eliminada' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar bitácora' });
    }
});

// Check if tower has registration for a given date
router.get('/check/:torreId/:fecha', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const existing = await prisma.bitacora.findUnique({
            where: { torreId_fechaRegistro: { torreId: req.params.torreId as string, fechaRegistro: req.params.fecha as string } },
        });
        res.json({ exists: !!existing, bitacora: existing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al verificar' });
    }
});

// Setup multer for accident photos
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.resolve(process.env['UPLOAD_DIR'] || './uploads')),
    filename: (_req, file, cb) => cb(null, `accidente-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`),
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
});

// PATCH /api/bitacoras/:id/foto-accidente
router.patch('/:id/foto-accidente', authenticateToken, upload.single('fotoAccidente'), async (req: AuthRequest, res: Response) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No se recibió ninguna foto' });
            return;
        }

        const bitacoraId = req.params.id;
        const fotoAccidenteUrl = `/uploads/${req.file.filename}`;

        const bitacora = await (prisma.bitacora as any).update({
            where: { id: bitacoraId },
            data: { fotoAccidenteUrl },
        });

        res.json(bitacora);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al subir foto de accidente' });
    }
});

export default router;
