# Kit inicial - Grana

## O que tem aqui

```txt
supabase/schema.sql                   -> vendas, códigos de acesso e RLS
supabase/app-data-schema.sql          -> dados privados do sistema financeiro
lib/supabase/server.ts                -> cliente admin para rotas de API
lib/supabase/client.ts                -> cliente do navegador
app/page.tsx                          -> landing com direcionamento para WhatsApp
app/api/checkout/route.ts             -> checkout Mercado Pago opcional, desativado na landing
app/api/webhook/mercadopago/route.ts  -> confirma pagamento e gera código, se Mercado Pago for usado depois
app/api/access/activate/route.ts      -> valida o código digitado pelo cliente
.env.local.example                    -> variáveis necessárias
```

## Passo a passo

1. No SQL Editor do Supabase, rode `supabase/schema.sql` e `supabase/app-data-schema.sql`.

2. Preencha as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Project Settings > API.
   - `SUPABASE_SERVICE_ROLE_KEY`: Project Settings > API, campo `service_role`.
   - `NEXT_PUBLIC_WHATSAPP_NUMBER`: número que recebe as compras, em formato internacional e somente números. Exemplo: `5511999999999`.
   - `NEXT_PUBLIC_SITE_URL`: URL pública do site, sem barra no final.
   - `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `RESEND_API_KEY` e `RESEND_FROM_EMAIL`: opcionais por enquanto.

3. Para vender agora, o botão da página inicial abre o WhatsApp com a mensagem de compra do acesso vitalício.

4. Depois da venda, crie ou envie o código de acesso conforme o fluxo do Supabase.

5. Se quiser reativar Mercado Pago no futuro, configure:
   - URL do webhook: `https://seusite.com/api/webhook/mercadopago`.
   - Evento: pagamentos (`payment`).
   - Chave secreta em `MERCADOPAGO_WEBHOOK_SECRET`.
   - Remetente no Resend para envio automático do código.

## Pendências úteis

- Painel admin simples para ver vendas e gerar códigos manuais.
- Fluxo de reembolso: marcar `user_access.revoked_at` e `lifetime_access = false`.
