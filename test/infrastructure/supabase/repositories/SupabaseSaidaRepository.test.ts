import { describe, expect, it } from 'vitest'

import type { SaidaPayload } from '../../../../src/domain/entities/Saida'
import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { SupabaseSaidaRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseSaidaRepository'
import { USER_ID, linhaFatura, linhaSaida, type FaturaRow, type SaidaRow } from '../../../helpers/linhasSupabase'
import { argumentos, criarSupabaseFake, falha, ok, usou, type ConsultaRegistrada } from '../../../helpers/supabaseFake'

const AGOSTO = { mes: 8, ano: 2026 }
const ID = '123e4567-e89b-12d3-a456-426614174000'
const ERRO = { message: 'falha no banco' }

function payload(sobrescritas: Partial<SaidaPayload> = {}): SaidaPayload {
  return {
    descricao: 'Aluguel',
    valor: 1000,
    data: '2026-08-05',
    categoriaId: 'cat-fixa',
    tipo: 'CONTA',
    status: 'PENDENTE',
    formaPagamento: 'PIX',
    recorrente: false,
    ...sobrescritas,
  }
}

function noIntervalo<T>(consulta: ConsultaRegistrada, linhas: T[], coluna: keyof T & string): T[] {
  const [, inicio] = argumentos(consulta, 'gte')!
  const [, fim] = argumentos(consulta, 'lte')!
  return linhas.filter((linha) => String(linha[coluna]) >= String(inicio) && String(linha[coluna]) <= String(fim))
}

/** Banco falso para `listarComProjecao`: saídas por período, candidatas recorrentes e faturas vencendo no mês. */
function cenario({
  saidas = [] as SaidaRow[],
  candidatas = [] as SaidaRow[],
  faturas = [] as FaturaRow[],
  categorias = ok([{ id: 'cat-fixa', nome: 'Despesa Fixa', cor: '#ef4444' }]),
} = {}) {
  return criarSupabaseFake({
    saidas: (consulta) => ok(usou(consulta, 'lt') ? candidatas : noIntervalo(consulta, saidas, 'data')),
    faturas: (consulta) => ok(noIntervalo(consulta, faturas, 'vencimento')),
    cartoes: () => ok([{ id: 'cartao-1', nome: 'Nubank' }]),
    transacoes_cartao: () => ok([]),
    categorias: (consulta) => (usou(consulta, 'maybeSingle') ? ok({ id: 'cat-var' }) : categorias),
  })
}

describe('SupabaseSaidaRepository', () => {
  describe('listarComProjecao', () => {
    it('mapeia as linhas de snake_case para camelCase, convertendo valor para número', async () => {
      const linha = linhaSaida({
        valor: '99.9' as unknown as number,
        status: 'PENDENTE',
        vencimento: '2026-08-10',
        pago_em: null,
        forma_pagamento: 'BOLETO',
        observacao: 'obs',
      })
      const { client } = cenario({ saidas: [linha] })

      const [saida] = await new SupabaseSaidaRepository(client).listarComProjecao(USER_ID, AGOSTO)

      expect(saida).toEqual({
        id: 'sai-1',
        descricao: 'Aluguel',
        valor: 99.9,
        data: '2026-08-05',
        categoriaId: 'cat-fixa',
        tipo: 'CONTA',
        status: 'PENDENTE',
        vencimento: '2026-08-10',
        pagoEm: null,
        formaPagamento: 'BOLETO',
        cartaoId: null,
        recorrente: false,
        observacao: 'obs',
        criadoEm: '2026-08-01T00:00:00.000Z',
        atualizadoEm: '2026-08-02T00:00:00.000Z',
        automatica: false,
      })
    })

    it('consulta o mês inteiro e as candidatas recorrentes anteriores, sempre filtrando por user_id', async () => {
      const fake = cenario()

      await new SupabaseSaidaRepository(fake.client).listarComProjecao(USER_ID, AGOSTO)

      const [doPeriodo, candidatas] = fake.consultasDe('saidas')
      expect(doPeriodo!.chamadas).toEqual([
        ['select', '*'],
        ['eq', 'user_id', USER_ID],
        ['gte', 'data', '2026-08-01'],
        ['lte', 'data', '2026-08-31'],
      ])
      expect(candidatas!.chamadas).toEqual([
        ['select', '*'],
        ['eq', 'user_id', USER_ID],
        ['eq', 'recorrente', true],
        ['lt', 'data', '2026-08-01'],
      ])
      expect(fake.consultasDe('faturas')[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    })

    it('projeta a série recorrente sem lançamento no mês, avançando data e vencimento', async () => {
      const origem = linhaSaida({ id: 'origem', data: '2026-07-05', vencimento: '2026-07-10', recorrente: true })
      const { client } = cenario({ candidatas: [origem] })

      const [projetada] = await new SupabaseSaidaRepository(client).listarComProjecao(USER_ID, AGOSTO)

      expect(projetada).toMatchObject({
        id: 'origem_2026-08',
        data: '2026-08-05',
        vencimento: '2026-08-10',
        origemRecorrenciaId: 'origem',
      })
    })

    it('inclui cada fatura que vence no mês como saída automática de cartão', async () => {
      const { client } = cenario({
        saidas: [linhaSaida({ data: '2026-08-01' })],
        faturas: [
          linhaFatura({ id: 'fat-1', vencimento: '2026-08-10', total: 450 }),
          linhaFatura({ id: 'fat-2', vencimento: '2026-08-20', total: 90, status: 'PAGA', pago_em: '2026-08-18' }),
        ],
      })

      const saidas = await new SupabaseSaidaRepository(client).listarComProjecao(USER_ID, AGOSTO)

      expect(saidas.map((saida) => saida.id)).toEqual(['sai_fat_fat-2', 'sai_fat_fat-1', 'sai-1'])
      expect(saidas[1]).toEqual({
        id: 'sai_fat_fat-1',
        descricao: 'Fatura – Nubank',
        valor: 450,
        data: '2026-08-10',
        categoriaId: 'cat-var',
        tipo: 'CONTA',
        status: 'PENDENTE',
        vencimento: '2026-08-10',
        pagoEm: null,
        formaPagamento: 'CARTAO_CREDITO',
        cartaoId: 'cartao-1',
        recorrente: true,
        observacao: null,
        criadoEm: '',
        atualizadoEm: '',
        automatica: true,
      })
      expect(saidas[0]).toMatchObject({ status: 'PAGO', pagoEm: '2026-08-18', automatica: true })
    })

    it('propaga o erro da consulta do período', async () => {
      const { client } = criarSupabaseFake({ saidas: [falha(ERRO), ok([])] })

      await expect(new SupabaseSaidaRepository(client).listarComProjecao(USER_ID, AGOSTO)).rejects.toBe(ERRO)
    })

    it('propaga o erro da consulta de candidatas a recorrência', async () => {
      const { client } = criarSupabaseFake({ saidas: [ok([]), falha(ERRO)] })

      await expect(new SupabaseSaidaRepository(client).listarComProjecao(USER_ID, AGOSTO)).rejects.toBe(ERRO)
    })
  })

  describe('listar', () => {
    const saidas = [
      linhaSaida({ id: 's1', descricao: 'Aluguel', data: '2026-08-05', status: 'PAGO' }),
      linhaSaida({ id: 's2', descricao: 'Mercado', data: '2026-08-10', status: 'PENDENTE', categoria_id: 'cat-var' }),
      linhaSaida({ id: 's3', descricao: 'Luz', data: '2026-08-15', status: 'PENDENTE', observacao: 'Conta da CEMIG' }),
    ]

    it('filtra por categoria e por situação', async () => {
      const { client } = cenario({ saidas })
      const repositorio = new SupabaseSaidaRepository(client)

      const porCategoria = await repositorio.listar(USER_ID, { periodo: AGOSTO, categoriaId: 'cat-var', page: 1, pageSize: 20 })
      const pendentes = await repositorio.listar(USER_ID, { periodo: AGOSTO, status: 'PENDENTE', page: 1, pageSize: 20 })

      expect(porCategoria.items.map((saida) => saida.id)).toEqual(['s2'])
      expect(pendentes.items.map((saida) => saida.id)).toEqual(['s3', 's2'])
    })

    it('busca na descrição e na observação sem diferenciar maiúsculas', async () => {
      const { client } = cenario({ saidas })

      const pagina = await new SupabaseSaidaRepository(client).listar(USER_ID, {
        periodo: AGOSTO,
        busca: 'cemig',
        page: 1,
        pageSize: 20,
      })

      expect(pagina.items.map((saida) => saida.id)).toEqual(['s3'])
    })

    it('pagina o resultado', async () => {
      const { client } = cenario({ saidas })

      const pagina = await new SupabaseSaidaRepository(client).listar(USER_ID, { periodo: AGOSTO, page: 1, pageSize: 2 })

      expect(pagina).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 })
      expect(pagina.items.map((saida) => saida.id)).toEqual(['s3', 's2'])
    })
  })

  describe('resumo', () => {
    it('calcula totais, pago x pendente, mês anterior e agrupamentos por categoria e por tipo', async () => {
      const { client } = cenario({
        saidas: [
          linhaSaida({ id: 's1', valor: 1000, status: 'PAGO', tipo: 'CONTA' }),
          linhaSaida({ id: 's2', descricao: 'Mercado', valor: 300, status: 'PENDENTE', tipo: 'ALIMENTACAO', categoria_id: 'cat-var' }),
          linhaSaida({ id: 's3', descricao: 'Luz', valor: 200, status: 'PENDENTE', tipo: 'CONTA' }),
          linhaSaida({ id: 's-jul', data: '2026-07-10', valor: 700 }),
        ],
      })

      const resumo = await new SupabaseSaidaRepository(client).resumo(USER_ID, AGOSTO)

      expect(resumo).toEqual({
        total: 1500,
        quantidade: 3,
        media: 500,
        totalPago: 1000,
        totalPendente: 500,
        totalMesAnterior: 700,
        porCategoria: [
          { categoriaId: 'cat-fixa', nome: 'Despesa Fixa', cor: '#ef4444', total: 1200 },
          { categoriaId: 'cat-var', nome: 'Sem categoria', cor: '#94a3b8', total: 300 },
        ],
        porTipo: [
          { tipo: 'CONTA', total: 1200 },
          { tipo: 'ALIMENTACAO', total: 300 },
        ],
      })
    })

    it('devolve zeros quando não há saídas no período', async () => {
      const { client } = cenario()

      const resumo = await new SupabaseSaidaRepository(client).resumo(USER_ID, AGOSTO)

      expect(resumo).toMatchObject({ total: 0, quantidade: 0, media: 0, totalPago: 0, totalPendente: 0, porTipo: [] })
    })

    it('propaga o erro da consulta de categorias', async () => {
      const { client } = cenario({ categorias: falha(ERRO) })

      await expect(new SupabaseSaidaRepository(client).resumo(USER_ID, AGOSTO)).rejects.toBe(ERRO)
    })
  })

  describe('buscarPorId', () => {
    it('busca pelo id e pelo user_id', async () => {
      const fake = criarSupabaseFake({ saidas: [ok(linhaSaida({ id: ID, automatica: true }))] })

      const saida = await new SupabaseSaidaRepository(fake.client).buscarPorId(USER_ID, ID)

      expect(saida).toMatchObject({ id: ID, automatica: true })
      expect(fake.consultas[0]!.chamadas).toEqual([
        ['select', '*'],
        ['eq', 'id', ID],
        ['eq', 'user_id', USER_ID],
        ['maybeSingle'],
      ])
    })

    it('devolve null quando não encontra', async () => {
      const { client } = criarSupabaseFake({ saidas: [ok(null)] })

      await expect(new SupabaseSaidaRepository(client).buscarPorId(USER_ID, ID)).resolves.toBeNull()
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ saidas: [falha(ERRO)] })

      await expect(new SupabaseSaidaRepository(client).buscarPorId(USER_ID, ID)).rejects.toBe(ERRO)
    })
  })

  describe('criar', () => {
    it('insere o payload em snake_case com o user_id, preenchendo opcionais com null', async () => {
      const fake = criarSupabaseFake({ saidas: [ok(linhaSaida({ id: ID }))] })

      const saida = await new SupabaseSaidaRepository(fake.client).criar(USER_ID, payload())

      expect(saida.id).toBe(ID)
      expect(argumentos(fake.consultas[0]!, 'insert')).toEqual([
        {
          descricao: 'Aluguel',
          valor: 1000,
          data: '2026-08-05',
          categoria_id: 'cat-fixa',
          tipo: 'CONTA',
          status: 'PENDENTE',
          vencimento: null,
          pago_em: null,
          forma_pagamento: 'PIX',
          cartao_id: null,
          recorrente: false,
          observacao: null,
          user_id: USER_ID,
        },
      ])
    })

    it('grava vencimento, pagoEm e observação informados', async () => {
      const fake = criarSupabaseFake({ saidas: [ok(linhaSaida())] })

      await new SupabaseSaidaRepository(fake.client).criar(
        USER_ID,
        payload({ vencimento: '2026-08-10', pagoEm: '2026-08-09', observacao: 'nota', status: 'PAGO' }),
      )

      expect(argumentos(fake.consultas[0]!, 'insert')![0]).toMatchObject({
        vencimento: '2026-08-10',
        pago_em: '2026-08-09',
        observacao: 'nota',
      })
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ saidas: [falha(ERRO)] })

      await expect(new SupabaseSaidaRepository(client).criar(USER_ID, payload())).rejects.toBe(ERRO)
    })
  })

  describe('atualizar', () => {
    it('atualiza só a linha do usuário e devolve a entidade', async () => {
      const fake = criarSupabaseFake({ saidas: [ok(linhaSaida({ id: ID, valor: 1200 }))] })

      const saida = await new SupabaseSaidaRepository(fake.client).atualizar(USER_ID, ID, payload({ valor: 1200 }))

      expect(saida.valor).toBe(1200)
      const consulta = fake.consultas[0]!
      expect(argumentos(consulta, 'update')![0]).toMatchObject({ valor: 1200, forma_pagamento: 'PIX' })
      expect(consulta.chamadas).toContainEqual(['eq', 'id', ID])
      expect(consulta.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    })

    it('lança NotFoundError quando nenhuma linha é atualizada', async () => {
      const { client } = criarSupabaseFake({ saidas: [ok(null)] })

      await expect(new SupabaseSaidaRepository(client).atualizar(USER_ID, ID, payload())).rejects.toBeInstanceOf(NotFoundError)
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ saidas: [falha(ERRO)] })

      await expect(new SupabaseSaidaRepository(client).atualizar(USER_ID, ID, payload())).rejects.toBe(ERRO)
    })
  })

  describe('remover', () => {
    it('remove só a linha do usuário', async () => {
      const fake = criarSupabaseFake({ saidas: [ok({ id: ID })] })

      await expect(new SupabaseSaidaRepository(fake.client).remover(USER_ID, ID)).resolves.toBeUndefined()

      const consulta = fake.consultas[0]!
      expect(usou(consulta, 'delete')).toBe(true)
      expect(consulta.chamadas).toContainEqual(['eq', 'id', ID])
      expect(consulta.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    })

    it('lança NotFoundError quando nenhuma linha é removida', async () => {
      const { client } = criarSupabaseFake({ saidas: [ok(null)] })

      const promessa = new SupabaseSaidaRepository(client).remover(USER_ID, ID)

      await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
      await expect(promessa).rejects.toMatchObject({ message: 'Saída não encontrado.' })
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ saidas: [falha(ERRO)] })

      await expect(new SupabaseSaidaRepository(client).remover(USER_ID, ID)).rejects.toBe(ERRO)
    })
  })
})
