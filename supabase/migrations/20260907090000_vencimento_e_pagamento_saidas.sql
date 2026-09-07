-- Saída passa a ter duas datas independentes da data de competência (`data`):
-- `vencimento` (opcional — nem toda saída tem uma conta com vencimento marcado)
-- e `pago_em` (preenchida pela aplicação sempre que a situação muda para 'PAGO',
-- nunca digitada livremente pelo usuário — ver `CriarSaida`/`AtualizarSaida`).
alter table public.saidas
  add column if not exists vencimento date,
  add column if not exists pago_em date;
