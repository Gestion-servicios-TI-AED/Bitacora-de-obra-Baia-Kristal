import { CheckCircle, Lock, ShieldCheck } from 'lucide-react';

interface Props {
    title: string;
    user: any;
    enabled: boolean;
    signed: boolean;
    onSign: (val: boolean) => void;
    firmaData?: any;
    firmaTimestamp?: string;
}

export default function FirmaDigital({ title, user, enabled, signed, onSign, firmaData, firmaTimestamp }: Props) {
    // If there's already firma data (viewing existing bitacora)
    const existingFirma = firmaData ? (typeof firmaData === 'string' ? JSON.parse(firmaData) : firmaData) : null;

    return (
        <div className={`rounded-xl border-2 p-5 transition-all ${existingFirma || signed
                ? 'border-green-200 bg-green-50/50'
                : enabled
                    ? 'border-gray-200 bg-white hover:border-primary/30'
                    : 'border-gray-100 bg-gray-50/50 opacity-60'
            }`}>
            <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className={`w-5 h-5 ${existingFirma || signed ? 'text-green-600' : 'text-gray-400'}`} />
                <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
                {!enabled && !existingFirma && (
                    <Lock className="w-3.5 h-3.5 text-gray-400 ml-auto" />
                )}
            </div>

            {existingFirma ? (
                // Showing existing signature
                <div className="space-y-2 animate-fadeIn">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-text-secondary">Nombre: </span><span className="font-medium">{existingFirma.nombre}</span></div>
                        <div><span className="text-text-secondary">Email: </span><span className="font-medium">{existingFirma.email}</span></div>
                        <div><span className="text-text-secondary">Cédula: </span><span className="font-medium">{existingFirma.cedula}</span></div>
                        <div><span className="text-text-secondary">Cargo: </span><span className="font-medium">{existingFirma.cargo}</span></div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-green-200">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-green-700 font-medium">
                            Firmado digitalmente — {firmaTimestamp ? new Date(firmaTimestamp).toLocaleString('es-CO') : ''}
                        </span>
                    </div>
                </div>
            ) : enabled ? (
                // Interactive signature
                <div>
                    <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={signed}
                            onChange={(e) => onSign(e.target.checked)}
                            className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/50 accent-primary"
                        />
                        <span className="text-xs text-gray-600 leading-relaxed">
                            Confirmo que he revisado y apruebo que la información registrada en esta bitácora de obra es verídica y conforme. Mi firma digital constituye el aval de lo aquí documentado.
                        </span>
                    </label>

                    {signed && user && (
                        <div className="mt-4 space-y-2 animate-fadeIn bg-green-50 rounded-lg p-3">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div><span className="text-text-secondary">Nombre: </span><span className="font-medium">{user.nombre} {user.apellido}</span></div>
                                <div><span className="text-text-secondary">Email: </span><span className="font-medium">{user.email}</span></div>
                                <div><span className="text-text-secondary">Cédula: </span><span className="font-medium">{user.cedula}</span></div>
                                <div><span className="text-text-secondary">Cargo: </span><span className="font-medium">{user.cargo}</span></div>
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-green-200">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <span className="text-xs text-green-700 font-medium">
                                    Firmado digitalmente — {new Date().toLocaleString('es-CO')}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                // Disabled state
                <p className="text-xs text-text-light">Pendiente — Solo puede firmar el usuario correspondiente.</p>
            )}
        </div>
    );
}
