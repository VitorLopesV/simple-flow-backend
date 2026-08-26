-- Correções apontadas pelo security advisor após as migrations anteriores:
-- 1) function_search_path_mutable em set_atualizado_em (faltava search_path fixo)
-- 2) handle_new_user era chamável via RPC pelos papéis anon/authenticated
--    (SECURITY DEFINER sem revogar EXECUTE) — só deve rodar via trigger.

create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
