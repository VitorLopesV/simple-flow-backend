-- Corrige o bug em que saídas/transações de cartão com tipo 'EDUCACAO' ou 'COMPRAS'
-- não podiam ser salvas: essas duas opções já existiam no frontend (SaidaTipo) mas
-- nunca foram incluídas nas check constraints criadas em
-- 20260902180000_simplificar_categorias_saida_e_adicionar_tipo.sql e
-- 20260903120000_debitos_no_cartao.sql, então o backend rejeitava (422/constraint).

alter table public.saidas
  drop constraint if exists saidas_tipo_check;

alter table public.saidas
  add constraint saidas_tipo_check
  check (tipo in ('TRANSPORTE', 'ALIMENTACAO', 'LAZER', 'CONTA', 'POUPANCA', 'ACOES', 'EDUCACAO', 'COMPRAS', 'OUTROS'));

alter table public.transacoes_cartao
  drop constraint if exists transacoes_cartao_tipo_check;

alter table public.transacoes_cartao
  add constraint transacoes_cartao_tipo_check
  check (tipo in ('TRANSPORTE', 'ALIMENTACAO', 'LAZER', 'CONTA', 'POUPANCA', 'ACOES', 'EDUCACAO', 'COMPRAS', 'OUTROS'));
