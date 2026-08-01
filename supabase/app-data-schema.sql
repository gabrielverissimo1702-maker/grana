-- ============================================================
-- Grana — dados do sistema em si (não confundir com o schema de
-- vendas/códigos de acesso, que fica em outro arquivo).
-- Rode isso também no SQL editor do Supabase.
-- ============================================================

create table if not exists grana_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table grana_data enable row level security;

create policy "usuario le seus proprios dados"
  on grana_data for select
  using (auth.uid() = user_id);

create policy "usuario cria sua propria linha"
  on grana_data for insert
  with check (auth.uid() = user_id);

create policy "usuario atualiza seus proprios dados"
  on grana_data for update
  using (auth.uid() = user_id);
