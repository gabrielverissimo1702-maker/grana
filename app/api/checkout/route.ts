import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";

const PRECO_ACESSO_VITALICIO = 97;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith("#")) return null;
  return value;
}

export async function POST() {
  const accessToken = getRequiredEnv("MERCADOPAGO_ACCESS_TOKEN");
  const siteUrl = getRequiredEnv("NEXT_PUBLIC_SITE_URL");

  if (!accessToken) {
    return NextResponse.json(
      { error: "Mercado Pago não configurado: informe MERCADOPAGO_ACCESS_TOKEN." },
      { status: 500 }
    );
  }

  if (!siteUrl) {
    return NextResponse.json(
      { error: "URL pública do site não configurada: informe NEXT_PUBLIC_SITE_URL." },
      { status: 500 }
    );
  }

  try {
    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: "grana-acesso-vitalicio",
            title: "Grana - acesso vitalício",
            quantity: 1,
            currency_id: "BRL",
            unit_price: PRECO_ACESSO_VITALICIO,
          },
        ],
        back_urls: {
          success: `${siteUrl}/acesso/aprovado`,
          failure: `${siteUrl}/acesso/erro`,
          pending: `${siteUrl}/acesso/pendente`,
        },
        auto_return: "approved",
        notification_url: `${siteUrl}/api/webhook/mercadopago`,
      },
    });

    const checkoutUrl = result.init_point || result.sandbox_init_point;
    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "Mercado Pago não retornou uma URL de checkout." },
        { status: 502 }
      );
    }

    return NextResponse.json({ init_point: checkoutUrl });
  } catch (error) {
    console.error("Erro ao criar preferência de pagamento:", error);
    return NextResponse.json(
      { error: "Não foi possível iniciar o pagamento. Confira as credenciais do Mercado Pago." },
      { status: 500 }
    );
  }
}


