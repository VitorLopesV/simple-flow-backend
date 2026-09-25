import type { Database } from '../../src/infrastructure/supabase/database.types'

type Tabelas = Database['public']['Tables']

export type CartaoRow = Tabelas['cartoes']['Row']
export type CategoriaRow = Tabelas['categorias']['Row']
export type EntradaRow = Tabelas['entradas']['Row']
export type FaturaRow = Tabelas['faturas']['Row']
export type SaidaRow = Tabelas['saidas']['Row']
export type TransacaoRow = Tabelas['transacoes_cartao']['Row']

/** Linhas do banco em snake_case, como o PostgREST devolve — usadas para testar o mapeamento dos repositórios. */
export const USER_ID = 'user-1'

export function linhaEntrada(sobrescritas: Partial<EntradaRow> = {}): EntradaRow {
  return {
    id: 'ent-1',
    descricao: 'Salário',
    valor: 5000,
    data: '2026-08-05',
    categoria_id: 'cat-renda',
    recorrente: false,
    observacao: null,
    user_id: USER_ID,
    criado_em: '2026-08-01T00:00:00.000Z',
    atualizado_em: '2026-08-02T00:00:00.000Z',
    ...sobrescritas,
  }
}

export function linhaSaida(sobrescritas: Partial<SaidaRow> = {}): SaidaRow {
  return {
    id: 'sai-1',
    descricao: 'Aluguel',
    valor: 1000,
    data: '2026-08-05',
    categoria_id: 'cat-fixa',
    tipo: 'CONTA',
    status: 'PAGO',
    vencimento: null,
    pago_em: '2026-08-05',
    forma_pagamento: 'PIX',
    cartao_id: null,
    recorrente: false,
    observacao: null,
    automatica: false,
    user_id: USER_ID,
    criado_em: '2026-08-01T00:00:00.000Z',
    atualizado_em: '2026-08-02T00:00:00.000Z',
    ...sobrescritas,
  }
}

export function linhaCartao(sobrescritas: Partial<CartaoRow> = {}): CartaoRow {
  return {
    id: 'cartao-1',
    nome: 'Nubank',
    bandeira: 'MASTERCARD',
    ultimos_digitos: '1234',
    limite: 5000,
    dia_fechamento: 10,
    dia_vencimento: 20,
    cor: '#820ad1',
    ativo: true,
    user_id: USER_ID,
    criado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

export function linhaFatura(sobrescritas: Partial<FaturaRow> = {}): FaturaRow {
  return {
    id: 'fat-1',
    cartao_id: 'cartao-1',
    competencia: '2026-07',
    fechamento: '2026-07-31',
    vencimento: '2026-08-10',
    total: 450,
    status: 'ABERTA',
    pago_em: null,
    user_id: USER_ID,
    ...sobrescritas,
  }
}

export function linhaTransacao(sobrescritas: Partial<TransacaoRow> = {}): TransacaoRow {
  return {
    id: 'tr-1',
    cartao_id: 'cartao-1',
    fatura_id: 'fat-1',
    descricao: 'Mercado',
    valor: 200,
    data: '2026-08-15',
    categoria_id: 'cat-var',
    tipo: 'ALIMENTACAO',
    parcela_atual: 1,
    total_parcelas: 1,
    recorrente: false,
    observacao: null,
    user_id: USER_ID,
    criado_em: '2026-08-15T12:00:00.000Z',
    atualizado_em: '2026-08-15T12:00:00.000Z',
    ...sobrescritas,
  }
}
