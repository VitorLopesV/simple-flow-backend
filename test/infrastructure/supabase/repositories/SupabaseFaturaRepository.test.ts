import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TransacaoCartaoPayload } from '../../../../src/domain/entities/Fatura'
import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { SupabaseFaturaRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseFaturaRepository'
import {
  USER_ID,
  linhaCartao,
  linhaFatura,
  linhaTransacao,
  type TransacaoRow,
} from '../../../helpers/linhasSupabase'
import {
  argumentos,
  criarSupabaseFake,
  falha,
  ok,
  usou,
  type ConsultaRegistrada,
  type RespostaSupabase,
} from '../../../helpers/supabaseFake'

const AGOSTO = { mes: 8, ano: 2026 }
const ERRO = { message: 'falha no banco' }

const DATAS = { competencia: '2026-08', fechamento: '2026-08-10', vencimento: '2026-08-20' }

function payload(sobrescritas: Partial<TransacaoCartaoPayload> = {}): TransacaoCartaoPayload {
  return {
    descricao: 'Mercado',
    valor: 200,
    data: '2026-08-15',
    categoriaId: 'cat-var',
    tipo: 'ALIMENTACAO',
    parcelaAtual: 1,
    totalParcelas: 1,
    recorrente: false,
    ...sobrescritas,
  }
}

/** Query de candidatas a recorrência: a única de `transacoes_cartao` que usa `lt`. */
const ehCandidatas = (consulta: ConsultaRegistrada) => usou(consulta, 'lt')

/** Query do `recalcularTotal`: seleciona só a coluna `valor`. */
const ehSomaDoTotal = (consulta: ConsultaRegistrada) => argumentos(consulta, 'select')?.[0] === 'valor'

describe('SupabaseFaturaRepository', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('listarComFaturas', () => {
    function cenario({
      cartoes = ok([linhaCartao()]) as RespostaSupabase,
      faturas = ok([]) as RespostaSupabase,
      candidatas = ok([]) as RespostaSupabase,
      transacoes = [] as TransacaoRow[],
      erroTransacoes = null as unknown,
    } = {}) {
      return criarSupabaseFake({
        cartoes: () => cartoes,
        faturas: () => faturas,
        transacoes_cartao: (consulta) => {
          if (ehCandidatas(consulta)) return candidatas
          if (erroTransacoes) return falha(erroTransacoes)
          const [, ids] = argumentos(consulta, 'in') as [string, string[]]
          return ok(transacoes.filter((transacao) => ids.includes(transacao.fatura_id)))
        },
      })
    }

    it('devolve lista vazia sem consultar faturas quando o usuário não tem cartões', async () => {
      const fake = cenario({ cartoes: ok([]) })

      const resultado = await new SupabaseFaturaRepository(fake.client).listarComFaturas(USER_ID, { periodo: AGOSTO })

      expect(resultado).toEqual([])
      expect(fake.consultas.map((consulta) => consulta.tabela)).toEqual(['cartoes'])
    })

    it('consulta cartões, faturas e transações sempre filtrando pelo usuário', async () => {
      const fake = cenario({ faturas: ok([linhaFatura({ competencia: '2026-08' })]) })

      await new SupabaseFaturaRepository(fake.client).listarComFaturas(USER_ID, { periodo: AGOSTO })

      expect(fake.consultasDe('cartoes')[0]!.chamadas).toEqual([
        ['select', '*'],
        ['eq', 'user_id', USER_ID],
        ['order', 'ativo', { ascending: false }],
        ['order', 'nome', { ascending: true }],
      ])
      expect(fake.consultasDe('faturas')[0]!.chamadas).toEqual([
        ['select', '*'],
        ['eq', 'user_id', USER_ID],
        ['eq', 'competencia', '2026-08'],
        ['in', 'cartao_id', ['cartao-1']],
      ])
      const [candidatas, daFatura] = fake.consultasDe('transacoes_cartao')
      expect(candidatas!.chamadas).toEqual([
        ['select', '*'],
        ['eq', 'user_id', USER_ID],
        ['eq', 'recorrente', true],
        ['in', 'cartao_id', ['cartao-1']],
        ['lt', 'data', '2026-08-01'],
      ])
      expect(daFatura!.chamadas).toEqual([
        ['select', '*'],
        ['in', 'fatura_id', ['fat-1']],
        ['order', 'data', { ascending: false }],
      ])
    })

    it('filtra por cartão quando cartaoId é informado', async () => {
      const fake = cenario()

      await new SupabaseFaturaRepository(fake.client).listarComFaturas(USER_ID, { periodo: AGOSTO, cartaoId: 'cartao-1' })

      expect(fake.consultasDe('cartoes')[0]!.chamadas).toContainEqual(['eq', 'id', 'cartao-1'])
    })

    it('mapeia cartão, fatura e transações para camelCase e calcula o uso do limite', async () => {
      const { client } = cenario({
        cartoes: ok([linhaCartao({ limite: 5000 })]),
        faturas: ok([linhaFatura({ competencia: '2026-08', total: '1000' as unknown as number, fechamento: '2026-08-10', vencimento: '2026-08-20' })]),
        transacoes: [linhaTransacao({ valor: '1000' as unknown as number, observacao: 'feira' })],
      })

      const [resultado] = await new SupabaseFaturaRepository(client).listarComFaturas(USER_ID, { periodo: AGOSTO })

      expect(resultado).toEqual({
        cartao: {
          id: 'cartao-1',
          nome: 'Nubank',
          bandeira: 'MASTERCARD',
          ultimosDigitos: '1234',
          limite: 5000,
          diaFechamento: 10,
          diaVencimento: 20,
          cor: '#820ad1',
          ativo: true,
          criadoEm: '2026-01-01T00:00:00.000Z',
        },
        fatura: {
          id: 'fat-1',
          cartaoId: 'cartao-1',
          competencia: '2026-08',
          fechamento: '2026-08-10',
          vencimento: '2026-08-20',
          total: 1000,
          status: 'ABERTA',
          pagoEm: null,
          transacoes: [
            {
              id: 'tr-1',
              cartaoId: 'cartao-1',
              faturaId: 'fat-1',
              descricao: 'Mercado',
              valor: 1000,
              data: '2026-08-15',
              categoriaId: 'cat-var',
              tipo: 'ALIMENTACAO',
              parcelaAtual: 1,
              totalParcelas: 1,
              recorrente: false,
              observacao: 'feira',
              criadoEm: '2026-08-15T12:00:00.000Z',
              atualizadoEm: '2026-08-15T12:00:00.000Z',
            },
          ],
        },
        usoLimite: 20,
      })
    })

    it('devolve fatura nula e uso zero para cartão sem fatura nem recorrência no mês', async () => {
      const fake = cenario()

      const resultado = await new SupabaseFaturaRepository(fake.client).listarComFaturas(USER_ID, { periodo: AGOSTO })

      expect(resultado).toEqual([{ cartao: expect.objectContaining({ id: 'cartao-1' }), fatura: null, usoLimite: 0 }])
      // Sem fatura real não há por que buscar transações por fatura_id.
      expect(fake.consultasDe('transacoes_cartao')).toHaveLength(1)
    })

    it('sintetiza uma fatura virtual ABERTA com as recorrências projetadas quando não há fatura real', async () => {
      const { client } = cenario({
        candidatas: ok([linhaTransacao({ id: 'spotify', descricao: 'Spotify', data: '2026-07-05', valor: 25, recorrente: true })]),
      })

      const [resultado] = await new SupabaseFaturaRepository(client).listarComFaturas(USER_ID, { periodo: AGOSTO })

      expect(resultado!.fatura).toMatchObject({
        id: 'fat_virtual_cartao-1_2026-08',
        cartaoId: 'cartao-1',
        competencia: '2026-08',
        fechamento: '2026-08-10',
        vencimento: '2026-08-20',
        total: 25,
        status: 'ABERTA',
        pagoEm: null,
      })
      expect(resultado!.fatura!.transacoes).toEqual([
        expect.objectContaining({
          id: 'spotify_2026-08',
          faturaId: 'fat_virtual_cartao-1_2026-08',
          data: '2026-08-05',
          origemRecorrenciaId: 'spotify',
        }),
      ])
      expect(resultado!.usoLimite).toBeCloseTo(0.5)
    })

    it('soma as recorrências projetadas ao total da fatura real, sem projetar a série já lançada', async () => {
      const { client } = cenario({
        faturas: ok([linhaFatura({ competencia: '2026-08', total: 200 })]),
        transacoes: [linhaTransacao({ id: 'mercado', descricao: 'Mercado', valor: 200, recorrente: true })],
        candidatas: ok([
          linhaTransacao({ id: 'mercado-jul', descricao: 'Mercado', data: '2026-07-15', recorrente: true }),
          linhaTransacao({ id: 'netflix', descricao: 'Netflix', data: '2026-07-01', valor: 40, recorrente: true }),
        ]),
      })

      const [resultado] = await new SupabaseFaturaRepository(client).listarComFaturas(USER_ID, { periodo: AGOSTO })

      expect(resultado!.fatura!.total).toBe(240)
      expect(resultado!.fatura!.transacoes.map((transacao) => [transacao.id, transacao.faturaId])).toEqual([
        ['mercado', 'fat-1'],
        ['netflix_2026-08', 'fat-1'],
      ])
    })

    it('usa uso do limite 0 para cartão sem limite', async () => {
      const { client } = cenario({
        cartoes: ok([linhaCartao({ limite: 0 })]),
        faturas: ok([linhaFatura({ competencia: '2026-08' })]),
        transacoes: [linhaTransacao()],
      })

      const [resultado] = await new SupabaseFaturaRepository(client).listarComFaturas(USER_ID, { periodo: AGOSTO })

      expect(resultado!.usoLimite).toBe(0)
    })

    it.each([
      ['cartões', { cartoes: falha(ERRO) }],
      ['faturas', { faturas: falha(ERRO) }],
      ['candidatas a recorrência', { candidatas: falha(ERRO) }],
      ['transações da fatura', { faturas: ok([linhaFatura()]), erroTransacoes: ERRO }],
    ])('propaga o erro da consulta de %s', async (_nome, sobrescritas) => {
      const { client } = cenario(sobrescritas)

      await expect(new SupabaseFaturaRepository(client).listarComFaturas(USER_ID, { periodo: AGOSTO })).rejects.toBe(ERRO)
    })
  })

  describe('listarVencendoNoPeriodo', () => {
    function cenario({
      faturas = ok([linhaFatura()]) as RespostaSupabase,
      cartoes = ok([{ id: 'cartao-1', nome: 'Nubank' }]) as RespostaSupabase,
      transacoes = ok([]) as RespostaSupabase,
      candidatas = ok([]) as RespostaSupabase,
      categoria = ok({ id: 'cat-var' }) as RespostaSupabase,
    } = {}) {
      return criarSupabaseFake({
        faturas: () => faturas,
        cartoes: () => cartoes,
        transacoes_cartao: (consulta) => (ehCandidatas(consulta) ? candidatas : transacoes),
        categorias: () => categoria,
      })
    }

    it('devolve lista vazia sem outras consultas quando nada vence no período', async () => {
      const fake = cenario({ faturas: ok([]) })

      await expect(new SupabaseFaturaRepository(fake.client).listarVencendoNoPeriodo(USER_ID, AGOSTO)).resolves.toEqual([])
      expect(fake.consultas).toHaveLength(1)
    })

    it('monta cada fatura como saída com nome do cartão, categoria de despesa variável e situação', async () => {
      const { client } = cenario({
        faturas: ok([
          linhaFatura({ id: 'fat-1', total: '450' as unknown as number }),
          linhaFatura({ id: 'fat-2', vencimento: '2026-08-25', total: 90, status: 'PAGA', pago_em: '2026-08-20' }),
        ]),
      })

      const resultado = await new SupabaseFaturaRepository(client).listarVencendoNoPeriodo(USER_ID, AGOSTO)

      expect(resultado).toEqual([
        {
          faturaId: 'fat-1',
          cartaoId: 'cartao-1',
          cartaoNome: 'Nubank',
          categoriaId: 'cat-var',
          vencimento: '2026-08-10',
          total: 450,
          paga: false,
          pagoEm: null,
        },
        {
          faturaId: 'fat-2',
          cartaoId: 'cartao-1',
          cartaoNome: 'Nubank',
          categoriaId: 'cat-var',
          vencimento: '2026-08-25',
          total: 90,
          paga: true,
          pagoEm: '2026-08-20',
        },
      ])
    })

    it('filtra pelo usuário e pelo intervalo de vencimento, buscando candidatas desde a competência mais antiga', async () => {
      const fake = cenario({
        faturas: ok([
          linhaFatura({ id: 'fat-1', competencia: '2026-07' }),
          linhaFatura({ id: 'fat-2', cartao_id: 'cartao-2', competencia: '2026-06' }),
        ]),
      })

      await new SupabaseFaturaRepository(fake.client).listarVencendoNoPeriodo(USER_ID, AGOSTO)

      expect(fake.consultasDe('faturas')[0]!.chamadas).toEqual([
        ['select', '*'],
        ['eq', 'user_id', USER_ID],
        ['gte', 'vencimento', '2026-08-01'],
        ['lte', 'vencimento', '2026-08-31'],
      ])
      expect(fake.consultasDe('cartoes')[0]!.chamadas).toEqual([
        ['select', 'id, nome'],
        ['eq', 'user_id', USER_ID],
        ['in', 'id', ['cartao-1', 'cartao-2']],
      ])
      const [daFatura, candidatas] = fake.consultasDe('transacoes_cartao')
      expect(daFatura!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
      expect(daFatura!.chamadas).toContainEqual(['in', 'fatura_id', ['fat-1', 'fat-2']])
      expect(candidatas!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
      expect(candidatas!.chamadas).toContainEqual(['lt', 'data', '2026-06-01'])
    })

    it('soma ao total as recorrências ainda não lançadas na competência da fatura', async () => {
      const { client } = cenario({
        faturas: ok([linhaFatura({ competencia: '2026-07', total: 200 })]),
        transacoes: ok([linhaTransacao({ descricao: 'Mercado', data: '2026-07-15' })]),
        candidatas: ok([
          linhaTransacao({ id: 'mercado-jun', descricao: 'Mercado', data: '2026-06-15', recorrente: true }),
          linhaTransacao({ id: 'netflix', descricao: 'Netflix', data: '2026-06-01', valor: 40, recorrente: true }),
        ]),
      })

      const [fatura] = await new SupabaseFaturaRepository(client).listarVencendoNoPeriodo(USER_ID, AGOSTO)

      expect(fatura!.total).toBe(240)
    })

    it('deixa de fora faturas zeradas', async () => {
      const { client } = cenario({ faturas: ok([linhaFatura({ total: 0 })]) })

      await expect(new SupabaseFaturaRepository(client).listarVencendoNoPeriodo(USER_ID, AGOSTO)).resolves.toEqual([])
    })

    it('usa "Cartão" e categoria vazia quando cartão ou categoria não são encontrados', async () => {
      const { client } = cenario({ cartoes: ok([]), categoria: ok(null) })

      const [fatura] = await new SupabaseFaturaRepository(client).listarVencendoNoPeriodo(USER_ID, AGOSTO)

      expect(fatura).toMatchObject({ cartaoNome: 'Cartão', categoriaId: '' })
    })

    it.each([
      ['faturas', { faturas: falha(ERRO) }],
      ['cartões', { cartoes: falha(ERRO) }],
      ['transações', { transacoes: falha(ERRO) }],
      ['candidatas a recorrência', { candidatas: falha(ERRO) }],
      ['categoria', { categoria: falha(ERRO) }],
    ])('propaga o erro da consulta de %s', async (_nome, sobrescritas) => {
      const { client } = cenario(sobrescritas)

      await expect(new SupabaseFaturaRepository(client).listarVencendoNoPeriodo(USER_ID, AGOSTO)).rejects.toBe(ERRO)
    })
  })

  describe('pagar', () => {
    it('marca a fatura do usuário como PAGA com a data de hoje', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-18T15:00:00.000Z'))
      const fake = criarSupabaseFake({ faturas: [ok({ id: 'fat-1' })] })

      await expect(new SupabaseFaturaRepository(fake.client).pagar(USER_ID, 'fat-1')).resolves.toBeUndefined()

      const consulta = fake.consultas[0]!
      expect(argumentos(consulta, 'update')).toEqual([{ status: 'PAGA', pago_em: '2026-08-18' }])
      expect(consulta.chamadas).toContainEqual(['eq', 'id', 'fat-1'])
      expect(consulta.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    })

    it('lança NotFoundError quando a fatura não existe para o usuário', async () => {
      const { client } = criarSupabaseFake({ faturas: [ok(null)] })

      await expect(new SupabaseFaturaRepository(client).pagar(USER_ID, 'fat-1')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ faturas: [falha(ERRO)] })

      await expect(new SupabaseFaturaRepository(client).pagar(USER_ID, 'fat-1')).rejects.toBe(ERRO)
    })
  })

  describe('buscarTransacaoPorId', () => {
    it('busca pelo id e pelo user_id e mapeia a transação', async () => {
      const fake = criarSupabaseFake({ transacoes_cartao: [ok(linhaTransacao({ parcela_atual: 2, total_parcelas: 3 }))] })

      const transacao = await new SupabaseFaturaRepository(fake.client).buscarTransacaoPorId(USER_ID, 'tr-1')

      expect(transacao).toMatchObject({ id: 'tr-1', faturaId: 'fat-1', parcelaAtual: 2, totalParcelas: 3 })
      expect(fake.consultas[0]!.chamadas).toEqual([
        ['select', '*'],
        ['eq', 'id', 'tr-1'],
        ['eq', 'user_id', USER_ID],
        ['maybeSingle'],
      ])
    })

    it('devolve null quando não encontra', async () => {
      const { client } = criarSupabaseFake({ transacoes_cartao: [ok(null)] })

      await expect(new SupabaseFaturaRepository(client).buscarTransacaoPorId(USER_ID, 'tr-1')).resolves.toBeNull()
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ transacoes_cartao: [falha(ERRO)] })

      await expect(new SupabaseFaturaRepository(client).buscarTransacaoPorId(USER_ID, 'tr-1')).rejects.toBe(ERRO)
    })
  })

  /**
   * Banco falso para as escritas de transação: `faturas` responde à busca da fatura da
   * competência, à criação e à atualização do total; `transacoes_cartao` responde à
   * busca, à escrita e à soma do `recalcularTotal`.
   */
  function cenarioEscrita({
    faturaExistente = ok(linhaFatura({ id: 'fat-ago', competencia: '2026-08' })) as RespostaSupabase,
    faturaCriada = ok(linhaFatura({ id: 'fat-nova', competencia: '2026-08' })) as RespostaSupabase,
    atualizacaoTotal = ok(null) as RespostaSupabase,
    transacaoAtual = ok(linhaTransacao({ fatura_id: 'fat-ago' })) as RespostaSupabase,
    escrita = ok(linhaTransacao({ fatura_id: 'fat-ago' })) as RespostaSupabase,
    valores = ok([{ valor: 200 }, { valor: '50.5' }]) as RespostaSupabase,
  } = {}) {
    return criarSupabaseFake({
      faturas: (consulta) => {
        if (usou(consulta, 'insert')) return faturaCriada
        if (usou(consulta, 'update')) return atualizacaoTotal
        return faturaExistente
      },
      transacoes_cartao: (consulta) => {
        if (ehSomaDoTotal(consulta)) return valores
        if (usou(consulta, 'insert') || usou(consulta, 'update') || usou(consulta, 'delete')) return escrita
        return transacaoAtual
      },
    })
  }

  function totaisGravados(fake: ReturnType<typeof criarSupabaseFake>) {
    return fake
      .consultasDe('faturas')
      .filter((consulta) => usou(consulta, 'update'))
      .map((consulta) => [argumentos(consulta, 'update')![0], argumentos(consulta, 'eq')])
  }

  describe('criarTransacao', () => {
    it('usa a fatura existente da competência, insere a transação e recalcula o total pela soma', async () => {
      const fake = cenarioEscrita()

      const transacao = await new SupabaseFaturaRepository(fake.client).criarTransacao(USER_ID, 'cartao-1', payload(), DATAS)

      expect(transacao).toMatchObject({ id: 'tr-1', faturaId: 'fat-ago' })
      expect(fake.consultasDe('faturas')[0]!.chamadas).toEqual([
        ['select', '*'],
        ['eq', 'cartao_id', 'cartao-1'],
        ['eq', 'competencia', '2026-08'],
        ['eq', 'user_id', USER_ID],
        ['maybeSingle'],
      ])
      expect(fake.consultasDe('faturas').some((consulta) => usou(consulta, 'insert'))).toBe(false)
      const insercao = fake.consultasDe('transacoes_cartao').find((consulta) => usou(consulta, 'insert'))!
      expect(argumentos(insercao, 'insert')).toEqual([
        {
          descricao: 'Mercado',
          valor: 200,
          data: '2026-08-15',
          categoria_id: 'cat-var',
          tipo: 'ALIMENTACAO',
          parcela_atual: 1,
          total_parcelas: 1,
          recorrente: false,
          observacao: null,
          fatura_id: 'fat-ago',
          cartao_id: 'cartao-1',
          user_id: USER_ID,
        },
      ])
      expect(totaisGravados(fake)).toEqual([[{ total: 250.5 }, ['id', 'fat-ago']]])
    })

    it('cria a fatura da competência como ABERTA na primeira transação do mês', async () => {
      const fake = cenarioEscrita({ faturaExistente: ok(null) })

      await new SupabaseFaturaRepository(fake.client).criarTransacao(USER_ID, 'cartao-1', payload(), DATAS)

      const criacao = fake.consultasDe('faturas').find((consulta) => usou(consulta, 'insert'))!
      expect(argumentos(criacao, 'insert')).toEqual([
        {
          cartao_id: 'cartao-1',
          user_id: USER_ID,
          competencia: '2026-08',
          fechamento: '2026-08-10',
          vencimento: '2026-08-20',
          total: 0,
          status: 'ABERTA',
        },
      ])
      const insercao = fake.consultasDe('transacoes_cartao').find((consulta) => usou(consulta, 'insert'))!
      expect(argumentos(insercao, 'insert')![0]).toMatchObject({ fatura_id: 'fat-nova' })
      expect(totaisGravados(fake)).toEqual([[{ total: 250.5 }, ['id', 'fat-nova']]])
    })

    it.each([
      ['busca da fatura', { faturaExistente: falha(ERRO) }],
      ['criação da fatura', { faturaExistente: ok(null), faturaCriada: falha(ERRO) }],
      ['inserção da transação', { escrita: falha(ERRO) }],
      ['soma das transações', { valores: falha(ERRO) }],
      ['gravação do total', { atualizacaoTotal: falha(ERRO) }],
    ])('propaga o erro da %s', async (_nome, sobrescritas) => {
      const { client } = cenarioEscrita(sobrescritas)

      await expect(
        new SupabaseFaturaRepository(client).criarTransacao(USER_ID, 'cartao-1', payload(), DATAS),
      ).rejects.toBe(ERRO)
    })
  })

  describe('atualizarTransacao', () => {
    it('atualiza a transação do usuário e recalcula só a fatura quando a competência não muda', async () => {
      const fake = cenarioEscrita()

      const transacao = await new SupabaseFaturaRepository(fake.client).atualizarTransacao(
        USER_ID,
        'tr-1',
        payload({ valor: 300, observacao: 'nota' }),
        DATAS,
      )

      expect(transacao.id).toBe('tr-1')
      const atualizacao = fake.consultasDe('transacoes_cartao').find((consulta) => usou(consulta, 'update'))!
      expect(argumentos(atualizacao, 'update')![0]).toMatchObject({ valor: 300, observacao: 'nota', fatura_id: 'fat-ago' })
      expect(atualizacao.chamadas).toContainEqual(['eq', 'id', 'tr-1'])
      expect(atualizacao.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
      expect(totaisGravados(fake)).toEqual([[{ total: 250.5 }, ['id', 'fat-ago']]])
    })

    it('move a transação para a fatura da nova competência e recalcula as duas', async () => {
      const fake = cenarioEscrita({
        transacaoAtual: ok(linhaTransacao({ fatura_id: 'fat-jul' })),
        escrita: ok(linhaTransacao({ fatura_id: 'fat-ago' })),
      })

      const transacao = await new SupabaseFaturaRepository(fake.client).atualizarTransacao(USER_ID, 'tr-1', payload(), DATAS)

      expect(transacao.faturaId).toBe('fat-ago')
      expect(totaisGravados(fake).map(([, filtro]) => filtro)).toEqual([
        ['id', 'fat-jul'],
        ['id', 'fat-ago'],
      ])
    })

    it('lança NotFoundError sem escrever quando a transação não existe para o usuário', async () => {
      const fake = cenarioEscrita({ transacaoAtual: ok(null) })

      await expect(
        new SupabaseFaturaRepository(fake.client).atualizarTransacao(USER_ID, 'tr-1', payload(), DATAS),
      ).rejects.toBeInstanceOf(NotFoundError)
      expect(fake.consultas.some((consulta) => usou(consulta, 'update') || usou(consulta, 'insert'))).toBe(false)
    })

    it('lança NotFoundError quando a atualização não afeta nenhuma linha', async () => {
      const { client } = cenarioEscrita({ escrita: ok(null) })

      await expect(
        new SupabaseFaturaRepository(client).atualizarTransacao(USER_ID, 'tr-1', payload(), DATAS),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('propaga o erro da atualização', async () => {
      const { client } = cenarioEscrita({ escrita: falha(ERRO) })

      await expect(
        new SupabaseFaturaRepository(client).atualizarTransacao(USER_ID, 'tr-1', payload(), DATAS),
      ).rejects.toBe(ERRO)
    })
  })

  describe('removerTransacao', () => {
    it('remove a transação do usuário e recalcula o total da fatura dela', async () => {
      const fake = cenarioEscrita({ escrita: ok({ fatura_id: 'fat-ago' }) })

      await expect(new SupabaseFaturaRepository(fake.client).removerTransacao(USER_ID, 'tr-1')).resolves.toBeUndefined()

      const remocao = fake.consultasDe('transacoes_cartao').find((consulta) => usou(consulta, 'delete'))!
      expect(remocao.chamadas).toEqual([
        ['delete'],
        ['eq', 'id', 'tr-1'],
        ['eq', 'user_id', USER_ID],
        ['select', 'fatura_id'],
        ['maybeSingle'],
      ])
      expect(totaisGravados(fake)).toEqual([[{ total: 250.5 }, ['id', 'fat-ago']]])
    })

    it('lança NotFoundError quando nenhuma linha é removida', async () => {
      const { client } = cenarioEscrita({ escrita: ok(null) })

      await expect(new SupabaseFaturaRepository(client).removerTransacao(USER_ID, 'tr-1')).rejects.toBeInstanceOf(
        NotFoundError,
      )
    })

    it('propaga o erro do banco', async () => {
      const { client } = cenarioEscrita({ escrita: falha(ERRO) })

      await expect(new SupabaseFaturaRepository(client).removerTransacao(USER_ID, 'tr-1')).rejects.toBe(ERRO)
    })
  })
})
