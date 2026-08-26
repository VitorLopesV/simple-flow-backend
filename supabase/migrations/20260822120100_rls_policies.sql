-- Habilita Row Level Security e define as policies de isolamento multi-tenant.
-- Todas as queries do backend rodam com um client Supabase escopado no JWT do usuário
-- (ver infrastructure/supabase/supabaseClientForRequest.ts), então auth.uid() resolve
-- corretamente e essas policies são a fronteira real de isolamento entre usuários.

alter table public.profiles enable row level security;
alter table public.categorias enable row level security;
alter table public.cartoes enable row level security;
alter table public.faturas enable row level security;
alter table public.transacoes_cartao enable row level security;
alter table public.entradas enable row level security;
alter table public.saidas enable row level security;

-- ---------------------------------------------------------------- profiles
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- ---------------------------------------------------------------- categorias
-- Leitura: categorias do sistema (user_id nulo) + as próprias do usuário.
-- Escrita: usuário só cria/edita/remove as próprias (nunca as padrão do sistema).
create policy "categorias_select" on public.categorias
  for select using (user_id is null or user_id = auth.uid());

create policy "categorias_insert_own" on public.categorias
  for insert with check (user_id = auth.uid());

create policy "categorias_update_own" on public.categorias
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "categorias_delete_own" on public.categorias
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------- cartoes
create policy "cartoes_all_own" on public.cartoes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- faturas
create policy "faturas_all_own" on public.faturas
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- transacoes_cartao
create policy "transacoes_cartao_all_own" on public.transacoes_cartao
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- entradas
create policy "entradas_all_own" on public.entradas
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- saidas
create policy "saidas_all_own" on public.saidas
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
