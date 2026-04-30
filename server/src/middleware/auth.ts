import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

const JWT_SECRET = process.env['JWT_SECRET'] || 'aed-bitacora-secret';

export interface AuthUser {
    id: string;
    nombre: string;
    apellido: string;
    cedula: string;
    cargo: string;
    email: string;
    tipoUsuario: string;
}

export interface AuthRequest extends Request {
    user?: AuthUser;
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ error: 'Token de autenticación requerido' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
        req.user = decoded;
        next();
    } catch {
        res.status(403).json({ error: 'Token inválido o expirado' });
    }
}

export function requireRole(...roles: string[]) {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }
        if (!roles.includes(req.user.tipoUsuario)) {
            res.status(403).json({ error: 'No tiene permisos para esta acción' });
            return;
        }
        next();
    };
}
