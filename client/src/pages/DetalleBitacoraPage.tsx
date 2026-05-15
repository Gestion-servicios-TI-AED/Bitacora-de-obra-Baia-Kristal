import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import FirmaDigital from '../components/FirmaDigital';
import { useState, useRef } from 'react';
import {
    ArrowLeft, Building2, Calendar, Hash, Clock,
    CheckCircle2, X, ZoomIn, Shield, FileDown, MapPin, Briefcase, User, HardHat,
    Lightbulb, AlertCircle, FlaskConical, Edit, Trash2, AlertTriangle
} from 'lucide-react';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

const estadoBadge: Record<string, { label: string; class: string }> = {
    nuevo: { label: 'Nuevo Informe', class: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/20' },
    pendiente_director: { label: 'Pendiente Aval Director', class: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' },
    pendiente_interventor: { label: 'Pendiente Aval Interventor', class: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' },
    pendiente_ambos: { label: 'Pendiente Avales', class: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20' },
    completado: { label: 'Folio Sellado', class: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' },
};

const climaIcons: Record<string, string> = {
    soleado: '☀️ Soleado', nublado: '☁️ Nublado', lluvia: '🌧️ Lluvia', tormenta_electrica: '⚡ Tormenta'
};

export default function DetalleBitacoraPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [signing, setSigning] = useState(false);
    const [signSuccess, setSignSuccess] = useState('');
    const [lightboxImg, setLightboxImg] = useState<string | null>(null);
    const pdfRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const [comentariosDirector, setComentariosDirector] = useState('');
    const [comentariosInterventor, setComentariosInterventor] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);

    const [editingActivity, setEditingActivity] = useState<any | null>(null);
    const [editForm, setEditForm] = useState<any>({});
    const startEditActivity = (act: any) => {
        setEditForm({
            actividadEjecutada: act.actividadEjecutada ?? '',
            porcentajeCompletado: act.porcentajeCompletado ?? 50,
            contratistaId: act.contratistaId ?? '',
            trabajadoresEnObra: act.trabajadoresEnObra ?? 1,
            horasTrabajadas: act.horasTrabajadas ?? 1,
            climaManana: act.climaManana ?? 'soleado',
            climaTarde: act.climaTarde ?? 'soleado',
            notasGenerales: act.notasGenerales ?? '',
            foto1: null as File | null,
            foto2: null as File | null,
        });
        setEditingActivity(act);
    };

    const editMutation = useMutation({
        mutationFn: async () => {
            const fd = new FormData();
            fd.append('actividadEjecutada', editForm.actividadEjecutada);
            fd.append('porcentajeCompletado', String(editForm.porcentajeCompletado));
            fd.append('contratistaId', editForm.contratistaId ?? '');
            fd.append('trabajadoresEnObra', String(editForm.trabajadoresEnObra));
            fd.append('horasTrabajadas', String(editForm.horasTrabajadas));
            fd.append('climaManana', editForm.climaManana);
            fd.append('climaTarde', editForm.climaTarde);
            fd.append('notasGenerales', editForm.notasGenerales);
            if (editForm.foto1) fd.append('foto1', editForm.foto1);
            if (editForm.foto2) fd.append('foto2', editForm.foto2);
            return (await api.put(`/actividades/${editingActivity.id}`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })).data;
        },
        onSuccess: (updated: any) => {
            queryClient.setQueryData(['bitacora', id], (old: any) => ({
                ...old,
                actividades: old.actividades.map((a: any) => a.id === updated.id ? updated : a),
            }));
            setEditingActivity(null);
            setSignSuccess('Actividad actualizada correctamente.');
            setTimeout(() => setSignSuccess(''), 3000);
        },
        onError: (err: any) => alert(err.response?.data?.error || 'Error al guardar'),
    });

    const { data: bitacora, isLoading } = useQuery({
        queryKey: ['bitacora', id],
        queryFn: async () => (await api.get(`/bitacoras/${id}`)).data,
        enabled: !!id,
    });

    const canEditActividades = user?.tipoUsuario === 'admin' ||
        ((user?.tipoUsuario === 'director_obra' || user?.tipoUsuario === 'director_obra_general') && !bitacora?.firmaDirectorData);

    const { data: contratistasParaEditar = [] } = useQuery({
        queryKey: ['contratistas', bitacora?.proyectoId],
        queryFn: async () => (await api.get(`/contratistas?proyecto_id=${bitacora.proyectoId}`)).data,
        enabled: !!bitacora?.proyectoId && !!editingActivity,
    });

    const signMutation = useMutation({
        mutationFn: async ({ type, body }: { type: string; body?: any }) => {
            return (await api.patch(`/bitacoras/${id}/firma-${type}`, body ?? {})).data;
        },
        onSuccess: (data) => {
            queryClient.setQueryData(['bitacora', id], data);
            queryClient.invalidateQueries({ queryKey: ['bitacoras'] });
            setSignSuccess('Firma digital estampada exitosamente. El folio ha sido actualizado.');
            setTimeout(() => setSignSuccess(''), 4000);
        },
        onError: (err: any) => {
            alert(err.response?.data?.error || 'Error de validación al firmar el documento.');
        },
    });

    const handleSign = async (type: string) => {
        setSigning(true);
        try {
            const body = type === 'director'
                ? { comentariosDirector }
                : type === 'interventor'
                ? { comentariosInterventor }
                : undefined;
            await signMutation.mutateAsync({ type, body });
        } finally {
            setSigning(false);
        }
    };

    const deleteMutation = useMutation({
        mutationFn: async () => (await api.delete(`/bitacoras/${id}`)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bitacoras'] });
            navigate('/bitacoras');
        },
        onError: (err: any) => alert(err.response?.data?.error || 'Error al eliminar la bitácora'),
    });

    const handleDownloadPdf = async () => {
        if (!pdfRef.current || !bitacora) return;
        setIsGeneratingPdf(true);
        try {
            const fileName = `Bitacora_${bitacora.proyecto?.abreviatura || 'PRJ'}_${bitacora.torre?.abreviatura || 'TR'}_${String(bitacora.numeroFolio).padStart(3, '0')}.pdf`;

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const contentWidth = pdfWidth - (margin * 2);
            let currentY = margin;

            const blocks = pdfRef.current.querySelectorAll('.pdf-block');
            if (blocks.length === 0) throw new Error("No hay bloques para renderizar");

            for (let i = 0; i < blocks.length; i++) {
                const block = blocks[i] as HTMLElement;
                const dataUrl = await toJpeg(block, {
                    quality: 0.95,
                    pixelRatio: 2,
                    backgroundColor: '#ffffff',
                    style: { margin: '0', transform: 'none' }
                });

                const img = new Image();
                img.src = dataUrl;
                await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

                const imgWidth = contentWidth;
                const imgHeight = (img.height * imgWidth) / img.width;

                if (currentY + imgHeight > pageHeight - margin && i > 0) {
                    pdf.addPage();
                    currentY = margin;
                }
                pdf.addImage(dataUrl, 'JPEG', margin, currentY, imgWidth, imgHeight);
                currentY += imgHeight + 6;
            }
            pdf.save(fileName);
        } catch (error: any) {
            console.error('Error generando PDF:', error);
            alert(`Ocurrió un error al generar el documento PDF: ${error.message || error}`);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
                <p className="mt-4 text-sm font-medium text-slate-500">Recuperando folio digital...</p>
            </div>
        );
    }

    if (!bitacora) {
        return (
            <div className="text-center py-20 px-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-slate-500 font-medium">El folio solicitado no se encuentra en el índice.</p>
                <button
                    onClick={() => navigate('/bitacoras')}
                    className="mt-4 px-6 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 transition-colors"
                >
                    Volver al Archivo
                </button>
            </div>
        );
    }

    const isAdminOwner = user?.tipoUsuario === 'admin' && bitacora.creadoPorUsuarioId === user?.id;
    const canSignDirector = ((user?.tipoUsuario === 'director_obra' || user?.tipoUsuario === 'director_obra_general') || isAdminOwner) && !bitacora.firmaDirectorData;
    const canSignInterventor = ((user?.tipoUsuario === 'interventoria' || user?.tipoUsuario === 'director_obra_general' || user?.tipoUsuario === 'supervisor_tecnico') || isAdminOwner) && !bitacora.firmaInterventorData && !!bitacora.firmaDirectorData;

    const directorAsignado = bitacora.torre?.usuarioTorres?.find(
        (ut: any) => ut.usuario?.tipoUsuario === 'director_obra'
    )?.usuario;

    const directorGeneralAsignado = bitacora.torre?.usuarioTorres?.find(
        (ut: any) => ut.usuario?.tipoUsuario === 'director_obra_general'
    )?.usuario;

    const interventorAsignado = bitacora.torre?.usuarioTorres?.find(
        (ut: any) => ut.usuario?.tipoUsuario === 'interventoria' || ut.usuario?.tipoUsuario === 'supervisor_tecnico'
    )?.usuario;

    const residentesAsignados: any[] = (bitacora.torre?.usuarioTorres ?? [])
        .filter((ut: any) => ut.usuario?.tipoUsuario === 'residente_obra')
        .map((ut: any) => ut.usuario);

    return (
        <div className="max-w-5xl mx-auto animate-fadeIn px-2 sm:px-0 pb-10">
            {/* Lightbox */}
            {lightboxImg && (
                <div
                    className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
                    onClick={() => setLightboxImg(null)}
                >
                    <button
                        className="absolute top-6 right-6 p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                        onClick={() => setLightboxImg(null)}
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img
                        src={lightboxImg}
                        alt="Evidencia fotográfica a resolución completa"
                        className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl ring-1 ring-white/20"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Top bar */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={() => navigate('/bitacoras')}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors group"
                >
                    <span className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-slate-200 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                    </span>
                    Volver al Archivo
                </button>
                <div className="flex items-center gap-2">
                    {user?.tipoUsuario === 'admin' && !confirmDelete && (
                        <button
                            onClick={() => setConfirmDelete(true)}
                            className="flex items-center gap-2 text-sm font-semibold bg-white border border-rose-200 text-rose-600 px-3 py-1.5 rounded-xl hover:bg-rose-50 transition-all shadow-sm active:scale-95"
                        >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                        </button>
                    )}
                    {confirmDelete && (
                        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl shadow-sm animate-fadeIn">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span className="text-xs font-semibold text-rose-700">¿Eliminar este folio?</span>
                            <button
                                onClick={() => deleteMutation.mutate()}
                                disabled={deleteMutation.isPending}
                                className="px-3 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors"
                            >
                                {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                            </button>
                            <button
                                onClick={() => setConfirmDelete(false)}
                                className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    )}
                    <button
                        onClick={handleDownloadPdf}
                        disabled={isGeneratingPdf}
                        className="flex items-center gap-2 text-sm font-semibold bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl hover:bg-slate-50 hover:text-primary transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {isGeneratingPdf ? (
                            <div className="w-4 h-4 border-2 border-slate-300 border-t-primary rounded-full animate-spin"></div>
                        ) : (
                            <FileDown className="w-4 h-4" />
                        )}
                        {isGeneratingPdf ? 'Exportando...' : 'Descargar PDF'}
                    </button>
                </div>
            </div>

            {/* Success notification */}
            {signSuccess && (
                <div className="mb-4 flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl animate-scaleIn shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-medium text-sm">{signSuccess}</span>
                </div>
            )}

            <div ref={pdfRef} className="bg-slate-50 sm:bg-transparent -mx-2 sm:mx-0 px-2 sm:px-0 pb-2">

                {/* ── Header ── */}
                <header className="pdf-block bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 md:p-5 mb-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-[80px] pointer-events-none"></div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm shadow-primary/20 shrink-0">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">Acta de Bitácora</h1>
                                <p className="text-sm font-medium text-slate-500">{bitacora.proyecto?.nombre}</p>
                            </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide shadow-sm ${estadoBadge[bitacora.estadoDiligencia]?.class}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
                            {estadoBadge[bitacora.estadoDiligencia]?.label}
                        </span>
                    </div>

                    {/* Key fields */}
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm bg-slate-50/70 rounded-xl p-3 border border-slate-100">
                        <div>
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Folio</span>
                            <div className="flex items-center gap-1 text-slate-900 font-bold text-sm">
                                <Hash className="w-3.5 h-3.5 text-slate-400" />
                                {(bitacora.proyecto?.abreviatura && bitacora.torre?.abreviatura)
                                    ? <span className="text-primary">{`${bitacora.proyecto.abreviatura}-${bitacora.torre.abreviatura}-${String(bitacora.numeroFolio).padStart(3, '0')}`}</span>
                                    : <span className="text-slate-700">#{bitacora.numeroFolio}</span>
                                }
                            </div>
                        </div>
                        <div>
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Fecha del Turno</span>
                            <div className="flex items-center gap-1 text-slate-900 font-bold text-sm">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {new Date(bitacora.fechaRegistro + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                        </div>
                        <div>
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Cierre Digital</span>
                            <div className="flex items-center gap-1 text-slate-900 font-bold text-sm">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {new Date(bitacora.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                <span className="text-slate-400 font-normal">·</span>
                                {bitacora.horaRegistro}
                            </div>
                        </div>
                        <div>
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Torre / Zona</span>
                            <span className="font-bold text-slate-900 text-sm line-clamp-1">{bitacora.torre?.nombre}</span>
                        </div>
                    </div>

                    {/* Info cards */}
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                        <div className="flex gap-2 items-start p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/60 hover:bg-slate-50 transition-colors border-l-4 border-l-primary/60">
                            <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Localización</span>
                                <span className="font-semibold text-slate-700 text-xs">{bitacora.proyecto?.direccion || 'No especificada'}</span>
                            </div>
                        </div>
                        <div className="flex gap-2 items-start p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/60 hover:bg-slate-50 transition-colors">
                            <Briefcase className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Empresa Contratante</span>
                                <span className="font-semibold text-slate-700 text-xs line-clamp-1">{bitacora.proyecto?.empresaContratante?.nombre || 'No asignada'}</span>
                            </div>
                        </div>
                        <div className="flex gap-2 items-start p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/60 hover:bg-slate-50 transition-colors">
                            <HardHat className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Director de Obra</span>
                                <span className="font-semibold text-slate-700 text-xs">{directorAsignado ? `${directorAsignado.nombre} ${directorAsignado.apellido}` : 'No asignado'}</span>
                            </div>
                        </div>
                        <div className="flex gap-2 items-start p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/60 hover:bg-slate-50 transition-colors">
                            <HardHat className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Director General de Obra</span>
                                <span className="font-semibold text-slate-700 text-xs">{directorGeneralAsignado ? `${directorGeneralAsignado.nombre} ${directorGeneralAsignado.apellido}` : 'No asignado'}</span>
                            </div>
                        </div>
                        <div className="flex gap-2 items-start p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/60 hover:bg-slate-50 transition-colors">
                            <User className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Residente de Obra</span>
                                {residentesAsignados.length > 0 ? (
                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                        {residentesAsignados.map((r: any) => (
                                            <span key={r.id} className="font-semibold text-slate-700 text-xs inline-flex items-center gap-1.5">
                                                {r.nombre} {r.apellido}
                                                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex justify-center text-[9px] leading-tight font-bold flex-col items-center shrink-0">{r.nombre?.charAt(0)}{r.apellido?.charAt(0)}</span>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="font-semibold text-slate-400 text-xs italic">No asignado</span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2 items-start p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/60 hover:bg-slate-50 transition-colors">
                            <Shield className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Supervisión Técnica</span>
                                <span className="font-semibold text-slate-700 text-xs">
                                    {bitacora.firmaInterventorData
                                        ? (JSON.parse(bitacora.firmaInterventorData)?.empresa || interventorAsignado?.empresaInterventoria?.nombre || 'No especificada')
                                        : (bitacora.proyecto?.empresaInterventoria?.nombre || interventorAsignado?.empresaInterventoria?.nombre || 'No asignada')}
                                </span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* ── Condiciones Generales ── */}
                <div className="pdf-block bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 md:p-5 mb-3">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-primary rounded-full"></span>
                        Condiciones Generales del Turno
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="text-slate-500 text-xs font-medium block mb-1">Ritmo de Ejecución</span>
                            {bitacora.estadoObra ? (
                                <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    {bitacora.estadoObra === 'avanzada' ? <><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>Avanzada (Sobre la curva)</> :
                                        bitacora.estadoObra === 'normal' ? <><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>Normal (Según cronograma)</> :
                                            bitacora.estadoObra === 'retrasada' ? <><div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>Retrasada (Desviación menor)</> :
                                                <><div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></div>Detenida (Suspendida)</>}
                                </span>
                            ) : <span className="text-slate-400 text-sm">Sin datos operativos</span>}
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="text-slate-500 text-xs font-medium block mb-1">Día Laborable</span>
                            <div className="flex items-center gap-2">
                                {bitacora.diaLaborable ? (
                                    <>
                                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5" /></div>
                                        <span className="font-bold text-slate-800 text-sm">Sí, labores activas</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center"><X className="w-3.5 h-3.5" /></div>
                                        <span className="font-bold text-slate-800 text-sm">No, recinto cerrado</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {!bitacora.diaLaborable && (
                        <div className="mt-3 bg-rose-50/50 border border-rose-100 p-3 rounded-xl">
                            <h4 className="text-xs font-bold text-rose-800 mb-2 border-b border-rose-200/50 pb-1.5">Justificación del Cierre</h4>
                            <div className="mb-2">
                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Causal</span>
                                <span className="font-bold text-slate-800 capitalize bg-white px-2 py-0.5 rounded shadow-sm border border-slate-200 inline-block text-xs">{bitacora.razonNoLaboral}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">Sustentación</span>
                                <p className="text-xs text-slate-700 font-medium leading-relaxed bg-white border border-slate-200 p-2.5 rounded-lg shadow-sm">{bitacora.explicacionNoLaboral}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Actividades y Visitas ── */}
                {bitacora.actividades?.length > 0 && (
                    <div className="mb-3">
                        <div className="pdf-block bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 mb-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-primary rounded-full"></span>
                                    Desglose de Actividades y Visitas
                                </h3>
                                <div className="flex items-center gap-2">
                                    {bitacora.actividades.filter((a: any) => !a.esVisita).length > 0 && (
                                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide">
                                            {bitacora.actividades.filter((a: any) => !a.esVisita).length} ACT.
                                        </span>
                                    )}
                                    {bitacora.actividades.filter((a: any) => a.esVisita).length > 0 && (
                                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide">
                                            {bitacora.actividades.filter((a: any) => a.esVisita).length} VISITAS
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {bitacora.actividades.map((act: any, idx: number) => (
                                act.esVisita ? (
                                    /* ── VISITA ── */
                                    <article key={act.id} className="pdf-block border-2 border-amber-300 rounded-xl overflow-hidden shadow-sm bg-amber-50 w-full">
                                        <div className="bg-amber-100/70 border-b border-amber-300 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center text-base shadow shrink-0">🏛️</div>
                                                <div>
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-black tracking-widest uppercase rounded">#{String(idx + 1).padStart(2, '0')}</span>
                                                        <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-black tracking-widest uppercase rounded">Visita Institucional</span>
                                                    </div>
                                                    <h4 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">{act.descripcionVisita}</h4>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 divide-x divide-amber-200 border-b border-amber-200">
                                            <div className="p-3">
                                                <span className="text-amber-600 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Personas</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="font-black text-slate-800 text-xl">{act.numeroPersonasVisita}</span>
                                                    <span className="text-xs font-semibold text-slate-500 uppercase">persona{act.numeroPersonasVisita !== 1 ? 's' : ''}</span>
                                                </div>
                                            </div>
                                            <div className="p-3">
                                                <span className="text-amber-600 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Duración</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="font-black text-slate-800 text-xl">
                                                        {act.duracionVisita >= 60 ? Math.floor(act.duracionVisita / 60) : act.duracionVisita}
                                                    </span>
                                                    <span className="text-xs font-semibold text-slate-500 uppercase">
                                                        {act.duracionVisita >= 60 ? `h${act.duracionVisita % 60 > 0 ? ` ${act.duracionVisita % 60}min` : ''}` : 'min'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {(act.foto1Url || act.foto2Url) && (
                                            <div className="p-3 border-t border-amber-200">
                                                <span className="text-amber-600 text-[10px] font-bold uppercase tracking-wider block mb-2">Registro fotográfico</span>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    {act.foto1Url && (
                                                        <figure className="relative group cursor-pointer rounded-xl overflow-hidden border border-amber-200 shadow-sm bg-amber-100 aspect-video md:aspect-[4/3] w-full max-w-[250px]" onClick={() => setLightboxImg(act.foto1Url)}>
                                                            <img src={act.foto1Url} alt="Visita foto 1" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" crossOrigin="anonymous" />
                                                            <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/40 transition-colors flex items-center justify-center">
                                                                <div className="opacity-0 group-hover:opacity-100 bg-white/95 rounded-full p-2 shadow-xl"><ZoomIn className="w-4 h-4 text-slate-800" /></div>
                                                            </div>
                                                            <figcaption className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-amber-900/80 text-white px-1.5 py-0.5 rounded uppercase tracking-widest">Toma 1</figcaption>
                                                        </figure>
                                                    )}
                                                    {act.foto2Url && (
                                                        <figure className="relative group cursor-pointer rounded-xl overflow-hidden border border-amber-200 shadow-sm bg-amber-100 aspect-video md:aspect-[4/3] w-full max-w-[250px]" onClick={() => setLightboxImg(act.foto2Url)}>
                                                            <img src={act.foto2Url} alt="Visita foto 2" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" crossOrigin="anonymous" />
                                                            <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/40 transition-colors flex items-center justify-center">
                                                                <div className="opacity-0 group-hover:opacity-100 bg-white/95 rounded-full p-2 shadow-xl"><ZoomIn className="w-4 h-4 text-slate-800" /></div>
                                                            </div>
                                                            <figcaption className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-amber-900/80 text-white px-1.5 py-0.5 rounded uppercase tracking-widest">Toma 2</figcaption>
                                                        </figure>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </article>
                                ) : (
                                    /* ── ACTIVIDAD ── */
                                    <article key={act.id} className="pdf-block border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors shadow-sm bg-white w-full">
                                        <div className="bg-slate-50/80 border-b border-slate-200 p-3 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-black tracking-widest uppercase rounded">#{String(idx + 1).padStart(2, '0')}</span>
                                                    {act.porcentajeCompletado === 100 && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Completada</span>}
                                                    {canEditActividades && (
                                                        <button onClick={() => startEditActivity(act)} className="ml-auto p-1 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" title="Editar actividad">
                                                            <Edit className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                                <h4 className="font-bold text-slate-800 text-sm leading-snug">{act.actividadEjecutada}</h4>
                                            </div>
                                            <div className="flex flex-col items-end shrink-0">
                                                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                                                    <span className="text-xs text-slate-500 font-semibold uppercase">Desarrollo:</span>
                                                    <span className="font-black text-primary text-sm">{act.porcentajeCompletado}%</span>
                                                </div>
                                                <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden shadow-inner">
                                                    <div className={`h-full rounded-full ${act.porcentajeCompletado === 100 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${act.porcentajeCompletado}%` }}></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 border-b border-slate-100">
                                            <div className="p-3">
                                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Contratista</span>
                                                <span className="font-semibold text-slate-700 text-xs line-clamp-2">{act.contratista?.nombre}</span>
                                            </div>
                                            <div className="p-3">
                                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Mano de Obra</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="font-black text-slate-800 text-base">{act.trabajadoresEnObra}</span>
                                                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Personal</span>
                                                </div>
                                            </div>
                                            <div className="p-3">
                                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Horas Jornada</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="font-black text-slate-800 text-base">{act.horasTrabajadas}</span>
                                                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Hrs</span>
                                                </div>
                                            </div>
                                            <div className="p-3">
                                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Clima</span>
                                                <div className="flex flex-col gap-0.5 mt-0.5">
                                                    <span className="text-xs font-medium bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-slate-700 inline-block w-max"><span className="text-slate-400 mr-1 text-[10px] uppercase">AM:</span>{climaIcons[act.climaManana]?.split(' ')[0]} {climaIcons[act.climaManana]?.split(' ')[1]}</span>
                                                    <span className="text-xs font-medium bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-slate-700 inline-block w-max"><span className="text-slate-400 mr-1 text-[10px] uppercase">PM:</span>{climaIcons[act.climaTarde]?.split(' ')[0]} {climaIcons[act.climaTarde]?.split(' ')[1]}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-amber-50/60 border-t border-amber-100">
                                            <span className="text-amber-700 text-[10px] font-bold uppercase tracking-wider block mb-1.5">Anotaciones</span>
                                            <p className="text-xs text-slate-800 font-medium leading-relaxed bg-white border border-amber-200 p-2.5 rounded-lg shadow-sm whitespace-pre-wrap">
                                                {act.notasGenerales || <span className="text-slate-400 italic">Sin anotaciones registradas</span>}
                                            </p>
                                        </div>

                                        {(act.foto1Url || act.foto2Url) && (
                                            <div className="p-3 border-t border-slate-100">
                                                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block mb-2">Evidencia Fotográfica</span>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    {act.foto1Url && (
                                                        <figure className="relative group cursor-pointer rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 aspect-video md:aspect-[4/3] w-full max-w-[250px]" onClick={() => setLightboxImg(act.foto1Url)}>
                                                            <img src={act.foto1Url} alt={`Soporte visual — Actividad ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" crossOrigin="anonymous" />
                                                            <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/40 transition-colors flex items-center justify-center">
                                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 bg-white/95 rounded-full p-2 shadow-xl backdrop-blur-sm"><ZoomIn className="w-4 h-4 text-slate-800" /></div>
                                                            </div>
                                                            <figcaption className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-slate-900/80 text-white px-1.5 py-0.5 rounded backdrop-blur border border-white/10 uppercase tracking-widest">Toma 1</figcaption>
                                                        </figure>
                                                    )}
                                                    {act.foto2Url && (
                                                        <figure className="relative group cursor-pointer rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 aspect-video md:aspect-[4/3] w-full max-w-[250px]" onClick={() => setLightboxImg(act.foto2Url)}>
                                                            <img src={act.foto2Url} alt={`Soporte visual — Actividad ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" crossOrigin="anonymous" />
                                                            <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/40 transition-colors flex items-center justify-center">
                                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 bg-white/95 rounded-full p-2 shadow-xl backdrop-blur-sm"><ZoomIn className="w-4 h-4 text-slate-800" /></div>
                                                            </div>
                                                            <figcaption className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-slate-900/80 text-white px-1.5 py-0.5 rounded backdrop-blur border border-white/10 uppercase tracking-widest">Toma 2</figcaption>
                                                        </figure>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </article>
                                )
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Instrucciones o Decisiones ── */}
                {bitacora.diaLaborable && (bitacora.ordenesImpartidas || bitacora.cambiosAprobados || bitacora.coordinacionesTecnicas) && (
                    <div className="pdf-block bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 md:p-5 mb-3">
                        <h3 className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>
                            <Lightbulb className="w-4 h-4 text-amber-500" />
                            Instrucciones o Decisiones
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {bitacora.ordenesImpartidas && (
                                <div className="md:col-span-2">
                                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1.5">Órdenes impartidas</span>
                                    <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">{bitacora.ordenesImpartidas}</p>
                                </div>
                            )}
                            {bitacora.cambiosAprobados && (
                                <div>
                                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1.5">Cambios en diseño o materiales</span>
                                    <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">{bitacora.cambiosAprobados}</p>
                                </div>
                            )}
                            {bitacora.coordinacionesTecnicas && (
                                <div>
                                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1.5">Coordinaciones técnicas</span>
                                    <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">{bitacora.coordinacionesTecnicas}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Incidentes o Novedades ── */}
                {bitacora.diaLaborable && (bitacora.accidentesFallas || bitacora.reclamosComunidad) && (
                    <div className="pdf-block bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 md:p-5 mb-3">
                        <h3 className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-rose-500 rounded-full"></span>
                            <AlertCircle className="w-4 h-4 text-rose-500" />
                            Incidentes o Novedades
                        </h3>
                        <div className="space-y-4">
                            {(bitacora.accidentesFallas || bitacora.fotoAccidenteUrl) && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2">
                                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1.5">Accidentes o fallas técnicas</span>
                                        <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">{bitacora.accidentesFallas || "Sin descripción de incidente"}</p>
                                    </div>
                                    {bitacora.fotoAccidenteUrl && (
                                        <div>
                                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1.5">Evidencia del Incidente</span>
                                            <figure
                                                className="relative group cursor-pointer rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 aspect-video md:aspect-square w-full"
                                                onClick={() => setLightboxImg(bitacora.fotoAccidenteUrl)}
                                            >
                                                <img src={bitacora.fotoAccidenteUrl} alt="Evidencia de incidente o falla" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" crossOrigin="anonymous" />
                                                <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/40 transition-colors flex items-center justify-center">
                                                    <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </figure>
                                        </div>
                                    )}
                                </div>
                            )}
                            {bitacora.reclamosComunidad && (
                                <div>
                                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1.5">Reclamos de la comunidad</span>
                                    <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">{bitacora.reclamosComunidad}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Gestión de Calidad (Ensayos) ── */}
                {bitacora.diaLaborable && bitacora.ensayos?.length > 0 && (
                    <div className="pdf-block bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 md:p-5 mb-3">
                        <h3 className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                            <FlaskConical className="w-4 h-4 text-indigo-500" />
                            Gestión de Calidad (Ensayos)
                        </h3>
                        <div className="space-y-3">
                            {bitacora.ensayos.map((ens: any, idx: number) => (
                                <div key={ens.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row gap-4 items-start">
                                    <div className="w-full md:w-24 h-24 rounded-lg border border-slate-200 overflow-hidden bg-white shrink-0 cursor-pointer group relative" onClick={() => setLightboxImg(ens.anexoFotoUrl)}>
                                        <img src={ens.anexoFotoUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" crossOrigin="anonymous" />
                                        <div className="absolute inset-0 bg-black/5 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                                            <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-0.5">Ensayo #{idx + 1}</span>
                                        <p className="text-sm font-bold text-slate-800 mb-1.5">{ens.ensayoRealizado}</p>
                                        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 bg-white w-max px-2 py-0.5 rounded border border-slate-200">
                                            <Calendar className="w-3 h-3" />
                                            Certificado el {new Date(ens.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Notas de Jornada ── */}
                {bitacora.notasGenerales && (
                    <div className="pdf-block bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 md:p-5 mb-3 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-200"></div>
                        <h3 className="text-sm font-bold text-slate-900 mb-3">Notas y Directrices de la Jornada</h3>
                        <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{bitacora.notasGenerales}</p>
                    </div>
                )}

                {/* ── Firmas ── */}
                <div className="pdf-block bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 md:p-5 mb-3">
                    <div className="mb-4 pb-3 border-b border-slate-100">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary" />
                            Validación y Firmas Criptográficas
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">Los sellos digitales garantizan la inmutabilidad y auditoría del folio.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Residente */}
                        <div className="h-full">
                            <FirmaDigital
                                title="Firma Diligenciador"
                                user={null}
                                enabled={false}
                                signed={!!bitacora.firmaResidenteData}
                                onSign={() => { }}
                                firmaData={bitacora.firmaResidenteData}
                                firmaTimestamp={bitacora.firmaResidenteTimestamp}
                            />
                        </div>

                        {/* Director */}
                        <div className="h-full flex flex-col">
                            {canSignDirector ? (
                                <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 shadow-sm flex flex-col h-full ring-4 ring-primary/10">
                                    <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                        Aprobación: Director
                                    </h4>
                                    <div className="mb-3">
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                                            Observaciones del Director <span className="text-rose-500">*</span>
                                        </label>
                                        <textarea
                                            value={comentariosDirector}
                                            onChange={(e) => setComentariosDirector(e.target.value)}
                                            rows={3}
                                            placeholder="Ingrese sus observaciones sobre este informe..."
                                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none text-slate-700 placeholder:text-slate-400"
                                        />
                                        {!comentariosDirector.trim() && (
                                            <p className="text-[10px] text-rose-500 mt-0.5">Este campo es requerido para emitir el aval.</p>
                                        )}
                                    </div>
                                    <label className={`flex items-start gap-3 mb-4 flex-1 group ${comentariosDirector.trim() ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                                        <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                                            <input type="checkbox" className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded cursor-pointer checked:bg-primary checked:border-primary transition-colors focus:ring-2 focus:ring-primary/30 focus:outline-none disabled:cursor-not-allowed" onChange={() => handleSign('director')} disabled={signing || !comentariosDirector.trim()} />
                                            <CheckCircle2 className="w-3.5 h-3.5 text-white absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
                                        </div>
                                        <span className="text-xs font-medium text-slate-700 leading-relaxed group-hover:text-slate-900 transition-colors">
                                            Declaro haber inspeccionado y aprobar la información de este folio. Esta acción estampará mi firma digital permanente.
                                        </span>
                                    </label>
                                    {signing ? (
                                        <span className="block w-full py-2 text-center text-xs font-bold text-primary animate-pulse bg-white rounded-lg border border-primary/20">Procesando sello criptográfico...</span>
                                    ) : (
                                        <span className="block w-full text-center text-[10px] font-bold text-primary/70 uppercase tracking-widest bg-white py-1.5 rounded-lg border border-primary/20 shadow-sm">Esperando validación</span>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 h-full">
                                    <FirmaDigital
                                        title="Aval Director de Obra"
                                        user={null}
                                        enabled={false}
                                        signed={!!bitacora.firmaDirectorData}
                                        onSign={() => { }}
                                        firmaData={bitacora.firmaDirectorData}
                                        firmaTimestamp={bitacora.firmaDirectorTimestamp}
                                    />
                                    {bitacora.comentariosDirector && (
                                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
                                            <span className="text-[10px] font-semibold text-primary/70 uppercase tracking-wider block mb-1">Observaciones del Director</span>
                                            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{bitacora.comentariosDirector}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Interventor */}
                        <div className="h-full flex flex-col">
                            {canSignInterventor ? (
                                <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 shadow-sm flex flex-col h-full ring-4 ring-primary/10">
                                    <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                        Aprobación: Supervisión Técnica
                                    </h4>
                                    <div className="mb-3">
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                                            Observaciones de Supervisión Técnica <span className="text-rose-500">*</span>
                                        </label>
                                        <textarea
                                            value={comentariosInterventor}
                                            onChange={(e) => setComentariosInterventor(e.target.value)}
                                            rows={3}
                                            placeholder="Ingrese sus observaciones sobre este informe..."
                                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none text-slate-700 placeholder:text-slate-400"
                                        />
                                        {!comentariosInterventor.trim() && (
                                            <p className="text-[10px] text-rose-500 mt-0.5">Este campo es requerido para emitir el aval.</p>
                                        )}
                                    </div>
                                    <label className={`flex items-start gap-3 mb-4 flex-1 group ${comentariosInterventor.trim() ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                                        <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                                            <input type="checkbox" className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded cursor-pointer checked:bg-primary checked:border-primary transition-colors focus:ring-2 focus:ring-primary/30 focus:outline-none disabled:cursor-not-allowed" onChange={() => handleSign('interventor')} disabled={signing || !comentariosInterventor.trim()} />
                                            <CheckCircle2 className="w-3.5 h-3.5 text-white absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
                                        </div>
                                        <span className="text-xs font-medium text-slate-700 leading-relaxed group-hover:text-slate-900 transition-colors">
                                            Declaro haber inspeccionado y aprobar la información de este folio. Esta acción estampará mi firma digital permanente.
                                        </span>
                                    </label>
                                    {signing ? (
                                        <span className="block w-full py-2 text-center text-xs font-bold text-primary animate-pulse bg-white rounded-lg border border-primary/20">Procesando sello criptográfico...</span>
                                    ) : (
                                        <span className="block w-full text-center text-[10px] font-bold text-primary/70 uppercase tracking-widest bg-white py-1.5 rounded-lg border border-primary/20 shadow-sm">Esperando validación</span>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 h-full">
                                    <FirmaDigital
                                        title="Aval Supervisión Técnica"
                                        user={null}
                                        enabled={false}
                                        signed={!!bitacora.firmaInterventorData}
                                        onSign={() => { }}
                                        firmaData={bitacora.firmaInterventorData}
                                        firmaTimestamp={bitacora.firmaInterventorTimestamp}
                                    />
                                    {bitacora.comentariosInterventor && (
                                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
                                            <span className="text-[10px] font-semibold text-primary/70 uppercase tracking-wider block mb-1">Observaciones de Supervisión Técnica</span>
                                            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{bitacora.comentariosInterventor}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Modal Editar Actividad ── */}
            {editingActivity && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
                        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between shrink-0">
                            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Edit className="w-4 h-4 text-primary" /> Editar Actividad
                            </h2>
                            <button onClick={() => setEditingActivity(null)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                                <X className="w-4 h-4 text-slate-400" />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Descripción de la actividad</label>
                                <textarea value={editForm.actividadEjecutada} onChange={(e) => setEditForm({ ...editForm, actividadEjecutada: e.target.value })} rows={2} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Progreso: {editForm.porcentajeCompletado}%</label>
                                <input type="range" min="1" max="100" value={editForm.porcentajeCompletado} onChange={(e) => setEditForm({ ...editForm, porcentajeCompletado: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Contratista</label>
                                <select value={editForm.contratistaId} onChange={(e) => setEditForm({ ...editForm, contratistaId: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                                    <option value="">Sin contratista</option>
                                    {contratistasParaEditar.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Trabajadores</label>
                                    <input type="number" min="1" value={editForm.trabajadoresEnObra} onChange={(e) => setEditForm({ ...editForm, trabajadoresEnObra: parseInt(e.target.value) })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Horas trabajadas (1–8)</label>
                                    <input type="number" min="1" max="8" value={editForm.horasTrabajadas} onChange={(e) => setEditForm({ ...editForm, horasTrabajadas: parseInt(e.target.value) })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {(['climaManana', 'climaTarde'] as const).map((field) => (
                                    <div key={field}>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">{field === 'climaManana' ? 'Clima AM' : 'Clima PM'}</label>
                                        <select value={editForm[field]} onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                                            <option value="soleado">☀️ Soleado</option>
                                            <option value="nublado">☁️ Nublado</option>
                                            <option value="lluvia">🌧️ Lluvia</option>
                                            <option value="tormenta_electrica">⚡ Tormenta Eléctrica</option>
                                        </select>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Anotaciones específicas</label>
                                <textarea value={editForm.notasGenerales} onChange={(e) => setEditForm({ ...editForm, notasGenerales: e.target.value })} rows={3} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" placeholder="Detalles sobre suministro, control de calidad..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { field: 'foto1', label: 'Foto 1', current: editingActivity.foto1Url },
                                    { field: 'foto2', label: 'Foto 2', current: editingActivity.foto2Url },
                                ].map(({ field, label, current }) => (
                                    <div key={field}>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">{label} <span className="text-xs font-normal text-slate-400">(opcional — reemplaza la actual)</span></label>
                                        {current && !editForm[field] && <img src={current} className="w-full h-20 object-cover rounded-lg mb-2 border border-slate-200" crossOrigin="anonymous" />}
                                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setEditForm({ ...editForm, [field]: e.target.files?.[0] || null })} className="w-full text-sm text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex gap-3 justify-end shrink-0">
                            <button onClick={() => setEditingActivity(null)} className="px-5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">Cancelar</button>
                            <button onClick={() => editMutation.mutate()} disabled={editMutation.isPending} className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/95 transition-colors disabled:opacity-50">
                                {editMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
