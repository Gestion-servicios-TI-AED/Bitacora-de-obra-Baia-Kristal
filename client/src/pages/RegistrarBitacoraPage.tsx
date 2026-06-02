import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useProjectStore } from '../stores/projectStore';
import api from '../lib/api';
import ActividadModal from '../components/ActividadModal';
import FirmaDigital from '../components/FirmaDigital';
import {
    AlertTriangle, CheckCircle2, XCircle,
    Plus, Trash2, Edit, Calendar, Hash, ClipboardList, PenTool, Shield,
    Lightbulb, AlertCircle, FlaskConical, Image as ImageIcon, Bookmark
} from 'lucide-react';
import EnsayoModal from '../components/EnsayoModal';

const estadoObraOptions = [
    { value: 'avanzada', label: 'Avanzada', lightColor: 'bg-emerald-50 text-emerald-700 border-emerald-200', activeRing: 'ring-emerald-500/50', icon: '🟢' },
    { value: 'normal', label: 'Normal', lightColor: 'bg-blue-50 text-blue-700 border-blue-200', activeRing: 'ring-blue-500/50', icon: '🔵' },
    { value: 'retrasada', label: 'Retrasada', lightColor: 'bg-amber-50 text-amber-700 border-amber-200', activeRing: 'ring-amber-500/50', icon: '🟡' },
    { value: 'detenida', label: 'Detenida', lightColor: 'bg-rose-50 text-rose-700 border-rose-200', activeRing: 'ring-rose-500/50', icon: '🔴' },
];

const climaIcons: Record<string, string> = {
    soleado: '☀️', nublado: '☁️', lluvia: '🌧️', tormenta_electrica: '⚡'
};

export default function RegistrarBitacoraPage() {
    const { user } = useAuthStore();
    const { selectedProjectId } = useProjectStore();
    const [searchParams] = useSearchParams();
    const fechaParam = searchParams.get('fecha');
    const isRetroactive = !!fechaParam;
    const [torreId, setTorreId] = useState('');
    const [estadoObra, setEstadoObra] = useState('');
    const [diaLaborable, setDiaLaborable] = useState<boolean | null>(null);
    const [razonNoLaboral, setRazonNoLaboral] = useState('');
    const [explicacionNoLaboral, setExplicacionNoLaboral] = useState('');
    const [actividades, setActividades] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [torreBlocked, setTorreBlocked] = useState(false);
    const [folio, setFolio] = useState<number | null>(null);
    const [signed, setSigned] = useState(false);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [notasGeneralesBitacora, setNotasGeneralesBitacora] = useState('');
    
    // New fields
    const [ordenesImpartidas, setOrdenesImpartidas] = useState('');
    const [cambiosAprobados, setCambiosAprobados] = useState('');
    const [coordinacionesTecnicas, setCoordinacionesTecnicas] = useState('');
    const [accidentesFallas, setAccidentesFallas] = useState('');
    const [fotoAccidente, setFotoAccidente] = useState<File | null>(null);
    const [reclamosComunidad, setReclamosComunidad] = useState('');
    
    // Ensayos
    const [ensayos, setEnsayos] = useState<any[]>([]);
    const [showEnsayoModal, setShowEnsayoModal] = useState(false);
    const [editingEnsayoIdx, setEditingEnsayoIdx] = useState<number | null>(null);

    // Draft
    const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
    const [draftMsg, setDraftMsg] = useState('');

    // Obtener la fecha de hoy usando la zona horaria local, no UTC (toISOString falla tarde en la noche por el offset)
    const today = new Date();
    const localTodayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Use retroactive date if provided, otherwise local today
    const targetDate = fechaParam || localTodayStr;

    // Fetch user's assigned towers
    const { data: allTorres = [] } = useQuery({
        queryKey: ['userTorres'],
        queryFn: async () => {
            const res = await api.get('/auth/me');
            return res.data.usuarioTorres?.map((ut: any) => ({
                ...ut.torre,
                proyectoNombre: ut.torre.proyecto?.nombre,
            })) || [];
        },
    });

    const torres = allTorres.filter((t: any) => t.proyectoId === selectedProjectId);

    const getDraftKey = (tid: string, date: string) => `borrador_bitacora_${tid}_${date}`;

    const saveDraft = () => {
        if (!torreId) return;
        const draft = {
            savedAt: new Date().toISOString(),
            estadoObra,
            diaLaborable,
            razonNoLaboral,
            explicacionNoLaboral,
            actividades: actividades.map(({ foto1, foto2, ...rest }: any) => rest),
            notasGeneralesBitacora,
            ordenesImpartidas,
            cambiosAprobados,
            coordinacionesTecnicas,
            accidentesFallas,
            reclamosComunidad,
            ensayos: ensayos.map(({ anexoFoto, ...rest }: any) => rest),
        };
        localStorage.setItem(getDraftKey(torreId, targetDate), JSON.stringify(draft));
        setDraftSavedAt(draft.savedAt);
        setDraftMsg('Borrador guardado correctamente');
        setTimeout(() => setDraftMsg(''), 3000);
    };

    const clearDraft = () => {
        if (torreId) localStorage.removeItem(getDraftKey(torreId, targetDate));
        setDraftSavedAt(null);
    };

    // Check if tower has existing registration
    const checkTorre = useCallback(async (id: string) => {
        if (!id) return;
        try {
            const res = await api.get(`/bitacoras/check/${id}/${targetDate}`);
            if (res.data.exists) {
                setTorreBlocked(true);
            } else {
                setTorreBlocked(false);
                const folioRes = await api.get(`/folios/siguiente?torre_id=${id}&fecha=${targetDate}`);
                setFolio(folioRes.data.folio);
                // Auto-load draft if one exists for this frente + date
                const saved = localStorage.getItem(`borrador_bitacora_${id}_${targetDate}`);
                if (saved) {
                    try {
                        const draft = JSON.parse(saved);
                        setEstadoObra(draft.estadoObra || '');
                        setDiaLaborable(draft.diaLaborable ?? null);
                        setRazonNoLaboral(draft.razonNoLaboral || '');
                        setExplicacionNoLaboral(draft.explicacionNoLaboral || '');
                        setActividades(draft.actividades || []);
                        setNotasGeneralesBitacora(draft.notasGeneralesBitacora || '');
                        setOrdenesImpartidas(draft.ordenesImpartidas || '');
                        setCambiosAprobados(draft.cambiosAprobados || '');
                        setCoordinacionesTecnicas(draft.coordinacionesTecnicas || '');
                        setAccidentesFallas(draft.accidentesFallas || '');
                        setReclamosComunidad(draft.reclamosComunidad || '');
                        setEnsayos(draft.ensayos || []);
                        setDraftSavedAt(draft.savedAt);
                    } catch { /* borrador corrupto, ignorar */ }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }, [targetDate]);

    useEffect(() => {
        if (torreId) checkTorre(torreId);
        else { setTorreBlocked(false); setFolio(null); }
    }, [torreId, checkTorre]);

    const selectedTorre = torres.find((t: any) => t.id === torreId);

    // Save bitacora
    const handleSave = async () => {
        if (diaLaborable && actividades.length === 0) return;
        setSaving(true);
        try {
            // 1. Create bitacora
            const bitRes = await api.post('/bitacoras', {
                torreId,
                estadoObra: estadoObra || null,
                diaLaborable,
                razonNoLaboral: diaLaborable ? null : razonNoLaboral,
                explicacionNoLaboral: diaLaborable ? null : explicacionNoLaboral,
                fechaRegistro: isRetroactive ? targetDate : undefined,
                notasGenerales: notasGeneralesBitacora,
                ordenesImpartidas,
                cambiosAprobados,
                coordinacionesTecnicas,
                accidentesFallas,
                reclamosComunidad,
            });
            const bitacoraId = bitRes.data.id;

            // 2. Upload actividades, ensayos y foto de incidente en paralelo
            const uploads: Promise<any>[] = [];

            if (fotoAccidente) {
                const incData = new FormData();
                incData.append('fotoAccidente', fotoAccidente);
                uploads.push(api.patch(`/bitacoras/${bitacoraId}/foto-accidente`, incData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                }));
            }

            for (const act of actividades) {
                const formData = new FormData();
                formData.append('bitacoraId', bitacoraId);
                formData.append('esVisita', act.esVisita ? 'true' : 'false');
                if (act.esVisita) {
                    formData.append('descripcionVisita', act.descripcionVisita);
                    formData.append('numeroPersonasVisita', act.numeroPersonasVisita.toString());
                    formData.append('duracionVisita', act.duracionVisita.toString());
                } else {
                    formData.append('actividadEjecutada', act.actividadEjecutada);
                    formData.append('porcentajeCompletado', act.porcentajeCompletado.toString());
                    formData.append('contratistaId', act.contratistaId);
                    formData.append('trabajadoresEnObra', act.trabajadoresEnObra.toString());
                    formData.append('horasTrabajadas', act.horasTrabajadas.toString());
                    formData.append('climaManana', act.climaManana);
                    formData.append('climaTarde', act.climaTarde);
                    formData.append('notasGenerales', act.notasGenerales);
                }
                if (act.foto1) formData.append('foto1', act.foto1);
                if (act.foto2) formData.append('foto2', act.foto2);
                uploads.push(api.post('/actividades', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                }));
            }

            for (const ens of ensayos) {
                const formData = new FormData();
                formData.append('bitacoraId', bitacoraId);
                formData.append('ensayoRealizado', ens.ensayoRealizado);
                formData.append('anexoFoto', ens.anexoFoto);
                uploads.push(api.post('/ensayos', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                }));
            }

            await Promise.all(uploads);

            // 3. Sign if checked (only residents sign here; directors sign from the detail page)
            if (signed && user?.tipoUsuario === 'residente_obra') {
                await api.patch(`/bitacoras/${bitacoraId}/firma-residente`);
            }


            // Clear draft on successful save
            localStorage.removeItem(getDraftKey(torreId, targetDate));
            setDraftSavedAt(null);

            setSuccessMsg('¡Bitácora registrada exitosamente al folio correspondiente!');
            // Reset form
            setTimeout(() => {
                setTorreId(''); setEstadoObra(''); setDiaLaborable(null);
                setRazonNoLaboral(''); setExplicacionNoLaboral('');
                setActividades([]); setSigned(false);
                setSuccessMsg(''); setNotasGeneralesBitacora('');
                setOrdenesImpartidas(''); setCambiosAprobados(''); setCoordinacionesTecnicas('');
                setAccidentesFallas(''); setFotoAccidente(null); setReclamosComunidad('');
                setEnsayos([]);
            }, 4000);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const addActividad = (act: any) => {
        setActividades([...actividades, act]);
    };
    const removeActividad = (index: number) => {
        setActividades(actividades.filter((_, i) => i !== index));
    };

    const canSave = torreId && !torreBlocked && signed && estadoObra && (
        (diaLaborable === false && razonNoLaboral && explicacionNoLaboral) ||
        (diaLaborable === true && notasGeneralesBitacora.trim() && actividades.length > 0)
    );

    if (user?.tipoUsuario === 'interventoria' || user?.tipoUsuario === 'supervisor_tecnico') {
        return (
            <div className="max-w-xl mx-auto mt-16 animate-fadeIn px-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-10 text-center">
                    <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-slate-800 mb-2">Acceso restringido</h2>
                    <p className="text-sm text-slate-500">Los usuarios con rol de interventoría o supervisión técnica no están habilitados para registrar bitácoras. Solo puede avalar las ya diligenciadas.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto animate-fadeIn px-2 sm:px-0">

            {/* Loading overlay */}
            {saving && (
                <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 border border-slate-200 max-w-xs w-full mx-4">
                        <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
                        <div className="text-center">
                            <p className="text-base font-bold text-slate-800">Registrando folio...</p>
                            <p className="text-xs text-slate-500 mt-1">Subiendo actividades y fotos</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Success message */}
            {successMsg && (
                <div className="mb-6 flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-4 rounded-xl animate-scaleIn shadow-sm">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span className="font-medium text-sm">{successMsg}</span>
                    </div>
                </div>
            )}

            {/* Retroactive banner */}
            {isRetroactive && (
                <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-xl animate-fadeIn shadow-sm">
                    <Calendar className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                        <p className="font-semibold text-sm">Registro retroactivo activo</p>
                        <p className="text-xs">Registrando informe correspondiente al {new Date(targetDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.</p>
                    </div>
                </div>
            )}

            {/* Sticky Header card with Glassmorphism */}
            <div className="sticky top-6 z-20 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/60 p-5 mb-8 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                            <PenTool className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight leading-tight">Registrar Nuevo Informe</h1>
                            <p className="text-sm text-slate-500 mt-0.5">Complete la información de su turno en la bitácora</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        {folio && selectedTorre ? (
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                                <Hash className="w-4 h-4 text-slate-500" />
                                <span className="font-bold text-slate-700 tracking-wide">
                                    {(selectedTorre.proyecto?.abreviatura && selectedTorre.abreviatura)
                                        ? `${selectedTorre.proyecto.abreviatura}-${selectedTorre.abreviatura}-${String(folio).padStart(3, '0')}`
                                        : folio}
                                </span>
                            </div>
                        ) : null}
                        <div className="flex items-center gap-2 text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                            <Calendar className="w-4 h-4" />
                            <span className="font-medium text-[13px] capitalize">{new Date(targetDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                        </div>
                    </div>
                </div>

                {selectedTorre && (
                    <div className="mt-4 pt-3.5 border-t border-slate-200/60 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">Proyecto:</span>
                            <span className="font-semibold text-slate-800">{selectedTorre.proyectoNombre}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">Torre Asignada:</span>
                            <span className="font-semibold text-slate-800">{selectedTorre.nombre}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Torre selection */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6">
                <label className="flex items-center gap-2 text-[15px] font-semibold text-slate-800 mb-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs shrink-0">1</span>
                    Seleccione la Torre de Origen
                </label>
                <select
                    value={torreId}
                    onChange={(e) => setTorreId(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-700 font-medium"
                >
                    <option value="" className="text-slate-400">Seleccionar la torre donde se realizó el trabajo...</option>
                    {torres.map((t: any) => (
                        <option key={t.id} value={t.id}>
                            {t.proyectoNombre} — {t.nombre}
                        </option>
                    ))}
                </select>

                {torreBlocked && (
                    <div className="mt-4 flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl animate-fadeIn">
                        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium">Esta torre ya cuenta con un registro para el día seleccionado. Un folio no puede ser modificado tras su firma. Seleccione otra torre para continuar.</p>
                    </div>
                )}
            </div>

            {torreId && !torreBlocked && (
                <>
                    {draftSavedAt && (
                        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl mb-6 animate-fadeIn">
                            <Bookmark className="w-5 h-5 text-amber-600 shrink-0" />
                            <p className="text-sm font-medium flex-1">
                                Borrador cargado — guardado el {new Date(draftSavedAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <button
                                onClick={clearDraft}
                                title="Borrar borrador"
                                className="p-1.5 rounded-lg text-amber-600 hover:text-amber-900 hover:bg-amber-100 transition-colors shrink-0"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    {/* Estado de obra */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6 animate-fadeIn">
                        <label className="flex items-center gap-2 text-[15px] font-semibold text-slate-800 mb-4">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs shrink-0">2</span>
                            Condición General de la Obra <span className="text-rose-500 ml-0.5">*</span>
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {estadoObraOptions.map((opt) => {
                                const isSelected = estadoObra === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => setEstadoObra(opt.value)}
                                        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all duration-200 transform hover:-translate-y-0.5 ${isSelected
                                            ? `${opt.lightColor} shadow-sm ring-2 ${opt.activeRing}`
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm'
                                            }`}
                                    >
                                        <span className="text-2xl drop-shadow-sm">{opt.icon}</span>
                                        <span>{opt.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {estadoObra && (<>
                    {/* Día laborable */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6 animate-fadeIn">
                        <label className="flex items-center gap-2 text-[15px] font-semibold text-slate-800 mb-4">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs shrink-0">3</span>
                            ¿Hubo jornada laboral activa el día de hoy?
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                                onClick={() => { setDiaLaborable(true); setRazonNoLaboral(''); setExplicacionNoLaboral(''); }}
                                className={`flex items-center justify-center gap-3 py-4 rounded-xl border-2 text-[15px] font-bold transition-all duration-200 ${diaLaborable === true
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md shadow-emerald-100'
                                    : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50/50'
                                    }`}
                            >
                                <CheckCircle2 className={`w-6 h-6 ${diaLaborable === true ? 'text-emerald-600' : 'text-slate-400'}`} />
                                SÍ, JORNADA ACTIVA
                            </button>
                            <button
                                onClick={() => { setDiaLaborable(false); setActividades([]); }}
                                className={`flex items-center justify-center gap-3 py-4 rounded-xl border-2 text-[15px] font-bold transition-all duration-200 ${diaLaborable === false
                                    ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-md shadow-rose-100'
                                    : 'border-slate-200 text-slate-500 hover:border-rose-300 hover:bg-rose-50/50'
                                    }`}
                            >
                                <XCircle className={`w-6 h-6 ${diaLaborable === false ? 'text-rose-600' : 'text-slate-400'}`} />
                                NO, SITIO CERRADO
                            </button>
                        </div>
                    </div>

                    {/* Flow A: No laboral */}
                    {diaLaborable === false && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6 animate-fadeIn">
                            <label className="block text-sm font-semibold text-slate-800 mb-3">Especificación de Cierre</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                                {[
                                    { value: 'domingo', label: '📅 Descanso (Domingo)' },
                                    { value: 'festivo', label: '🎉 Feriado Nacional' },
                                    { value: 'otro', label: '💬 Causa Extraordinaria' },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setRazonNoLaboral(opt.value)}
                                        className={`py-3.5 px-4 rounded-xl border-2 text-sm font-medium transition-all ${razonNoLaboral === opt.value
                                            ? 'border-primary bg-primary/5 text-primary shadow-sm'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-primary/30 hover:bg-slate-50'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {razonNoLaboral && (
                                <div className="animate-fadeIn p-4 border border-slate-100 bg-slate-50 rounded-xl rounded-tl-none">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Describa textualmente las novedades o contexto del cierre (obligatorio)</label>
                                    <textarea
                                        value={explicacionNoLaboral}
                                        onChange={(e) => setExplicacionNoLaboral(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none shadow-sm"
                                        placeholder="Bitácora registrada en estado no laboral, justificación..."
                                        required
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    {/* Section 4: Desglose de Actividades */}
                    {diaLaborable === true && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6 animate-fadeIn">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                                <label className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs shrink-0">4</span>
                                    Desglose de Actividades Ejecutadas
                                </label>
                                <button
                                    onClick={() => setShowModal(true)}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium shadow-sm hover:bg-primary/95 hover:shadow transition-all group"
                                >
                                    <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    Añadir Actividad
                                </button>
                            </div>

                            {actividades.length === 0 ? (
                                <div className="text-center py-10 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                    <ClipboardList className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                                    <p className="text-sm font-medium text-slate-600">No hay tareas documentadas.</p>
                                    <p className="text-xs mt-1 text-slate-500">Debe registrar al menos una actividad ejecutada para cerrar el folio de hoy.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {actividades.map((act, idx) => (
                                        act.esVisita ? (
                                            /* ── TARJETA VISITA ── */
                                            <div key={idx} className="bg-amber-50 border border-amber-300 rounded-xl shadow-sm overflow-hidden">
                                                <div className="p-4 sm:p-5">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex-1 pr-4">
                                                            <div className="flex items-center gap-2 mb-1.5">
                                                                <span className="text-xs text-amber-700 font-bold tracking-wider uppercase flex items-center gap-1">🏛️ Visita #{idx + 1}</span>
                                                                <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-200 text-amber-800 ring-1 ring-inset ring-amber-400/30">Terceros / Autoridades</span>
                                                            </div>
                                                            <p className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2">{act.descripcionVisita}</p>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button onClick={() => { setEditingIdx(idx); setShowModal(true); }} className="text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors p-1.5 rounded-lg" title="Editar visita">
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => removeActividad(idx)} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors p-1.5 rounded-lg" title="Eliminar registro">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 text-[13px] bg-amber-100/60 rounded-lg p-3 border border-amber-200">
                                                        <div>
                                                            <span className="text-amber-700 block text-xs mb-0.5 font-bold">Personas en visita:</span>
                                                            <span className="font-semibold text-slate-700">{act.numeroPersonasVisita} persona{act.numeroPersonasVisita !== 1 ? 's' : ''}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-amber-700 block text-xs mb-0.5 font-bold">Duración:</span>
                                                            <span className="font-semibold text-slate-700">
                                                                {act.duracionVisita >= 60
                                                                    ? `${Math.floor(act.duracionVisita / 60)}h ${act.duracionVisita % 60 > 0 ? `${act.duracionVisita % 60}min` : ''}`
                                                                    : `${act.duracionVisita} min`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {(act.foto1 || act.foto2) && (
                                                        <div className="mt-3 pt-3 border-t border-amber-200">
                                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                                                {act.foto1 && (
                                                                    <figure className="relative rounded-xl overflow-hidden border border-amber-200 shadow-sm bg-amber-100">
                                                                        <img src={URL.createObjectURL(act.foto1)} className="w-full h-24 object-cover" />
                                                                        <figcaption className="absolute bottom-1 left-1 text-[9px] font-bold bg-amber-900/70 text-white px-1.5 rounded">FOTO 1</figcaption>
                                                                    </figure>
                                                                )}
                                                                {act.foto2 && (
                                                                    <figure className="relative rounded-xl overflow-hidden border border-amber-200 shadow-sm bg-amber-100">
                                                                        <img src={URL.createObjectURL(act.foto2)} className="w-full h-24 object-cover" />
                                                                        <figcaption className="absolute bottom-1 left-1 text-[9px] font-bold bg-amber-900/70 text-white px-1.5 rounded">FOTO 2</figcaption>
                                                                    </figure>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                        /* ── TARJETA ACTIVIDAD ── */
                                        <div key={idx} className="bg-white border border-slate-200/80 rounded-xl shadow-sm hover:border-primary/30 transition-colors overflow-hidden">
                                            <div className="p-4 sm:p-5">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex-1 pr-4">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <span className="text-xs text-slate-500 font-bold tracking-wider uppercase">Actividad #{idx + 1}</span>
                                                            <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20">{act.porcentajeCompletado}% Ejecución</span>
                                                        </div>
                                                        <p className="font-semibold text-slate-800 text-sm leading-snug">{act.actividadEjecutada}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button onClick={() => { setEditingIdx(idx); setShowModal(true); }} className="text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors p-1.5 rounded-lg" title="Editar actividad">
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => removeActividad(idx)} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors p-1.5 rounded-lg" title="Eliminar registro">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-[13px] bg-slate-50/80 rounded-lg p-3 border border-slate-100">
                                                    <div>
                                                        <span className="text-slate-500 block text-xs mb-0.5">Asignado a:</span>
                                                        <span className="font-semibold text-slate-700">{act.contratistaNombre}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500 block text-xs mb-0.5">Mano de Obra:</span>
                                                        <span className="font-semibold text-slate-700">{act.trabajadoresEnObra} personal</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500 block text-xs mb-0.5">Tiempo Efectivo:</span>
                                                        <span className="font-semibold text-slate-700">{act.horasTrabajadas} hrs</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500 block text-xs mb-0.5">Clima Registrado:</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span title="Mañana" className="bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm text-sm">{climaIcons[act.climaManana]}</span>
                                                            <span className="text-slate-300">/</span>
                                                            <span title="Tarde" className="bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm text-sm">{climaIcons[act.climaTarde]}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {act.notasGenerales && (
                                                    <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                                                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-0.5">Anotaciones específicas</span>
                                                        <p className="text-xs text-slate-700 leading-snug">{act.notasGenerales}</p>
                                                    </div>
                                                )}
                                                {(act.foto1 || act.foto2) && (
                                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                                            {act.foto1 && (
                                                                <figure className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
                                                                    <img src={URL.createObjectURL(act.foto1)} className="w-full h-24 object-cover" />
                                                                    <figcaption className="absolute bottom-1 left-1 text-[9px] font-bold bg-slate-900/60 text-white px-1.5 rounded">FOTO 1</figcaption>
                                                                </figure>
                                                            )}
                                                            {act.foto2 && (
                                                                <figure className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
                                                                    <img src={URL.createObjectURL(act.foto2)} className="w-full h-24 object-cover" />
                                                                    <figcaption className="absolute bottom-1 left-1 text-[9px] font-bold bg-slate-900/60 text-white px-1.5 rounded">FOTO 2</figcaption>
                                                                </figure>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        )
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Section 5: Instrucciones o Decisiones */}
                    {diaLaborable && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6 animate-fadeIn">
                            <label className="flex items-center gap-2 text-[15px] font-semibold text-slate-800 mb-4">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs shrink-0">5</span>
                                <Lightbulb className="w-5 h-5 text-amber-500" />
                                Instrucciones o Decisiones
                            </label>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Órdenes impartidas</label>
                                    <textarea
                                        value={ordenesImpartidas}
                                        onChange={(e) => setOrdenesImpartidas(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none placeholder-slate-400"
                                        placeholder="Describa las órdenes dadas al personal o contratistas..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Cambios aprobados en diseño o materiales (con justificación)</label>
                                    <textarea
                                        value={cambiosAprobados}
                                        onChange={(e) => setCambiosAprobados(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none placeholder-slate-400"
                                        placeholder="Documente cualquier cambio técnico aprobado y su porqué..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Coordinaciones técnicas</label>
                                    <textarea
                                        value={coordinacionesTecnicas}
                                        onChange={(e) => setCoordinacionesTecnicas(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none placeholder-slate-400"
                                        placeholder="Coordinaciones con especialistas, interventoría o proveedores..."
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section 6: Incidentes o Novedades */}
                    {diaLaborable && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6 animate-fadeIn">
                            <label className="flex items-center gap-2 text-[15px] font-semibold text-slate-800 mb-4">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs shrink-0">6</span>
                                <AlertCircle className="w-5 h-5 text-rose-500" />
                                Incidentes o Novedades
                            </label>
                            
                            <div className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Accidentes de trabajo o fallas técnicas</label>
                                        <textarea
                                            value={accidentesFallas}
                                            onChange={(e) => setAccidentesFallas(e.target.value)}
                                            rows={3}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none placeholder-slate-400"
                                            placeholder="Detalle cualquier accidente laboral o falla en equipos críticos..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Soporte (Opcional)</label>
                                        <label className={`flex flex-col items-center justify-center p-4 h-[108px] bg-slate-50 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-100 transition-all ${fotoAccidente ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-300'}`}>
                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => setFotoAccidente(e.target.files?.[0] || null)} />
                                            {fotoAccidente ? (
                                                <div className="text-center overflow-hidden">
                                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                                                    <span className="text-[10px] font-bold text-emerald-700 truncate block px-2 w-full">{fotoAccidente.name}</span>
                                                </div>
                                            ) : (
                                                <div className="text-center text-slate-400">
                                                    <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
                                                    <span className="text-[10px] font-bold uppercase tracking-wider">Foto</span>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Reclamos o inquietudes de la comunidad</label>
                                    <textarea
                                        value={reclamosComunidad}
                                        onChange={(e) => setReclamosComunidad(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none placeholder-slate-400"
                                        placeholder="Peticiones, quejas o reclamos de vecinos o la comunidad local..."
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section 7: Gestión de Calidad (Ensayos) */}
                    {diaLaborable && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6 animate-fadeIn">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                                <label className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs shrink-0">7</span>
                                    <FlaskConical className="w-5 h-5 text-indigo-500" />
                                    Gestión de Calidad (Ensayos)
                                </label>
                                <button
                                    onClick={() => { setEditingEnsayoIdx(null); setShowEnsayoModal(true); }}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-indigo-700 transition-all group"
                                >
                                    <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    Registrar Ensayo
                                </button>
                            </div>

                            {ensayos.length === 0 ? (
                                <div className="text-center py-8 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                    <FlaskConical className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                    <p className="text-sm font-medium text-slate-500">No se han registrado ensayos de calidad para hoy.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {ensayos.map((ens, idx) => (
                                        <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-4">
                                            <div className="flex gap-4">
                                                <div className="w-16 h-16 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-slate-300">
                                                    {ens.anexoFoto
                                                        ? <img src={URL.createObjectURL(ens.anexoFoto)} className="w-full h-full object-cover" />
                                                        : <FlaskConical className="w-7 h-7" />}
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-1">Ensayo #{idx+1}</span>
                                                    <p className="text-sm font-semibold text-slate-800 line-clamp-2">{ens.ensayoRealizado}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => { setEditingEnsayoIdx(idx); setShowEnsayoModal(true); }}
                                                    className="text-slate-400 hover:text-primary hover:bg-primary/5 p-1.5 rounded-lg transition-colors"
                                                    title="Editar ensayo"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setEnsayos(ensayos.filter((_, i) => i !== idx))}
                                                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
                                                    title="Eliminar ensayo"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notas generales de la bitácora */}
                    {diaLaborable !== null && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6 animate-fadeIn">
                            <div className="mb-3 flex items-center justify-between">
                                <label className="text-[15px] font-semibold text-slate-800">Notas Generales y Directrices</label>
                                {diaLaborable === true && <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded ring-1 ring-inset ring-rose-200">Requerido</span>}
                            </div>
                            <textarea
                                value={notasGeneralesBitacora}
                                onChange={(e) => setNotasGeneralesBitacora(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none placeholder-slate-400"
                                placeholder="Escriba aquí los comentarios globales del día, decisiones de comité, material recibido de importancia, entre otras novedades de la obra que no estén asociadas a una actividad."
                            />
                            {diaLaborable === true && !notasGeneralesBitacora.trim() && (
                                <p className="text-xs text-rose-500 mt-1.5 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> El folio requiere poseer comentarios globales de la residencia.</p>
                            )}
                        </div>
                    )}

                    {/* Signatures section - Document blocks */}
                    {diaLaborable !== null && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6 animate-fadeIn">
                            <h3 className="text-[15px] font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <Shield className="w-5 h-5 text-primary" />
                                Protocolo de Legalidad y Firmas
                            </h3>
                            <p className="text-sm text-slate-500 mb-5">Las firmas digitales estamparán la fecha, hora e IP en el hash transaccional del sistema, asegurando la trazabilidad.</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                <FirmaDigital
                                    title="Firma Diligenciador"
                                    user={user}
                                    enabled={true}
                                    signed={signed}
                                    onSign={(val) => setSigned(val)}
                                />
                                <FirmaDigital title="Firma del Director de Obra" user={null} enabled={false} signed={false} onSign={() => { }} />
                                <FirmaDigital title="Firma del Supervisor" user={null} enabled={false} signed={false} onSign={() => { }} />
                            </div>
                        </div>
                    )}

                    {/* Save Action Block container */}
                    {diaLaborable !== null && (
                        <div className="flex flex-col sm:flex-row justify-end items-center gap-4 bg-slate-50 border border-slate-200/80 p-5 rounded-2xl shadow-inner mb-8 mt-2">
                            {draftMsg ? (
                                <span className="text-sm text-emerald-600 font-semibold mr-auto flex items-center gap-1.5 animate-fadeIn">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" /> {draftMsg}
                                </span>
                            ) : !canSave && (
                                <span className="text-sm text-slate-500 font-medium mr-auto hidden md:block">
                                    Por favor complete todos los campos requeridos y estampe su firma.
                                </span>
                            )}
                            <button
                                onClick={saveDraft}
                                className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                <Bookmark className="w-5 h-5" />
                                {draftSavedAt ? 'Actualizar Borrador' : 'Guardar Borrador'}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!canSave || saving}
                                className={`w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-bold shadow-md transition-all duration-200 flex items-center justify-center gap-2 ${!canSave
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-primary hover:bg-primary/95 text-white hover:shadow-lg hover:-translate-y-0.5'
                                    }`}
                            >
                                {saving ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Asegurando Folio...
                                    </>
                                ) : (
                                    <>
                                        <Shield className="w-5 h-5" />
                                        Sellar y Registrar Folio
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                    </>)}
                </>
            )}

            {/* Modal for new activity */}
            {showModal && (
                <ActividadModal
                    torreId={torreId}
                    initialData={editingIdx !== null ? actividades[editingIdx] : undefined}
                    onClose={() => { setShowModal(false); setEditingIdx(null); }}
                    onSave={(act) => {
                        if (editingIdx !== null) {
                            setActividades(actividades.map((a, i) => i === editingIdx ? act : a));
                            setEditingIdx(null);
                        } else {
                            addActividad(act);
                        }
                        setShowModal(false);
                    }}
                />
            )}

            {/* Modal for new/edit quality test (ensayo) */}
            {showEnsayoModal && (
                <EnsayoModal
                    initialData={editingEnsayoIdx !== null ? ensayos[editingEnsayoIdx] : undefined}
                    onClose={() => { setShowEnsayoModal(false); setEditingEnsayoIdx(null); }}
                    onSave={(ens) => {
                        if (editingEnsayoIdx !== null) {
                            setEnsayos(ensayos.map((e, i) => i === editingEnsayoIdx ? ens : e));
                            setEditingEnsayoIdx(null);
                        } else {
                            setEnsayos([...ensayos, ens]);
                        }
                        setShowEnsayoModal(false);
                    }}
                />
            )}
        </div>
    );
}

