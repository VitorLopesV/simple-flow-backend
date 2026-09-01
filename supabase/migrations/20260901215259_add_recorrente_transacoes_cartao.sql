alter table public.transacoes_cartao
  add column recorrente boolean not null default false;
