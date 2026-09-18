-- Adiciona o tipo de saída 'FARMACIA' às check constraints de tipo em saidas e transacoes_cartao.

alter table public.saidas
  drop constraint if exists saidas_tipo_check;

alter table public.saidas
  add constraint saidas_tipo_check
  check (tipo in ('TRANSPORTE', 'ALIMENTACAO', 'LAZER', 'CONTA', 'POUPANCA', 'ACOES', 'EDUCACAO', 'COMPRAS', 'FARMACIA', 'OUTROS'));

alter table public.transacoes_cartao
  drop constraint if exists transacoes_cartao_tipo_check;

alter table public.transacoes_cartao
  add constraint transacoes_cartao_tipo_check
  check (tipo in ('TRANSPORTE', 'ALIMENTACAO', 'LAZER', 'CONTA', 'POUPANCA', 'ACOES', 'EDUCACAO', 'COMPRAS', 'FARMACIA', 'OUTROS'));
