import type { AuthResponse } from '@supabase/supabase-js';
import { supabase } from '../../../api/supabase';

export const loginWithEmail = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (response.error) throw response.error;
  return response;
};