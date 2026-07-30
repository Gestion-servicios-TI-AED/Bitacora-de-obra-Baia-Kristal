import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { prisma } from '../index';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Multer para la creación atómica de la bitácora: acepta cualquier campo de archivo
// (fotoAccidente, act_<i>_foto1/foto2, ens_<i>_anexoFoto) porque el número de actividades
// y ensayos es dinámico.
const creacionStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.resolve(process.env['UPLOAD_DIR'] || './uploads')),
    filename: (_req, file, cb) => cb(null, `folio-${Date.now()}-${Math.random().toString(36).slice(2, 11)}${path.extname(file.originalname)}`),
});
const uploadCreacion = multer({
    storage: creacionStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Solo se permiten imágenes (jpg, jpeg, png, webp)'));
    },
});

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
        } else if (user.tipoUsuario === 'director_obra' || user.tipoUsuario === 'director_obra_general' || user.tipoUsuario === 'interventoria' || user.tipoUsuario === 'supervisor_tecnico') {
            const userTorres = await prisma.usuarioTorre.findMany({
                where: { usuarioId: user.id },
                select: { torreId: true },
            });
            const torreIds = userTorres.map(ut => ut.torreId);
            if (torre_id) {
                if (!torreIds.includes(torre_id as string)) {
                    res.json({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
                    return;
                }
            } else {
                where.torreId = { in: torreIds };
            }
        }
        // admin sees all

        // Pagination
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
        const skip = (page - 1) * limit;

        const [bitacoras, total] = await Promise.all([
            prisma.bitacora.findMany({
                where,
                include: {
                    torre: true,
                    proyecto: true,
                    creadoPor: { select: { id: true, nombre: true, apellido: true, cargo: true, email: true, tipoUsuario: true } },
                    _count: { select: { actividades: true } },
                },
                orderBy: { fechaRegistro: 'desc' },
                skip,
                take: limit,
            }),
            prisma.bitacora.count({ where }),
        ]);

        res.json({
            data: bitacoras,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
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
                        empresaInterventoria: true,
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
//
// Crea la bitácora JUNTO CON sus actividades, ensayos y foto de incidente en una sola
// petición y una sola transacción de base de datos. Antes esto eran N peticiones HTTP
// independientes (una por actividad/ensayo) coordinadas por el cliente con Promise.all: si
// una fallaba por señal débil en obra, las demás en vuelo no se cancelaban y podían quedar
// guardadas de todas formas, dejando una bitácora a medias (folio consumido, torre marcada
// como "ya tiene registro ese día", sin forma de agregar desde la UI las actividades que
// faltaron). El intento de "deshacer" la bitácora huérfana era además de mejor esfuerzo: si
// esa llamada de rollback también fallaba por la misma mala señal, quedaba en un limbo
// irrecuperable. Al ser todo o nada dentro de una transacción, un corte de red a mitad de
// camino no deja ningún residuo: ni folio consumido ni filas parciales.
router.post('/', authenticateToken, uploadCreacion.any(), async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user!;
        const {
            torreId, estadoObra, diaLaborable, razonNoLaboral, explicacionNoLaboral,
            fechaRegistro, notasGenerales,
            ordenesImpartidas, cambiosAprobados, coordinacionesTecnicas,
            accidentesFallas, reclamosComunidad,
        } = req.body;

        const diaLaborableBool = diaLaborable === undefined ? true : (diaLaborable === 'true' || diaLaborable === true);

        // Get torre to find project
        const torre = await prisma.torre.findUnique({ where: { id: torreId }, include: { proyecto: true } });
        if (!torre) { res.status(404).json({ error: 'Torre no encontrada' }); return; }

        const now = new Date();
        const fecha = fechaRegistro || now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
        const hora = now.toLocaleTimeString('en-GB', { timeZone: 'America/Bogota', hour12: false });

        // Check duplicate
        const existing = await prisma.bitacora.findUnique({
            where: { torreId_fechaRegistro: { torreId, fechaRegistro: fecha } },
        });
        if (existing) {
            res.status(400).json({ error: 'Esta torre ya cuenta con un registro de bitácora para este día.' });
            return;
        }

        let actividades: any[] = [];
        let ensayos: any[] = [];
        try {
            actividades = JSON.parse(req.body.actividades || '[]');
            ensayos = JSON.parse(req.body.ensayos || '[]');
        } catch {
            res.status(400).json({ error: 'Formato inválido de actividades o ensayos.' });
            return;
        }

        const files = (req.files as Express.Multer.File[] | undefined) || [];
        const fileByField = new Map(files.map((f) => [f.fieldname, f]));

        // Validar que las fotos obligatorias llegaron ANTES de escribir nada en la base de
        // datos: si falta alguna, se rechaza la petición completa sin crear folio.
        for (let i = 0; i < actividades.length; i++) {
            if (!actividades[i].esVisita && (!fileByField.has(`act_${i}_foto1`) || !fileByField.has(`act_${i}_foto2`))) {
                res.status(400).json({ error: `Faltan fotos obligatorias en la actividad #${i + 1}.` });
                return;
            }
        }
        for (let i = 0; i < ensayos.length; i++) {
            if (!fileByField.has(`ens_${i}_anexoFoto`)) {
                res.status(400).json({ error: `Falta la foto obligatoria del ensayo #${i + 1}.` });
                return;
            }
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

        // La firma del DILIGENCIADOR siempre refleja a quien crea la bitácora, sea cual sea
        // su rol (residente, director, interventoría, supervisión, admin...). NUNCA queda en
        // null: la persona que la diligencia queda estampada como tal al momento de crearla,
        // en la misma petición (atómico). Así, si se cae la señal en obra, la bitácora solo
        // puede nacer ya firmada por su autor, o no nacer.
        const firmaResidenteData = JSON.stringify({
            nombre: `${user.nombre} ${user.apellido}`,
            email: user.email,
            cedula: user.cedula,
            cargo: user.cargo,
        });

        const fotoAccidenteFile = fileByField.get('fotoAccidente');
        const fotoAccidenteUrl = fotoAccidenteFile ? `/uploads/${fotoAccidenteFile.filename}` : null;

        const bitacoraId = await prisma.$transaction(async (tx) => {
            const created = await tx.bitacora.create({
                data: {
                    torreId,
                    proyectoId: torre.proyectoId,
                    numeroFolio: nextFolio,
                    fechaRegistro: fecha,
                    horaRegistro: hora,
                    estadoObra: estadoObra || null,
                    diaLaborable: diaLaborableBool,
                    razonNoLaboral: diaLaborableBool ? null : razonNoLaboral,
                    explicacionNoLaboral: diaLaborableBool ? null : explicacionNoLaboral,
                    creadoPorUsuarioId: user.id,
                    omitirFirmaResidente: false,
                    firmaResidenteData,
                    firmaResidenteTimestamp: now,
                    notasGenerales: notasGenerales || null,
                    ordenesImpartidas: ordenesImpartidas || null,
                    cambiosAprobados: cambiosAprobados || null,
                    coordinacionesTecnicas: coordinacionesTecnicas || null,
                    accidentesFallas: accidentesFallas || null,
                    fotoAccidenteUrl,
                    reclamosComunidad: reclamosComunidad || null,
                    estadoDiligencia: 'pendiente_ambos',
                } as any,
            });

            for (let i = 0; i < actividades.length; i++) {
                const act = actividades[i];
                const isVisita = !!act.esVisita;
                const foto1 = fileByField.get(`act_${i}_foto1`);
                const foto2 = fileByField.get(`act_${i}_foto2`);
                await tx.bitacoraActividad.create({
                    data: {
                        bitacoraId: created.id,
                        esVisita: isVisita,
                        actividadEjecutada: isVisita ? (act.descripcionVisita ?? '') : act.actividadEjecutada,
                        porcentajeCompletado: isVisita ? null : parseInt(act.porcentajeCompletado),
                        contratistaId: isVisita ? null : (act.contratistaId || null),
                        trabajadoresEnObra: isVisita ? null : parseInt(act.trabajadoresEnObra),
                        horasTrabajadas: isVisita ? null : parseInt(act.horasTrabajadas),
                        climaManana: isVisita ? null : act.climaManana,
                        climaTarde: isVisita ? null : act.climaTarde,
                        foto1Url: foto1 ? `/uploads/${foto1.filename}` : null,
                        foto2Url: foto2 ? `/uploads/${foto2.filename}` : null,
                        notasGenerales: isVisita ? null : (act.notasGenerales || null),
                        descripcionVisita: isVisita ? (act.descripcionVisita ?? null) : null,
                        numeroPersonasVisita: isVisita ? parseInt(act.numeroPersonasVisita) : null,
                        duracionVisita: isVisita ? parseInt(act.duracionVisita) : null,
                    } as any,
                });
            }

            for (let i = 0; i < ensayos.length; i++) {
                const anexo = fileByField.get(`ens_${i}_anexoFoto`)!;
                await (tx as any).bitacoraEnsayo.create({
                    data: {
                        bitacoraId: created.id,
                        ensayoRealizado: ensayos[i].ensayoRealizado,
                        anexoFotoUrl: `/uploads/${anexo.filename}`,
                    },
                });
            }

            await tx.folioControl.create({ data: { torreId, fecha, numeroFolio: nextFolio } });
            await tx.torre.update({ where: { id: torreId }, data: { folioActual: nextFolio } });

            return created.id;
        });

        const bitacora = await prisma.bitacora.findUnique({
            where: { id: bitacoraId },
            include: {
                torre: true,
                proyecto: true,
                creadoPor: { select: { id: true, nombre: true, apellido: true, cargo: true, email: true, tipoUsuario: true } },
                actividades: { include: { contratista: true } },
                ensayos: true,
            } as any,
        });

        res.status(201).json(bitacora);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'No se pudo guardar la bitácora en el servidor. Espere un momento e intente de nuevo.' });
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

        const isAdminOwner = user.tipoUsuario === 'admin' && bitacora.creadoPorUsuarioId === user.id;
        if (!isAdminOwner && (user.tipoUsuario !== 'residente_obra' || bitacora.creadoPorUsuarioId !== user.id)) {
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
        const isDirector = user.tipoUsuario === 'director_obra' || user.tipoUsuario === 'director_obra_general';

        const { comentariosDirector } = req.body;
        if (!comentariosDirector?.trim()) {
            res.status(400).json({ error: 'Los comentarios del director son requeridos para emitir el aval' });
            return;
        }

        const bitacora = await prisma.bitacora.findUnique({ where: { id: req.params.id as string } });
        if (!bitacora) { res.status(404).json({ error: 'Bitácora no encontrada' }); return; }

        const isAdminOwner = user.tipoUsuario === 'admin' && bitacora.creadoPorUsuarioId === user.id;

        if (!isDirector && !isAdminOwner) {
            res.status(403).json({ error: 'Solo el director de obra puede firmar aquí' });
            return;
        }

        // Check torre assignment (skip for admin owner)
        if (!isAdminOwner) {
            const assigned = await prisma.usuarioTorre.findUnique({
                where: { usuarioId_torreId: { usuarioId: user.id, torreId: bitacora.torreId } },
            });
            if (!assigned) {
                res.status(403).json({ error: 'No está asignado a esta torre' });
                return;
            }
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
        const isInterventor = user.tipoUsuario === 'interventoria' || user.tipoUsuario === 'director_obra_general' || user.tipoUsuario === 'supervisor_tecnico';

        const { comentariosInterventor } = req.body;
        if (!comentariosInterventor?.trim()) {
            res.status(400).json({ error: 'Los comentarios del interventor son requeridos para emitir el aval' });
            return;
        }

        const bitacora = await prisma.bitacora.findUnique({ where: { id: req.params.id as string } });
        if (!bitacora) { res.status(404).json({ error: 'Bitácora no encontrada' }); return; }

        const isAdminOwner = user.tipoUsuario === 'admin' && bitacora.creadoPorUsuarioId === user.id;

        if (!isInterventor && !isAdminOwner) {
            res.status(403).json({ error: 'Solo el interventor, supervisor técnico o director general puede firmar aquí' });
            return;
        }

        if (!isAdminOwner) {
            const torre = await prisma.torre.findUnique({ where: { id: bitacora.torreId } });

            // If the frente has a specific responsible assigned, only that person can sign
            if (torre?.interventorResponsableId) {
                if (user.id !== torre.interventorResponsableId) {
                    res.status(403).json({ error: 'Solo la persona responsable asignada a este frente puede firmar el aval de supervisión' });
                    return;
                }
            } else {
                // No specific person assigned: fall back to torre assignment check
                const assigned = await prisma.usuarioTorre.findUnique({
                    where: { usuarioId_torreId: { usuarioId: user.id, torreId: bitacora.torreId } },
                });
                if (!assigned) {
                    res.status(403).json({ error: 'No está asignado a esta torre' });
                    return;
                }
            }
        }

        // Determine empresa for firma data
        let empresa = '';
        if (user.tipoUsuario === 'director_obra_general') {
            const proyecto = await (prisma.proyecto as any).findUnique({
                where: { id: bitacora.proyectoId },
                include: { empresaContratante: true },
            });
            empresa = proyecto?.empresaContratante?.nombre || '';
        } else {
            const fullUser = await prisma.usuario.findUnique({
                where: { id: user.id },
                include: { empresaInterventoria: true },
            });
            empresa = fullUser?.empresaInterventoria?.nombre || '';
        }

        const firmaData = JSON.stringify({
            nombre: `${user.nombre} ${user.apellido}`,
            email: user.email,
            cedula: user.cedula,
            cargo: user.cargo,
            empresa,
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
