import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import FirmaDigital from '../components/FirmaDigital';
import { useState, useRef } from 'react';
import {
    ArrowLeft, Building2, Calendar, Hash, Clock,
    CheckCircle2, X, ZoomIn, Shield, FileDown, MapPin, Briefcase, User, HardHat,
    Lightbulb, AlertCircle, FlaskConical
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

    const { data: bitacora, isLoading } = useQuery({
        queryKey: ['bitacora', id],
        queryFn: async () => (await api.get(`/bitacoras/${id}`)).data,
        enabled: !!id,
    });

    const signMutation = useMutation({
        mutationFn: async (type: string) => {
            return (await api.patch(`/bitacoras/${id}/firma-${type}`)).data;
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
            await signMutation.mutateAsync(type);
        } finally {
            setSigning(false);
        }
    };

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
            if (blocks.length === 0) {
                throw new Error("No hay bloques para renderizar");
            }

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
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });

                const imgWidth = contentWidth;
                const imgHeight = (img.height * imgWidth) / img.width;
                const blockMarginBottom = 6;

                if (currentY + imgHeight > pageHeight - margin && i > 0) {
                    pdf.addPage();
                    currentY = margin;
                }

                pdf.addImage(dataUrl, 'JPEG', margin, currentY, imgWidth, imgHeight);
                currentY += imgHeight + blockMarginBottom;
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

    const canSignDirector = (user?.tipoUsuario === 'director_obra' || user?.tipoUsuario === 'director_obra_general') && !bitacora.firmaDirectorData;
    const canSignInterventor = user?.tipoUsuario === 'interventoria' && !bitacora.firmaInterventorData;

    const directorAsignado = bitacora.torre?.usuarioTorres?.find(
        (ut: any) => ut.usuario?.tipoUsuario === 'director_obra' || ut.usuario?.tipoUsuario === 'director_obra_general'
    )?.usuario;
    
    const interventorAsignado = bitacora.torre?.usuarioTorres?.find(
        (ut: any) => ut.usuario?.tipoUsuario === 'interventoria'
    )?.usuario;

    return (
        <div className="max-w-5xl mx-auto animate-fadeIn px-2 sm:px-0 pb-10">
            {/* Lightbox for gallery images */}
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

            {/* Navigation top bar */}
            <div className="flex items-center justify-between mb-5">
                <button
                    onClick={() => navigate('/bitacoras')}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors group"
                >
                    <span className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-slate-200 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                    </span>
                    Volver al Archivo
                </button>
                <button
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf}
                    className="flex items-center gap-2 text-sm font-semibold bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 hover:text-primary transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                    {isGeneratingPdf ? (
                        <div className="w-4 h-4 border-2 border-slate-300 border-t-primary rounded-full animate-spin"></div>
                    ) : (
                        <FileDown className="w-4 h-4" />
                    )}
                    {isGeneratingPdf ? 'Exportando...' : 'Descargar PDF'}
                </button>
            </div>

            {/* Success Notification */}
            {signSuccess && (
                <div className="mb-6 flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-4 rounded-xl animate-scaleIn shadow-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="font-medium text-sm">{signSuccess}</span>
                </div>
            )}

            <div ref={pdfRef} className="bg-slate-50 sm:bg-transparent -mx-2 sm:mx-0 px-2 sm:px-0 pb-2">
                {/* Main Document Header */}
                <header className="pdf-block bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 mb-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] pointer-events-none"></div>

                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-5 relative z-10">
                        <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
                                <Building2 className="w-7 h-7" />
                            </div>
                            <div className="pt-1">
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">Acta de Bitácora</h1>
                                <p className="text-[15px] font-medium text-slate-500 mt-1">{bitacora.proyecto?.nombre}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide shadow-sm ${estadoBadge[bitacora.estadoDiligencia]?.class}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
                                {estadoBadge[bitacora.estadoDiligencia]?.label}
                            </span>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 text-sm bg-slate-50/50 rounded-xl p-5 border border-slate-100">
                        <div>
                            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-1">Identificador de Folio</span>
                            <div className="flex items-center gap-1.5 text-slate-900 font-bold text-[15px]">
                                <Hash className="w-4 h-4 text-slate-400" />
                                {(bitacora.proyecto?.abreviatura && bitacora.torre?.abreviatura)
                                    ? <span className="text-primary">{`${bitacora.proyecto.abreviatura}-${bitacora.torre.abreviatura}-${String(bitacora.numeroFolio).padStart(3, '0')}`}</span>
                                    : <span className="text-slate-700">#{bitacora.numeroFolio}</span>
                                }
                            </div>
                        </div>
                        <div>
                            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-1">Fecha de Turno</span>
                            <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                {new Date(bitacora.fechaRegistro + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                        </div>
                        <div>
                            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-1">Cierre y Sello Digital</span>
                            <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                                <Clock className="w-4 h-4 text-slate-400" />
                                {new Date(bitacora.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })} <span className="text-slate-400 font-normal mx-0.5">|</span> {bitacora.horaRegistro}
                            </div>
                        </div>
                        <div>
                            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-1">Torre/Zona</span>
                            <span className="font-bold text-slate-900 line-clamp-1">{bitacora.torre?.nombre}</span>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        <div className="flex gap-3 items-start p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/60 transition-colors hover:bg-slate-50 border-l-4 border-l-primary/60">
                            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div>
                                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Localización (Proyecto)</span>
                                <span className="font-semibold text-slate-800 text-[13px]">{bitacora.proyecto?.direccion || 'No especificada'}</span>
                            </div>
                        </div>
                        <div className="flex gap-3 items-start p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/60 transition-colors hover:bg-slate-50">
                            <Briefcase className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div>
                                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Empresa Contratante</span>
                                <span className="font-semibold text-slate-800 text-[13px] line-clamp-1">{bitacora.proyecto?.empresaContratante?.nombre || 'No asignada al proyecto'}</span>
                            </div>
                        </div>
                        <div className="flex gap-3 items-start p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/60 transition-colors hover:bg-slate-50">
                            <HardHat className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div>
                                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Director de Obra</span>
                                <span className="font-semibold text-slate-800 text-[13px]">{directorAsignado ? `${directorAsignado.nombre} ${directorAsignado.apellido}` : 'No asignado a la torre'}</span>
                            </div>
                        </div>
                        <div className="flex gap-3 items-start p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/60 transition-colors hover:bg-slate-50">
                            <User className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div>
                                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Residente de Obra (Reportó)</span>
                                <span className="font-semibold text-slate-800 text-[13px] inline-flex items-center gap-2">
                                    {bitacora.creadoPor?.nombre} {bitacora.creadoPor?.apellido}
                                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex justify-center text-[10px] leading-tight font-bold ml-1 flex-col items-center">{bitacora.creadoPor?.nombre?.charAt(0)}{bitacora.creadoPor?.apellido?.charAt(0)}</span>
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-3 items-start p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/60 transition-colors hover:bg-slate-50 md:col-span-2 lg:col-span-2">
                            <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div>
                                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Empresa Interventora</span>
                                <span className="font-semibold text-slate-800 text-[13px]">{interventorAsignado?.empresaInterventoria?.nombre || 'No asignada al interventor o no hay interventor'}</span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* General Status Conditions */}
                <div className="pdf-block bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 mb-6">
                    <h3 className="text-[15px] font-bold text-slate-900 mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-primary rounded-full"></span>
                        Condiciones Generales del Turno
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center">
                            <span className="text-slate-500 font-medium mb-1">Ritmo y Estado de Ejecución</span>
                            {bitacora.estadoObra ? (
                                <span className="font-bold text-slate-800 text-[15px] flex items-center gap-2">
                                    {bitacora.estadoObra === 'avanzada' ? <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div> Avanzada (Sobre la curva)</span> :
                                        bitacora.estadoObra === 'normal' ? <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div> Normal (Según cronograma)</span> :
                                            bitacora.estadoObra === 'retrasada' ? <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div> Retrasada (Desviación menor)</span> :
                                                <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div> Detenida (Suspendida)</span>}
                                </span>
                            ) : <span className="font-medium text-slate-400">Sin datos operativos</span>}
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center">
                            <span className="text-slate-500 font-medium mb-1">Apertura del Recinto (Día Laborable)</span>
                            <div className="flex items-center gap-2">
                                {bitacora.diaLaborable ? (
                                    <>
                                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-4 h-4" /></div>
                                        <span className="font-bold text-slate-800 text-[15px]">Sí, labores activas</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center"><X className="w-4 h-4" /></div>
                                        <span className="font-bold text-slate-800 text-[15px]">No, recinto cerrado</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Justification if non-working day */}
                    {!bitacora.diaLaborable && (
                        <div className="mt-5 bg-rose-50/50 border border-rose-100 p-5 rounded-xl">
                            <h4 className="text-sm font-bold text-rose-800 mb-3 border-b border-rose-200/50 pb-2">Justificación del Cierre</h4>
                            <div className="mb-3">
                                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-0.5">Clasificación de la causal</span>
                                <span className="font-bold text-slate-800 capitalize bg-white px-2 py-1 rounded shadow-sm border border-slate-200 inline-block text-[13px]">{bitacora.razonNoLaboral}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-1">Contexto o sustentación textual</span>
                                <p className="text-sm text-slate-700 font-medium leading-relaxed bg-white border border-slate-200 p-3 rounded-lg shadow-sm">{bitacora.explicacionNoLaboral}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Activities & Visitas Documentation */}
                {bitacora.actividades?.length > 0 && (
                    <div className="mb-6">
                        <div className="pdf-block bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 mb-5">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-primary rounded-full"></span>
                                    Desglose de Actividades y Visitas
                                </h3>
                                <div className="flex items-center gap-2">
                                    {bitacora.actividades.filter((a: any) => !a.esVisita).length > 0 && (
                                        <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide">
                                            {bitacora.actividades.filter((a: any) => !a.esVisita).length} ACTIVIDADES
                                        </span>
                                    )}
                                    {bitacora.actividades.filter((a: any) => a.esVisita).length > 0 && (
                                        <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide">
                                            {bitacora.actividades.filter((a: any) => a.esVisita).length} VISITAS
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5">
                            {bitacora.actividades.map((act: any, idx: number) => (
                                act.esVisita ? (
                                    /* ── VISITA ── */
                                    <article key={act.id} className="pdf-block border-2 border-amber-300 rounded-xl overflow-hidden shadow-sm bg-amber-50 w-full">
                                        <div className="bg-amber-100/70 border-b border-amber-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg shadow shrink-0">🏛️</div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-black tracking-widest uppercase rounded"># {String(idx + 1).padStart(2, '0')}</span>
                                                        <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-black tracking-widest uppercase rounded">Visita Institucional</span>
                                                    </div>
                                                    <h4 className="font-bold text-slate-800 text-[15px] leading-snug line-clamp-2">{act.descripcionVisita}</h4>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 divide-x divide-amber-200 border-b border-amber-200">
                                            <div className="p-4">
                                                <span className="text-amber-600 text-[11px] font-bold uppercase tracking-wider block mb-1">Personas en la visita</span>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="font-black text-slate-800 text-2xl">{act.numeroPersonasVisita}</span>
                                                    <span className="text-xs font-semibold text-slate-500 uppercase">persona{act.numeroPersonasVisita !== 1 ? 's' : ''}</span>
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <span className="text-amber-600 text-[11px] font-bold uppercase tracking-wider block mb-1">Duración de la visita</span>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="font-black text-slate-800 text-2xl">
                                                        {act.duracionVisita >= 60 ? Math.floor(act.duracionVisita / 60) : act.duracionVisita}
                                                    </span>
                                                    <span className="text-xs font-semibold text-slate-500 uppercase">
                                                        {act.duracionVisita >= 60
                                                            ? `h${act.duracionVisita % 60 > 0 ? ` ${act.duracionVisita % 60}min` : ''}`
                                                            : 'min'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {(act.foto1Url || act.foto2Url) && (
                                            <div className="p-4 border-t border-amber-200">
                                                <span className="text-amber-600 text-[11px] font-bold uppercase tracking-wider block mb-3">Registro fotográfico</span>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    {act.foto1Url && (
                                                        <figure className="relative group cursor-pointer rounded-xl overflow-hidden border border-amber-200 shadow-sm bg-amber-100 aspect-video md:aspect-[4/3] w-full max-w-[250px]" onClick={() => setLightboxImg(act.foto1Url)}>
                                                            <img src={act.foto1Url} alt="Visita foto 1" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" crossOrigin="anonymous" />
                                                            <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/40 transition-colors flex items-center justify-center">
                                                                <div className="opacity-0 group-hover:opacity-100 bg-white/95 rounded-full p-2.5 shadow-xl"><ZoomIn className="w-5 h-5 text-slate-800" /></div>
                                                            </div>
                                                            <figcaption className="absolute bottom-2 left-2 text-[10px] font-bold bg-amber-900/80 text-white px-2 py-0.5 rounded uppercase tracking-widest">Toma 1</figcaption>
                                                        </figure>
                                                    )}
                                                    {act.foto2Url && (
                                                        <figure className="relative group cursor-pointer rounded-xl overflow-hidden border border-amber-200 shadow-sm bg-amber-100 aspect-video md:aspect-[4/3] w-full max-w-[250px]" onClick={() => setLightboxImg(act.foto2Url)}>
                                                            <img src={act.foto2Url} alt="Visita foto 2" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" crossOrigin="anonymous" />
                                                            <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/40 transition-colors flex items-center justify-center">
                                                                <div className="opacity-0 group-hover:opacity-100 bg-white/95 rounded-full p-2.5 shadow-xl"><ZoomIn className="w-5 h-5 text-slate-800" /></div>
                                                            </div>
                                                            <figcaption className="absolute bottom-2 left-2 text-[10px] font-bold bg-amber-900/80 text-white px-2 py-0.5 rounded uppercase tracking-widest">Toma 2</figcaption>
                                                        </figure>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </article>
                                ) : (
                                    /* ── ACTIVIDAD ── */
                                    <article key={act.id} className="pdf-block border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors shadow-sm bg-white w-full">
                                        <div className="bg-slate-50/80 border-b border-slate-200 p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-black tracking-widest uppercase rounded"># {String(idx + 1).padStart(2, '0')}</span>
                                                    {act.porcentajeCompletado === 100 && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Completada</span>}
                                                </div>
                                                <h4 className="font-bold text-slate-800 text-[15px] leading-snug">{act.actividadEjecutada}</h4>
                                            </div>
                                            <div className="flex flex-col items-end shrink-0">
                                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                                    <span className="text-xs text-slate-500 font-semibold uppercase">Desarrollo:</span>
                                                    <span className="font-black text-primary text-base">{act.porcentajeCompletado}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden shadow-inner">
                                                    <div className={`h-full rounded-full ${act.porcentajeCompletado === 100 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${act.porcentajeCompletado}%` }}></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 border-b border-slate-100">
                                            <div className="p-4">
                                                <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider block mb-1">Contratista Asignado</span>
                                                <span className="font-semibold text-slate-700 text-sm line-clamp-2">{act.contratista?.nombre}</span>
                                            </div>
                                            <div className="p-4">
                                                <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider block mb-1">Mano de Obra</span>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="font-black text-slate-800 text-lg">{act.trabajadoresEnObra}</span>
                                                    <span className="text-xs font-semibold text-slate-500 uppercase">Personal</span>
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider block mb-1">Costo Tiempo (Horas)</span>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="font-black text-slate-800 text-lg">{act.horasTrabajadas}</span>
                                                    <span className="text-xs font-semibold text-slate-500 uppercase">Hrs / Jornada</span>
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider block mb-1">Condición Climática</span>
                                                <div className="flex flex-col gap-1 mt-0.5">
                                                    <span className="text-xs font-medium bg-slate-50 border border-slate-100 px-2 py-0.5 rounded shadow-sm text-slate-700 inline-block w-max"><span className="text-slate-400 mr-1 text-[10px] uppercase">AM:</span>{climaIcons[act.climaManana]?.split(' ')[0]} {climaIcons[act.climaManana]?.split(' ')[1]}</span>
                                                    <span className="text-xs font-medium bg-slate-50 border border-slate-100 px-2 py-0.5 rounded shadow-sm text-slate-700 inline-block w-max"><span className="text-slate-400 mr-1 text-[10px] uppercase">PM:</span>{climaIcons[act.climaTarde]?.split(' ')[0]} {climaIcons[act.climaTarde]?.split(' ')[1]}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {act.notasGenerales && (
                                            <div className="p-4 bg-slate-50/50">
                                                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-2">Comentarios Específicos de la Actividad</span>
                                                <p className="text-sm text-slate-700 font-medium leading-relaxed bg-white border border-slate-200 p-3 rounded-lg shadow-sm whitespace-pre-wrap">{act.notasGenerales}</p>
                                            </div>
                                        )}

                                        {(act.foto1Url || act.foto2Url) && (
                                            <div className="p-4 border-t border-slate-100">
                                                <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wider block mb-3">Evidencia Audiovisual Adjunta</span>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    {act.foto1Url && (
                                                        <figure className="relative group cursor-pointer rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 aspect-video md:aspect-[4/3] w-full max-w-[250px]" onClick={() => setLightboxImg(act.foto1Url)}>
                                                            <img src={act.foto1Url} alt={`Soporte visual — Actividad ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" crossOrigin="anonymous" />
                                                            <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/40 transition-colors flex items-center justify-center">
                                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 bg-white/95 rounded-full p-2.5 shadow-xl backdrop-blur-sm"><ZoomIn className="w-5 h-5 text-slate-800" /></div>
                                                            </div>
                                                            <figcaption className="absolute bottom-2 left-2 text-[10px] font-bold bg-slate-900/80 text-white px-2 py-0.5 rounded backdrop-blur border border-white/10 uppercase tracking-widest">Toma 1</figcaption>
                                                        </figure>
                                                    )}
                                                    {act.foto2Url && (
                                                        <figure className="relative group cursor-pointer rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 aspect-video md:aspect-[4/3] w-full max-w-[250px]" onClick={() => setLightboxImg(act.foto2Url)}>
                                                            <img src={act.foto2Url} alt={`Soporte visual — Actividad ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" crossOrigin="anonymous" />
                                                            <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/40 transition-colors flex items-center justify-center">
                                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 bg-white/95 rounded-full p-2.5 shadow-xl backdrop-blur-sm"><ZoomIn className="w-5 h-5 text-slate-800" /></div>
                                                            </div>
                                                            <figcaption className="absolute bottom-2 left-2 text-[10px] font-bold bg-slate-900/80 text-white px-2 py-0.5 rounded backdrop-blur border border-white/10 uppercase tracking-widest">Toma 2</figcaption>
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

                {/* Section 5: Instrucciones o Decisiones */}
                {bitacora.diaLaborable && (bitacora.ordenesImpartidas || bitacora.cambiosAprobados || bitacora.coordinacionesTecnicas) && (
                    <div className="pdf-block bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 mb-6 relative overflow-hidden">
                        <h3 className="text-[15px] font-bold text-slate-900 mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>
                            <Lightbulb className="w-5 h-5 text-amber-500" />
                            Instrucciones o Decisiones
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {bitacora.ordenesImpartidas && (
                                <div className="md:col-span-2">
                                    <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-2">Órdenes impartidas</span>
                                    <p className="text-sm text-slate-700 font-medium leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{bitacora.ordenesImpartidas}</p>
                                </div>
                            )}
                            {bitacora.cambiosAprobados && (
                                <div>
                                    <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-2">Cambios en diseño o materiales</span>
                                    <p className="text-sm text-slate-700 font-medium leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{bitacora.cambiosAprobados}</p>
                                </div>
                            )}
                            {bitacora.coordinacionesTecnicas && (
                                <div>
                                    <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-2">Coordinaciones técnicas</span>
                                    <p className="text-sm text-slate-700 font-medium leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{bitacora.coordinacionesTecnicas}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Section 6: Incidentes o Novedades */}
                {bitacora.diaLaborable && (bitacora.accidentesFallas || bitacora.reclamosComunidad) && (
                    <div className="pdf-block bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 mb-6 relative overflow-hidden">
                        <h3 className="text-[15px] font-bold text-slate-900 mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-rose-500 rounded-full"></span>
                            <AlertCircle className="w-5 h-5 text-rose-500" />
                            Incidentes o Novedades
                        </h3>
                        <div className="space-y-6">
                            {(bitacora.accidentesFallas || bitacora.fotoAccidenteUrl) && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2">
                                        <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-2">Accidentes de trabajo o fallas técnicas</span>
                                        <p className="text-sm text-slate-700 font-medium leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{bitacora.accidentesFallas || "Sin descripción de incidente"}</p>
                                    </div>
                                    {bitacora.fotoAccidenteUrl && (
                                        <div>
                                            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-2">Evidencia del Incidente</span>
                                            <figure
                                                className="relative group cursor-pointer rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 aspect-video md:aspect-square w-full"
                                                onClick={() => setLightboxImg(bitacora.fotoAccidenteUrl)}
                                            >
                                                <img
                                                    src={bitacora.fotoAccidenteUrl}
                                                    alt="Evidencia de incidente o falla"
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                    crossOrigin="anonymous"
                                                />
                                                <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/40 transition-colors flex items-center justify-center">
                                                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </figure>
                                        </div>
                                    )}
                                </div>
                            )}
                            {bitacora.reclamosComunidad && (
                                <div>
                                    <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-2">Reclamos o inquietudes de la comunidad</span>
                                    <p className="text-sm text-slate-700 font-medium leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{bitacora.reclamosComunidad}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Section 7: Gestión de Calidad (Ensayos) */}
                {bitacora.diaLaborable && bitacora.ensayos?.length > 0 && (
                    <div className="pdf-block bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 mb-6 relative overflow-hidden">
                        <h3 className="text-[15px] font-bold text-slate-900 mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                            <FlaskConical className="w-5 h-5 text-indigo-500" />
                            Gestión de Calidad (Ensayos)
                        </h3>
                        <div className="space-y-4">
                            {bitacora.ensayos.map((ens: any, idx: number) => (
                                <div key={ens.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-5 items-start">
                                    <div className="w-full md:w-32 h-32 rounded-xl border border-slate-200 overflow-hidden bg-white shrink-0 cursor-pointer group relative" onClick={() => setLightboxImg(ens.anexoFotoUrl)}>
                                        <img src={ens.anexoFotoUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" crossOrigin="anonymous" />
                                        <div className="absolute inset-0 bg-black/5 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                                            <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-1">Ensayo #{idx + 1}</span>
                                        <p className="text-[15px] font-bold text-slate-800 mb-2">{ens.ensayoRealizado}</p>
                                        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 bg-white w-max px-2 py-0.5 rounded-md border border-slate-200">
                                            <Calendar className="w-3 h-3" />
                                            Certificado el {new Date(ens.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Global Journal Notes */}
                {bitacora.notasGenerales && (
                    <div className="pdf-block bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 mb-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-300"></div>
                        <h3 className="text-[15px] font-bold text-slate-900 mb-4 flex items-center gap-2">
                            Notas y Directrices de la Jornada
                        </h3>
                        <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{bitacora.notasGenerales}</p>
                    </div>
                )}

                {/* Document Verification & Signatures */}
                <div className="pdf-block bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 md:p-8 mb-6">
                    <div className="mb-6 pb-4 border-b border-slate-100">
                        <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-primary" />
                            Validación y Firmas Criptográficas
                        </h3>
                        <p className="text-[13px] text-slate-500 mt-1 font-medium">Los sellos digitales garantizan la inmutabilidad y auditoría de la información consignada en este folio de bitácora.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Residente (Creator) */}
                        {!bitacora.omitirFirmaResidente && (
                            <div className="h-full">
                                <FirmaDigital
                                    title="Firma Residente (Creador)"
                                    user={null}
                                    enabled={false}
                                    signed={!!bitacora.firmaResidenteData}
                                    onSign={() => { }}
                                    firmaData={bitacora.firmaResidenteData}
                                    firmaTimestamp={bitacora.firmaResidenteTimestamp}
                                />
                            </div>
                        )}

                        {/* Director Approval */}
                        <div className="h-full flex flex-col">
                            {canSignDirector ? (
                                <div className="rounded-xl border-2 border-primary bg-primary/5 p-6 shadow-sm flex flex-col h-full ring-4 ring-primary/10">
                                    <h4 className="text-[15px] font-bold text-slate-900 mb-4 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                        Aprobación Requerida: Director
                                    </h4>
                                    <label className="flex items-start gap-4 cursor-pointer mb-5 flex-1 group">
                                        <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                                            <input type="checkbox" className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded cursor-pointer checked:bg-primary checked:border-primary transition-colors focus:ring-2 focus:ring-primary/30 focus:outline-none" onChange={() => handleSign('director')} disabled={signing} />
                                            <CheckCircle2 className="w-3.5 h-3.5 text-white absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
                                        </div>
                                        <span className="text-xs font-medium text-slate-700 leading-relaxed group-hover:text-slate-900 transition-colors">
                                            Declaro bajo gravedad de juramento que he inspeccionado y apruebo enteramente la información consignada en este folio. Esta acción estampará mi firma digital permanente.
                                        </span>
                                    </label>
                                    {signing ? (
                                        <span className="block w-full py-2.5 text-center text-sm font-bold text-primary animate-pulse bg-white rounded-lg border border-primary/20">Procesando sello criptográfico...</span>
                                    ) : (
                                        <span className="block w-full text-center text-xs font-bold text-primary/70 uppercase tracking-widest bg-white py-2 rounded-lg border border-primary/20 shadow-sm">Esperando validación</span>
                                    )}
                                </div>
                            ) : (
                                <FirmaDigital
                                    title="Aval Director de Obra"
                                    user={null}
                                    enabled={false}
                                    signed={!!bitacora.firmaDirectorData}
                                    onSign={() => { }}
                                    firmaData={bitacora.firmaDirectorData}
                                    firmaTimestamp={bitacora.firmaDirectorTimestamp}
                                />
                            )}
                        </div>

                        {/* Interventor Approval */}
                        <div className="h-full flex flex-col">
                            {canSignInterventor ? (
                                <div className="rounded-xl border-2 border-primary bg-primary/5 p-6 shadow-sm flex flex-col h-full ring-4 ring-primary/10">
                                    <h4 className="text-[15px] font-bold text-slate-900 mb-4 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                        Aprobación Requerida: Interventoría
                                    </h4>
                                    <label className="flex items-start gap-4 cursor-pointer mb-5 flex-1 group">
                                        <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                                            <input type="checkbox" className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded cursor-pointer checked:bg-primary checked:border-primary transition-colors focus:ring-2 focus:ring-primary/30 focus:outline-none" onChange={() => handleSign('interventor')} disabled={signing} />
                                            <CheckCircle2 className="w-3.5 h-3.5 text-white absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
                                        </div>
                                        <span className="text-xs font-medium text-slate-700 leading-relaxed group-hover:text-slate-900 transition-colors">
                                            Declaro bajo gravedad de juramento que he inspeccionado y apruebo enteramente la información consignada en este folio. Esta acción estampará mi firma digital permanente.
                                        </span>
                                    </label>
                                    {signing ? (
                                        <span className="block w-full py-2.5 text-center text-sm font-bold text-primary animate-pulse bg-white rounded-lg border border-primary/20">Procesando sello criptográfico...</span>
                                    ) : (
                                        <span className="block w-full text-center text-xs font-bold text-primary/70 uppercase tracking-widest bg-white py-2 rounded-lg border border-primary/20 shadow-sm">Esperando validación</span>
                                    )}
                                </div>
                            ) : (
                                <FirmaDigital
                                    title="Aval Firma Interventora"
                                    user={null}
                                    enabled={false}
                                    signed={!!bitacora.firmaInterventorData}
                                    onSign={() => { }}
                                    firmaData={bitacora.firmaInterventorData}
                                    firmaTimestamp={bitacora.firmaInterventorTimestamp}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

