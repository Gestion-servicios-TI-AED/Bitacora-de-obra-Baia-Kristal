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

    const FirmaInfo = ({ data, timestamp }: { data: any; timestamp?: string }) => (
        <div className="space-y-1.5 animate-fadeIn">
            <div className="grid grid-cols-1 gap-1 text-xs">
                <div className="min-w-0">
                    <span className="text-gray-500">Nombre: </span>
                    <span className="font-medium break-words">{data.nombre}</span>
                </div>
                <div className="min-w-0">
                    <span className="text-gray-500">Email: </span>
                    <span className="font-medium break-all">{data.email}</span>
                </div>
                <div className="min-w-0">
                    <span className="text-gray-500">Cédula: </span>
                    <span className="font-medium">{data.cedula}</span>
                </div>
                <div className="min-w-0">
                    <span className="text-gray-500">Cargo: </span>
                    <span className="font-medium break-words">{data.cargo}</span>
                </div>
            </div>
            {timestamp !== undefined && (
                <div className="flex items-center gap-1.5 pt-2 border-t border-green-200">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    <span className="text-[11px] text-green-700 font-medium break-words">
                        Firmado — {timestamp ? new Date(timestamp).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : new Date().toLocaleString('es-CO')}
                    </span>
                </div>
            )}
        </div>
    );

    return (
        <div className={`rounded-xl border-2 p-4 transition-all overflow-hidden ${existingFirma || signed
                ? 'border-green-200 bg-green-50/50'
                : enabled
                    ? 'border-gray-200 bg-white hover:border-primary/30'
                    : 'border-gray-100 bg-gray-50/50 opacity-60'
            }`}>
            <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className={`w-4 h-4 shrink-0 ${existingFirma || signed ? 'text-green-600' : 'text-gray-400'}`} />
                <h4 className="text-sm font-semibold text-gray-800 min-w-0 truncate">{title}</h4>
                {!enabled && !existingFirma && (
                    <Lock className="w-3.5 h-3.5 text-gray-400 ml-auto shrink-0" />
                )}
            </div>

            {existingFirma ? (
                <FirmaInfo data={existingFirma} {...(firmaTimestamp !== undefined && { timestamp: firmaTimestamp })} />
            ) : enabled ? (
                <div>
                    <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={signed}
                            onChange={(e) => onSign(e.target.checked)}
                            className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/50 accent-primary shrink-0"
                        />
                        <span className="text-xs text-gray-600 leading-relaxed">
                            Confirmo que he revisado y apruebo que la información registrada en esta bitácora de obra es verídica y conforme. Mi firma digital constituye el aval de lo aquí documentado.
                        </span>
                    </label>
                    {signed && user && (
                        <div className="mt-3 p-3 bg-green-50 rounded-lg">
                            <FirmaInfo data={{ nombre: `${user.nombre} ${user.apellido}`, email: user.email, cedula: user.cedula, cargo: user.cargo }} timestamp="" />
                        </div>
                    )}
                </div>
            ) : (
                <p className="text-xs text-text-light">Pendiente — Solo puede firmar el usuario correspondiente.</p>
            )}
        </div>
    );
}
