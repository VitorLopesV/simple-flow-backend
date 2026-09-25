import { describe, expect, it } from 'vitest'

import { SupabaseDashboardRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseDashboardRepository'
import {
  USER_ID,
  linhaEntrada,
  linhaFatura,
  linhaSaida,
  type EntradaRow,
  type FaturaRow,
  type SaidaRow,
} from '../../../helpers/linhasSupabase'
import { argumentos, criarSupabaseFake, falha, ok, usou, type ConsultaRegistrada } from '../../../helpers/supabaseFake'

const AGOSTO = { mes: 8, ano: 2026 }
const LABELS = ['mar/26', 'abr/26', 'mai/26', 'jun/26', 'jul/26', 'ago/26']

const CATEGORIAS = [
  { id: 'cat-fixa', nome: 'Despesa Fixa', cor: '#ef4444' },
  { id: 'cat-var', nome: 'Despesa Variável', cor: '#f97316' },
  { id: 'cat-renda', nome: 'Salário', cor: '#22c55e' },
]

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
 * depender do filtro, não da ordem. Queries de candidatas a recorrência (`lt`)
 * voltam vazias: a projeção tem testes próprios nos repositórios de entradas/saídas.
 */
function cenario({
  entradas = [] as EntradaRow[],
  saidas = [] as SaidaRow[],
  faturas = [] as FaturaRow[],
  categorias = ok(CATEGORIAS),
} = {}) {
  const candidatas = (consulta: ConsultaRegistrada) => usou(consulta, 'lt')

  return criarSupabaseFake({
    entradas: (consulta) => ok(candidatas(consulta) ? [] : noIntervalo(consulta, entradas, 'data')),
    saidas: (consulta) => ok(candidatas(consulta) ? [] : noIntervalo(consulta, saidas, 'data')),
    faturas: (consulta) => ok(noIntervalo(consulta, faturas, 'vencimento')),
    cartoes: () => ok([{ id: 'cartao-1', nome: 'Nubank' }]),
    transacoes_cartao: () => ok([]),
    categorias: (consulta) => (usou(consulta, 'maybeSingle') ? ok({ id: 'cat-var' }) : categorias),
  })
}

describe('SupabaseDashboardRepository', () => {
  describe('totais do mês', () => {
    it('soma entradas e saídas da competência e calcula o saldo', async () => {
      const { client } = cenario({
        entradas: [linhaEntrada({ id: 'e1', valor: 5000 }), linhaEntrada({ id: 'e2', descricao: 'Freela', valor: 1000 })],
        saidas: [linhaSaida({ id: 's1', valor: 1500 }), linhaSaida({ id: 's2', descricao: 'Luz', valor: 500 })],
      })

      const resumo = await new SupabaseDashboardRepository(client).resumo(USER_ID, AGOSTO)

      expect(resumo.totalEntradas).toBe(6000)
      expect(resumo.totalSaidas).toBe(2000)
      expect(resumo.saldo).toBe(4000)
    })

    it('calcula a variação contra o mês anterior da série', async () => {
      const { client } = cenario({
        entradas: [linhaEntrada({ id: 'e-jul', data: '2026-07-05', valor: 1000 }), linhaEntrada({ valor: 1500 })],
        saidas: [linhaSaida({ id: 's-jul', data: '2026-07-05', valor: 800 }), linhaSaida({ valor: 400 })],
      })

      const resumo = await new SupabaseDashboardRepository(client).resumo(USER_ID, AGOSTO)

      expect(resumo.variacaoEntradas).toBeCloseTo(0.5)
      expect(resumo.variacaoSaidas).toBeCloseTo(-0.5)
    })

    it('monta serieEntradas e serieSaidas com os últimos 6 meses', async () => {
      const { client } = cenario({
        entradas: [linhaEntrada({ id: 'e-mar', data: '2026-03-01', valor: 10 }), linhaEntrada({ valor: 60 })],
        saidas: [linhaSaida({ id: 's-jun', data: '2026-06-30', valor: 40 })],
      })

      const resumo = await new SupabaseDashboardRepository(client).resumo(USER_ID, AGOSTO)

      expect(resumo.serieEntradas).toEqual([
        { label: 'mar/26', valor: 10 },
        { label: 'abr/26', valor: 0 },
        { label: 'mai/26', valor: 0 },
        { label: 'jun/26', valor: 0 },
        { label: 'jul/26', valor: 0 },
        { label: 'ago/26', valor: 60 },
      ])
      expect(resumo.serieSaidas.map((ponto) => ponto.valor)).toEqual([0, 0, 0, 40, 0, 0])
    })
  })

  describe('serieFaturas', () => {
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

  describe('gastosPorCategoria', () => {
    it('agrupa as saídas do mês por categoria, do maior para o menor total', async () => {
      const { client } = cenario({
        saidas: [
          linhaSaida({ id: 's1', categoria_id: 'cat-fixa', valor: 100 }),
          linhaSaida({ id: 's2', descricao: 'Luz', categoria_id: 'cat-fixa', valor: 50 }),
          linhaSaida({ id: 's3', descricao: 'Cinema', categoria_id: 'cat-var', valor: 300 }),
        ],
      })

      const resumo = await new SupabaseDashboardRepository(client).resumo(USER_ID, AGOSTO)

      expect(resumo.gastosPorCategoria).toEqual([
        { nome: 'Despesa Variável', cor: '#f97316', total: 300 },
        { nome: 'Despesa Fixa', cor: '#ef4444', total: 150 },
      ])
    })

    it('usa "Outros" e cor neutra para categoria desconhecida', async () => {
      const { client } = cenario({ saidas: [linhaSaida({ categoria_id: 'cat-sumida', valor: 70 })] })

      const resumo = await new SupabaseDashboardRepository(client).resumo(USER_ID, AGOSTO)

      expect(resumo.gastosPorCategoria).toEqual([{ nome: 'Outros', cor: '#94a3b8', total: 70 }])
    })
  })

  describe('transacoesRecentes', () => {
    it('mistura entradas e saídas do mês, mais recentes primeiro, com nome e cor da categoria', async () => {
      const { client } = cenario({
        entradas: [linhaEntrada({ id: 'e1', data: '2026-08-03', valor: 5000 })],
        saidas: [
          linhaSaida({ id: 's1', data: '2026-08-10', valor: 100 }),
          linhaSaida({ id: 's2', descricao: 'Padaria', data: '2026-08-01', categoria_id: 'cat-x', valor: 20 }),
        ],
      })

      const resumo = await new SupabaseDashboardRepository(client).resumo(USER_ID, AGOSTO)

      expect(resumo.transacoesRecentes).toEqual([
        {
          id: 's1',
          tipo: 'SAIDA',
          descricao: 'Aluguel',
          valor: 100,
          data: '2026-08-10',
          categoriaNome: 'Despesa Fixa',
          categoriaCor: '#ef4444',
        },
        {
          id: 'e1',
          tipo: 'ENTRADA',
          descricao: 'Salário',
          valor: 5000,
          data: '2026-08-03',
          categoriaNome: 'Salário',
          categoriaCor: '#22c55e',
        },
        {
          id: 's2',
          tipo: 'SAIDA',
          descricao: 'Padaria',
          valor: 20,
          data: '2026-08-01',
          categoriaNome: 'Sem categoria',
          categoriaCor: '#94a3b8',
        },
      ])
    })

    it('limita a lista às 8 transações mais recentes', async () => {
      const saidas = Array.from({ length: 10 }, (_, i) =>
        linhaSaida({ id: `s${i + 1}`, descricao: `Gasto ${i + 1}`, data: `2026-08-${String(i + 1).padStart(2, '0')}` }),
      )
      const { client } = cenario({ saidas })

      const resumo = await new SupabaseDashboardRepository(client).resumo(USER_ID, AGOSTO)

      expect(resumo.transacoesRecentes).toHaveLength(8)
      expect(resumo.transacoesRecentes[0]!.id).toBe('s10')
      expect(resumo.transacoesRecentes.at(-1)!.id).toBe('s3')
    })
  })

  it('filtra por user_id todas as queries de entradas, saídas e faturas (defesa em profundidade além do RLS)', async () => {
    const fake = cenario({ faturas: [linhaFatura()] })

    await new SupabaseDashboardRepository(fake.client).resumo(USER_ID, AGOSTO)

    const consultasComDono = [
      ...fake.consultasDe('entradas'),
      ...fake.consultasDe('saidas'),
      ...fake.consultasDe('faturas'),
      ...fake.consultasDe('cartoes'),
      ...fake.consultasDe('transacoes_cartao'),
    ]
    expect(fake.consultasDe('entradas')).toHaveLength(12)
    expect(fake.consultasDe('saidas')).toHaveLength(12)
    for (const consulta of consultasComDono) {
      expect(consulta.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    }
  })

  it('propaga o erro da consulta de categorias', async () => {
    const erro = { message: 'falha no banco' }
    const { client } = cenario({ categorias: falha(erro) })

    await expect(new SupabaseDashboardRepository(client).resumo(USER_ID, AGOSTO)).rejects.toBe(erro)
  })
})
