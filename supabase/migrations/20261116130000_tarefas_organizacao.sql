-- Tarefas do módulo Organização (issue #64): cada tarefa pertence a exatamente uma área
-- e nunca à Rotina (área do sistema). Só o título é obrigatório; o resto é opcional
-- (tempo, dificuldade, prioridade e dia só são exigidos para entrar no sprint, issue #69).

create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Sem cascade: a exclusão de uma área decide o destino das tarefas antes (RemoverArea).
  area_id uuid not null references public.areas (id),
  titulo text not null check (char_length(btrim(titulo)) > 0),
  dia date,
  hora time,
  tempo_estimado_minutos integer check (tempo_estimado_minutos in (15, 30, 60, 120, 240)),
  dificuldade text check (dificuldade in ('FACIL', 'MEDIA', 'DIFICIL')),
  prioridade text check (prioridade in ('BAIXA', 'MEDIA', 'ALTA')),
  notas text,
  arquivada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists tarefas_user_area_idx on public.tarefas (user_id, area_id);
create index if not exists tarefas_area_idx on public.tarefas (area_id);

alter table public.tarefas enable row level security;

create policy "tarefas_select_own" on public.tarefas for select using (user_id = auth.uid());
create policy "tarefas_insert_own" on public.tarefas for insert with check (user_id = auth.uid());
create policy "tarefas_update_own" on public.tarefas for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tarefas_delete_own" on public.tarefas for delete using (user_id = auth.uid());

drop trigger if exists set_atualizado_em on public.tarefas;
create trigger set_atualizado_em
  before update on public.tarefas
  for each row execute function public.set_atualizado_em();

-- A Rotina só guarda itens de rotina: barra também no banco tarefa nessa área.
create or replace function public.proteger_rotina_de_tarefas()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.areas where id = new.area_id and sistema) then
    raise exception 'A área Rotina não aceita tarefas.';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_rotina_de_tarefas on public.tarefas;
create trigger proteger_rotina_de_tarefas
  before insert or update of area_id on public.tarefas
  for each row execute function public.proteger_rotina_de_tarefas();

revoke execute on function public.proteger_rotina_de_tarefas() from public, anon, authenticated;
