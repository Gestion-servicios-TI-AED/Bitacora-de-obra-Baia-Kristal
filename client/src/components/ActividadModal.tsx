import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { X, Camera, Upload, CheckCircle2, Users, Clock3 } from 'lucide-react';

interface Props {
    torreId: string;
    onClose: () => void;
    onSave: (actividad: any) => void;
    initialData?: any;
}

export default function ActividadModal({ torreId, onClose, onSave, initialData }: Props) {
    const isEditing = !!initialData;
    const [esVisita, setEsVisita] = useState(initialData?.esVisita ?? false);

    // Actividad fields
    const [actividadEjecutada, setActividadEjecutada] = useState(initialData?.actividadEjecutada ?? '');
    const [porcentajeCompletado, setPorcentajeCompletado] = useState(initialData?.porcentajeCompletado ?? 50);
    const [contratistaId, setContratistaId] = useState(initialData?.contratistaId ?? '');
    const [contratistaNombre, setContratistaNombre] = useState(initialData?.contratistaNombre ?? '');
    const [trabajadoresEnObra, setTrabajadoresEnObra] = useState(initialData?.trabajadoresEnObra?.toString() ?? '');
    const [horasTrabajadas, setHorasTrabajadas] = useState(initialData?.horasTrabajadas?.toString() ?? '');
    const [climaManana, setClimaManana] = useState(initialData?.climaManana ?? '');
    const [climaTarde, setClimaTarde] = useState(initialData?.climaTarde ?? '');
    const [foto1, setFoto1] = useState<File | null>(initialData?.foto1 ?? null);
    const [foto2, setFoto2] = useState<File | null>(initialData?.foto2 ?? null);
    const [notasGenerales, setNotasGenerales] = useState(initialData?.notasGenerales ?? '');

    // Visita fields
    const [descripcionVisita, setDescripcionVisita] = useState(initialData?.descripcionVisita ?? '');
    const [numeroPersonasVisita, setNumeroPersonasVisita] = useState(initialData?.numeroPersonasVisita?.toString() ?? '');
    const [duracionVisita, setDuracionVisita] = useState(initialData?.duracionVisita?.toString() ?? '');

    const { data: torre } = useQuery({
        queryKey: ['torre', torreId],
        queryFn: async () => {
            const res = await api.get(`/torres/${torreId}`);
            return res.data;
        },
        enabled: !!torreId,
    });

    const { data: contratistas = [] } = useQuery({
        queryKey: ['contratistas', torre?.proyectoId],
        queryFn: async () => {
            const res = await api.get(`/contratistas?proyecto_id=${torre.proyectoId}`);
            return res.data;
        },
        enabled: !!torre?.proyectoId,
    });

    const climaOptions = [
        { value: 'soleado', label: '☀️ Soleado' },
        { value: 'nublado', label: '☁️ Nublado' },
        { value: 'lluvia', label: '🌧️ Lluvia' },
        { value: 'tormenta_electrica', label: '⚡ Tormenta Eléctrica' },
    ];

    const isValidActividad = actividadEjecutada && contratistaId && trabajadoresEnObra && horasTrabajadas &&
        parseInt(horasTrabajadas) >= 1 && parseInt(horasTrabajadas) <= 8 &&
        climaManana && climaTarde && foto1 && foto2 && notasGenerales;

    const isValidVisita = descripcionVisita.trim() &&
        numeroPersonasVisita && parseInt(numeroPersonasVisita) >= 1 &&
        duracionVisita && parseInt(duracionVisita) >= 1;

    const isValid = esVisita ? isValidVisita : isValidActividad;

    const handleSave = () => {
        if (!isValid) return;
        if (esVisita) {
            onSave({
                esVisita: true,
                descripcionVisita,
                numeroPersonasVisita: parseInt(numeroPersonasVisita),
                duracionVisita: parseInt(duracionVisita),
                foto1,
                foto2,
            });
        } else {
            onSave({
                esVisita: false,
                actividadEjecutada,
                porcentajeCompletado,
                contratistaId,
                contratistaNombre,
                trabajadoresEnObra: parseInt(trabajadoresEnObra),
                horasTrabajadas: parseInt(horasTrabajadas),
                climaManana,
                climaTarde,
                foto1,
                foto2,
                notasGenerales,
            });
        }
        onClose();
    };

    const handleContratistaChange = (id: string) => {
        setContratistaId(id);
        const c = contratistas.find((c: any) => c.id === id);
        setContratistaNombre(c?.nombre || '');
    };

    const handleToggleVisita = (val: boolean) => {
        setEsVisita(val);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn border border-slate-200">
                {/* Header */}
                <div className={`border-b px-6 py-4 flex items-center justify-between shrink-0 transition-colors ${esVisita ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                    <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${esVisita ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'}`}>
                            {esVisita ? '🏛️' : '📝'}
                        </span>
                        {isEditing
                            ? (esVisita ? 'Editar Visita' : 'Editar Actividad')
                            : (esVisita ? 'Registro de Visita' : 'Registro de Actividad')}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors group">
                        <X className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5 form-custom-scroll">

                    {/* Toggle visita — prominente, antes de todo */}
                    <div
                        onClick={() => !isEditing && handleToggleVisita(!esVisita)}
                        className={`select-none flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${isEditing ? 'opacity-50 pointer-events-none' : 'cursor-pointer'} ${
                            esVisita
                                ? 'bg-amber-50 border-amber-400 shadow-md shadow-amber-100'
                                : 'bg-slate-50 border-slate-200 hover:border-amber-300 hover:bg-amber-50/40'
                        }`}
                    >
                        <div className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${esVisita ? 'bg-amber-500' : 'bg-slate-300'}`}>
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${esVisita ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </div>
                        <div className="flex-1">
                            <p className={`font-bold text-sm ${esVisita ? 'text-amber-800' : 'text-slate-700'}`}>
                                Registrar visita de autoridades o tercero
                            </p>
                            <p className={`text-xs mt-0.5 ${esVisita ? 'text-amber-600' : 'text-slate-500'}`}>
                                {esVisita
                                    ? 'Modo visita activo — se registrará como visita institucional'
                                    : 'Activa esta opción si se trata de una visita en lugar de una actividad de obra'}
                            </p>
                        </div>
                        {esVisita && (
                            <span className="shrink-0 px-2.5 py-1 bg-amber-500 text-white text-[10px] font-black rounded-full uppercase tracking-widest">
                                Visita
                            </span>
                        )}
                    </div>

                    {/* ─── MODO VISITA ─── */}
                    {esVisita && (
                        <div className="bg-amber-50/60 rounded-xl border border-amber-200 p-5 space-y-5 animate-fadeIn">
                            <h3 className="text-[13px] font-bold uppercase tracking-wider text-amber-700 mb-1 border-b border-amber-200 pb-2 flex items-center gap-2">
                                <span>🏛️</span> Datos de la Visita
                            </h3>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Descripción de la visita <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    value={descripcionVisita}
                                    onChange={(e) => setDescripcionVisita(e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/40 focus:border-amber-400 resize-none transition-all placeholder-slate-400"
                                    placeholder="Describa el propósito de la visita, entidad representada, observaciones realizadas, compromisos adquiridos..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                                        <Users className="w-4 h-4 text-amber-600" />
                                        N.° de personas <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="1"
                                            value={numeroPersonasVisita}
                                            onChange={(e) => setNumeroPersonasVisita(e.target.value)}
                                            className="w-full pl-4 pr-16 py-3 bg-white border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/40 focus:border-amber-400 font-semibold text-slate-700"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase tracking-widest pointer-events-none">Pers.</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                                        <Clock3 className="w-4 h-4 text-amber-600" />
                                        Duración (minutos) <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="1"
                                            value={duracionVisita}
                                            onChange={(e) => setDuracionVisita(e.target.value)}
                                            className="w-full pl-4 pr-14 py-3 bg-white border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/40 focus:border-amber-400 font-semibold text-slate-700"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase tracking-widest pointer-events-none">Min.</span>
                                    </div>
                                </div>
                            </div>

                            {/* Fotos opcionales para visita */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                                    <Camera className="w-4 h-4 text-amber-600" />
                                    Evidencia fotográfica <span className="text-xs font-normal text-slate-400">(opcional)</span>
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    {[{ state: foto1, setter: setFoto1, label: 'Foto 1' }, { state: foto2, setter: setFoto2, label: 'Foto 2' }].map(({ state, setter, label }) => (
                                        <label key={label} className={`flex flex-col items-center justify-center gap-2 px-4 py-5 bg-white border-2 border-dashed rounded-xl cursor-pointer hover:bg-amber-50/60 transition-all ${state ? 'border-emerald-400 bg-emerald-50/30' : 'border-amber-200 hover:border-amber-400'}`}>
                                            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setter(e.target.files?.[0] || null)} className="hidden" />
                                            {state ? (
                                                <div className="text-center">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-1.5"><CheckCircle2 className="w-5 h-5" /></div>
                                                    <span className="text-xs text-emerald-700 font-bold max-w-[120px] truncate block px-2" title={state.name}>{state.name}</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center text-amber-400">
                                                    <Camera className="w-5 h-5 mb-1" />
                                                    <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
                                                </div>
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── MODO ACTIVIDAD ─── */}
                    {!esVisita && (
                        <>
                            {/* Block: Actividad y Estado */}
                            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
                                <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-500 mb-1 border-b border-slate-100 pb-2">Identificación de la Tarea/Actividad</h3>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Descripción ejecutiva de la actividad <span className="text-rose-500">*</span></label>
                                    <textarea
                                        value={actividadEjecutada}
                                        onChange={(e) => setActividadEjecutada(e.target.value)}
                                        rows={2}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-all placeholder-slate-400"
                                        placeholder="Ej: Fundida de placa entrepiso torre 1, nivel 4..."
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-bold text-slate-700">Progreso físico de la tarea</label>
                                        <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black ring-1 ring-inset ring-primary/20">{porcentajeCompletado}% Ejecutado</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="100"
                                        value={porcentajeCompletado}
                                        onChange={(e) => setPorcentajeCompletado(parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                    <div className="flex justify-between text-[11px] font-semibold text-slate-400 mt-1.5 px-1 uppercase tracking-wider">
                                        <span>Inicio</span>
                                        <span>Mitad</span>
                                        <span>Cierre</span>
                                    </div>
                                </div>
                            </div>

                            {/* Block: Recursos Asignados */}
                            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
                                <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-500 mb-1 border-b border-slate-100 pb-2">Recursos Asignados</h3>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Contratista Ejecutor <span className="text-rose-500">*</span></label>
                                    <select
                                        value={contratistaId}
                                        onChange={(e) => handleContratistaChange(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-700"
                                    >
                                        <option value="" className="text-slate-400">Seleccionar entidad ejecutora...</option>
                                        {contratistas.map((c: any) => (
                                            <option key={c.id} value={c.id}>{c.nombre}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Mano de Obra <span className="text-rose-500">*</span></label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="1"
                                                value={trabajadoresEnObra}
                                                onChange={(e) => setTrabajadoresEnObra(e.target.value)}
                                                className="w-full pl-4 pr-16 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold text-slate-700"
                                                placeholder="0"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase tracking-widest pointer-events-none">Pers.</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Tiempo Efectivo (1-8) <span className="text-rose-500">*</span></label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="1"
                                                max="8"
                                                value={horasTrabajadas}
                                                onChange={(e) => {
                                                    const v = parseInt(e.target.value);
                                                    setHorasTrabajadas(isNaN(v) ? e.target.value : String(Math.min(v, 8)));
                                                }}
                                                className="w-full pl-4 pr-16 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold text-slate-700"
                                                placeholder="0"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase tracking-widest pointer-events-none">Hrs.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Block: Condiciones y Anexos */}
                            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
                                <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-500 mb-1 border-b border-slate-100 pb-2">Condiciones y Soportes Visuales</h3>

                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-[13px] font-bold text-slate-700 mb-2">Reporte de Clima AM <span className="text-rose-500">*</span></label>
                                        <select value={climaManana} onChange={(e) => setClimaManana(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-700 font-medium">
                                            <option value="">-- Seleccionar --</option>
                                            {climaOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-bold text-slate-700 mb-2">Reporte de Clima PM <span className="text-rose-500">*</span></label>
                                        <select value={climaTarde} onChange={(e) => setClimaTarde(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-700 font-medium">
                                            <option value="">-- Seleccionar --</option>
                                            {climaOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-5">
                                    {[{ state: foto1, setter: setFoto1, label: 'Toma Fotográfica 1' }, { state: foto2, setter: setFoto2, label: 'Toma Fotográfica 2' }].map(({ state, setter, label }) => (
                                        <div key={label}>
                                            <label className="block text-[13px] font-bold text-slate-700 mb-2">{label} <span className="text-rose-500">*</span></label>
                                            <label className={`flex flex-col items-center justify-center gap-2 px-4 py-6 bg-slate-50 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-100 transition-all ${state ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-300 hover:border-slate-400 group'}`}>
                                                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setter(e.target.files?.[0] || null)} className="hidden" />
                                                {state ? (
                                                    <div className="text-center">
                                                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2"><CheckCircle2 className="w-5 h-5" /></div>
                                                        <span className="text-xs text-emerald-700 font-bold max-w-[120px] truncate block px-2" title={state.name}>{state.name}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center text-slate-400 group-hover:text-primary transition-colors">
                                                        <div className="p-3 bg-white rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform"><Camera className="w-5 h-5" /></div>
                                                        <span className="text-xs font-bold uppercase tracking-wider">Adjuntar Archivo</span>
                                                    </div>
                                                )}
                                            </label>
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Anotaciones Específicas de la Actividad <span className="text-rose-500">*</span></label>
                                    <textarea
                                        value={notasGenerales}
                                        onChange={(e) => setNotasGenerales(e.target.value)}
                                        rows={2}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-all placeholder-slate-400"
                                        placeholder="Escriba aquí los detalles sobre el suministro de equipo, control de calidad, etc..."
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className={`border-t px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 ${esVisita ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-xs font-semibold text-slate-500">
                        {isValid
                            ? <span className="text-emerald-600 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Validación pre-ingreso satisfactoria.</span>
                            : <span className="text-rose-500 flex items-center gap-1.5"><X className="w-4 h-4" /> Rellene todos los datos obligatorios.</span>}
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                            Descartar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!isValid}
                            className={`flex-1 sm:flex-none px-6 py-2.5 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none disabled:transform-none flex items-center justify-center gap-2 ${esVisita ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-primary/95'}`}
                        >
                            {isEditing ? <><Upload className="w-4 h-4" /> Guardar Cambios</> : esVisita ? <><Users className="w-4 h-4" /> Registrar Visita</> : <><Upload className="w-4 h-4" /> Registrar Actividad</>}
                        </button>
                    </div>
                </div>
            </div>
            <style>{`
                .form-custom-scroll::-webkit-scrollbar { width: 6px; }
                .form-custom-scroll::-webkit-scrollbar-track { background: transparent; }
                .form-custom-scroll::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
            `}</style>
        </div>
    );
}
