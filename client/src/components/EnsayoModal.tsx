import { useState } from 'react';
import { X, Camera, Upload, CheckCircle2 } from 'lucide-react';

interface Props {
    onClose: () => void;
    onSave: (ensayo: any) => void;
}

export default function EnsayoModal({ onClose, onSave }: Props) {
    const [ensayoRealizado, setEnsayoRealizado] = useState('');
    const [anexoFoto, setAnexoFoto] = useState<File | null>(null);

    const isValid = ensayoRealizado && anexoFoto;

    const handleSave = () => {
        if (!isValid) return;
        onSave({
            ensayoRealizado,
            anexoFoto,
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn border border-slate-200">
                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                    <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">🧪</span>
                        Registrar Ensayo de Calidad
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors group">
                        <X className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Descripción del Ensayo Realizado <span className="text-rose-500">*</span></label>
                        <textarea
                            value={ensayoRealizado}
                            onChange={(e) => setEnsayoRealizado(e.target.value)}
                            rows={4}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-all placeholder-slate-400"
                            placeholder="Ej: Ensayo de asentamiento (Slump) para concreto de zapatas..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Anexo o Registro Fotográfico <span className="text-rose-500">*</span></label>
                        <label className={`flex flex-col items-center justify-center gap-3 px-4 py-10 bg-slate-50 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-100 transition-all ${anexoFoto ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-300 hover:border-slate-400 group'}`}>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={(e) => setAnexoFoto(e.target.files?.[0] || null)}
                                className="hidden"
                            />
                            {anexoFoto ? (
                                <div className="text-center">
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2"><CheckCircle2 className="w-6 h-6" /></div>
                                    <span className="text-sm text-emerald-700 font-bold max-w-[200px] truncate block px-2">{anexoFoto.name}</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                                    <div className="p-4 bg-white rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform">
                                        <Camera className="w-6 h-6" />
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-wider">Cargar Evidencia del Ensayo</span>
                                </div>
                            )}
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                    <div className="text-xs font-semibold text-slate-500">
                        {isValid ? <span className="text-emerald-600 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Listo para registrar</span> : <span className="text-rose-500 flex items-center gap-1.5"><X className="w-4 h-4" /> Campos obligatorios pendientes</span>}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!isValid}
                            className="px-6 py-2.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                        >
                            <Upload className="w-4 h-4" />
                            Registrar Ensayo
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
