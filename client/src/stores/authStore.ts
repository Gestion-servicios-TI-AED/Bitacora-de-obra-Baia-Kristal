import { create } from 'zustand';
import api from '../lib/api';

interface User {
    id: string;
    nombre: string;
    apellido: string;
    cedula: string;
    cargo: string;
    email: string;
    tipoUsuario: string;
    usuarioProyectos?: any[];
    usuarioTorres?: any[];
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: localStorage.getItem('aed-token'),
    isAuthenticated: !!localStorage.getItem('aed-token'),
    isLoading: false,

    login: async (email: string, password: string) => {
        const res = await api.post('/auth/login', { email, password });
        const { token, user } = res.data;
        localStorage.setItem('aed-token', token);
        localStorage.setItem('aed-user', JSON.stringify(user));
        set({ token, user, isAuthenticated: true });
    },

    logout: () => {
        localStorage.removeItem('aed-token');
        localStorage.removeItem('aed-user');
        set({ token: null, user: null, isAuthenticated: false });
    },

    loadUser: async () => {
        try {
            set({ isLoading: true });
            const res = await api.get('/auth/me');
            set({ user: res.data, isAuthenticated: true, isLoading: false });
        } catch {
            localStorage.removeItem('aed-token');
            localStorage.removeItem('aed-user');
            set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
    },
}));
