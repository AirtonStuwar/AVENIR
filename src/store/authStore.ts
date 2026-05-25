// authStore.ts
import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';
import type { Usuario } from '../features/solicitud/types/solicitud';

interface AuthState {
  user:           User | null;
  session:        Session | null;
  isLoading:      boolean;
  userRole:       number | null;
  usuarioProfile: Usuario | null;
  setSession:     (session: Session | null) => Promise<void>;
  setLoading:     (loading: boolean) => void;
  logout:         () => void;
  fetchUserRole:  (userId: string) => Promise<void>;
  initialize:     () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:           null,
  session:        null,
  isLoading:      true,
  userRole:       null,
  usuarioProfile: null,

  setSession: async (session) => {
    set({ session, user: session?.user ?? null });
    if (session?.user?.id) {
      await get().fetchUserRole(session.user.id);
    } else {
      set({ usuarioProfile: null })
    }
    set({ isLoading: false });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  logout: () => {
    supabase.auth.signOut();
    set({ user: null, session: null, isLoading: false, userRole: null, usuarioProfile: null });
  },

  fetchUserRole: async (userId: string) => {
    try {
      const [rolRes, profileRes] = await Promise.all([
        supabase.from('usuario_rol').select('rol').eq('usuario', userId).maybeSingle(),
        supabase.from('usuario').select('*').eq('id', userId).maybeSingle(),
      ]);

      if (rolRes.error) console.error('Error fetching user role:', rolRes.error);
      if (profileRes.error) console.error('Error fetching usuario profile:', profileRes.error);

      set({
        userRole:       rolRes.data?.rol ?? null,
        usuarioProfile: (profileRes.data as Usuario | null) ?? null,
      });
    } catch (error) {
      console.error('Error:', error);
      set({ userRole: null, usuarioProfile: null });
    }
  },

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await get().setSession(session);

    supabase.auth.onAuthStateChange(async (_event, session) => {
      await get().setSession(session);
    });
  },
}));
