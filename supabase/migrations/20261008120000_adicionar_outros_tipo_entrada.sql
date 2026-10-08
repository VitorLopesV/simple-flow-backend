-- Adiciona o tipo de entrada 'OUTROS' à check constraint de tipo em entradas, para
-- registrar entradas que não se encaixam em Salário, Freelance, Rendimentos ou Reembolso.
-- Só amplia o conjunto aceito: nenhuma linha existente é alterada.

alter table public.entradas
  drop constraint if exists entradas_tipo_check;

alter table public.entradas
  add constraint entradas_tipo_check
  check (tipo in ('SALARIO', 'FREELANCE', 'RENDIMENTOS', 'REEMBOLSO', 'OUTROS'));
