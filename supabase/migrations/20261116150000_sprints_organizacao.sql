-- Sprint semanal do módulo Organização (issue #67): segunda 00:00 a sexta 23:59 (America/Sao_Paulo),
-- único por usuário por semana. `inicio` é sempre uma segunda e `fim` a sexta da mesma semana.
-- `rotina_gerada_em` marca que as ocorrências de rotina da semana já foram gravadas (contrato congelado).
-- `situacao` ABERTO/FECHADO: o fechamento é da issue #71.

create table if not exists public.sprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  inicio date not null,
  fim date not null,
  situacao text not null default 'ABERTO' check (situacao in ('ABERTO', 'FECHADO')),
  rotina_gerada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint sprints_semana_check check (extract(isodow from inicio) = 1 and fim = inicio + 4),
  constraint sprints_user_inicio_key unique (user_id, inicio)
);

alter table public.sprints enable row level security;

create policy "sprints_select_own" on public.sprints for select using (user_id = auth.uid());
create policy "sprints_insert_own" on public.sprints for insert with check (user_id = auth.uid());
create policy "sprints_update_own" on public.sprints for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sprints_delete_own" on public.sprints for delete using (user_id = auth.uid());

drop trigger if exists set_atualizado_em on public.sprints;
create trigger set_atualizado_em
  before update on public.sprints
  for each row execute function public.set_atualizado_em();

-- Ocorrências de rotina do sprint. `nome` é cópia do item na hora da geração e `item_id` fica nulo se o
-- item for removido: alterar ou apagar a rotina depois da geração não muda o sprint em andamento.
-- `indice` é a posição da vez dentro do dia para o item; com (sprint, item, data) forma a chave de
-- idempotência da geração. `lembrete` = ocorrência de sábado/domingo (fora do sprint, sem pontos).
create table if not exists public.ocorrencias_rotina (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sprint_id uuid not null references public.sprints (id) on delete cascade,
  item_id uuid references public.itens_rotina (id) on delete set null,
  nome text not null,
  data date not null,
  hora text check (hora is null or hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  indice integer not null check (indice >= 0),
  ordem integer not null check (ordem >= 0),
  lembrete boolean not null default false,
  concluida_em timestamptz,
  criado_em timestamptz not null default now(),
  constraint ocorrencias_rotina_geracao_key unique (sprint_id, item_id, data, indice)
);

create index if not exists ocorrencias_rotina_sprint_idx on public.ocorrencias_rotina (sprint_id);
create index if not exists ocorrencias_rotina_user_idx on public.ocorrencias_rotina (user_id);
create index if not exists ocorrencias_rotina_item_idx on public.ocorrencias_rotina (item_id);

alter table public.ocorrencias_rotina enable row level security;

create policy "ocorrencias_rotina_select_own" on public.ocorrencias_rotina for select using (user_id = auth.uid());
create policy "ocorrencias_rotina_insert_own" on public.ocorrencias_rotina for insert with check (user_id = auth.uid());
create policy "ocorrencias_rotina_update_own" on public.ocorrencias_rotina for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ocorrencias_rotina_delete_own" on public.ocorrencias_rotina for delete using (user_id = auth.uid());
