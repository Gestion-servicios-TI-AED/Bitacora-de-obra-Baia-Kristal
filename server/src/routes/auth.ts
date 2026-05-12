import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env['JWT_SECRET'] || 'aed-bitacora-secret';

// POST /api/auth/login
router.post('/login', async (req, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email y contraseña son requeridos' });
            return;
        }

        const usuario = await prisma.usuario.findUnique({ where: { email } });

        if (!usuario || !usuario.activo) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }

        const validPassword = await bcrypt.compare(password, usuario.passwordHash);
        if (!validPassword) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }

        const tokenPayload = {
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            cedula: usuario.cedula,
            cargo: usuario.cargo,
            email: usuario.email,
            tipoUsuario: usuario.tipoUsuario,
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

        res.json({ token, user: tokenPayload });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const usuario = await prisma.usuario.findUnique({
            where: { id: req.user!.id },
            include: {
                usuarioProyectos: { include: { proyecto: true } },
                usuarioTorres: { include: { torre: { include: { proyecto: true } } } },
            },
        });

        if (!usuario) {
            res.status(404).json({ error: 'Usuario no encontrado' });
            return;
        }

        const { passwordHash, ...userWithoutPassword } = usuario;
        res.json(userWithoutPassword);
    } catch (error) {
        console.error('Me error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/auth/change-password
router.put('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
            return;
        }

        const usuario = await prisma.usuario.findUnique({ where: { id: req.user!.id } });
        if (!usuario) {
            res.status(404).json({ error: 'Usuario no encontrado' });
            return;
        }

        const valid = await bcrypt.compare(currentPassword, usuario.passwordHash);
        if (!valid) {
            res.status(400).json({ error: 'La contraseña actual es incorrecta' });
            return;
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await prisma.usuario.update({ where: { id: req.user!.id }, data: { passwordHash: newHash } });

        res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/auth/logout
router.post('/logout', (_req, res: Response) => {
    res.json({ message: 'Sesión cerrada exitosamente' });
});

export default router;
