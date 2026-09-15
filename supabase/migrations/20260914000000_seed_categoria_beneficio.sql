-- Adiciona a categoria "Benefício" às categorias padrão de entrada (issue #6).
-- `where not exists` torna a migration idempotente caso já tenha sido aplicada
-- manualmente em produção antes desta migration ser versionada.

insert into public.categorias (nome, tipo, movimento, cor)
select 'Benefício', 'RENDA', 'ENTRADA', '#f97316'
where not exists (
  select 1 from public.categorias
  where nome = 'Benefício' and movimento = 'ENTRADA' and user_id is null
);
