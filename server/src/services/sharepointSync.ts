import axios from 'axios';
import { prisma } from '../index';

interface SyncResult {
    added: number;
    updated: number;
    skipped: number;
}

async function getAccessToken(): Promise<string> {
    const tenantId = process.env['AZURE_TENANT_ID'];
    const clientId = process.env['AZURE_CLIENT_ID'];
    const clientSecret = process.env['AZURE_CLIENT_SECRET'];

    if (!tenantId || !clientId || !clientSecret) {
        throw new Error('Variables de Azure AD no configuradas (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)');
    }

    const response = await axios.post(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'https://graph.microsoft.com/.default',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    return response.data.access_token as string;
}

async function getSiteId(token: string): Promise<string> {
    const siteUrl = process.env['SHAREPOINT_SITE_URL'];
    if (!siteUrl) throw new Error('SHAREPOINT_SITE_URL no configurada');

    const url = new URL(siteUrl);
    const hostname = url.hostname;

    // Solo los dos primeros segmentos del path: /sites/NombreSitio o /teams/NombreSitio
    // Descartamos cualquier sub-ruta adicional que el usuario haya copiado
    const segments = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean).slice(0, 2);
    const sitePath = segments.length > 0 ? '/' + segments.join('/') : '';

    const graphUrl = sitePath
        ? `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`
        : `https://graph.microsoft.com/v1.0/sites/${hostname}`;

    console.log('[SharePoint getSiteId] hostname:', hostname, '| sitePath:', sitePath, '| url:', graphUrl);

    const response = await axios.get(graphUrl, { headers: { Authorization: `Bearer ${token}` } });
    return response.data.id as string;
}

function resolveFilePath(rawPath: string): string {
    // Si el usuario pegó la URL completa del archivo, extraemos solo la ruta relativa al sitio
    if (!rawPath.startsWith('http')) return rawPath;

    const parsed = new URL(rawPath);
    const siteUrl = process.env['SHAREPOINT_SITE_URL'] ?? '';
    try {
        const sitePathname = new URL(siteUrl).pathname
            .replace(/\/+$/, '')
            .split('/')
            .filter(Boolean)
            .slice(0, 2)
            .join('/');
        const decoded = decodeURIComponent(parsed.pathname);
        // Eliminar el prefijo /sites/NombreSitio para obtener la ruta relativa
        const relative = sitePathname ? decoded.replace(`/${sitePathname}`, '') : decoded;
        return relative || decoded;
    } catch {
        return parsed.pathname;
    }
}

async function getWorksheetData(token: string, siteId: string): Promise<{ values: any[][]; text: string[][] }> {
    const rawFilePath = process.env['SHAREPOINT_FILE_PATH'];
    const sheetName = process.env['SHAREPOINT_SHEET_NAME'];

    if (!rawFilePath || !sheetName) {
        throw new Error('SHAREPOINT_FILE_PATH o SHAREPOINT_SHEET_NAME no configuradas');
    }

    const filePath = resolveFilePath(rawFilePath);
    const encodedSheet = encodeURIComponent(sheetName);
    const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:${filePath}:/workbook/worksheets/${encodedSheet}/usedRange`;

    console.log('[SharePoint getWorksheetData] filePath:', filePath, '| url:', url);

    const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params: { '$select': 'values,text' },
    });

    return { values: response.data.values, text: response.data.text };
}

// Detecta si la celda tiene el checkmark activado (maneja boolean, texto y número)
function isChecked(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        return ['true', 'verdadero', 'si', 'sí', '1', '✓', '✔', 'x'].includes(v);
    }
    return false;
}

// Normaliza la fecha: si viene como serial de Excel (número) la convierte a string YYYY-MM-DD
function normalizeDate(value: any, textValue: string): string | null {
    if (!value && !textValue) return null;

    // Preferimos el texto formateado tal como aparece en Excel
    if (textValue && textValue.trim() && textValue.trim() !== '0') return textValue.trim();

    // Fallback: convertir serial de Excel a fecha
    if (typeof value === 'number' && value > 0) {
        const date = new Date(Math.round((value - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0]!;
    }

    if (typeof value === 'string' && value.trim()) return value.trim();

    return null;
}

function extractAxiosError(err: any): string {
    return err?.response?.data?.error_description
        ?? err?.response?.data?.error?.message
        ?? err?.response?.data?.message
        ?? err?.message
        ?? 'Error desconocido';
}

export async function syncContratistas(proyectoId: string): Promise<SyncResult> {
    const token = await getAccessToken().catch((err) => { throw new Error(`[Token Azure AD] ${extractAxiosError(err)}`); });
    const siteId = await getSiteId(token).catch((err) => { throw new Error(`[SharePoint Site] ${extractAxiosError(err)}`); });
    const { values, text } = await getWorksheetData(token, siteId).catch((err) => { throw new Error(`[Worksheet] ${extractAxiosError(err)}`); });

    if (!values || values.length < 2) {
        return { added: 0, updated: 0, skipped: 0 };
    }

    // Detectar índices de columnas por nombre (insensible a mayúsculas/acentos)
    const normalize = (s: string) => s.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const headers = (values[0] as any[]).map((h) => normalize(String(h ?? '')));

    const colNombre = headers.findIndex((h) => h === normalize('CONTRATISTA'));
    const colDebida = headers.findIndex((h) => h === normalize('DEBIDA DILIGENCIA'));
    const colConf   = headers.findIndex((h) => h === normalize('CONFIDENCIALIDAD'));
    const colFecha  = headers.findIndex((h) => h === normalize('FECHA DE VENCIMIENTO SAGRILAFT'));

    if (colNombre === -1) throw new Error('Columna "CONTRATISTA" no encontrada en el Excel');
    if (colDebida === -1) throw new Error('Columna "DEBIDA DILIGENCIA" no encontrada en el Excel');
    if (colConf   === -1) throw new Error('Columna "CONFIDENCIALIDAD" no encontrada en el Excel');

    let added = 0, updated = 0, skipped = 0;

    for (let i = 1; i < values.length; i++) {
        const row = values[i] as any[];
        const rowText = text[i] as string[];

        const nombre = String(row[colNombre] ?? '').trim();
        const debida = isChecked(row[colDebida]);
        const conf   = isChecked(row[colConf]);
        const fecha  = colFecha >= 0
            ? normalizeDate(row[colFecha], rowText?.[colFecha] ?? '')
            : null;

        if (!nombre || !debida || !conf) {
            skipped++;
            continue;
        }

        const existing = await prisma.contratista.findFirst({
            where: { nombre, proyectoId },
        });

        if (existing) {
            await prisma.contratista.update({
                where: { id: existing.id },
                data: { fechaVencimientoSagrilaft: fecha, activo: true },
            });
            updated++;
        } else {
            await prisma.contratista.create({
                data: { nombre, proyectoId, fechaVencimientoSagrilaft: fecha, activo: true },
            });
            added++;
        }
    }

    return { added, updated, skipped };
}
