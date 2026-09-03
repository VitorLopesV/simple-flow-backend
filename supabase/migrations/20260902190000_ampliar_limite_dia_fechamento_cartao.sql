-- Dia de fechamento do cartão pode ser de 1 a 31 (dia de vencimento permanece 1-28).
-- calcularDatasFatura (src/shared/utils/fatura.ts) já clampa o dia ao último dia do mês.
alter table public.cartoes
  drop constraint if exists cartoes_dia_fechamento_check;

alter table public.cartoes
  add constraint cartoes_dia_fechamento_check
  check (dia_fechamento between 1 and 31);
