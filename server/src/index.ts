import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

import authRoutes from './routes/auth';
import proyectosRoutes from './routes/proyectos';
import torresRoutes from './routes/torres';
import usuariosRoutes from './routes/usuarios';
import contratistasRoutes from './routes/contratistas';
import bitacorasRoutes from './routes/bitacoras';
import actividadesRoutes from './routes/actividades';
import foliosRoutes from './routes/folios';
import festivosRoutes from './routes/festivos';
import empresasInterventoriaRoutes from './routes/empresasInterventoria';
import empresasContratantesRoutes from './routes/empresasContratantes';
import ensayosRoutes from './routes/ensayos';
export const prisma = new PrismaClient();
const app = express();
const PORT = process.env['PORT'] || 3001;

// Middleware
const corsOrigin = process.env['CORS_ORIGIN'] ||
    (process.env['NODE_ENV'] === 'production' ? false : 'http://localhost:5173');
app.use(cors({ origin: corsOrigin, credentials: corsOrigin !== false }));
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
const uploadsDir = path.resolve(process.env['UPLOAD_DIR'] || './uploads');
app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res, path, stat) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    }
}));

// Ensure uploads directory exists
import fs from 'fs';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/proyectos', proyectosRoutes);
app.use('/api/torres', torresRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/contratistas', contratistasRoutes);
app.use('/api/bitacoras', bitacorasRoutes);
app.use('/api/actividades', actividadesRoutes);
app.use('/api/folios', foliosRoutes);
app.use('/api/festivos', festivosRoutes);
app.use('/api/empresas-interventoria', empresasInterventoriaRoutes);
app.use('/api/empresas-contratantes', empresasContratantesRoutes);
app.use('/api/ensayos', ensayosRoutes);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Serve React frontend in production (must be after all API routes)
if (process.env['NODE_ENV'] === 'production') {
    const clientDistPath = path.join(__dirname, '..', 'public');
    app.use(express.static(clientDistPath));
    app.get('*', (_req, res) => {
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`🏗️  AED Bitácora Server running on http://localhost:${PORT}`);
});
