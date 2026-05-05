import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useProjectStore, SINGLE_PROJECT_MODE } from '../stores/projectStore';
import CitySearchSelect from '../components/CitySearchSelect';
import {
    Settings, Building2, Layers, Users, Briefcase, Calendar,
    Plus, Edit, ToggleLeft, ToggleRight, Save, RefreshCw, CheckCircle2,
    ShieldAlert, UserCog, Shield
} from 'lucide-react';

type Tab = 'proyectos' | 'torres' | 'usuarios' | 'contratistas' | 'festivos' | 'interventoras' | 'empresas_contratantes';

export default function ConfiguracionPage() {
    const [activeTab, setActiveTab] = useState<Tab>(SINGLE_PROJECT_MODE ? 'torres' : 'proyectos');
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const tabs: { key: Tab; label: string; icon: any }[] = [
        { key: 'proyectos', label: 'Proyectos', icon: Building2 },
        { key: 'torres', label: 'Torres', icon: Layers },
        { key: 'usuarios', label: 'Usuarios', icon: Users },
        { key: 'contratistas', label: 'Contratistas', icon: Briefcase },
        { key: 'interventoras', label: 'Empresas Interventoras', icon: Briefcase },
        { key: 'empresas_contratantes', label: 'Empresas Contratantes', icon: Building2 },
        { key: 'festivos', label: 'Festivos', icon: Calendar },
    ];

    // In single-project mode, hide the Proyectos tab since the project is locked
    const visibleTabs = SINGLE_PROJECT_MODE ? tabs.filter(t => t.key !== 'proyectos') : tabs;

    return (
        <div className="max-w-6xl mx-auto animate-fadeIn px-2 sm:px-0">
            {toast && (
                <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl animate-scaleIn border border-emerald-500">
                    <CheckCircle2 className="w-5 h-5 text-emerald-100" />
                    <span className="font-medium text-sm">{toast}</span>
                </div>
            )}

            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm shrink-0">
                    <Settings className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Configuración del Sistema</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Administra parámetros base, estructura de negocio y control de accesos.</p>
                </div>
            </div>

            {/* Tabs - Segmented Control Style */}
            <div className="flex gap-1.5 bg-slate-100/80 p-1.5 rounded-xl mb-6 overflow-x-auto ring-1 ring-slate-200/50 shadow-inner hide-scrollbar">
                {visibleTabs.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ease-in-out ${activeTab === key ? 'bg-white text-primary shadow shrink-0' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            }`}
                    >
                        <Icon className="w-4 h-4" /> {label}
                    </button>
                ))}
            </div>

            {/* Content Container */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-1 sm:p-6 min-h-[500px]">
                {activeTab === 'proyectos' && <ProyectosTab showToast={showToast} />}
                {activeTab === 'torres' && <TorresTab showToast={showToast} />}
                {activeTab === 'usuarios' && <UsuariosTab showToast={showToast} />}
                {activeTab === 'contratistas' && <ContratistasTab showToast={showToast} />}
                {activeTab === 'interventoras' && <InterventorasTab showToast={showToast} />}
                {activeTab === 'empresas_contratantes' && <EmpresasContratantesTab showToast={showToast} />}
                {activeTab === 'festivos' && <FestivosTab showToast={showToast} />}
            </div>
        </div>
    );
}

// ── SHARED INPUT CLASSES ──
const inputClasses = "px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-700 w-full";
const selectClasses = "px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-700 w-full";
const labelClasses = "block text-[13px] font-medium text-slate-700 mb-1.5";
const btnPrimary = "flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/95 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondary = "flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 hover:text-primary transition-all duration-200 shadow-sm";


// ── PROYECTOS TAB ──
function ProyectosTab({ showToast }: { showToast: (m: string) => void }) {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [nombre, setNombre] = useState('');
    const [direccion, setDireccion] = useState('');
    const [ciudad, setCiudad] = useState('');
    const [abreviatura, setAbreviatura] = useState('');
    const [empresaContratanteId, setEmpresaContratanteId] = useState('');

    const { data: proyectos = [] } = useQuery({
        queryKey: ['proyectos'],
        queryFn: async () => (await api.get('/proyectos')).data,
    });

    const { data: contratantes = [] } = useQuery({
        queryKey: ['empresas_contratantes'],
        queryFn: async () => (await api.get('/empresas-contratantes')).data,
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (editId) {
                return (await api.put(`/proyectos/${editId}`, { nombre, direccion, ciudad, abreviatura, empresaContratanteId })).data;
            }
            return (await api.post('/proyectos', { nombre, direccion, ciudad, abreviatura, empresaContratanteId })).data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['proyectos'] });
            resetForm();
            showToast(editId ? 'Proyecto actualizado' : 'Proyecto creado');
        },
    });

    const toggleMutation = useMutation({
        mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
            return (await api.put(`/proyectos/${id}`, { activo })).data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['proyectos'] });
        },
    });

    const resetForm = () => { setShowForm(false); setEditId(null); setNombre(''); setDireccion(''); setCiudad(''); setAbreviatura(''); setEmpresaContratanteId(''); };
    const startEdit = (p: any) => { setEditId(p.id); setNombre(p.nombre); setDireccion(p.direccion || ''); setCiudad(p.ciudad || ''); setAbreviatura(p.abreviatura || ''); setEmpresaContratanteId(p.empresaContratanteId || ''); setShowForm(true); };

    return (
        <div className="p-4 sm:p-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <h2 className="text-lg font-semibold text-slate-800">Catálogo de Proyectos</h2>
                <button onClick={() => { resetForm(); setShowForm(true); }} className={btnPrimary}>
                    <Plus className="w-4 h-4" /> Nuevo Proyecto
                </button>
            </div>

            {showForm && (
                <div className="border border-slate-200/80 rounded-2xl p-5 mb-6 bg-slate-50/50 shadow-sm animate-fadeIn">
                    <h3 className="text-sm font-medium text-slate-800 mb-4">{editId ? 'Editar Proyecto' : 'Registrar Nuevo Proyecto'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                        <div>
                            <label className={labelClasses}>Nombre del Proyecto</label>
                            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClasses} placeholder="Ej: Baia Kristal" />
                        </div>
                        <div>
                            <label className={labelClasses}>Abreviatura</label>
                            <input value={abreviatura} onChange={(e) => setAbreviatura(e.target.value.toUpperCase())} className={inputClasses} placeholder="Ej: BK" maxLength={10} />
                        </div>
                        <div>
                            <label className={labelClasses}>Ciudad</label>
                            <CitySearchSelect value={ciudad} onChange={setCiudad} />
                        </div>
                        <div>
                            <label className={labelClasses}>Dirección</label>
                            <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={inputClasses} placeholder="Ubicación de la obra" />
                        </div>
                        <div className="md:col-span-2">
                            <label className={labelClasses}>Empresa Contratante</label>
                            <select value={empresaContratanteId} onChange={(e) => setEmpresaContratanteId(e.target.value)} className={selectClasses}>
                                <option value="">Seleccionar contratante...</option>
                                {contratantes.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end pt-2 border-t border-slate-200/60">
                        <button onClick={resetForm} className={btnSecondary}>Cancelar</button>
                        <button onClick={() => saveMutation.mutate()} disabled={!nombre} className={btnPrimary}>
                            <Save className="w-4 h-4" /> Guardar
                        </button>
                    </div>
                </div>
            )}

            <div className="border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-slate-50/80 border-b border-slate-200/80">
                            <tr>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Proyecto</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Contratante</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Abrev.</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Ciudad</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Dirección</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider text-center">Torres</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {proyectos.map((p: any) => (
                                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors duration-150 group">
                                    <td className="py-3.5 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${p.activo ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                            <span className="font-semibold text-slate-900">{p.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-5">
                                        {p.empresaContratante?.nombre ? (
                                            <div className="flex items-center gap-1.5 text-slate-600">
                                                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="font-medium line-clamp-1">{p.empresaContratante.nombre}</span>
                                            </div>
                                        ) : <span className="text-slate-400 italic text-xs">Sin contratante</span>}
                                    </td>
                                    <td className="py-3.5 px-5">
                                        {p.abreviatura ? <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 border border-slate-300/50">{p.abreviatura}</span> : <span className="text-slate-400 italic text-xs">N/A</span>}
                                    </td>
                                    <td className="py-3.5 px-5 font-medium text-slate-700">{p.ciudad || <span className="text-slate-400 italic text-xs">Sin ciudad</span>}</td>
                                    <td className="py-3.5 px-5 text-slate-600 truncate max-w-[200px]">{p.direccion || <span className="text-slate-400 italic text-xs">Sin dirección</span>}</td>
                                    <td className="py-3.5 px-5 text-center">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold text-xs">{p._count?.torres || 0}</span>
                                    </td>
                                    <td className="py-3.5 px-5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => startEdit(p)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors tooltip-trigger" title="Editar">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => toggleMutation.mutate({ id: p.id, activo: !p.activo })} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title={p.activo ? "Inactivar" : "Activar"}>
                                                {p.activo ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-300" />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {proyectos.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-500 bg-slate-50">
                                        No hay proyectos registrados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ── TORRES TAB ──
function TorresTab({ showToast }: { showToast: (m: string) => void }) {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [nombre, setNombre] = useState('');
    const [abreviatura, setAbreviatura] = useState('');
    const [proyectoId, setProyectoId] = useState('');
    const [filterProyectoId, setFilterProyectoId] = useState('');
    const { selectedProjectId } = useProjectStore();

    // In single-project mode, lock filters to the active project
    const effectiveFilterProyectoId = SINGLE_PROJECT_MODE ? (selectedProjectId || '') : filterProyectoId;

    const { data: proyectos = [] } = useQuery({ queryKey: ['proyectos'], queryFn: async () => (await api.get('/proyectos')).data });
    const { data: torres = [] } = useQuery({
        queryKey: ['torres', effectiveFilterProyectoId],
        queryFn: async () => {
            const p = effectiveFilterProyectoId ? `?proyecto_id=${effectiveFilterProyectoId}` : '';
            return (await api.get(`/torres${p}`)).data;
        },
    });

    const save = useMutation({
        mutationFn: async () => {
            if (editId) {
                return (await api.put(`/torres/${editId}`, { nombre, abreviatura })).data;
            }
            return (await api.post('/torres', { nombre, abreviatura, proyectoId })).data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['torres'] });
            resetForm();
            showToast(editId ? 'Torre actualizada' : 'Torre creada');
        },
    });

    const toggle = useMutation({
        mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => (await api.put(`/torres/${id}`, { activo })).data,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['torres'] }),
    });

    const resetForm = () => { setShowForm(false); setEditId(null); setNombre(''); setAbreviatura(''); setProyectoId(''); };
    const startEdit = (t: any) => { setEditId(t.id); setNombre(t.nombre); setAbreviatura(t.abreviatura || ''); setProyectoId(t.proyectoId); setShowForm(true); };

    return (
        <div className="p-4 sm:p-0">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <h2 className="text-lg font-semibold text-slate-800">Catálogo de Torres</h2>
                    {/* Project filter — hidden in single-project mode */}
                    {!SINGLE_PROJECT_MODE && (
                        <select value={filterProyectoId} onChange={(e) => setFilterProyectoId(e.target.value)} className="px-3.5 py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-sm min-w-[200px] focus:outline-none focus:ring-2 focus:ring-primary/20">
                            <option value="">Filtrar por proyecto (Todos)</option>
                            {proyectos.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                    )}
                </div>
                <button onClick={() => { resetForm(); if (SINGLE_PROJECT_MODE && selectedProjectId) setProyectoId(selectedProjectId); setShowForm(true); }} className={btnPrimary}>
                    <Plus className="w-4 h-4" /> Nueva Torre
                </button>
            </div>

            {showForm && (
                <div className="border border-slate-200/80 rounded-2xl p-5 mb-6 bg-slate-50/50 shadow-sm animate-fadeIn">
                    <h3 className="text-sm font-medium text-slate-800 mb-4">{editId ? 'Editar Torre' : 'Registrar Nueva Torre'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                        {/* Project selector — hidden in single-project mode (auto-set) */}
                        {!SINGLE_PROJECT_MODE && (
                            <div>
                                <label className={labelClasses}>Proyecto Asociado</label>
                                <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={selectClasses} disabled={!!editId}>
                                    <option value="">Seleccionar proyecto...</option>
                                    {proyectos.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className={labelClasses}>Nombre de la Torre</label>
                            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClasses} placeholder="Ej: Torre 1, Kala 3" />
                        </div>
                        <div>
                            <label className={labelClasses}>Abreviatura</label>
                            <input value={abreviatura} onChange={(e) => setAbreviatura(e.target.value.toUpperCase())} className={inputClasses} placeholder="Ej: KL3" maxLength={10} />
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end pt-2 border-t border-slate-200/60">
                        <button onClick={resetForm} className={btnSecondary}>Cancelar</button>
                        <button onClick={() => save.mutate()} disabled={!nombre || !proyectoId} className={btnPrimary}>
                            <Save className="w-4 h-4" /> {editId ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </div>
            )}

            <div className="border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-slate-50/80 border-b border-slate-200/80">
                            <tr>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Torre</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Abrev.</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Proyecto Pertenece</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {torres.map((t: any) => (
                                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors duration-150 group">
                                    <td className="py-3.5 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${t.activo ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                            <span className="font-semibold text-slate-900">{t.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-5">
                                        {t.abreviatura ? <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 border border-slate-300/50">{t.abreviatura}</span> : <span className="text-slate-400 italic text-xs">N/A</span>}
                                    </td>
                                    <td className="py-3.5 px-5 text-slate-600 font-medium">
                                        {t.proyecto?.nombre}
                                    </td>
                                    <td className="py-3.5 px-5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => startEdit(t)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors tooltip-trigger" title="Editar">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => toggle.mutate({ id: t.id, activo: !t.activo })} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title={t.activo ? "Inactivar" : "Activar"}>
                                                {t.activo ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-300" />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {torres.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center text-slate-500 bg-slate-50">
                                        No hay torres registradas para este filtro.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ── USUARIOS TAB ──
function UsuariosTab({ showToast }: { showToast: (m: string) => void }) {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ nombre: '', apellido: '', cedula: '', cargo: '', email: '', password: '', tipoUsuario: '', empresaInterventoriaId: '', proyectoIds: [] as string[], torreIds: [] as string[] });

    const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: async () => (await api.get('/usuarios')).data });
    const { data: proyectos = [] } = useQuery({ queryKey: ['proyectos'], queryFn: async () => (await api.get('/proyectos')).data });
    const { data: torres = [] } = useQuery({ queryKey: ['allTorres'], queryFn: async () => (await api.get('/torres')).data });
    const { data: interventoras = [] } = useQuery({ queryKey: ['interventoras'], queryFn: async () => (await api.get('/empresas-interventoria')).data });

    const filteredTorres = torres.filter((t: any) => form.proyectoIds.includes(t.proyectoId));

    const save = useMutation({
        mutationFn: async () => {
            const payload = { ...form };
            if (editId) return (await api.put(`/usuarios/${editId}`, payload)).data;
            return (await api.post('/usuarios', payload)).data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['usuarios'] });
            resetForm();
            showToast(editId ? 'Usuario actualizado' : 'Usuario creado');
        },
        onError: (err: any) => alert(err.response?.data?.error || 'Error'),
    });

    const toggle = useMutation({
        mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => (await api.put(`/usuarios/${id}`, { activo })).data,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
    });

    const resetForm = () => {
        setShowForm(false); setEditId(null);
        setForm({ nombre: '', apellido: '', cedula: '', cargo: '', email: '', password: '', tipoUsuario: '', empresaInterventoriaId: '', proyectoIds: [], torreIds: [] });
    };

    const startEdit = (u: any) => {
        setEditId(u.id);
        setForm({
            nombre: u.nombre, apellido: u.apellido, cedula: u.cedula, cargo: u.cargo, email: u.email, password: '',
            tipoUsuario: u.tipoUsuario,
            empresaInterventoriaId: u.empresaInterventoriaId || '',
            proyectoIds: u.usuarioProyectos?.map((up: any) => up.proyectoId || up.proyecto?.id) || [],
            torreIds: u.usuarioTorres?.map((ut: any) => ut.torreId || ut.torre?.id) || [],
        });
        setShowForm(true);
    };

    const tipoLabels: Record<string, string> = {
        residente_obra: 'Residente', director_obra: 'Director', director_obra_general: 'Dir. General', interventoria: 'Interventor', admin: 'Administrador',
    };

    const getRoleBadgeClasses = (role: string) => {
        switch (role) {
            case 'admin': return 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20';
            case 'director_obra_general': return 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20';
            case 'director_obra': return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20';
            case 'residente_obra': return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20';
            case 'interventoria': return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20';
            default: return 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/20';
        }
    };

    return (
        <div className="p-4 sm:p-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <h2 className="text-lg font-semibold text-slate-800">Directorio de Usuarios</h2>
                <button onClick={() => { resetForm(); setShowForm(true); }} className={btnPrimary}>
                    <Plus className="w-4 h-4" /> Nuevo Usuario
                </button>
            </div>

            {showForm && (
                <div className="border border-slate-200/80 rounded-2xl p-5 mb-6 bg-slate-50/50 shadow-sm animate-fadeIn">
                    <h3 className="text-sm font-medium text-slate-800 mb-4">{editId ? 'Editar Perfil de Usuario' : 'Registrar Nuevo Usuario'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
                        <div className="lg:col-span-1">
                            <label className={labelClasses}>Nombre</label>
                            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={inputClasses} placeholder="Nombre(s)" />
                        </div>
                        <div className="lg:col-span-1">
                            <label className={labelClasses}>Apellidos</label>
                            <input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} className={inputClasses} placeholder="Apellido(s)" />
                        </div>
                        <div className="lg:col-span-1">
                            <label className={labelClasses}>Cédula</label>
                            <input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} className={inputClasses} placeholder="Documento" />
                        </div>
                        <div className="lg:col-span-1">
                            <label className={labelClasses}>Correo Electrónico (Login)</label>
                            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClasses} placeholder="usuario@aed.com" type="email" />
                        </div>
                        <div className="lg:col-span-1">
                            <label className={labelClasses}>{editId ? 'Nueva Contraseña (Opcional)' : 'Contraseña'}</label>
                            <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClasses} placeholder={editId ? '••••••••' : 'Constreña segura'} type="password" />
                        </div>
                        <div className="lg:col-span-1">
                            <label className={labelClasses}>Rol y Permisos</label>
                            <select value={form.tipoUsuario} onChange={(e) => setForm({ ...form, tipoUsuario: e.target.value })} className={selectClasses}>
                                <option value="">Seleccionar rol...</option>
                                <option value="residente_obra">Residente de Obra</option>
                                <option value="director_obra">Director de Obra</option>
                                <option value="director_obra_general">Director de Obra General</option>
                                <option value="interventoria">Interventoría</option>
                                <option value="admin">Administrador del Sistema</option>
                            </select>
                        </div>
                        {form.tipoUsuario === 'interventoria' && (
                            <div className="lg:col-span-1">
                                <label className={labelClasses}>Empresa de Interventoría</label>
                                <select value={form.empresaInterventoriaId} onChange={(e) => setForm({ ...form, empresaInterventoriaId: e.target.value })} className={selectClasses}>
                                    <option value="">Seleccionar empresa...</option>
                                    {interventoras.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                <label className="block text-sm font-semibold text-slate-800 mb-2">Asignación de Proyectos</label>
                                <p className="text-xs text-slate-500 mb-2">Ctrl+Click para selección múltiple</p>
                                <select multiple value={form.proyectoIds} onChange={(e) => setForm({ ...form, proyectoIds: Array.from(e.target.selectedOptions, o => o.value) })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm h-28 focus:outline-none focus:ring-1 focus:ring-primary/30">
                                    {proyectos.map((p: any) => <option key={p.id} value={p.id} className="py-1 px-1 rounded hover:bg-primary/5">{p.nombre}</option>)}
                                </select>
                            </div>

                            {filteredTorres.length > 0 ? (
                                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                    <label className="block text-sm font-semibold text-slate-800 mb-2">Asignación de Torres Específicas</label>
                                    <p className="text-xs text-slate-500 mb-2">Solo torres de los proyectos seleccionados</p>
                                    <select multiple value={form.torreIds} onChange={(e) => setForm({ ...form, torreIds: Array.from(e.target.selectedOptions, o => o.value) })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm h-28 focus:outline-none focus:ring-1 focus:ring-primary/30">
                                        {filteredTorres.map((t: any) => <option key={t.id} value={t.id} className="py-1 px-1 rounded hover:bg-primary/5">{t.proyecto?.nombre} — {t.nombre}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-50 border border-slate-200 border-dashed rounded-xl shadow-sm flex items-center justify-center text-center">
                                    <p className="text-sm text-slate-500">Seleccione proyectos primero para asignar torres específicas.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end pt-4 border-t border-slate-200/60">
                        <button onClick={resetForm} className={btnSecondary}>Cancelar</button>
                        <button onClick={() => save.mutate()} disabled={!form.nombre || !form.email || !form.tipoUsuario} className={btnPrimary}>
                            <Save className="w-4 h-4" /> {editId ? 'Actualizar Usuario' : 'Crear Usuario'}
                        </button>
                    </div>
                </div>
            )}

            <div className="border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-slate-50/80 border-b border-slate-200/80">
                            <tr>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Perfil de Usuario</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Contacto / Cédula</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Rol de Sistema</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {usuarios.map((u: any) => (
                                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors duration-150 group">
                                    <td className="py-3.5 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className="hidden sm:flex w-9 h-9 rounded-full bg-primary/10 items-center justify-center text-primary border border-primary/20 shrink-0">
                                                {u.tipoUsuario === 'admin' ? <ShieldAlert className="w-4 h-4" /> : <UserCog className="w-4 h-4" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${u.activo ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                                    <span className="font-semibold text-slate-900">{u.nombre} {u.apellido}</span>
                                                </div>
                                                <span className="text-xs text-slate-500 truncate max-w-[200px]">{u.cargo || 'Sin cargo definido'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-5">
                                        {u.empresaInterventoria?.nombre ? (
                                            <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100/50 w-fit">
                                                <Shield className="w-3.5 h-3.5" />
                                                <span className="text-[11px] font-bold tracking-tight">{u.empresaInterventoria.nombre}</span>
                                            </div>
                                        ) : u.tipoUsuario === 'interventoria' ? (
                                            <span className="text-slate-400 italic text-[11px]">Sin empresa asignada</span>
                                        ) : null}
                                    </td>
                                    <td className="py-3.5 px-5">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-700">{u.email}</span>
                                            <span className="text-xs text-slate-500">ID: {u.cedula || 'N/A'}</span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-5">
                                        <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide ${getRoleBadgeClasses(u.tipoUsuario)}`}>
                                            {tipoLabels[u.tipoUsuario] || u.tipoUsuario}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => startEdit(u)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors tooltip-trigger" title="Editar Rol y Permisos">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => toggle.mutate({ id: u.id, activo: !u.activo })} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title={u.activo ? "Quitar Acceso" : "Restaurar Acceso"}>
                                                {u.activo ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-300" />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ── CONTRATISTAS TAB ──
function ContratistasTab({ showToast }: { showToast: (m: string) => void }) {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [nombre, setNombre] = useState('');
    const [proyectoId, setProyectoId] = useState('');
    const [filterProyectoId, setFilterProyectoId] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ agregados: number; actualizados: number; omitidos: number } | null>(null);
    const { selectedProjectId } = useProjectStore();

    const effectiveFilterProyectoId = SINGLE_PROJECT_MODE ? (selectedProjectId || '') : filterProyectoId;

    const { data: proyectos = [] } = useQuery({ queryKey: ['proyectos'], queryFn: async () => (await api.get('/proyectos')).data });
    const { data: contratistas = [] } = useQuery({
        queryKey: ['contratistas', effectiveFilterProyectoId],
        queryFn: async () => {
            const p = effectiveFilterProyectoId ? `?proyecto_id=${effectiveFilterProyectoId}` : '';
            return (await api.get(`/contratistas${p}`)).data;
        },
    });

    const save = useMutation({
        mutationFn: async () => (await api.post('/contratistas', { nombre, proyectoId })).data,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contratistas'] }); setShowForm(false); setNombre(''); showToast('Contratista registrado'); },
    });

    const toggle = useMutation({
        mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => (await api.put(`/contratistas/${id}`, { activo })).data,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contratistas'] }),
    });

    const handleSync = async () => {
        if (!effectiveFilterProyectoId) {
            alert('Selecciona un proyecto para sincronizar.');
            return;
        }
        setSyncing(true);
        setSyncResult(null);
        try {
            const res = await api.post('/sync-contratistas', { proyectoId: effectiveFilterProyectoId });
            setSyncResult(res.data);
            queryClient.invalidateQueries({ queryKey: ['contratistas'] });
            showToast(`Sincronización completada: ${res.data.agregados} nuevos, ${res.data.actualizados} actualizados`);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Error al sincronizar con SharePoint');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="p-4 sm:p-0">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <h2 className="text-lg font-semibold text-slate-800">Directorio de Contratistas</h2>
                    {!SINGLE_PROJECT_MODE && (
                        <select value={filterProyectoId} onChange={(e) => setFilterProyectoId(e.target.value)} className="px-3.5 py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-sm min-w-[200px] focus:outline-none focus:ring-2 focus:ring-primary/20">
                            <option value="">Filtrar por proyecto (Todos)</option>
                            {proyectos.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSync}
                        disabled={syncing || !effectiveFilterProyectoId}
                        className={btnSecondary}
                        title="Importar contratistas con Debida Diligencia activa desde SharePoint"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Sincronizando...' : 'Sincronizar SharePoint'}
                    </button>
                    <button onClick={() => { if (SINGLE_PROJECT_MODE && selectedProjectId) setProyectoId(selectedProjectId); setShowForm(true); }} className={btnPrimary}>
                        <Plus className="w-4 h-4" /> Registrar Contratista
                    </button>
                </div>
            </div>

            {syncResult && (
                <div className="mb-4 flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                        Sincronización exitosa —{' '}
                        <strong>{syncResult.agregados}</strong> nuevos ·{' '}
                        <strong>{syncResult.actualizados}</strong> actualizados ·{' '}
                        <strong>{syncResult.omitidos}</strong> omitidos (sin debida diligencia)
                    </span>
                </div>
            )}

            {showForm && (
                <div className="border border-slate-200/80 rounded-2xl p-5 mb-6 bg-slate-50/50 shadow-sm animate-fadeIn">
                    <h3 className="text-sm font-medium text-slate-800 mb-4">Registrar Nuevo Contratista</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                        {!SINGLE_PROJECT_MODE && (
                            <div>
                                <label className={labelClasses}>Proyecto Asignado</label>
                                <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={selectClasses}>
                                    <option value="">Seleccionar proyecto...</option>
                                    {proyectos.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className={labelClasses}>Razón Social / Nombre</label>
                            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClasses} placeholder="Nombre de la empresa o contratista" />
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end pt-2 border-t border-slate-200/60">
                        <button onClick={() => setShowForm(false)} className={btnSecondary}>Cancelar</button>
                        <button onClick={() => save.mutate()} disabled={!nombre || !proyectoId} className={btnPrimary}>
                            <Save className="w-4 h-4" /> Guardar Registro
                        </button>
                    </div>
                </div>
            )}

            <div className="border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-slate-50/80 border-b border-slate-200/80">
                            <tr>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Razón Social / Entidad</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Proyecto Vinculado</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Venc. SAGRILAFT</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider text-right">Estatus</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {contratistas.map((c: any) => (
                                <tr key={c.id} className="hover:bg-slate-50/80 transition-colors duration-150 group">
                                    <td className="py-3 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${c.activo ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                            <span className="font-semibold text-slate-900">{c.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-5 text-slate-600 font-medium">{c.proyecto?.nombre}</td>
                                    <td className="py-3 px-5">
                                        {c.fechaVencimientoSagrilaft
                                            ? <span className="text-slate-700 text-xs font-medium">{c.fechaVencimientoSagrilaft}</span>
                                            : <span className="text-slate-400 italic text-xs">—</span>}
                                    </td>
                                    <td className="py-3 px-5 text-right">
                                        <button onClick={() => toggle.mutate({ id: c.id, activo: !c.activo })} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title={c.activo ? "Marcar Inactivo" : "Marcar Activo"}>
                                            {c.activo ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-300" />}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {contratistas.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center text-slate-500 bg-slate-50">
                                        No hay contratistas registrados para este filtro.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ── FESTIVOS TAB ──
function FestivosTab({ showToast }: { showToast: (m: string) => void }) {
    const queryClient = useQueryClient();
    const [syncing, setSyncing] = useState(false);
    const year = new Date().getFullYear();

    const { data: festivos = [] } = useQuery({
        queryKey: ['festivos'],
        queryFn: async () => (await api.get('/festivos')).data,
    });

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await api.post('/festivos/sync', { anio: year.toString() });
            queryClient.invalidateQueries({ queryKey: ['festivos'] });
            showToast(res.data.message);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Error al sincronizar');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="p-4 sm:p-0">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-slate-800">Calendario de Festivos</h2>
                    <p className="text-sm text-slate-500">Calendario Oficial de Colombia para el año {year}</p>
                </div>
                <button onClick={handleSync} disabled={syncing} className={btnPrimary}>
                    <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> Sincronizar API
                </button>
            </div>

            {festivos.length === 0 ? (
                <div className="border border-slate-200/80 border-dashed rounded-2xl p-12 text-center bg-slate-50/50">
                    <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-3 opacity-50" />
                    <p className="text-slate-600 font-medium">La base de datos de festivos está vacía.</p>
                    <p className="text-sm text-slate-500 mt-1">Haz clic en "Sincronizar API" para obtener las fechas del gobierno.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {festivos.map((f: any) => (
                        <div key={f.id} className="flex flex-col p-4 border border-slate-200 shadow-sm rounded-xl bg-white hover:border-primary/30 transition-colors group">
                            <span className="text-xs font-bold text-primary mb-1 uppercase tracking-wider">{new Date(f.fecha + 'T00:00:00').toLocaleDateString('es-CO', { month: 'long', day: 'numeric' })}</span>
                            <span className="font-medium text-slate-800 text-sm leading-tight">{f.nombre}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── INTERVENTORAS TAB ──
function InterventorasTab({ showToast }: { showToast: (m: string) => void }) {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [nombre, setNombre] = useState('');
    const [nit, setNit] = useState('');

    const { data: interventoras = [] } = useQuery({
        queryKey: ['interventoras'],
        queryFn: async () => (await api.get('/empresas-interventoria')).data,
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (editId) {
                return (await api.put(`/empresas-interventoria/${editId}`, { nombre, nit })).data;
            }
            return (await api.post('/empresas-interventoria', { nombre, nit })).data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interventoras'] });
            resetForm();
            showToast(editId ? 'Empresa Interventora actualizada' : 'Empresa Interventora creada');
        },
    });

    const toggleMutation = useMutation({
        mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
            return (await api.put(`/empresas-interventoria/${id}`, { activo })).data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interventoras'] });
        },
    });

    const resetForm = () => { setShowForm(false); setEditId(null); setNombre(''); setNit(''); };
    const startEdit = (e: any) => { setEditId(e.id); setNombre(e.nombre); setNit(e.nit || ''); setShowForm(true); };

    return (
        <div className="p-4 sm:p-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <h2 className="text-lg font-semibold text-slate-800">Catálogo de Empresas de Interventoría</h2>
                <button onClick={() => { resetForm(); setShowForm(true); }} className={btnPrimary}>
                    <Plus className="w-4 h-4" /> Nueva Empresa
                </button>
            </div>

            {showForm && (
                <div className="border border-slate-200/80 rounded-2xl p-5 mb-6 bg-slate-50/50 shadow-sm animate-fadeIn">
                    <h3 className="text-sm font-medium text-slate-800 mb-4">{editId ? 'Editar Empresa' : 'Registrar Nueva Empresa Interventora'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                        <div>
                            <label className={labelClasses}>Razón Social / Nombre</label>
                            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClasses} placeholder="Nombre de la empresa" />
                        </div>
                        <div>
                            <label className={labelClasses}>NIT</label>
                            <input value={nit} onChange={(e) => setNit(e.target.value)} className={inputClasses} placeholder="123456789-0" />
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end pt-2 border-t border-slate-200/60">
                        <button onClick={resetForm} className={btnSecondary}>Cancelar</button>
                        <button onClick={() => saveMutation.mutate()} disabled={!nombre} className={btnPrimary}>
                            <Save className="w-4 h-4" /> Guardar
                        </button>
                    </div>
                </div>
            )}

            <div className="border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-slate-50/80 border-b border-slate-200/80">
                            <tr>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Empresa</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">NIT</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {interventoras.map((t: any) => (
                                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors duration-150 group">
                                    <td className="py-3.5 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${t.activo ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                            <span className="font-semibold text-slate-900">{t.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-5 text-slate-600 truncate max-w-[200px]">
                                        {t.nit || <span className="text-slate-400 italic text-xs">Sin NIT</span>}
                                    </td>
                                    <td className="py-3.5 px-5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => startEdit(t)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors tooltip-trigger" title="Editar">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => toggleMutation.mutate({ id: t.id, activo: !t.activo })} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title={t.activo ? "Inactivar" : "Activar"}>
                                                {t.activo ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-300" />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {interventoras.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="py-12 text-center text-slate-500 bg-slate-50">
                                        No hay empresas registradas.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ── EMPRESAS CONTRATANTES TAB ──
function EmpresasContratantesTab({ showToast }: { showToast: (m: string) => void }) {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [nombre, setNombre] = useState('');
    const [nit, setNit] = useState('');

    const { data: contratantes = [] } = useQuery({
        queryKey: ['empresas_contratantes'],
        queryFn: async () => (await api.get('/empresas-contratantes')).data,
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (editId) {
                return (await api.put(`/empresas-contratantes/${editId}`, { nombre, nit })).data;
            }
            return (await api.post('/empresas-contratantes', { nombre, nit })).data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['empresas_contratantes'] });
            resetForm();
            showToast(editId ? 'Empresa Contratante actualizada' : 'Empresa Contratante creada');
        },
    });

    const toggleMutation = useMutation({
        mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
            return (await api.put(`/empresas-contratantes/${id}`, { activo })).data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['empresas_contratantes'] });
        },
    });

    const resetForm = () => { setShowForm(false); setEditId(null); setNombre(''); setNit(''); };
    const startEdit = (e: any) => { setEditId(e.id); setNombre(e.nombre); setNit(e.nit || ''); setShowForm(true); };

    return (
        <div className="p-4 sm:p-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <h2 className="text-lg font-semibold text-slate-800">Catálogo de Empresas Contratantes</h2>
                <button onClick={() => { resetForm(); setShowForm(true); }} className={btnPrimary}>
                    <Plus className="w-4 h-4" /> Nueva Empresa
                </button>
            </div>

            {showForm && (
                <div className="border border-slate-200/80 rounded-2xl p-5 mb-6 bg-slate-50/50 shadow-sm animate-fadeIn">
                    <h3 className="text-sm font-medium text-slate-800 mb-4">{editId ? 'Editar Empresa' : 'Registrar Nueva Empresa Contratante'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                        <div>
                            <label className={labelClasses}>Razón Social / Nombre</label>
                            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClasses} placeholder="Nombre de la empresa" />
                        </div>
                        <div>
                            <label className={labelClasses}>NIT</label>
                            <input value={nit} onChange={(e) => setNit(e.target.value)} className={inputClasses} placeholder="123456789-0" />
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end pt-2 border-t border-slate-200/60">
                        <button onClick={resetForm} className={btnSecondary}>Cancelar</button>
                        <button onClick={() => saveMutation.mutate()} disabled={!nombre} className={btnPrimary}>
                            <Save className="w-4 h-4" /> Guardar
                        </button>
                    </div>
                </div>
            )}

            <div className="border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-slate-50/80 border-b border-slate-200/80">
                            <tr>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">Empresa</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider">NIT</th>
                                <th className="py-3.5 px-5 text-slate-500 font-semibold text-xs uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {contratantes.map((t: any) => (
                                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors duration-150 group">
                                    <td className="py-3.5 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${t.activo ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                            <span className="font-semibold text-slate-900">{t.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-5 text-slate-600 truncate max-w-[200px]">
                                        {t.nit || <span className="text-slate-400 italic text-xs">Sin NIT</span>}
                                    </td>
                                    <td className="py-3.5 px-5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => startEdit(t)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors tooltip-trigger" title="Editar">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => toggleMutation.mutate({ id: t.id, activo: !t.activo })} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title={t.activo ? "Inactivar" : "Activar"}>
                                                {t.activo ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-300" />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {contratantes.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="py-12 text-center text-slate-500 bg-slate-50">
                                        No hay empresas registradas.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
