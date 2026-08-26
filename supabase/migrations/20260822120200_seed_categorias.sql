-- Seed das categorias padrão do sistema (user_id nulo = visível a todos os usuários).
-- Espelha SEMENTE_CATEGORIAS em frontend/src/services/mock/db.ts.

insert into public.categorias (nome, tipo, movimento, cor) values
  ('Aluguel', 'CONTA_FIXA', 'SAIDA', '#6366f1'),
  ('Energia', 'CONTA_FIXA', 'SAIDA', '#f59e0b'),
  ('Água', 'CONTA_FIXA', 'SAIDA', '#0ea5e9'),
  ('Internet', 'CONTA_FIXA', 'SAIDA', '#8b5cf6'),
  ('Plano de Saúde', 'CONTA_FIXA', 'SAIDA', '#ec4899'),

  ('Alimentação', 'CONTA_VARIAVEL', 'SAIDA', '#22c55e'),
  ('Transporte', 'CONTA_VARIAVEL', 'SAIDA', '#14b8a6'),
  ('Lazer', 'CONTA_VARIAVEL', 'SAIDA', '#f43f5e'),
  ('Compras', 'CONTA_VARIAVEL', 'SAIDA', '#a855f7'),
  ('Educação', 'CONTA_VARIAVEL', 'SAIDA', '#3b82f6'),
  ('Fatura de cartão', 'CONTA_VARIAVEL', 'SAIDA', '#64748b'),

  ('Salário', 'RENDA', 'ENTRADA', '#10b981'),
  ('Freelance', 'RENDA', 'ENTRADA', '#06b6d4'),
  ('Reembolso', 'RENDA', 'ENTRADA', '#84cc16'),

  ('Poupança', 'INVESTIMENTO', 'SAIDA', '#0891b2'),
  ('Ações', 'INVESTIMENTO', 'SAIDA', '#7c3aed'),
  ('Rendimentos', 'INVESTIMENTO', 'ENTRADA', '#eab308');
