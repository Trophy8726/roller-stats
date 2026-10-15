// Public values: the publishable key is meant to ship in browser code. Never put the secret key here.
// `.env` holds production (build, tests); `.env.development` holds staging (npm run dev).
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is missing: see .env / .env.development`);
  return value;
}

export const SUPABASE_URL = required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL);
export const SUPABASE_KEY = required('VITE_SUPABASE_KEY', import.meta.env.VITE_SUPABASE_KEY);
