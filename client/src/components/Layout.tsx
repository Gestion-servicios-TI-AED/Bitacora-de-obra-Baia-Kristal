import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import { useProjectStore, SINGLE_PROJECT_MODE, DEFAULT_PROJECT_NAME } from '../stores/projectStore';
import {
    Building2, ClipboardList, FolderOpen, Settings,
    LogOut, Menu, X, ChevronLeft, User, Clock,
    Sun, CloudRain, CloudLightning, Cloud, CloudSnow, CloudFog,
    KeyRound, Eye, EyeOff, CheckCircle2
} from 'lucide-react';

const getWeatherIcon = (code: number, className: string) => {
    if (code === 0) return <Sun className={className} />;
    if (code >= 1 && code <= 3) return <Cloud className={className} />;
    if (code === 45 || code === 48) return <CloudFog className={className} />;
    if (code >= 51 && code <= 67) return <CloudRain className={className} />;
    if (code >= 71 && code <= 82) return <CloudSnow className={className} />;
    if (code >= 95 && code <= 99) return <CloudLightning className={className} />;
    return <Sun className={className} />; // Default
};

export default function Layout() {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { user, logout } = useAuthStore();
    const { selectedProjectId, setSelectedProjectId } = useProjectStore();
    const navigate = useNavigate();

    const [time, setTime] = useState(new Date());
    const [weather, setWeather] = useState<{ temp: number, code: number } | null>(null);

    // Change password modal state
    const [showChangePwd, setShowChangePwd] = useState(false);
    const [pwdCurrent, setPwdCurrent] = useState('');
    const [pwdNew, setPwdNew] = useState('');
    const [pwdConfirm, setPwdConfirm] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [pwdLoading, setPwdLoading] = useState(false);
    const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    const handleChangePwd = async () => {
        if (pwdNew !== pwdConfirm) { setPwdMsg({ type: 'err', text: 'Las contraseñas nuevas no coinciden' }); return; }
        if (pwdNew.length < 6) { setPwdMsg({ type: 'err', text: 'Mínimo 6 caracteres' }); return; }
        setPwdLoading(true); setPwdMsg(null);
        try {
            await api.put('/auth/change-password', { currentPassword: pwdCurrent, newPassword: pwdNew });
            setPwdMsg({ type: 'ok', text: 'Contraseña actualizada correctamente' });
            setPwdCurrent(''); setPwdNew(''); setPwdConfirm('');
        } catch (err: any) {
            setPwdMsg({ type: 'err', text: err.response?.data?.error || 'Error al cambiar contraseña' });
        } finally {
            setPwdLoading(false);
        }
    };

    const closePwdModal = () => {
        setShowChangePwd(false);
        setPwdCurrent(''); setPwdNew(''); setPwdConfirm('');
        setPwdMsg(null); setShowCurrent(false); setShowNew(false);
    };

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Proyectos derivados del usuario o todos si es admin
    const { data: proyectos = [] } = useQuery({
        queryKey: ['layoutProyectos', user?.id],
        queryFn: async () => {
            if (user?.tipoUsuario === 'admin') {
                const res = await api.get('/proyectos');
                return res.data;
            } else {
                const res = await api.get('/auth/me');
                const pMap = new Map();
                res.data.usuarioProyectos?.forEach((up: any) => pMap.set(up.proyecto.id, up.proyecto));
                res.data.usuarioTorres?.forEach((ut: any) => {
                    if (ut.torre?.proyecto) pMap.set(ut.torre.proyecto.id, ut.torre.proyecto);
                });
                return Array.from(pMap.values());
            }
        },
        enabled: !!user,
    });

    const isMultiProject = !SINGLE_PROJECT_MODE && (proyectos.length > 1 || user?.tipoUsuario === 'admin');

    // Set initial project if none selected
    useEffect(() => {
        if (!selectedProjectId && proyectos.length > 0) {
            if (SINGLE_PROJECT_MODE) {
                // Lock to the default project in single-project mode
                const defaultProject = proyectos.find((p: any) => p.nombre === DEFAULT_PROJECT_NAME);
                setSelectedProjectId(defaultProject?.id || proyectos[0].id);
            } else {
                setSelectedProjectId(proyectos[0].id);
            }
        }
    }, [proyectos, selectedProjectId, setSelectedProjectId]);

    // Determinar la dirección / ciudad basada en los proyectos cargados
    const activeProject = proyectos.find((p: any) => p.id === selectedProjectId);

    // Si tenemos ciudad, buscamos estrictamente "Ciudad, Colombia" para máxima precisión.
    // Si no, recaemos en la dirección anterior o Bogotá por defecto.
    const address = activeProject?.ciudad
        ? `${activeProject.ciudad}, Colombia`
        : (activeProject?.direccion || 'Bogotá, Colombia');

    // Weather
    useEffect(() => {
        const fetchWeather = async () => {
            setWeather(null); // Feedback visual de carga
            try {
                // Geo via Nominatim (much better for street addresses than Open-Meteo's city-only search)
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`);
                const geoData = await geoRes.json();

                let lat = 4.6097; // Bogota Default fallback
                let lng = -74.0817;

                if (geoData && geoData.length > 0) {
                    lat = parseFloat(geoData[0].lat);
                    lng = parseFloat(geoData[0].lon);
                    console.log(`Clima resuelto para: ${geoData[0].display_name} (${lat}, ${lng})`);
                } else {
                    console.warn(`No se encontraron coordenadas para: ${address}`);
                }

                // Weather via Open-Meteo
                const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
                const wData = await wRes.json();
                setWeather({
                    temp: wData.current_weather.temperature,
                    code: wData.current_weather.weathercode
                });
            } catch (error) {
                console.error("Failed to fetch weather", error);
            }
        };

        if (selectedProjectId && proyectos.length > 0) {
            fetchWeather();
        }
    }, [selectedProjectId, address, proyectos.length]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const canRegister = user?.tipoUsuario !== 'interventoria' && user?.tipoUsuario !== 'supervisor_tecnico';

    const menuItems = [
        ...(canRegister ? [{ to: '/registrar', icon: ClipboardList, label: 'Registrar Bitácora' }] : []),
        { to: '/bitacoras', icon: FolderOpen, label: 'Ver Bitácoras' },
    ];

    if (user?.tipoUsuario === 'admin') {
        menuItems.push({ to: '/configuracion', icon: Settings, label: 'Configuración' });
    }

    const navLinkClass = (isActive: boolean) =>
        `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${isActive
            ? 'bg-white/15 text-white shadow-lg shadow-black/10'
            : 'text-blue-100/70 hover:bg-white/10 hover:text-white'
        }`;

    return (
        <div className="min-h-screen flex bg-bg">
            {/* Mobile overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed lg:sticky top-0 left-0 h-screen z-50 flex flex-col bg-gradient-to-b from-[#1B3A6B] to-[#122a4f] shadow-2xl transition-all duration-300 ${collapsed ? 'w-20' : 'w-72'
                    } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
            >
                {/* Header */}
                <div className={`flex items-center p-5 border-b border-white/10 ${collapsed ? 'justify-center' : 'gap-3'}`}>
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#F5A623]/20 shrink-0">
                        <Building2 className="w-5 h-5 text-[#F5A623]" />
                    </div>
                    {!collapsed && (
                        <div className="animate-fadeIn min-w-0">
                            <h1 className="text-white font-bold text-lg leading-tight truncate">AED</h1>
                            <p className="text-blue-200/60 text-xs truncate">Bitácora de Obra</p>
                        </div>
                    )}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="hidden lg:flex ml-auto items-center justify-center w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all"
                    >
                        <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                        onClick={() => setMobileOpen(false)}
                        className="lg:hidden ml-auto text-white/60 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setMobileOpen(false)}
                            className={({ isActive }) => navLinkClass(isActive)}
                        >
                            <item.icon className="w-5 h-5 shrink-0" />
                            {!collapsed && <span className="truncate">{item.label}</span>}
                        </NavLink>
                    ))}
                </nav>

                {/* User info */}
                <div className={`p-4 border-t border-white/10 ${collapsed ? 'text-center' : ''}`}>
                    <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                        <div className="w-9 h-9 rounded-full bg-[#F5A623]/20 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-[#F5A623]" />
                        </div>
                        {!collapsed && (
                            <div className="min-w-0 flex-1">
                                <p className="text-white text-sm font-bold truncate">{user?.nombre} {user?.apellido}</p>
                                <p className="text-blue-200/80 text-[11px] truncate mb-1.5">{user?.email}</p>
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${user?.tipoUsuario === 'admin' ? 'bg-purple-500/20 text-purple-200 ring-1 ring-inset ring-purple-500/30' :
                                    user?.tipoUsuario === 'residente_obra' ? 'bg-blue-500/20 text-blue-200 ring-1 ring-inset ring-blue-500/30' :
                                        user?.tipoUsuario === 'director_obra' ? 'bg-amber-500/20 text-amber-200 ring-1 ring-inset ring-amber-500/30' :
                                            user?.tipoUsuario === 'director_obra_general' ? 'bg-orange-500/20 text-orange-200 ring-1 ring-inset ring-orange-500/30' :
                                                user?.tipoUsuario === 'supervisor_tecnico' ? 'bg-indigo-500/20 text-indigo-200 ring-1 ring-inset ring-indigo-500/30' :
                                                    'bg-green-500/20 text-green-200 ring-1 ring-inset ring-green-500/30'
                                    }`}>
                                    {user?.tipoUsuario === 'admin' ? 'Administrador' :
                                        user?.tipoUsuario === 'residente_obra' ? 'Residente de Obra' :
                                            user?.tipoUsuario === 'director_obra' ? 'Director de Obra' :
                                                user?.tipoUsuario === 'director_obra_general' ? 'Director General' :
                                                    user?.tipoUsuario === 'supervisor_tecnico' ? 'Supervisor Técnico' : 'Interventoría'}
                                </span>
                            </div>
                        )}
                    </div>
                    {!collapsed && (
                        <button
                            onClick={() => setShowChangePwd(true)}
                            className="mt-2 flex items-center gap-2 text-blue-200/60 hover:text-blue-200 text-xs transition-colors w-full"
                        >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Cambiar contraseña</span>
                        </button>
                    )}
                    <button
                        onClick={handleLogout}
                        className={`mt-2 flex items-center gap-2 text-red-300/80 hover:text-red-300 text-sm transition-colors w-full ${collapsed ? 'justify-center mt-3' : ''}`}
                    >
                        <LogOut className="w-4 h-4" />
                        {!collapsed && <span>Cerrar sesión</span>}
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top bar */}
                <header className="bg-white border-b border-border px-6 py-4 flex items-center gap-4 shadow-sm sticky top-0 z-30">
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="flex-1 flex items-center justify-end gap-6">
                        {/* Weather Widget */}
                        <div className="hidden sm:flex items-center gap-2 text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            {weather ? (
                                <>
                                    {getWeatherIcon(weather.code, "w-4 h-4 text-emerald-600")}
                                    <span className="text-sm font-bold">{Math.round(weather.temp)}°C</span>
                                </>
                            ) : (
                                <span className="text-xs text-slate-400 font-medium animate-pulse">Cargando clima...</span>
                            )}
                        </div>

                        {/* Clock Widget */}
                        <div className="flex items-center gap-2 text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 font-mono font-bold text-sm tracking-tight shadow-inner">
                            <Clock className="w-4 h-4 text-primary" />
                            {time.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })} <span className="text-slate-400 font-normal mx-0.5">|</span> {time.toLocaleTimeString('es-CO', { hour12: false })}
                        </div>

                        {/* Project Selector / Indicator */}
                        <div className="flex items-center gap-2 border-l border-slate-200 pl-6">
                            <Building2 className="w-5 h-5 text-slate-400" />
                            {isMultiProject ? (
                                /* Multi-project selector — hidden when SINGLE_PROJECT_MODE is true */
                                <select
                                    value={selectedProjectId || ''}
                                    onChange={(e) => setSelectedProjectId(e.target.value)}
                                    className="bg-transparent border-none text-sm font-extrabold text-slate-800 focus:ring-0 cursor-pointer outline-none w-48 truncate"
                                    title="Seleccionar Proyecto Activo"
                                >
                                    {proyectos.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.nombre} {p.abreviatura ? `(${p.abreviatura})` : ''}</option>
                                    ))}
                                    {user?.tipoUsuario === 'admin' && proyectos.length === 0 && (
                                        <option value="" disabled>Sin proyectos asignados</option>
                                    )}
                                </select>
                            ) : (
                                <span className="text-sm font-extrabold text-slate-800 w-48 truncate block">
                                    {activeProject?.nombre || proyectos[0]?.nombre || 'Sin proyecto'}
                                </span>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 p-6 overflow-auto">
                    <Outlet />
                </main>
            </div>

            {/* Change password modal */}
            {showChangePwd && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                                <KeyRound className="w-4 h-4 text-primary" /> Cambiar contraseña
                            </h2>
                            <button onClick={closePwdModal} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                <X className="w-4 h-4 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Current password */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Contraseña actual</label>
                                <div className="relative">
                                    <input
                                        type={showCurrent ? 'text' : 'password'}
                                        value={pwdCurrent}
                                        onChange={e => setPwdCurrent(e.target.value)}
                                        className="w-full px-3 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        placeholder="••••••••"
                                    />
                                    <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            {/* New password */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Nueva contraseña</label>
                                <div className="relative">
                                    <input
                                        type={showNew ? 'text' : 'password'}
                                        value={pwdNew}
                                        onChange={e => setPwdNew(e.target.value)}
                                        className="w-full px-3 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        placeholder="Mínimo 6 caracteres"
                                    />
                                    <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            {/* Confirm */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Confirmar nueva contraseña</label>
                                <input
                                    type="password"
                                    value={pwdConfirm}
                                    onChange={e => setPwdConfirm(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleChangePwd()}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    placeholder="Repite la nueva contraseña"
                                />
                            </div>
                            {pwdMsg && (
                                <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg ${pwdMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                                    {pwdMsg.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
                                    {pwdMsg.text}
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 px-6 pb-5">
                            <button onClick={closePwdModal} className="px-5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={handleChangePwd}
                                disabled={pwdLoading || !pwdCurrent || !pwdNew || !pwdConfirm}
                                className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold shadow-sm disabled:opacity-50 disabled:pointer-events-none transition-all"
                            >
                                {pwdLoading ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
