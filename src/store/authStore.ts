// authStore.ts
import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  userRole: number | null;
  setSession: (session: Session | null) => Promise<void>;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  fetchUserRole: (userId: string) => Promise<void>;
  initialize: () => Promise<void>; // Nueva función de inicialización
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  userRole: null,
  
  setSession: async (session) => {
    set({ 
      session, 
      user: session?.user ?? null,
    });
    
    if (session?.user?.id) {
      await get().fetchUserRole(session.user.id);
    }
    set({ isLoading: false });
  },
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  logout: () => {
    supabase.auth.signOut();
    set({ 
      user: null, 
      session: null, 
      isLoading: false,
      userRole: null
    });
  },
  
  fetchUserRole: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('usuario_rol')
        .select('rol')
        .eq('usuario', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching user role:', error);
        set({ userRole: null });
        return;
      }
      
      set({ userRole: data?.rol ?? null });
      console.log('User role fetched:', data?.rol);
    } catch (error) {
      console.error('Error:', error);
      set({ userRole: null });
    }
  },
  
  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await get().setSession(session);
    
    // Escuchar cambios en la autenticación
    supabase.auth.onAuthStateChange(async (_event, session) => {
      await get().setSession(session);
    });
  },
}));