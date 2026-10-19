import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from '../config';

// The session is kept on the device (localStorage) so the app opens signed in without network.
// PKCE: Google sends the browser back with `?code=`, which leaves the `#/…` routes alone.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});
