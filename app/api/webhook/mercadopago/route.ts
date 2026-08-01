import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { supabaseAdmin } from "@/lib/supabase/server";

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

async function enviarCodigoPorEmail(email: string | undefined, codigo: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!email || !apiKey || !from) {
    console.warn("Codigo de acesso gerado, mas o envio de email nao esta configurado.");
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Seu codigo de acesso ao Grana",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#14161a">
          <h1>Seu acesso ao Grana foi aprovado</h1>
          <p>Use o codigo abaixo para ativar sua conta:</p>
          <p style="font-size:22px;font-weight:700;letter-spacing:1px">${codigo}</p>
          <p>Depois, acesse o Grana, crie sua conta com este email e informe o codigo na tela de ativacao.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao enviar email de acesso: ${body}`);
  }
}

function validarAssinatura(
  signatureHeader: string | null,
  requestIdHeader: string | null,
  dataId: string | null
): boolean {
  if (!signatureHeader || !requestIdHeader || !dataId) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.trim().split("="))
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const template = `id:${dataId};request-id:${requestIdHeader};ts:${ts};`;
  const expected = crypto
    .createHmac("sha256", process.env.MERCADOPAGO_WEBHOOK_SECRET!)
    .update(template)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(v1);
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function gerarCodigo(): string {
  const bloco = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `GRANA-${bloco()}-${bloco()}`;
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");

  if (!dataId) {
    return NextResponse.json({ error: "pagamento nao informado" }, { status: 400 });
  }

  const signature = req.headers.get("x-signature");
  const requestId = req.headers.get("x-request-id");

  if (!validarAssinatura(signature, requestId, dataId)) {
    return NextResponse.json({ error: "assinatura invalida" }, { status: 401 });
  }

  const supabase = supabaseAdmin();

  try {
    const payment = new Payment(mpClient);
    const paymentData = await payment.get({ id: dataId });

    if (paymentData.status !== "approved") {
      await supabase.from("purchases").upsert(
        {
          mp_payment_id: String(paymentData.id),
          status: paymentData.status ?? "pending",
          amount: paymentData.transaction_amount,
          buyer_email: paymentData.payer?.email,
          raw_payload: paymentData as unknown as object,
        },
        { onConflict: "mp_payment_id" }
      );
      return NextResponse.json({ ok: true });
    }

    const { data: existing } = await supabase
      .from("purchases")
      .select("id")
      .eq("mp_payment_id", String(paymentData.id))
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, already_processed: true });
    }

    const { data: purchase, error: purchaseError } = await supabase
      .from("purchases")
      .insert({
        mp_payment_id: String(paymentData.id),
        status: "approved",
        amount: paymentData.transaction_amount,
        buyer_email: paymentData.payer?.email,
        raw_payload: paymentData as unknown as object,
      })
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    const codigo = gerarCodigo();
    await supabase.from("access_codes").insert({
      code: codigo,
      purchase_id: purchase.id,
    });

    await enviarCodigoPorEmail(paymentData.payer?.email, codigo);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao processar webhook do Mercado Pago:", error);
    return NextResponse.json({ error: "erro interno" }, { status: 500 });
  }
}
