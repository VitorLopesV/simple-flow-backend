-- Entradas passam a seguir o modelo das saídas (issue #49): a categoria é o grupo
-- (Renda Fixa, Renda Variável, Investimentos, Outros) e o detalhe vai no novo campo
-- `tipo` da entrada (Salário, Freelance, Rendimentos, Reembolso). Espelha o mock do
-- frontend (frontend/src/services/mock/db.ts, SEED_CATEGORIES).

-- ---------------------------------------------------- 1) natureza das categorias
-- RENDA some no fim desta migration (todas as categorias de entrada antigas usavam ela).
alter table public.categorias
  drop constraint if exists categorias_tipo_check;

alter table public.categorias
  add constraint categorias_tipo_check
  check (tipo in ('CONTA_FIXA', 'CONTA_VARIAVEL', 'RENDA', 'RENDA_FIXA', 'RENDA_VARIAVEL', 'INVESTIMENTO', 'OUTROS'));

-- ------------------------------------------------ 2) as 4 categorias de entrada
-- `where not exists` deixa a migration idempotente.
insert into public.categorias (nome, tipo, movimento, cor)
select v.nome, v.tipo, 'ENTRADA', v.cor
from (values
  ('Renda Fixa', 'RENDA_FIXA', '#10b981'),
  ('Renda Variável', 'RENDA_VARIAVEL', '#06b6d4'),
  ('Investimentos', 'INVESTIMENTO', '#eab308'),
  ('Outros', 'OUTROS', '#94a3b8')
) as v (nome, tipo, cor)
where not exists (
  select 1 from public.categorias c
  where c.nome = v.nome and c.movimento = 'ENTRADA' and c.user_id is null
);

-- --------------------------------------------------------- 3) tipo da entrada
alter table public.entradas
  add column if not exists tipo text;

-- Mapeamento aprovado na issue: Salário → Renda Fixa, Freelance → Renda Variável,
-- Rendimentos → Investimentos, Reembolso → Outros. "Benefício" (seed de 20260914000000)
-- não tem tipo próprio: é parte da remuneração fixa, então vira Renda Fixa/Salário.
-- Qualquer outra categoria de entrada (custom) cai em Outros/Reembolso — nada é perdido.
create temporary table mapeamento_entradas as
select
  c.id as categoria_antiga,
  case c.nome
    when 'Salário' then 'SALARIO'
    when 'Benefício' then 'SALARIO'
    when 'Freelance' then 'FREELANCE'
    when 'Rendimentos' then 'RENDIMENTOS'
    else 'REEMBOLSO'
  end as tipo,
  case c.nome
    when 'Salário' then 'Renda Fixa'
    when 'Benefício' then 'Renda Fixa'
    when 'Freelance' then 'Renda Variável'
    when 'Rendimentos' then 'Investimentos'
    else 'Outros'
  end as categoria_nova
from public.categorias c
where c.movimento = 'ENTRADA'
  and c.nome not in ('Renda Fixa', 'Renda Variável', 'Investimentos', 'Outros');

update public.entradas e
set tipo = m.tipo,
    categoria_id = nova.id
from mapeamento_entradas m
join public.categorias nova
  on nova.nome = m.categoria_nova and nova.movimento = 'ENTRADA' and nova.user_id is null
where e.categoria_id = m.categoria_antiga;

-- Entradas que já estavam numa das 4 categorias novas (ex.: migration reaplicada)
-- ganham o tipo padrão do grupo.
update public.entradas e
set tipo = case c.tipo
  when 'RENDA_FIXA' then 'SALARIO'
  when 'RENDA_VARIAVEL' then 'FREELANCE'
  when 'INVESTIMENTO' then 'RENDIMENTOS'
  else 'REEMBOLSO'
end
from public.categorias c
where e.categoria_id = c.id
  and e.tipo is null;

alter table public.entradas
  alter column tipo set not null;

alter table public.entradas
  drop constraint if exists entradas_tipo_check;

alter table public.entradas
  add constraint entradas_tipo_check
  check (tipo in ('SALARIO', 'FREELANCE', 'RENDIMENTOS', 'REEMBOLSO'));

-- ------------------------------------------- 4) remove as categorias antigas
delete from public.categorias c
using mapeamento_entradas m
where c.id = m.categoria_antiga;

alter table public.categorias
  drop constraint categorias_tipo_check;

alter table public.categorias
  add constraint categorias_tipo_check
  check (tipo in ('CONTA_FIXA', 'CONTA_VARIAVEL', 'RENDA_FIXA', 'RENDA_VARIAVEL', 'INVESTIMENTO', 'OUTROS'));

drop table mapeamento_entradas;
