-- Esquema inicial do SimpleFlow (Sistema de Controle Financeiro).
-- Todas as tabelas de domínio carregam `user_id` para isolamento multi-tenant via RLS
-- (ver migration seguinte 20260822120100_rls_policies.sql).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles
-- Estende auth.users com dados de perfil próprios da aplicação.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  criado_em timestamptz not null default now()
);

-- Cria a linha de profile automaticamente quando um usuário se cadastra no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, new.raw_user_meta_data ->> 'nome');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- categorias
-- user_id nulo = categoria padrão do sistema, visível a todos; preenchido = categoria custom do usuário.
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('CONTA_FIXA', 'CONTA_VARIAVEL', 'RENDA', 'INVESTIMENTO')),
  movimento text not null check (movimento in ('ENTRADA', 'SAIDA')),
  cor text not null,
  criado_em timestamptz not null default now()
);

create index if not exists categorias_user_id_idx on public.categorias (user_id);

-- ---------------------------------------------------------------- cartoes
create table if not exists public.cartoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  bandeira text not null check (bandeira in ('VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD')),
  ultimos_digitos char(4) not null,
  limite numeric(12, 2) not null check (limite >= 0),
  dia_fechamento smallint not null check (dia_fechamento between 1 and 28),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 28),
  cor text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index if not exists cartoes_user_id_idx on public.cartoes (user_id);

-- ---------------------------------------------------------------- faturas
create table if not exists public.faturas (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid not null references public.cartoes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  competencia char(7) not null, -- formato YYYY-MM
  fechamento date not null,
  vencimento date not null,
  total numeric(12, 2) not null default 0,
  status text not null check (status in ('ABERTA', 'FECHADA', 'PAGA', 'ATRASADA')) default 'ABERTA',
  pago_em date,
  unique (cartao_id, competencia)
);

create index if not exists faturas_user_id_idx on public.faturas (user_id);
create index if not exists faturas_cartao_competencia_idx on public.faturas (cartao_id, competencia);

-- ---------------------------------------------------------------- transacoes_cartao
create table if not exists public.transacoes_cartao (
  id uuid primary key default gen_random_uuid(),
  fatura_id uuid not null references public.faturas (id) on delete cascade,
  cartao_id uuid not null references public.cartoes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  categoria_id uuid not null references public.categorias (id),
  descricao text not null,
  valor numeric(12, 2) not null check (valor > 0),
  data date not null,
  parcela_atual smallint not null default 1,
  total_parcelas smallint not null default 1
);

create index if not exists transacoes_cartao_user_id_idx on public.transacoes_cartao (user_id);
create index if not exists transacoes_cartao_fatura_id_idx on public.transacoes_cartao (fatura_id);

-- ---------------------------------------------------------------- entradas
create table if not exists public.entradas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  categoria_id uuid not null references public.categorias (id),
  descricao text not null,
  valor numeric(12, 2) not null check (valor > 0),
  data date not null,
  recorrente boolean not null default false,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists entradas_user_id_data_idx on public.entradas (user_id, data);
create index if not exists entradas_categoria_id_idx on public.entradas (categoria_id);

-- ---------------------------------------------------------------- saidas
create table if not exists public.saidas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  categoria_id uuid not null references public.categorias (id),
  descricao text not null,
  valor numeric(12, 2) not null check (valor > 0),
  data date not null,
  status text not null check (status in ('PAGO', 'PENDENTE')) default 'PENDENTE',
  forma_pagamento text not null
    check (forma_pagamento in ('DINHEIRO', 'PIX', 'DEBITO', 'BOLETO', 'CARTAO_CREDITO')),
  cartao_id uuid references public.cartoes (id) on delete set null,
  recorrente boolean not null default false,
  observacao text,
  automatica boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists saidas_user_id_data_idx on public.saidas (user_id, data);
create index if not exists saidas_categoria_id_idx on public.saidas (categoria_id);
create index if not exists saidas_cartao_id_idx on public.saidas (cartao_id);

-- ---------------------------------------------------------------- trigger genérico de atualizado_em
create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists set_atualizado_em on public.entradas;
create trigger set_atualizado_em
  before update on public.entradas
  for each row execute function public.set_atualizado_em();

drop trigger if exists set_atualizado_em on public.saidas;
create trigger set_atualizado_em
  before update on public.saidas
  for each row execute function public.set_atualizado_em();
