-- Encerramento da série (issue #51): excluir um mês remove ele e os seguintes, e
-- desligar a recorrência num mês remove só os seguintes. Os meses anteriores ficam
-- intactos — inclusive com `recorrente = true` —, então é preciso marcar a série
-- como encerrada para o job `gerar_recorrencias_mes_seguinte` (issue #52) não recriar
-- o mês removido a partir de um mês anterior. Religar a recorrência reabre a série.

alter table public.entradas
  add column if not exists serie_encerrada boolean not null default false;

alter table public.saidas
  add column if not exists serie_encerrada boolean not null default false;

alter table public.transacoes_cartao
  add column if not exists serie_encerrada boolean not null default false;
