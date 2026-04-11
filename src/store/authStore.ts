import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean; // 👈 Nuevo estado
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void; // 👈 Para controlar el inicio
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true, // Empezamos cargando
  setSession: (session) => set({ 
    session, 
    user: session?.user ?? null,
    isLoading: false // Cuando llega la sesión, dejamos de cargar
  }),
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => set({ user: null, session: null, isLoading: false }),
}));