import { describe, expect, it } from 'vitest'

import type { Database } from '../../../../src/infrastructure/supabase/database.types'
import { SupabaseDashboardRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseDashboardRepository'
import { argumentos, criarSupabaseFake, ok, type ConsultaRegistrada } from '../../../helpers/supabaseFake'

type EntradaRow = Database['public']['Tables']['entradas']['Row']
type SaidaRow = Database['public']['Tables']['saidas']['Row']
type FaturaRow = Database['public']['Tables']['faturas']['Row']

const USER_ID = 'user-1'
const AGOSTO = { mes: 8, ano: 2026 }
const LABELS = ['mar/26', 'abr/26', 'mai/26', 'jun/26', 'jul/26', 'ago/26']

function linhaEntrada(sobrescritas: Partial<EntradaRow> = {}): EntradaRow {
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
    atualizado_em: '2026-08-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

function linhaSaida(sobrescritas: Partial<SaidaRow> = {}): SaidaRow {
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
    atualizado_em: '2026-08-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

function linhaFatura(sobrescritas: Partial<FaturaRow> = {}): FaturaRow {
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

/** Filtra as linhas pelo intervalo `gte`/`lte` que a query aplicou na `coluna`. */
function noIntervalo<T>(consulta: ConsultaRegistrada, linhas: T[], coluna: keyof T & string): T[] {
  const [, inicio] = argumentos(consulta, 'gte') ?? []
  const [, fim] = argumentos(consulta, 'lte') ?? []
  return linhas.filter((linha) => {
    const valor = String(linha[coluna])
    return valor >= String(inicio) && valor <= String(fim)
  })
}

/**
 * Monta um banco falso em que cada query por período devolve só as linhas daquele
 * mês — o dashboard consulta os 6 meses em paralelo, então a resposta precisa
 * depender do filtro, não da ordem.
 */
function cenario({
  entradas = [] as EntradaRow[],
  saidas = [] as SaidaRow[],
  faturas = [] as FaturaRow[],
  categorias = [
    { id: 'cat-fixa', nome: 'Despesa Fixa', cor: '#ef4444' },
    { id: 'cat-var', nome: 'Despesa Variável', cor: '#f97316' },
    { id: 'cat-renda', nome: 'Salário', cor: '#22c55e' },
  ],
} = {}) {
  const semRecorrencia = (consulta: ConsultaRegistrada) => argumentos(consulta, 'lt') !== undefined

  return criarSupabaseFake({
    entradas: (consulta) => ok(semRecorrencia(consulta) ? [] : noIntervalo(consulta, entradas, 'data')),
    saidas: (consulta) => ok(semRecorrencia(consulta) ? [] : noIntervalo(consulta, saidas, 'data')),
    faturas: (consulta) => ok(noIntervalo(consulta, faturas, 'vencimento')),
    cartoes: () => ok([{ id: 'cartao-1', nome: 'Nubank' }]),
    transacoes_cartao: () => ok([]),
    categorias: (consulta) =>
      consulta.chamadas.some(([metodo]) => metodo === 'maybeSingle') ? ok({ id: 'cat-var' }) : ok(categorias),
  })
}

describe('SupabaseDashboardRepository — serieFaturas', () => {
  it('devolve 6 pontos com labels e ordem idênticos aos de serieSaidas', async () => {
    const { client } = cenario()

    const resumo = await new SupabaseDashboardRepository(client).resumo(USER_ID, AGOSTO)

    expect(resumo.serieFaturas).toHaveLength(6)
    expect(resumo.serieFaturas.map((ponto) => ponto.label)).toEqual(LABELS)
    expect(resumo.serieFaturas.map((ponto) => ponto.label)).toEqual(resumo.serieSaidas.map((ponto) => ponto.label))
  })

  it('soma as faturas pelo mês de vencimento, com 0 nos meses sem fatura', async () => {
    const { client } = cenario({
      saidas: [linhaSaida({ id: 'sai-ago', data: '2026-08-05', valor: 1000 })],
      faturas: [
        linhaFatura({ id: 'fat-jun', competencia: '2026-06', vencimento: '2026-07-10', total: 300 }),
        linhaFatura({ id: 'fat-jul', competencia: '2026-07', vencimento: '2026-08-10', total: 450 }),
      ],
    })

    const resumo = await new SupabaseDashboardRepository(client).resumo(USER_ID, AGOSTO)

    expect(resumo.serieFaturas).toEqual([
      { label: 'mar/26', valor: 0 },
      { label: 'abr/26', valor: 0 },
      { label: 'mai/26', valor: 0 },
      { label: 'jun/26', valor: 0 },
      { label: 'jul/26', valor: 300 },
      { label: 'ago/26', valor: 450 },
    ])
  })

  it('usa a mesma regra de totalFaturas: o último ponto é igual a totalFaturas', async () => {
    const { client } = cenario({
      faturas: [
        linhaFatura({ id: 'fat-a', cartao_id: 'cartao-1', vencimento: '2026-08-10', total: 450 }),
        linhaFatura({ id: 'fat-b', cartao_id: 'cartao-2', vencimento: '2026-08-20', total: 150 }),
      ],
    })

    const resumo = await new SupabaseDashboardRepository(client).resumo(USER_ID, AGOSTO)

    expect(resumo.totalFaturas).toBe(600)
    expect(resumo.serieFaturas.at(-1)!.valor).toBe(resumo.totalFaturas)
  })

  it('é recorte de serieSaidas: as faturas continuam somadas nas saídas e nunca as ultrapassam', async () => {
    const { client } = cenario({
      saidas: [
        linhaSaida({ id: 'sai-jul', data: '2026-07-03', valor: 200 }),
        linhaSaida({ id: 'sai-ago', data: '2026-08-05', valor: 1000 }),
      ],
      faturas: [
        linhaFatura({ id: 'fat-jun', vencimento: '2026-07-10', total: 300 }),
        linhaFatura({ id: 'fat-jul', vencimento: '2026-08-10', total: 450 }),
      ],
    })

    const resumo = await new SupabaseDashboardRepository(client).resumo(USER_ID, AGOSTO)

    expect(resumo.serieSaidas.map((ponto) => ponto.valor)).toEqual([0, 0, 0, 0, 500, 1450])
    resumo.serieFaturas.forEach((ponto, i) => {
      expect(ponto.valor).toBeLessThanOrEqual(resumo.serieSaidas[i]!.valor)
    })
  })

  it('não conta como fatura uma saída comum, mesmo sendo a única do mês', async () => {
    const { client } = cenario({ saidas: [linhaSaida({ data: '2026-08-05', valor: 1000 })] })

    const resumo = await new SupabaseDashboardRepository(client).resumo(USER_ID, AGOSTO)

    expect(resumo.serieSaidas.at(-1)!.valor).toBe(1000)
    expect(resumo.serieFaturas.at(-1)!.valor).toBe(0)
    expect(resumo.totalFaturas).toBe(0)
  })

  it('devolve todos os pontos zerados quando não há nenhuma fatura na janela', async () => {
    const { client } = cenario({
      entradas: [linhaEntrada()],
      saidas: [linhaSaida({ data: '2026-05-10', valor: 80 })],
    })

    const resumo = await new SupabaseDashboardRepository(client).resumo(USER_ID, AGOSTO)

    expect(resumo.serieFaturas).toEqual(LABELS.map((label) => ({ label, valor: 0 })))
    expect(resumo.totalFaturas).toBe(0)
  })

  it('mantém a janela de 6 meses atravessando a virada do ano', async () => {
    const { client } = cenario({
      faturas: [linhaFatura({ competencia: '2025-12', vencimento: '2026-01-10', total: 90 })],
    })

    const resumo = await new SupabaseDashboardRepository(client).resumo(USER_ID, { mes: 2, ano: 2026 })

    expect(resumo.serieFaturas).toEqual([
      { label: 'set/25', valor: 0 },
      { label: 'out/25', valor: 0 },
      { label: 'nov/25', valor: 0 },
      { label: 'dez/25', valor: 0 },
      { label: 'jan/26', valor: 90 },
      { label: 'fev/26', valor: 0 },
    ])
  })
})
