import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para uso SÓ no servidor (API routes).
 * Usa a service role key, que ignora RLS — por isso NUNCA deve
 * ser importado em um componente client-side nem exposta com NEXT_PUBLIC_.
 */
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
