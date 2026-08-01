import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { code } = await req.json();

  if (!code) {
    return NextResponse.json({ error: "Informe o c\u00f3digo de acesso." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const normalizedCode = String(code).trim().toUpperCase();

  const { data: accessCode, error } = await supabase
    .from("access_codes")
    .select("id, used")
    .eq("code", normalizedCode)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "N\u00e3o foi poss\u00edvel validar o c\u00f3digo agora." }, { status: 500 });
  }

  if (!accessCode) {
    return NextResponse.json({ error: "C\u00f3digo inv\u00e1lido." }, { status: 404 });
  }

  if (accessCode.used) {
    return NextResponse.json({ error: "Esse c\u00f3digo j\u00e1 foi utilizado." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, code: normalizedCode });
}
