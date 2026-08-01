import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Espera um POST com { userId, code } — userId vem da sessão já autenticada
 * do Supabase Auth (o cliente já criou a conta antes de chamar essa rota).
 *
 * Toda a validação do código acontece aqui, no servidor, nunca no navegador.
 */
export async function POST(req: NextRequest) {
  const { userId, code } = await req.json();

  if (!userId || !code) {
    return NextResponse.json({ error: "dados incompletos" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const normalizedCode = String(code).trim().toUpperCase();

  const { data: accessCode, error } = await supabase
    .from("access_codes")
    .select("id, used")
    .eq("code", normalizedCode)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "erro ao validar código" }, { status: 500 });
  }

  if (!accessCode) {
    return NextResponse.json({ error: "Código inválido." }, { status: 404 });
  }

  if (accessCode.used) {
    return NextResponse.json({ error: "Esse código já foi utilizado." }, { status: 409 });
  }

  // Marca o código como usado
  const { error: updateError } = await supabase
    .from("access_codes")
    .update({ used: true, used_by_user_id: userId, used_at: new Date().toISOString() })
    .eq("id", accessCode.id);

  if (updateError) {
    return NextResponse.json({ error: "erro ao ativar código" }, { status: 500 });
  }

  // Libera o acesso vitalício pro usuário
  const { error: accessError } = await supabase
    .from("user_access")
    .upsert({ user_id: userId, lifetime_access: true, activated_at: new Date().toISOString() });

  if (accessError) {
    return NextResponse.json({ error: "erro ao liberar acesso" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
