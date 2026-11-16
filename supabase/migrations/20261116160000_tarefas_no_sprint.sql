-- Vínculo tarefa ↔ sprint (issue #69). Uma tarefa está no sprint quando `sprint_id` é preenchido;
-- o dia dela (`dia`, seg–sex dentro da semana do sprint) continua na própria tarefa.
-- `on delete set null`: apagar um sprint nunca apaga tarefas, só as devolve ao backlog.
alter table public.tarefas
  add column if not exists sprint_id uuid references public.sprints (id) on delete set null;

create index if not exists tarefas_user_sprint_idx on public.tarefas (user_id, sprint_id);
