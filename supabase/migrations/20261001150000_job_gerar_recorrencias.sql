-- Job agendado que gera o mês seguinte das séries recorrentes (issue #52) + migração
-- das séries que até aqui só existiam como projeção em tempo de leitura (ver
-- 20261001130000_series_recorrentes.sql).

-- ------------------------------------------------------------------------------
-- 1) Função de geração
-- ------------------------------------------------------------------------------
-- Para cada série recorrente com registro no mês de `referencia` (padrão: hoje no
-- fuso de São Paulo) e sem nenhum registro do mês seguinte em diante, cria no mês
-- seguinte uma cópia independente do registro mais recente do mês: mesmos campos,
-- mesmo dia (limitado ao fim do mês), mesmo `serie_id` e `user_id`; saída nasce
-- PENDENTE e transação de cartão vai para a fatura do mês seguinte (criada se preciso).
--
-- Idempotente: rodar de novo não duplica nada (o `not exists` olha o mês seguinte).
-- Séries encerradas (`serie_encerrada`, issue #51) e registros com a recorrência
-- desligada não são continuados. Espelha `mesmoDiaNoMesSeguinte`/`saidaDoMesSeguinte`
-- dos use-cases e `calcularDatasFatura` (src/shared/utils/fatura.ts).
--
-- SECURITY INVOKER: quem roda é o pg_cron como `postgres` (dono das tabelas, ignora o
-- RLS e enxerga todos os usuários). EXECUTE é revogado dos papéis da API abaixo.
create or replace function public.gerar_recorrencias_mes_seguinte(
  referencia date default (now() at time zone 'America/Sao_Paulo')::date
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  inicio date := date_trunc('month', referencia)::date;
  proximo date := (date_trunc('month', referencia) + interval '1 month')::date;
  dias_no_proximo int := extract(day from (date_trunc('month', referencia) + interval '2 month - 1 day'))::int;
  competencia_proxima text := to_char(proximo, 'YYYY-MM');
  criadas int := 0;
  linhas int;
begin
  -- ---------------------------------------------------------------- entradas
  insert into public.entradas (user_id, categoria_id, tipo, descricao, valor, data, recorrente, observacao, serie_id)
  select distinct on (e.serie_id)
    e.user_id, e.categoria_id, e.tipo, e.descricao, e.valor,
    proximo + (least(extract(day from e.data)::int, dias_no_proximo) - 1),
    true, e.observacao, e.serie_id
  from public.entradas e
  where e.recorrente and e.serie_id is not null and not e.serie_encerrada
    and e.data >= inicio and e.data < proximo
    and not exists (
      select 1 from public.entradas s
      where s.user_id = e.user_id and s.serie_id = e.serie_id and s.data >= proximo
    )
  order by e.serie_id, e.data desc;
  get diagnostics linhas = row_count;
  criadas := criadas + linhas;

  -- ------------------------------------------------------------------ saídas
  insert into public.saidas
    (user_id, categoria_id, tipo, descricao, valor, data, vencimento, status, pago_em,
     forma_pagamento, cartao_id, recorrente, observacao, serie_id)
  select distinct on (s.serie_id)
    s.user_id, s.categoria_id, s.tipo, s.descricao, s.valor,
    proximo + (least(extract(day from s.data)::int, dias_no_proximo) - 1),
    case when s.vencimento is null then null else
      (date_trunc('month', s.vencimento) + interval '1 month')::date
        + (least(extract(day from s.vencimento)::int,
                 extract(day from (date_trunc('month', s.vencimento) + interval '2 month - 1 day'))::int) - 1)
    end,
    'PENDENTE', null,
    s.forma_pagamento, s.cartao_id, true, s.observacao, s.serie_id
  from public.saidas s
  where s.recorrente and s.serie_id is not null and not s.serie_encerrada and not s.automatica
    and s.data >= inicio and s.data < proximo
    and not exists (
      select 1 from public.saidas o
      where o.user_id = s.user_id and o.serie_id = s.serie_id and o.data >= proximo
    )
  order by s.serie_id, s.data desc;
  get diagnostics linhas = row_count;
  criadas := criadas + linhas;

  -- ------------------------------------------------------- transações de cartão
  -- Fatura da competência seguinte, criada como ABERTA se ainda não existir.
  with origem as (
    select distinct on (t.serie_id) t.cartao_id
    from public.transacoes_cartao t
    where t.recorrente and t.serie_id is not null and not t.serie_encerrada
      and t.data >= inicio and t.data < proximo
      and not exists (
        select 1 from public.transacoes_cartao o
        where o.user_id = t.user_id and o.serie_id = t.serie_id and o.data >= proximo
      )
    order by t.serie_id, t.data desc
  )
  insert into public.faturas (cartao_id, user_id, competencia, fechamento, vencimento, total, status)
  select distinct
    c.id, c.user_id, competencia_proxima,
    proximo + (least(c.dia_fechamento, dias_no_proximo) - 1),
    case
      when c.dia_vencimento <= c.dia_fechamento then
        (proximo + interval '1 month')::date
          + (least(c.dia_vencimento, extract(day from (proximo + interval '2 month - 1 day'))::int) - 1)
      else proximo + (least(c.dia_vencimento, dias_no_proximo) - 1)
    end,
    0, 'ABERTA'
  from origem g
  join public.cartoes c on c.id = g.cartao_id
  where not exists (
    select 1 from public.faturas f where f.cartao_id = c.id and f.competencia = competencia_proxima
  );

  insert into public.transacoes_cartao
    (fatura_id, cartao_id, user_id, categoria_id, descricao, valor, data, parcela_atual, total_parcelas,
     recorrente, tipo, observacao, serie_id)
  select
    f.id, g.cartao_id, g.user_id, g.categoria_id, g.descricao, g.valor,
    proximo + (least(extract(day from g.data)::int, dias_no_proximo) - 1),
    g.parcela_atual, g.total_parcelas, true, g.tipo, g.observacao, g.serie_id
  from (
    select distinct on (t.serie_id) t.*
    from public.transacoes_cartao t
    where t.recorrente and t.serie_id is not null and not t.serie_encerrada
      and t.data >= inicio and t.data < proximo
      and not exists (
        select 1 from public.transacoes_cartao o
        where o.user_id = t.user_id and o.serie_id = t.serie_id and o.data >= proximo
      )
    order by t.serie_id, t.data desc
  ) g
  join public.faturas f on f.cartao_id = g.cartao_id and f.competencia = competencia_proxima;
  get diagnostics linhas = row_count;
  criadas := criadas + linhas;

  -- O total da fatura é sempre a soma das transações (mesma regra de `recalcularTotal`).
  update public.faturas f
  set total = soma.total
  from (
    select t.fatura_id, sum(t.valor) as total
    from public.transacoes_cartao t
    group by t.fatura_id
  ) soma
  where soma.fatura_id = f.id
    and f.competencia = competencia_proxima
    and f.total <> soma.total;

  return criadas;
end;
$$;

revoke execute on function public.gerar_recorrencias_mes_seguinte(date) from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2) Agendamento diário às 03h UTC (meia-noite em São Paulo)
-- ------------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

-- `cron.schedule` com um nome já existente só atualiza o job — a migration é reaplicável.
select cron.schedule(
  'gerar-recorrencias-mes-seguinte',
  '0 3 * * *',
  $$select public.gerar_recorrencias_mes_seguinte()$$
);

-- ------------------------------------------------------------------------------
-- 3) Migração dos dados atuais
-- ------------------------------------------------------------------------------
-- 3.1) Recorrência só existe em categoria fixa (Renda Fixa / Despesa Fixa): nas
-- demais, o registro fica, só deixa de ser recorrente.
update public.entradas e set recorrente = false
from public.categorias c
where e.categoria_id = c.id and e.recorrente and c.tipo not in ('CONTA_FIXA', 'RENDA_FIXA');

update public.saidas s set recorrente = false
from public.categorias c
where s.categoria_id = c.id and s.recorrente and c.tipo not in ('CONTA_FIXA', 'RENDA_FIXA');

update public.transacoes_cartao t set recorrente = false
from public.categorias c
where t.categoria_id = c.id and t.recorrente and c.tipo not in ('CONTA_FIXA', 'RENDA_FIXA');

-- 3.2) Cada série da projeção antiga (mesmo usuário + descrição + categoria, e cartão
-- no caso das transações) ganha um `serie_id`, gravado nos registros recorrentes dela.
with series as (
  select user_id, descricao, categoria_id, gen_random_uuid() as serie_id
  from public.entradas
  where recorrente and serie_id is null
  group by user_id, descricao, categoria_id
)
update public.entradas e set serie_id = series.serie_id
from series
where e.recorrente and e.serie_id is null
  and e.user_id = series.user_id and e.descricao = series.descricao and e.categoria_id = series.categoria_id;

with series as (
  select user_id, descricao, categoria_id, gen_random_uuid() as serie_id
  from public.saidas
  where recorrente and not automatica and serie_id is null
  group by user_id, descricao, categoria_id
)
update public.saidas s set serie_id = series.serie_id
from series
where s.recorrente and not s.automatica and s.serie_id is null
  and s.user_id = series.user_id and s.descricao = series.descricao and s.categoria_id = series.categoria_id;

with series as (
  select user_id, cartao_id, descricao, categoria_id, gen_random_uuid() as serie_id
  from public.transacoes_cartao
  where recorrente and serie_id is null
  group by user_id, cartao_id, descricao, categoria_id
)
update public.transacoes_cartao t set serie_id = series.serie_id
from series
where t.recorrente and t.serie_id is null
  and t.user_id = series.user_id and t.cartao_id = series.cartao_id
  and t.descricao = series.descricao and t.categoria_id = series.categoria_id;

-- 3.3) Materializa o mês atual e o seguinte com exatamente o que a projeção mostrava
-- (regra de `projetarRecorrencias`, removida no #50): para cada série, o registro
-- recorrente mais recente anterior ao mês vira uma cópia no mês — desde que a série
-- (mesma chave) ainda não tenha nenhum registro naquele mês. Saída nasce PENDENTE.
-- O mês seguinte é materializado depois do atual, então copia o que acabou de ser criado.
do $$
declare
  alvo date;
  fim_alvo date;
  dias int;
  competencia_alvo text;
begin
  foreach alvo in array array[
    date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date,
    (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) + interval '1 month')::date
  ] loop
    fim_alvo := (alvo + interval '1 month - 1 day')::date;
    dias := extract(day from fim_alvo)::int;
    competencia_alvo := to_char(alvo, 'YYYY-MM');

    insert into public.entradas (user_id, categoria_id, tipo, descricao, valor, data, recorrente, observacao, serie_id)
    select distinct on (e.user_id, e.descricao, e.categoria_id)
      e.user_id, e.categoria_id, e.tipo, e.descricao, e.valor,
      alvo + (least(extract(day from e.data)::int, dias) - 1), true, e.observacao, e.serie_id
    from public.entradas e
    where e.recorrente and e.serie_id is not null and not e.serie_encerrada and e.data < alvo
      and not exists (
        select 1 from public.entradas r
        where r.user_id = e.user_id and r.descricao = e.descricao and r.categoria_id = e.categoria_id
          and r.data between alvo and fim_alvo
      )
    order by e.user_id, e.descricao, e.categoria_id, e.data desc;

    insert into public.saidas
      (user_id, categoria_id, tipo, descricao, valor, data, vencimento, status, pago_em,
       forma_pagamento, cartao_id, recorrente, observacao, serie_id)
    select distinct on (s.user_id, s.descricao, s.categoria_id)
      s.user_id, s.categoria_id, s.tipo, s.descricao, s.valor,
      alvo + (least(extract(day from s.data)::int, dias) - 1),
      case when s.vencimento is null then null else alvo + (least(extract(day from s.vencimento)::int, dias) - 1) end,
      'PENDENTE', null, s.forma_pagamento, s.cartao_id, true, s.observacao, s.serie_id
    from public.saidas s
    where s.recorrente and not s.automatica and s.serie_id is not null and not s.serie_encerrada and s.data < alvo
      and not exists (
        select 1 from public.saidas r
        where r.user_id = s.user_id and r.descricao = s.descricao and r.categoria_id = s.categoria_id
          and r.data between alvo and fim_alvo
      )
    order by s.user_id, s.descricao, s.categoria_id, s.data desc;

    create temporary table transacoes_a_materializar on commit drop as
    select distinct on (t.user_id, t.cartao_id, t.descricao, t.categoria_id) t.*
    from public.transacoes_cartao t
    where t.recorrente and t.serie_id is not null and not t.serie_encerrada and t.data < alvo
      and not exists (
        select 1 from public.transacoes_cartao r
        where r.user_id = t.user_id and r.cartao_id = t.cartao_id and r.descricao = t.descricao
          and r.categoria_id = t.categoria_id and r.data between alvo and fim_alvo
      )
    order by t.user_id, t.cartao_id, t.descricao, t.categoria_id, t.data desc;

    insert into public.faturas (cartao_id, user_id, competencia, fechamento, vencimento, total, status)
    select distinct
      c.id, c.user_id, competencia_alvo,
      alvo + (least(c.dia_fechamento, dias) - 1),
      case
        when c.dia_vencimento <= c.dia_fechamento then
          (alvo + interval '1 month')::date
            + (least(c.dia_vencimento, extract(day from (alvo + interval '2 month - 1 day'))::int) - 1)
        else alvo + (least(c.dia_vencimento, dias) - 1)
      end,
      0, 'ABERTA'
    from transacoes_a_materializar m
    join public.cartoes c on c.id = m.cartao_id
    where not exists (select 1 from public.faturas f where f.cartao_id = c.id and f.competencia = competencia_alvo);

    insert into public.transacoes_cartao
      (fatura_id, cartao_id, user_id, categoria_id, descricao, valor, data, parcela_atual, total_parcelas,
       recorrente, tipo, observacao, serie_id)
    select f.id, m.cartao_id, m.user_id, m.categoria_id, m.descricao, m.valor,
      alvo + (least(extract(day from m.data)::int, dias) - 1),
      m.parcela_atual, m.total_parcelas, true, m.tipo, m.observacao, m.serie_id
    from transacoes_a_materializar m
    join public.faturas f on f.cartao_id = m.cartao_id and f.competencia = competencia_alvo;

    update public.faturas f
    set total = coalesce((select sum(t.valor) from public.transacoes_cartao t where t.fatura_id = f.id), 0)
    where f.competencia = competencia_alvo
      and f.cartao_id in (select cartao_id from transacoes_a_materializar);

    drop table transacoes_a_materializar;
  end loop;
end;
$$;
