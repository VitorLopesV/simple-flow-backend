-- Perfil editável (PATCH /auth/me): telefone e foto passam a viver em `profiles`, que
-- vira a fonte do nome/telefone/foto devolvidos ao frontend. A foto é guardada como
-- data URL (o frontend já envia recortada e reduzida, dezenas de KB) — fica aqui e não
-- em user_metadata porque o metadata vai dentro do JWT e incharia todo token.

alter table public.profiles
  add column if not exists telefone text,
  add column if not exists foto_url text;

-- Só dígitos, DDD + número (10 ou 11) — espelha a validação do schema Zod.
alter table public.profiles
  drop constraint if exists profiles_telefone_check;

alter table public.profiles
  add constraint profiles_telefone_check
  check (telefone is null or telefone ~ '^[0-9]{10,11}$');

-- O cadastro passa a aceitar telefone: ele chega em raw_user_meta_data junto com o nome.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, telefone)
  values (new.id, new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'telefone');
  return new;
end;
$$;

-- Mesmo cuidado de 20260822120300_fix_security_advisors.sql: a function é
-- SECURITY DEFINER e só deve rodar via trigger, nunca via RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
