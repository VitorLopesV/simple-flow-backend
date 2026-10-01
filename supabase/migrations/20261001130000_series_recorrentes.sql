-- Recorrência com registros reais (issue #50): a projeção em tempo de leitura sai e
-- cada mês de uma série recorrente passa a ser uma linha gravada e independente
-- (editar um mês não muda os outros). O que liga os meses é `serie_id`.
--
-- `editado_manualmente` marca o registro que o usuário alterou depois de criado
-- (inclusive marcar como PAGO) — encerrar a série a partir de um mês anterior exige
-- confirmação antes de removê-lo (issue #51).
--
-- O registro do mês seguinte nasce junto com o lançamento (use-cases Criar*); os
-- próximos, pelo job diário `gerar_recorrencias_mes_seguinte` (issue #52), que
-- também materializa as séries que hoje só existem como projeção.

alter table public.entradas
  add column if not exists serie_id uuid,
  add column if not exists editado_manualmente boolean not null default false;

alter table public.saidas
  add column if not exists serie_id uuid,
  add column if not exists editado_manualmente boolean not null default false;

alter table public.transacoes_cartao
  add column if not exists serie_id uuid,
  add column if not exists editado_manualmente boolean not null default false;

create index if not exists entradas_user_id_serie_id_idx on public.entradas (user_id, serie_id) where serie_id is not null;
create index if not exists saidas_user_id_serie_id_idx on public.saidas (user_id, serie_id) where serie_id is not null;
create index if not exists transacoes_cartao_user_id_serie_id_idx
  on public.transacoes_cartao (user_id, serie_id) where serie_id is not null;
