import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Eye, X, Clock } from 'lucide-react';

const estadoBadge: Record<string, { label: string; class: string }> = {
    nuevo: { label: 'Nuevo', class: 'bg-gray-100 text-gray-600' },
    pendiente_director: { label: 'Pend. Director', class: 'bg-amber-100 text-amber-700' },
    pendiente_interventor: { label: 'Pend. Interventor', class: 'bg-orange-100 text-orange-700' },
    pendiente_ambos: { label: 'Pend. Ambas', class: 'bg-red-100 text-red-700' },
    completado: { label: 'Completado', class: 'bg-green-100 text-green-700' },
};

interface Props {
    bitacoras: any[];
    festivos: any[];
    torreFilter: string;
    userRole?: string | undefined;
    onNavigate: (id: string) => void;
    onRegisterRetroactive?: (fecha: string) => void;
}

export default function CalendarView({ bitacoras, festivos, userRole, onNavigate, onRegisterRetroactive }: Props) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [popoverDate, setPopoverDate] = useState<string | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    // Close popover on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setPopoverDate(null);
            }
        };
        if (popoverDate) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [popoverDate]);

    const festivoSet = useMemo(() => {
        const set = new Set<string>();
        festivos.forEach((f: any) => set.add(f.fecha));
        return set;
    }, [festivos]);

    const bitacoraMap = useMemo(() => {
        const map = new Map<string, any>();
        bitacoras.forEach((b: any) => {
            if (!map.has(b.fechaRegistro)) map.set(b.fechaRegistro, []);
            map.get(b.fechaRegistro).push(b);
        });
        return map;
    }, [bitacoras]);

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const prev = () => { setCurrentDate(new Date(year, month - 1, 1)); setPopoverDate(null); };
    const next = () => { setCurrentDate(new Date(year, month + 1, 1)); setPopoverDate(null); };

    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <button onClick={prev} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h2 className="text-lg font-bold text-gray-900">
                    {monthNames[month]} {year}
                </h2>
                <button onClick={next} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map((d) => (
                    <div key={d} className="text-center text-xs font-semibold text-text-secondary py-2">
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
                {days.map((day, idx) => {
                    if (day === null) return <div key={`empty-${idx}`} className="h-24" />;

                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayOfWeek = new Date(year, month, day).getDay();
                    const isSunday = dayOfWeek === 0;
                    const isFestivo = festivoSet.has(dateStr);
                    const registros = bitacoraMap.get(dateStr) || [];
                    const hasRegistro = registros.length > 0;
                    const hasRetroactive = registros.some((b: any) => {
                        if (!b.createdAt) return false;
                        const createdDate = new Date(b.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
                        return createdDate > b.fechaRegistro;
                    });
                    const today = new Date();
                    const localTodayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                    const isToday = dateStr === localTodayStr;
                    const isPast = new Date(dateStr) < new Date(localTodayStr);
                    const isPrivilegedUser = userRole === 'director_obra_general' || userRole === 'admin';
                    const canRegisterRetroactive = isPast && (
                        (!hasRegistro && (isSunday || isFestivo)) || isPrivilegedUser
                    );
                    const isPopoverOpen = popoverDate === dateStr;

                    let bgColor = '';
                    if (hasRegistro) {
                        bgColor = 'bg-green-100/80 border-green-200 hover:bg-green-100';
                    } else if (canRegisterRetroactive) {
                        bgColor = 'bg-amber-50/80 border-amber-300 hover:bg-amber-100 hover:border-amber-400 hover:shadow-md';
                    } else if (isSunday || isFestivo) {
                        bgColor = 'bg-gray-50 border-gray-200';
                    } else if (isPast) {
                        bgColor = 'bg-red-50/50 border-red-200/50';
                    } else {
                        bgColor = 'bg-white border-gray-200 hover:bg-gray-50';
                    }

                    const handleClick = () => {
                        if (hasRegistro) {
                            if (registros.length === 1 && !isPrivilegedUser) {
                                onNavigate(registros[0].id);
                            } else {
                                setPopoverDate(isPopoverOpen ? null : dateStr);
                            }
                        } else if (canRegisterRetroactive && onRegisterRetroactive) {
                            onRegisterRetroactive(dateStr);
                        }
                    };

                    return (
                        <div
                            key={day}
                            className={`h-24 p-2 rounded-xl border ${bgColor} transition-all cursor-pointer relative ${isToday ? 'ring-2 ring-primary/40' : ''} ${isPopoverOpen ? 'ring-2 ring-primary z-20' : ''}`}
                            onClick={handleClick}
                            title={canRegisterRetroactive && !hasRegistro ? 'Clic para registrar bitácora de este día' : hasRegistro ? 'Clic para ver detalles/registros' : undefined}
                        >
                            <div className="flex items-center justify-between">
                                <span className={`text-sm font-medium ${isToday ? 'text-primary font-bold' : isSunday ? 'text-red-400' : 'text-gray-700'}`}>
                                    {day}
                                </span>
                                <div className="flex items-center gap-0.5">
                                    {hasRetroactive && <span title="Contiene registro retroactivo"><Clock className="w-3 h-3 text-amber-500" /></span>}
                                    {isFestivo && <span className="text-xs">🎉</span>}
                                    {isSunday && !isFestivo && <span className="text-xs text-gray-400">Dom</span>}
                                </div>
                            </div>
                            {hasRegistro && (
                                <div className="mt-1 space-y-0.5">
                                    {registros.slice(0, 2).map((r: any, i: number) => {
                                        const isRetro = r.createdAt && new Date(r.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) > r.fechaRegistro;
                                        return (
                                            <div key={i} className={`flex items-center gap-1 text-[10px] font-medium truncate leading-tight ${isRetro ? 'text-amber-700' : 'text-green-700'}`}>
                                                {isRetro && <Clock className="w-2.5 h-2.5 shrink-0" />}
                                                <span className="truncate">
                                                    {(r.proyecto?.abreviatura && r.torre?.abreviatura)
                                                        ? `${r.proyecto.abreviatura}-${r.torre.abreviatura}-${String(r.numeroFolio).padStart(3, '0')}`
                                                        : `#${r.numeroFolio}`} {r.torre?.nombre?.replace('ETAPA 3 - ', '')}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {registros.length > 2 && (
                                        <div className="text-[10px] text-green-600">+{registros.length - 2} más</div>
                                    )}
                                </div>
                            )}
                            {canRegisterRetroactive && !hasRegistro && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center mt-2">
                                        <Plus className="w-4 h-4 text-amber-700" />
                                    </div>
                                    <span className="text-[9px] font-semibold text-amber-700 mt-0.5">Registrar</span>
                                </div>
                            )}

                            {/* Popover for multiple registrations or adding new ones */}
                            {isPopoverOpen && hasRegistro && (
                                <div
                                    ref={popoverRef}
                                    className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-72 bg-white rounded-xl shadow-2xl border border-border z-50 animate-scaleIn overflow-hidden"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-border">
                                        <span className="text-xs font-semibold text-gray-700">
                                            {registros.length} registros — {new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                        </span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setPopoverDate(null); }}
                                            className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5 text-gray-400" />
                                        </button>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        {registros.map((r: any) => {
                                            const isRetro = r.createdAt && new Date(r.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) > r.fechaRegistro;
                                            return (
                                            <button
                                                key={r.id}
                                                onClick={(e) => { e.stopPropagation(); setPopoverDate(null); onNavigate(r.id); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary/5 transition-colors border-b border-border/50 last:border-b-0 text-left"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-primary">{(r.proyecto?.abreviatura && r.torre?.abreviatura)
                                                            ? `${r.proyecto.abreviatura}-${r.torre.abreviatura}-${String(r.numeroFolio).padStart(3, '0')}`
                                                            : `#${r.numeroFolio}`}</span>
                                                        <span className="text-xs font-medium text-gray-800 truncate">{r.torre?.nombre}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold ${estadoBadge[r.estadoDiligencia]?.class || 'bg-gray-100 text-gray-600'}`}>
                                                            {estadoBadge[r.estadoDiligencia]?.label || r.estadoDiligencia}
                                                        </span>
                                                        {isRetro && (
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-700">
                                                                <Clock className="w-2.5 h-2.5" /> Retroactivo
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] text-text-light truncate">{r.creadoPor?.nombre} {r.creadoPor?.apellido}</span>
                                                    </div>
                                                </div>
                                                <Eye className="w-3.5 h-3.5 text-primary/50 shrink-0" />
                                            </button>
                                            );
                                        })}
                                    </div>

                                    {isPrivilegedUser && isPast && (
                                        <div className="p-3 border-t border-border bg-gray-50 flex justify-center">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setPopoverDate(null); onRegisterRetroactive?.(dateStr); }}
                                                className="w-full py-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm"
                                            >
                                                <Plus className="w-4 h-4" /> Registrar Folio Adicional
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-4 text-xs text-text-secondary">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-green-100 border border-green-200"></div>
                    Con registro
                </div>
                <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-amber-500" />
                    Registro retroactivo
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-red-50 border border-red-200/50"></div>
                    Sin registro (pasado)
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-gray-50 border border-gray-200"></div>
                    Domingo / Festivo
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-amber-50 border border-amber-300"></div>
                    Domingo/Festivo registrable
                </div>
            </div>
        </div>
    );
}
