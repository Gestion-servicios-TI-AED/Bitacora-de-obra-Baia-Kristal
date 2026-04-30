import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../index';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/usuarios
router.get('/', authenticateToken, requireRole('admin'), async (_req: AuthRequest, res: Response) => {
    try {
        const usuarios = await prisma.usuario.findMany({
            include: {
                usuarioProyectos: { include: { proyecto: true } },
                usuarioTorres: { include: { torre: { include: { proyecto: true } } } },
                empresaInterventoria: true,
            },
            orderBy: { nombre: 'asc' },
        });
        const sanitized = usuarios.map(({ passwordHash, ...rest }) => rest);
        res.json(sanitized);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// GET /api/usuarios/:id
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const usuario = await prisma.usuario.findUnique({
            where: { id: req.params.id as string },
            include: {
                usuarioProyectos: { include: { proyecto: true } },
                usuarioTorres: { include: { torre: { include: { proyecto: true } } } },
                empresaInterventoria: true,
            },
        });
        if (!usuario) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
        const { passwordHash, ...rest } = usuario;
        res.json(rest);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener usuario' });
    }
});

// POST /api/usuarios
router.post('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
        const { nombre, apellido, cedula, cargo, email, password, tipoUsuario, empresaInterventoriaId, proyectoIds, torreIds } = req.body;

        const passwordHash = await bcrypt.hash(password, 12);
        const usuario = await prisma.usuario.create({
            data: {
                nombre, apellido, cedula, cargo, email, passwordHash, tipoUsuario, 
                empresaInterventoriaId: (empresaInterventoriaId === '' || empresaInterventoriaId === 'null') ? null : (empresaInterventoriaId || null),
                usuarioProyectos: {
                    create: (proyectoIds || []).map((pid: string) => ({ proyectoId: pid })),
                },
                usuarioTorres: {
                    create: (torreIds || []).map((tid: string) => ({ torreId: tid })),
                },
            },
            include: {
                usuarioProyectos: { include: { proyecto: true } },
                usuarioTorres: { include: { torre: true } },
                empresaInterventoria: true,
            },
        });

        const { passwordHash: _, ...rest } = usuario;
        res.status(201).json(rest);
    } catch (error: any) {
        console.error(error);
        if (error.code === 'P2002') {
            res.status(400).json({ error: 'Ya existe un usuario con ese email o cédula' });
            return;
        }
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

// PUT /api/usuarios/:id
router.put('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
    try {
        console.log('PUT /api/usuarios body:', req.body);
        const { nombre, apellido, cedula, cargo, email, password, tipoUsuario, activo, empresaInterventoriaId, proyectoIds, torreIds } = req.body;

        const data: any = {};
        if (nombre !== undefined) data.nombre = nombre;
        if (apellido !== undefined) data.apellido = apellido;
        if (cedula !== undefined) data.cedula = cedula;
        if (cargo !== undefined) data.cargo = cargo;
        if (email !== undefined) data.email = email;
        if (tipoUsuario !== undefined) data.tipoUsuario = tipoUsuario;
        if (activo !== undefined) data.activo = activo;

        if (empresaInterventoriaId !== undefined) {
            if (empresaInterventoriaId && empresaInterventoriaId !== '' && empresaInterventoriaId !== 'null') {
                data.empresaInterventoria = { connect: { id: empresaInterventoriaId } };
            } else {
                data.empresaInterventoria = { disconnect: true };
            }
        }

        if (password) data.passwordHash = await bcrypt.hash(password, 12);

        // Update project and tower assignments
        if (proyectoIds !== undefined) {
            await prisma.usuarioProyecto.deleteMany({ where: { usuarioId: req.params.id as string } });
            data.usuarioProyectos = {
                create: proyectoIds.map((pid: string) => ({ proyectoId: pid })),
            };
        }
        if (torreIds !== undefined) {
            await prisma.usuarioTorre.deleteMany({ where: { usuarioId: req.params.id as string } });
            data.usuarioTorres = {
                create: torreIds.map((tid: string) => ({ torreId: tid })),
            };
        }

        const usuario = await prisma.usuario.update({
            where: { id: req.params.id as string },
            data,
            include: {
                usuarioProyectos: { include: { proyecto: true } },
                usuarioTorres: { include: { torre: true } },
                empresaInterventoria: true,
            },
        });

        const { passwordHash, ...rest } = usuario;
        res.json(rest);
    } catch (error: any) {
        console.error(error);
        if (error.code === 'P2002') {
            res.status(400).json({ error: 'Ya existe un usuario con ese email o cédula' });
            return;
        }
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

export default router;
