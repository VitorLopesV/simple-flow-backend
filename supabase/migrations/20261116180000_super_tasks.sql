-- Super task do módulo Organização (issue #65): agrupa tarefas filhas de um trabalho grande
-- (estilo epic). Não pontua e nunca entra no sprint, por isso fica numa tabela própria e não em
-- `tarefas`. Progresso e estado (não iniciada / em andamento / concluída) são DERIVADOS das filhas
-- na leitura; só `concluida_em` é gravado (null = aberta ou reaberta), para a trava de edição.

create table if not exists public.super_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Sem cascade: a exclusão de uma área decide o destino das Super tasks antes (RemoverArea).
  area_id uuid not null references public.areas (id),
  titulo text not null check (char_length(btrim(titulo)) > 0),
  notas text,
  data_termino date,
  concluida_em timestamptz,
  arquivada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists super_tasks_user_area_idx on public.super_tasks (user_id, area_id);
create index if not exists super_tasks_area_idx on public.super_tasks (area_id);

alter table public.super_tasks enable row level security;

create policy "super_tasks_select_own" on public.super_tasks for select using (user_id = auth.uid());
create policy "super_tasks_insert_own" on public.super_tasks for insert with check (user_id = auth.uid());
create policy "super_tasks_update_own" on public.super_tasks for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "super_tasks_delete_own" on public.super_tasks for delete using (user_id = auth.uid());

drop trigger if exists set_atualizado_em on public.super_tasks;
create trigger set_atualizado_em
  before update on public.super_tasks
  for each row execute function public.set_atualizado_em();

-- A Super task não existe na Rotina: reaproveita o trigger que barra a área do sistema nas tarefas.
drop trigger if exists proteger_rotina_de_tarefas on public.super_tasks;
create trigger proteger_rotina_de_tarefas
  before insert or update of area_id on public.super_tasks
  for each row execute function public.proteger_rotina_de_tarefas();

-- Vínculo opcional da tarefa com a Super task (um nível só: a filha é sempre uma tarefa comum).
-- Excluir a Super task solta as filhas; a opção "excluir junto" é feita pela aplicação.
alter table public.tarefas
  add column if not exists super_task_id uuid references public.super_tasks (id) on delete set null;

create index if not exists tarefas_super_task_idx on public.tarefas (super_task_id) where super_task_id is not null;
