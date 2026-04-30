import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Building2, Eye, Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuthStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await login(email, password);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Error al iniciar sesión');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f2847] via-[#1B3A6B] to-[#1a4a7a] relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#F5A623]/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#1B3A6B]/50 rounded-full blur-3xl"></div>
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-2xl"></div>
            </div>

            <div className="animate-scaleIn relative z-10 w-full max-w-md mx-4 pb-12">
                {/* Logo header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-5 shadow-2xl">
                        <Building2 className="w-10 h-10 text-[#F5A623]" />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Constructora AED</h1>
                    <p className="text-blue-200/80 mt-2 text-sm font-medium">Bitácora de Obra — v1.0</p>
                </div>

                {/* Login card */}
                <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 sm:p-10 border border-white/50">
                    <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center">Iniciar Sesión</h2>

                    {error && (
                        <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl text-sm animate-fadeIn">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span className="font-medium">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Correo electrónico</label>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100/80 border border-gray-200 shrink-0 text-gray-400">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30 focus:border-[#1B3A6B] transition-all placeholder:text-gray-400 font-medium text-gray-800 h-12"
                                    placeholder="correo@ejemplo.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Contraseña</label>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100/80 border border-gray-200 shrink-0 text-gray-400">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <div className="relative w-full">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30 focus:border-[#1B3A6B] transition-all placeholder:text-gray-400 font-medium text-gray-800 h-12 tracking-wider"
                                        placeholder="••••••••"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        <Eye className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-12 mt-2 bg-gradient-to-r from-[#1B3A6B] to-[#2a5298] text-white font-bold rounded-xl shadow-lg shadow-[#1B3A6B]/25 hover:shadow-xl hover:shadow-[#1B3A6B]/30 transform hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none text-[15px]"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                    Ingresando...
                                </span>
                            ) : 'Ingresar al Sistema'}
                        </button>
                    </form>
                </div>

                {/* Test credentials hint */}
                <div className="mt-8 text-center text-[13px] text-blue-200/60 font-medium">
                    <p>Credenciales de prueba: admin@aed.com / AED2024!</p>
                </div>
            </div>
        </div>
    );
}
