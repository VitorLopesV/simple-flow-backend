-- Conclusão de tarefas (issue #70). `concluida_em` (timestamptz) é preenchido uma única vez pela
-- API: concluir é definitivo (a aplicação recusa desmarcar ou editar). O atraso é calculado a
-- partir dele (America/Sao_Paulo), nunca gravado. `ocorrencias_rotina.concluida_em` já existe.
alter table public.tarefas
  add column if not exists concluida_em timestamptz;
