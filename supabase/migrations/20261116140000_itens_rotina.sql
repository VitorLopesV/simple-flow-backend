-- Itens de rotina do módulo Organização (issue #66): as "missões" diárias da área Rotina.
-- Regra de repetição em colunas: modo DIAS_DA_SEMANA (dias_semana, 1 = segunda ... 5 = sexta)
-- ou A_CADA_N_DIAS (intervalo_dias + data_inicial). `vezes` é a lista de ocorrências no dia:
-- [{ "hora": "08:00" }, { "hora": null }], com pelo menos uma (hora opcional).
-- Itens não têm pontuação: a rotina pontua por dia (geração das ocorrências: issue #67).

create table if not exists public.itens_rotina (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  area_id uuid not null references public.areas (id),
  nome text not null check (char_length(btrim(nome)) > 0),
  modo text not null check (modo in ('DIAS_DA_SEMANA', 'A_CADA_N_DIAS')),
  dias_semana smallint[],
  intervalo_dias integer check (intervalo_dias >= 1),
  data_inicial date,
  vezes jsonb not null check (jsonb_typeof(vezes) = 'array' and jsonb_array_length(vezes) >= 1),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint itens_rotina_regra_check check (
    (modo = 'DIAS_DA_SEMANA'
      and coalesce(array_length(dias_semana, 1), 0) >= 1
      and dias_semana <@ array[1, 2, 3, 4, 5]::smallint[]
      and intervalo_dias is null and data_inicial is null)
    or
    (modo = 'A_CADA_N_DIAS'
      and dias_semana is null
      and intervalo_dias is not null and data_inicial is not null)
  )
);

create index if not exists itens_rotina_user_idx on public.itens_rotina (user_id);
create index if not exists itens_rotina_area_idx on public.itens_rotina (area_id);

alter table public.itens_rotina enable row level security;

create policy "itens_rotina_select_own" on public.itens_rotina for select using (user_id = auth.uid());
create policy "itens_rotina_insert_own" on public.itens_rotina for insert with check (user_id = auth.uid());
create policy "itens_rotina_update_own" on public.itens_rotina for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "itens_rotina_delete_own" on public.itens_rotina for delete using (user_id = auth.uid());

drop trigger if exists set_atualizado_em on public.itens_rotina;
create trigger set_atualizado_em
  before update on public.itens_rotina
  for each row execute function public.set_atualizado_em();

-- Itens de rotina só vivem na área do sistema (Rotina), do mesmo usuário.
create or replace function public.proteger_area_de_itens_rotina()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.areas where id = new.area_id and sistema and user_id = new.user_id
  ) then
    raise exception 'Itens de rotina só pertencem à área Rotina.';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_area_de_itens_rotina on public.itens_rotina;
create trigger proteger_area_de_itens_rotina
  before insert or update of area_id on public.itens_rotina
  for each row execute function public.proteger_area_de_itens_rotina();

revoke execute on function public.proteger_area_de_itens_rotina() from public, anon, authenticated;
