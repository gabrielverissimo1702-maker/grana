-- ============================================================
-- Grana — schema de vendas por código de acesso vitalício
-- Rode isso no SQL editor do seu projeto Supabase.
-- Pode zerar as tabelas antigas do projeto anterior antes, se quiser.
-- ============================================================

-- Compras registradas a partir dos webhooks do Mercado Pago
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  mp_payment_id text unique not null,       -- id do pagamento no Mercado Pago
  status text not null default 'pending',   -- pending | approved | rejected
  amount numeric(10,2),
  buyer_email text,
  raw_payload jsonb,                        -- payload bruto do webhook, útil para depurar
  created_at timestamptz not null default now()
);

-- Códigos de acesso gerados após aprovação do pagamento
create table if not exists access_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  purchase_id uuid references purchases(id) on delete set null,
  used boolean not null default false,
  used_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

-- Liberação de acesso vitalício por usuário
create table if not exists user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lifetime_access boolean not null default false,
  activated_at timestamptz,
  revoked_at timestamptz
);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table purchases enable row level security;
alter table access_codes enable row level security;
alter table user_access enable row level security;

-- Ninguém acessa purchases/access_codes direto do cliente —
-- essas tabelas só devem ser lidas/escritas pelo backend (service role key),
-- por isso não criamos policies de select/insert para o público aqui.

-- Cada usuário só vê a PRÓPRIA linha de acesso
create policy "usuario ve seu proprio acesso"
  on user_access for select
  using (auth.uid() = user_id);

-- (a escrita em user_access também deve ocorrer só via backend/service role,
--  ao ativar um código — por isso não há policy de insert/update pro público)
