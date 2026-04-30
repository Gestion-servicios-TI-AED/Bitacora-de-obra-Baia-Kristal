import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useProjectStore, SINGLE_PROJECT_MODE } from '../stores/projectStore';
import api from '../lib/api';
import CalendarView from '../components/CalendarView';
import {
    Filter, Calendar, LayoutList, Eye, Building2, SearchX
} from 'lucide-react';

const estadoBadge: Record<string, { label: string; class: string }> = {
    nuevo: { label: 'Nuevo', class: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-500/20' },
    pendiente_director: { label: 'Pend. Director', class: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' },
    pendiente_interventor: { label: 'Pend. Interventor', class: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20' },
    pendiente_ambos: { label: 'Pend. Ambas', class: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' },
    completado: { label: 'Completado', class: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' },
};

const estadoObraBadge: Record<string, { label: string; class: string }> = {
    avanzada: { label: '🟢 Avanzada', class: 'text-emerald-700 font-medium' },
    normal: { label: '🔵 Normal', class: 'text-blue-700 font-medium' },
    retrasada: { label: '🟡 Retrasada', class: 'text-amber-700 font-medium' },
    detenida: { label: '🔴 Detenida', class: 'text-rose-700 font-medium' },
};

export default function VerBitacorasPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { selectedProjectId } = useProjectStore();
    const [view, setView] = useState<'table' | 'calendar'>('table');
    const [proyectoFilter, setProyectoFilter] = useState('');
    const [torreFilter, setTorreFilter] = useState('');
    const [estadoFilter, setEstadoFilter] = useState('');
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');

    const { data: proyectos = [] } = useQuery({
        queryKey: ['proyectos'],
        queryFn: async () => (await api.get('/proyectos')).data,
    });

    // In single-project mode, lock the filter to the active project
    const effectiveProyectoFilter = SINGLE_PROJECT_MODE ? (selectedProjectId || '') : proyectoFilter;

    const { data: torres = [] } = useQuery({
        queryKey: ['torres', effectiveProyectoFilter],
        queryFn: async () => {
            const params = effectiveProyectoFilter ? `?proyecto_id=${effectiveProyectoFilter}` : '';
            return (await api.get(`/torres${params}`)).data;
        },
    });

    const { data: bitacoras = [], isLoading } = useQuery({
        queryKey: ['bitacoras', effectiveProyectoFilter, torreFilter, estadoFilter, fechaDesde, fechaHasta],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (effectiveProyectoFilter) params.set('proyecto_id', effectiveProyectoFilter);
            if (torreFilter) params.set('torre_id', torreFilter);
            if (estadoFilter) params.set('estado', estadoFilter);
            if (fechaDesde) params.set('fecha_desde', fechaDesde);
            if (fechaHasta) params.set('fecha_hasta', fechaHasta);
            return (await api.get(`/bitacoras?${params.toString()}`)).data;
        },
    });

    const { data: festivos = [] } = useQuery({
        queryKey: ['festivos'],
        queryFn: async () => (await api.get('/festivos')).data,
    });

    return (
        <div className="max-w-7xl mx-auto animate-fadeIn px-2 sm:px-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 shadow-sm">
                        <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ver Bitácoras</h1>
                        <p className="text-sm text-slate-500 mt-0.5">{bitacoras.length} registro(s) encontrado(s)</p>
                    </div>
                </div>
                <div className="flex items-center self-start sm:self-auto bg-slate-100/80 p-1 rounded-xl ring-1 ring-slate-200/50 shadow-inner">
                    <button
                        onClick={() => setView('table')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-in-out ${view === 'table' ? 'bg-white text-primary shadow shrink-0' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            }`}
                    >
                        <LayoutList className="w-4 h-4" /> Tabla
                    </button>
                    <button
                        onClick={() => setView('calendar')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-in-out ${view === 'calendar' ? 'bg-white text-primary shadow shrink-0' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            }`}
                    >
                        <Calendar className="w-4 h-4" /> Calendario
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">Filtros de Búsqueda</span>
                </div>
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${SINGLE_PROJECT_MODE ? 'lg:grid-cols-4' : 'lg:grid-cols-5'} gap-4`}>
                    {/* Project filter — hidden in single-project mode */}
                    {!SINGLE_PROJECT_MODE && (
                        <select value={proyectoFilter} onChange={(e) => { setProyectoFilter(e.target.value); setTorreFilter(''); }}
                            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-700">
                            <option value="">Todos los proyectos</option>
                            {proyectos.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                    )}
                    <select value={torreFilter} onChange={(e) => setTorreFilter(e.target.value)}
                        className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-700">
                        <option value="">Todas las torres</option>
                        {torres.map((t: any) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                    <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}
                        className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-700">
                        <option value="">Todos los estados</option>
                        <option value="nuevo">Nuevo</option>
                        <option value="pendiente_director">Pendiente Director</option>
                        <option value="pendiente_interventor">Pendiente Interventor</option>
                        <option value="pendiente_ambos">Pendiente Ambas</option>
                        <option value="completado">Completado</option>
                    </select>
                    <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
                        className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-700"
                        title="Fecha Desde" />
                    <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
                        className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-700"
                        title="Fecha Hasta" />
                </div>
            </div>

            {/* Table view */}
            {view === 'table' ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                    {isLoading ? (
                        <div className="p-16 text-center flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-100 border-t-primary mb-4"></div>
                            <p className="text-sm font-medium text-slate-500">Cargando registros...</p>
                        </div>
                    ) : bitacoras.length === 0 ? (
                        <div className="p-16 text-center flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 ring-1 ring-slate-100">
                                <SearchX className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-base font-semibold text-slate-900 mb-1">No hay resultados</h3>
                            <p className="text-sm text-slate-500 max-w-sm">No se encontraron bitácoras que coincidan con los filtros aplicados. Intenta ajustar tu búsqueda.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left whitespace-nowrap">
                                <thead className="bg-slate-50/80 border-b border-slate-200/80">
                                    <tr>
                                        <th className="py-4 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Folio</th>
                                        <th className="py-4 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Fecha</th>
                                        <th className="py-4 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Proyecto / Torre</th>
                                        <th className="py-4 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Estado Obra</th>
                                        <th className="py-4 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Diligencia</th>
                                        <th className="py-4 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Creado por</th>
                                        <th className="py-4 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider relative"><span className="sr-only">Acciones</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {bitacoras.map((b: any) => (
                                        <tr key={b.id} className="hover:bg-slate-50/80 transition-colors duration-150 group">
                                            <td className="py-3 px-5">
                                                <span className="font-semibold text-primary">
                                                    {(b.proyecto?.abreviatura && b.torre?.abreviatura)
                                                        ? `${b.proyecto.abreviatura}-${b.torre.abreviatura}-${String(b.numeroFolio).padStart(3, '0')}`
                                                        : `#${b.numeroFolio}`}
                                                </span>
                                            </td>
                                            <td className="py-3 px-5 text-slate-600 font-medium">
                                                {new Date(b.fechaRegistro + 'T00:00:00').toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </td>
                                            <td className="py-3 px-5">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900 truncate max-w-[200px]">{b.proyecto?.nombre}</span>
                                                    <span className="text-xs text-slate-500 truncate max-w-[200px]">{b.torre?.nombre}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-5">
                                                {b.estadoObra ? (
                                                    <span className={`text-[13px] ${estadoObraBadge[b.estadoObra]?.class}`}>
                                                        {estadoObraBadge[b.estadoObra]?.label}
                                                    </span>
                                                ) : <span className="text-slate-400 text-[13px] italic">N/A</span>}
                                            </td>
                                            <td className="py-3 px-5">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${estadoBadge[b.estadoDiligencia]?.class ?? estadoBadge['nuevo']?.class ?? ''}`}>
                                                    {estadoBadge[b.estadoDiligencia]?.label ?? 'Nuevo'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-5">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-700">{b.creadoPor?.nombre} {b.creadoPor?.apellido}</span>
                                                    <span className="text-xs text-slate-500">Residente</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-5 text-right">
                                                <button
                                                    onClick={() => navigate(`/bitacoras/${b.id}`)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 hover:text-primary hover:border-primary/30 transition-all duration-200 shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                >
                                                    <Eye className="w-3.5 h-3.5" /> Abrir
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-1">
                    <CalendarView
                        bitacoras={bitacoras}
                        festivos={festivos}
                        torreFilter={torreFilter}
                        userRole={user?.tipoUsuario}
                        onNavigate={(id: string) => navigate(`/bitacoras/${id}`)}
                        onRegisterRetroactive={(fecha: string) => navigate(`/registrar?fecha=${fecha}`)}
                    />
                </div>
            )}
        </div>
    );
}
