-- Áreas do módulo Organização (issue #63): listas que agrupam tarefas.
-- Cada usuário tem a área do sistema "Rotina" (sistema = true), que não pode ser
-- renomeada nem excluída; as demais são criadas por ele. Nome único por usuário
-- (sem diferenciar maiúsculas), o que também impede criar outra "Rotina".

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) > 0),
  cor text not null,
  sistema boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists areas_user_nome_uniq on public.areas (user_id, lower(nome));
-- Uma única área do sistema por usuário.
create unique index if not exists areas_user_sistema_uniq on public.areas (user_id) where sistema;

alter table public.areas enable row level security;

create policy "areas_select_own" on public.areas for select using (user_id = auth.uid());
create policy "areas_insert_own" on public.areas for insert with check (user_id = auth.uid());
create policy "areas_update_own" on public.areas for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- A Rotina é protegida também no banco: o usuário não a apaga nem pelo PostgREST.
create policy "areas_delete_own" on public.areas for delete using (user_id = auth.uid() and not sistema);

drop trigger if exists set_atualizado_em on public.areas;
create trigger set_atualizado_em
  before update on public.areas
  for each row execute function public.set_atualizado_em();

-- Impede desmarcar a área do sistema ou trocar o nome dela.
create or replace function public.proteger_area_sistema()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.sistema and (new.sistema is distinct from old.sistema or new.nome is distinct from old.nome) then
    raise exception 'A área do sistema não pode ser renomeada.';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_area_sistema on public.areas;
create trigger proteger_area_sistema
  before update on public.areas
  for each row execute function public.proteger_area_sistema();

revoke execute on function public.proteger_area_sistema() from public, anon, authenticated;

-- Rotina para quem já existe (backfill)...
insert into public.areas (user_id, nome, cor, sistema)
select id, 'Rotina', '#6366f1', true from auth.users
on conflict do nothing;

-- ...e para quem se cadastrar daqui em diante: o cadastro (handle_new_user) passa a criá-la.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, telefone)
  values (new.id, new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'telefone');

  insert into public.areas (user_id, nome, cor, sistema)
  values (new.id, 'Rotina', '#6366f1', true);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
