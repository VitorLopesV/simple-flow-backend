-- Débitos de cartão passam a ser lançados diretamente no cartão (aba Cartões), no
-- mesmo formato de uma saída, e a fatura é que aparece como uma saída (derivada,
-- nunca persistida) na aba Saídas.
--
-- Antes desta migration, `CriarSaida` gravava DOIS registros para um gasto no
-- cartão: uma linha em `saidas` (que aparecia individualmente na lista) e uma em
-- `transacoes_cartao` (que somava na fatura) — ou seja, o mesmo gasto contava duas
-- vezes assim que a fatura também virasse saída. Aqui a transação do cartão passa a
-- ser a única fonte de verdade, e as saídas de cartão existentes são convertidas
-- em transações antes de serem removidas.

-- ---------------------------------------------------------- 1) campos da saída
-- `transacoes_cartao` ganha os campos que faltavam pra ter o mesmo formato de uma
-- saída (a situação continua vindo da fatura: transação de fatura paga é paga).
alter table public.transacoes_cartao
  add column if not exists tipo text not null default 'OUTROS',
  add column if not exists observacao text,
  add column if not exists criado_em timestamptz not null default now(),
  add column if not exists atualizado_em timestamptz not null default now();

alter table public.transacoes_cartao
  drop constraint if exists transacoes_cartao_tipo_check;

alter table public.transacoes_cartao
  add constraint transacoes_cartao_tipo_check
  check (tipo in ('TRANSPORTE', 'ALIMENTACAO', 'LAZER', 'CONTA', 'POUPANCA', 'ACOES', 'OUTROS'));

drop trigger if exists set_atualizado_em on public.transacoes_cartao;
create trigger set_atualizado_em
  before update on public.transacoes_cartao
  for each row execute function public.set_atualizado_em();

-- --------------------------------------------- 2) saídas de cartão → transações
-- Saídas no cartão que ainda não têm transação equivalente (mesmo cartão, data,
-- valor e descrição) viram transações; as demais já estavam duplicadas e só somem.
create temporary table saidas_a_converter as
select s.*
from public.saidas s
where s.forma_pagamento = 'CARTAO_CREDITO'
  and s.cartao_id is not null
  and not exists (
    select 1
    from public.transacoes_cartao t
    where t.user_id = s.user_id
      and t.cartao_id = s.cartao_id
      and t.data = s.data
      and t.valor = s.valor
      and t.descricao = s.descricao
  );

-- Fatura da competência de cada saída convertida, criada como ABERTA se não existir.
-- Replica `calcularDatasFatura` (src/shared/utils/fatura.ts): o dia é limitado ao
-- último dia do mês e o vencimento cai no mês seguinte quando é <= o fechamento.
insert into public.faturas (cartao_id, user_id, competencia, fechamento, vencimento, total, status)
select distinct on (s.cartao_id, to_char(s.data, 'YYYY-MM'))
  s.cartao_id,
  s.user_id,
  to_char(s.data, 'YYYY-MM'),
  d.inicio + (least(c.dia_fechamento, d.dias_no_mes) - 1),
  case
    when c.dia_vencimento <= c.dia_fechamento
      then d.proximo + (least(c.dia_vencimento, extract(day from (d.proximo + interval '1 month - 1 day'))::int) - 1)
    else d.inicio + (least(c.dia_vencimento, d.dias_no_mes) - 1)
  end,
  0,
  'ABERTA'
from saidas_a_converter s
join public.cartoes c on c.id = s.cartao_id
cross join lateral (
  select
    date_trunc('month', s.data)::date as inicio,
    (date_trunc('month', s.data) + interval '1 month')::date as proximo,
    extract(day from (date_trunc('month', s.data) + interval '1 month - 1 day'))::int as dias_no_mes
) d
where not exists (
  select 1 from public.faturas f
  where f.cartao_id = s.cartao_id and f.competencia = to_char(s.data, 'YYYY-MM')
);

insert into public.transacoes_cartao
  (fatura_id, cartao_id, user_id, categoria_id, descricao, valor, data, tipo, observacao, recorrente, criado_em)
select f.id, s.cartao_id, s.user_id, s.categoria_id, s.descricao, s.valor, s.data, s.tipo, s.observacao, s.recorrente, s.criado_em
from saidas_a_converter s
join public.faturas f on f.cartao_id = s.cartao_id and f.competencia = to_char(s.data, 'YYYY-MM');

delete from public.saidas
where forma_pagamento = 'CARTAO_CREDITO';

-- ------------------------------------------------- 3) totais das faturas em dia
update public.faturas f
set total = coalesce((select sum(t.valor) from public.transacoes_cartao t where t.fatura_id = f.id), 0);

drop table saidas_a_converter;
