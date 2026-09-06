import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase env vars. Create a .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

// Note: we intentionally do NOT pass a generated `Database` generic here.
// Row shapes are defined by hand in `src/types/database.ts` and applied at
// the query-function call sites (see `src/lib/queries.ts`), which keeps the
// client simple while still giving full type safety in application code.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
