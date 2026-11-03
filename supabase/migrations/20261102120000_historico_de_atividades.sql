-- Histórico de atividades (issue #61): alimenta o card "Últimas transações" do dashboard,
-- que mostra também os registros alterados e removidos — coisa que não dá para derivar
-- das tabelas de domínio, porque a linha removida deixa de existir.
--
-- Cada tabela de lançamentos (entradas, saidas, transacoes_cartao) ganha um trigger que
-- grava uma cópia dos dados do registro a cada adição, alteração e remoção. Fica no banco
-- (e não nos use-cases) para cobrir também as remoções em série e a exclusão de cartão
-- em cascata. A escrita é só do trigger: o usuário apenas lê o próprio histórico.

create table if not exists public.atividades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('ENTRADA', 'SAIDA', 'CARTAO')),
  acao text not null check (acao in ('ADICIONADO', 'ALTERADO', 'REMOVIDO')),
  -- Sem FK de propósito: o registro removido (ou a categoria) pode não existir mais.
  registro_id uuid not null,
  descricao text not null,
  valor numeric(12, 2) not null,
  data date not null,
  categoria_id uuid,
  criado_em timestamptz not null default now()
);

create index if not exists atividades_user_criado_em_idx on public.atividades (user_id, criado_em desc);
create index if not exists atividades_registro_id_idx on public.atividades (registro_id);

alter table public.atividades enable row level security;

create policy "atividades_select_own" on public.atividades
  for select using (user_id = auth.uid());

create policy "atividades_insert_own" on public.atividades
  for insert with check (user_id = auth.uid());

-- ---------------------------------------------------------------- trigger
create or replace function public.registrar_atividade()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Colunas de controle: mudar só elas (ex.: encerrar a série) não é uma alteração do usuário.
  controle constant text[] := array['atualizado_em', 'editado_manualmente', 'serie_encerrada'];
  registro jsonb;
  acao_registrada text;
begin
  -- Sem usuário autenticado (job de recorrência, manutenção, exclusão de conta) não é
  -- uma ação do usuário e não entra no histórico.
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    acao_registrada := 'ADICIONADO';
    registro := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    acao_registrada := 'REMOVIDO';
    registro := to_jsonb(old);
  else
    if (to_jsonb(old) - controle) = (to_jsonb(new) - controle) then
      return new;
    end if;
    acao_registrada := 'ALTERADO';
    registro := to_jsonb(new);
  end if;

  insert into public.atividades (user_id, tipo, acao, registro_id, descricao, valor, data, categoria_id)
  values (
    (registro ->> 'user_id')::uuid,
    tg_argv[0],
    acao_registrada,
    (registro ->> 'id')::uuid,
    registro ->> 'descricao',
    (registro ->> 'valor')::numeric,
    (registro ->> 'data')::date,
    (registro ->> 'categoria_id')::uuid
  );

  return coalesce(new, old);
end;
$$;

-- Só deve rodar via trigger.
revoke execute on function public.registrar_atividade() from public, anon, authenticated;

drop trigger if exists registrar_atividade on public.entradas;
create trigger registrar_atividade
  after insert or update or delete on public.entradas
  for each row execute function public.registrar_atividade('ENTRADA');

drop trigger if exists registrar_atividade on public.saidas;
create trigger registrar_atividade
  after insert or update or delete on public.saidas
  for each row execute function public.registrar_atividade('SAIDA');

drop trigger if exists registrar_atividade on public.transacoes_cartao;
create trigger registrar_atividade
  after insert or update or delete on public.transacoes_cartao
  for each row execute function public.registrar_atividade('CARTAO');
