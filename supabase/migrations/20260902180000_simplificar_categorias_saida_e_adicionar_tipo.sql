-- Adiciona a classificação específica da despesa (tipo) diretamente na saída,
-- e reduz as categorias de saída aos 3 grandes grupos (Despesa Fixa/Variável/Investimento).
-- Espelha o mesmo ajuste feito no mock do frontend (frontend/src/services/mock/db.ts).

-- 1) Nova coluna `tipo` em saidas, retrocompatível via backfill a partir da categoria atual.
alter table public.saidas
  add column if not exists tipo text;

update public.saidas s
set tipo = case c.nome
  when 'Aluguel' then 'CONTA'
  when 'Energia' then 'CONTA'
  when 'Água' then 'CONTA'
  when 'Internet' then 'CONTA'
  when 'Plano de Saúde' then 'CONTA'
  when 'Fatura de cartão' then 'CONTA'
  when 'Alimentação' then 'ALIMENTACAO'
  when 'Transporte' then 'TRANSPORTE'
  when 'Lazer' then 'LAZER'
  when 'Compras' then 'OUTROS'
  when 'Educação' then 'OUTROS'
  when 'Poupança' then 'POUPANCA'
  when 'Ações' then 'ACOES'
  else 'OUTROS'
end
from public.categorias c
where s.categoria_id = c.id
  and s.tipo is null;

alter table public.saidas
  alter column tipo set default 'OUTROS';

update public.saidas set tipo = 'OUTROS' where tipo is null;

alter table public.saidas
  alter column tipo set not null;

alter table public.saidas
  add constraint saidas_tipo_check
  check (tipo in ('TRANSPORTE', 'ALIMENTACAO', 'LAZER', 'CONTA', 'POUPANCA', 'ACOES', 'OUTROS'));

-- 2) Consolida as categorias de saída em 3 grupos, mantendo uma linha por tipo
-- (a mais antiga) e remapeando as referências das demais antes de excluí-las.
with mantidas as (
  select distinct on (tipo) id, tipo
  from public.categorias
  where movimento = 'SAIDA'
  order by tipo, criado_em asc, id asc
)
update public.saidas s
set categoria_id = m.id
from public.categorias c
join mantidas m on m.tipo = c.tipo
where s.categoria_id = c.id
  and c.movimento = 'SAIDA'
  and c.id <> m.id;

with mantidas as (
  select distinct on (tipo) id, tipo
  from public.categorias
  where movimento = 'SAIDA'
  order by tipo, criado_em asc, id asc
)
update public.transacoes_cartao t
set categoria_id = m.id
from public.categorias c
join mantidas m on m.tipo = c.tipo
where t.categoria_id = c.id
  and c.movimento = 'SAIDA'
  and c.id <> m.id;

with mantidas as (
  select distinct on (tipo) id, tipo
  from public.categorias
  where movimento = 'SAIDA'
  order by tipo, criado_em asc, id asc
)
update public.categorias c
set nome = case m.tipo
  when 'CONTA_FIXA' then 'Despesa Fixa'
  when 'CONTA_VARIAVEL' then 'Despesa Variável'
  when 'INVESTIMENTO' then 'Investimento'
end
from mantidas m
where c.id = m.id;

delete from public.categorias
where movimento = 'SAIDA'
  and nome not in ('Despesa Fixa', 'Despesa Variável', 'Investimento');
