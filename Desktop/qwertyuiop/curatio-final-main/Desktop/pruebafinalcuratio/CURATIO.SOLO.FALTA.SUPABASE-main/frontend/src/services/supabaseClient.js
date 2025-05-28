import { createClient } from '@supabase/supabase-js';

// Replace with your actual Supabase project URL and public API key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Validar conexión a Supabase al cargar el cliente
(async () => {
  try {
    const { error } = await supabase.from('transactions').select('*').limit(1);
    if (error) {
      console.error('[Supabase] Error de conexión inicial:', error.message);
    } else {
      console.log('[Supabase] Conexión inicial exitosa.');
    }
  } catch (err) {
    console.error('[Supabase] Excepción al validar conexión:', err);
  }
})(); 