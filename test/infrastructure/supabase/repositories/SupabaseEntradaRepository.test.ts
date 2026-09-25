import { describe, expect, it } from 'vitest'

import type { EntradaPayload } from '../../../../src/domain/entities/Entrada'
import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { SupabaseEntradaRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseEntradaRepository'
import { USER_ID, linhaEntrada, type EntradaRow } from '../../../helpers/linhasSupabase'
import { argumentos, criarSupabaseFake, falha, ok, usou, type ConsultaRegistrada } from '../../../helpers/supabaseFake'

const AGOSTO = { mes: 8, ano: 2026 }
const ID = '123e4567-e89b-12d3-a456-426614174000'
const ERRO = { message: 'falha no banco' }

function payload(sobrescritas: Partial<EntradaPayload> = {}): EntradaPayload {
  return {
    descricao: 'Salário',
    valor: 5000,
    data: '2026-08-05',
    categoriaId: 'cat-renda',
    recorrente: false,
    ...sobrescritas,
  }
}

/** Responde às duas queries de `listarComProjecao`: as linhas do período e as candidatas a recorrência (`lt`). */
function porPeriodo(linhas: EntradaRow[], candidatas: EntradaRow[] = []) {
  return (consulta: ConsultaRegistrada) => {
    if (usou(consulta, 'lt')) return ok(candidatas)
    const [, inicio] = argumentos(consulta, 'gte')!
    const [, fim] = argumentos(consulta, 'lte')!
    return ok(linhas.filter((linha) => linha.data >= String(inicio) && linha.data <= String(fim)))
  }
}

describe('SupabaseEntradaRepository', () => {
  describe('listarComProjecao', () => {
    it('mapeia as linhas de snake_case para camelCase, convertendo valor para número', async () => {
      const linha = linhaEntrada({ valor: '1234.56' as unknown as number, observacao: 'bônus' })
      const { client } = criarSupabaseFake({ entradas: porPeriodo([linha]) })

      const [entrada] = await new SupabaseEntradaRepository(client).listarComProjecao(USER_ID, AGOSTO)

      expect(entrada).toEqual({
        id: 'ent-1',
        descricao: 'Salário',
        valor: 1234.56,
        data: '2026-08-05',
        categoriaId: 'cat-renda',
        recorrente: false,
        observacao: 'bônus',
        criadoEm: '2026-08-01T00:00:00.000Z',
        atualizadoEm: '2026-08-02T00:00:00.000Z',
      })
    })

    it('consulta o mês inteiro e as candidatas recorrentes anteriores, sempre filtrando por user_id', async () => {
      const fake = criarSupabaseFake({ entradas: porPeriodo([]) })

      await new SupabaseEntradaRepository(fake.client).listarComProjecao(USER_ID, AGOSTO)

      const [doPeriodo, candidatas] = fake.consultasDe('entradas')
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
    })

    it('projeta a série recorrente sem lançamento no mês e ordena da data mais recente para a mais antiga', async () => {
      const real = linhaEntrada({ id: 'real', descricao: 'Freela', data: '2026-08-02', valor: 300 })
      const origem = linhaEntrada({ id: 'origem', data: '2026-07-20', recorrente: true })
      const { client } = criarSupabaseFake({ entradas: porPeriodo([real], [origem]) })

      const entradas = await new SupabaseEntradaRepository(client).listarComProjecao(USER_ID, AGOSTO)

      expect(entradas.map((entrada) => entrada.id)).toEqual(['origem_2026-08', 'real'])
      expect(entradas[0]).toMatchObject({ data: '2026-08-20', origemRecorrenciaId: 'origem', valor: 5000 })
    })

    it('não projeta a série que já tem lançamento real no mês', async () => {
      const real = linhaEntrada({ id: 'real', data: '2026-08-05', recorrente: true })
      const origem = linhaEntrada({ id: 'origem', data: '2026-07-05', recorrente: true })
      const { client } = criarSupabaseFake({ entradas: porPeriodo([real], [origem]) })

      const entradas = await new SupabaseEntradaRepository(client).listarComProjecao(USER_ID, AGOSTO)

      expect(entradas.map((entrada) => entrada.id)).toEqual(['real'])
    })

    it('propaga o erro da consulta do período', async () => {
      const { client } = criarSupabaseFake({ entradas: [falha(ERRO), ok([])] })

      await expect(new SupabaseEntradaRepository(client).listarComProjecao(USER_ID, AGOSTO)).rejects.toBe(ERRO)
    })

    it('propaga o erro da consulta de candidatas a recorrência', async () => {
      const { client } = criarSupabaseFake({ entradas: [ok([]), falha(ERRO)] })

      await expect(new SupabaseEntradaRepository(client).listarComProjecao(USER_ID, AGOSTO)).rejects.toBe(ERRO)
    })
  })

  describe('listar', () => {
    const linhas = [
      linhaEntrada({ id: 'e1', descricao: 'Salário', data: '2026-08-05', categoria_id: 'cat-renda' }),
      linhaEntrada({ id: 'e2', descricao: 'Freela', data: '2026-08-10', categoria_id: 'cat-extra', observacao: 'Site' }),
      linhaEntrada({ id: 'e3', descricao: 'Venda', data: '2026-08-15', categoria_id: 'cat-extra' }),
    ]

    it('pagina o resultado já ordenado', async () => {
      const { client } = criarSupabaseFake({ entradas: porPeriodo(linhas) })

      const pagina = await new SupabaseEntradaRepository(client).listar(USER_ID, {
        periodo: AGOSTO,
        page: 2,
        pageSize: 2,
      })

      expect(pagina).toEqual({
        items: [expect.objectContaining({ id: 'e1' })],
        page: 2,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      })
    })

    it('filtra por categoria', async () => {
      const { client } = criarSupabaseFake({ entradas: porPeriodo(linhas) })

      const pagina = await new SupabaseEntradaRepository(client).listar(USER_ID, {
        periodo: AGOSTO,
        categoriaId: 'cat-extra',
        page: 1,
        pageSize: 20,
      })

      expect(pagina.items.map((entrada) => entrada.id)).toEqual(['e3', 'e2'])
    })

    it('busca sem diferenciar maiúsculas na descrição e na observação', async () => {
      const { client } = criarSupabaseFake({ entradas: porPeriodo(linhas) })
      const repositorio = new SupabaseEntradaRepository(client)

      const porDescricao = await repositorio.listar(USER_ID, { periodo: AGOSTO, busca: 'SALÁ', page: 1, pageSize: 20 })
      const porObservacao = await repositorio.listar(USER_ID, { periodo: AGOSTO, busca: 'site', page: 1, pageSize: 20 })

      expect(porDescricao.items.map((entrada) => entrada.id)).toEqual(['e1'])
      expect(porObservacao.items.map((entrada) => entrada.id)).toEqual(['e2'])
    })
  })

  describe('resumo', () => {
    it('calcula total, quantidade, média, mês anterior e agrupamento por categoria', async () => {
      const { client } = criarSupabaseFake({
        entradas: porPeriodo([
          linhaEntrada({ id: 'e1', valor: 1000, categoria_id: 'cat-renda' }),
          linhaEntrada({ id: 'e2', descricao: 'Freela', valor: 3000, categoria_id: 'cat-extra' }),
          linhaEntrada({ id: 'e3', descricao: 'Bico', valor: 2000, categoria_id: 'cat-renda' }),
          linhaEntrada({ id: 'e-jul', data: '2026-07-10', valor: 4000 }),
        ]),
        categorias: [ok([{ id: 'cat-renda', nome: 'Salário', cor: '#22c55e' }])],
      })

      const resumo = await new SupabaseEntradaRepository(client).resumo(USER_ID, AGOSTO)

      expect(resumo).toEqual({
        total: 6000,
        quantidade: 3,
        media: 2000,
        totalMesAnterior: 4000,
        porCategoria: [
          { categoriaId: 'cat-renda', nome: 'Salário', cor: '#22c55e', total: 3000 },
          { categoriaId: 'cat-extra', nome: 'Sem categoria', cor: '#94a3b8', total: 3000 },
        ],
      })
    })

    it('devolve média 0 quando não há entradas no período', async () => {
      const { client } = criarSupabaseFake({ entradas: porPeriodo([]), categorias: [ok([])] })

      const resumo = await new SupabaseEntradaRepository(client).resumo(USER_ID, AGOSTO)

      expect(resumo).toEqual({ total: 0, quantidade: 0, media: 0, totalMesAnterior: 0, porCategoria: [] })
    })

    it('propaga o erro da consulta de categorias', async () => {
      const { client } = criarSupabaseFake({ entradas: porPeriodo([]), categorias: [falha(ERRO)] })

      await expect(new SupabaseEntradaRepository(client).resumo(USER_ID, AGOSTO)).rejects.toBe(ERRO)
    })
  })

  describe('buscarPorId', () => {
    it('busca pelo id e pelo user_id e mapeia a linha', async () => {
      const fake = criarSupabaseFake({ entradas: [ok(linhaEntrada({ id: ID }))] })

      const entrada = await new SupabaseEntradaRepository(fake.client).buscarPorId(USER_ID, ID)

      expect(entrada).toMatchObject({ id: ID, categoriaId: 'cat-renda' })
      expect(fake.consultas[0]!.chamadas).toEqual([
        ['select', '*'],
        ['eq', 'id', ID],
        ['eq', 'user_id', USER_ID],
        ['maybeSingle'],
      ])
    })

    it('devolve null quando não encontra', async () => {
      const { client } = criarSupabaseFake({ entradas: [ok(null)] })

      await expect(new SupabaseEntradaRepository(client).buscarPorId(USER_ID, ID)).resolves.toBeNull()
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ entradas: [falha(ERRO)] })

      await expect(new SupabaseEntradaRepository(client).buscarPorId(USER_ID, ID)).rejects.toBe(ERRO)
    })
  })

  describe('criar', () => {
    it('insere o payload em snake_case com o user_id e devolve a entidade', async () => {
      const fake = criarSupabaseFake({ entradas: [ok(linhaEntrada({ id: ID }))] })

      const entrada = await new SupabaseEntradaRepository(fake.client).criar(USER_ID, payload())

      expect(entrada.id).toBe(ID)
      expect(argumentos(fake.consultas[0]!, 'insert')).toEqual([
        {
          descricao: 'Salário',
          valor: 5000,
          data: '2026-08-05',
          categoria_id: 'cat-renda',
          recorrente: false,
          observacao: null,
          user_id: USER_ID,
        },
      ])
      expect(usou(fake.consultas[0]!, 'single')).toBe(true)
    })

    it('mantém a observação informada', async () => {
      const fake = criarSupabaseFake({ entradas: [ok(linhaEntrada())] })

      await new SupabaseEntradaRepository(fake.client).criar(USER_ID, payload({ observacao: 'nota' }))

      expect(argumentos(fake.consultas[0]!, 'insert')![0]).toMatchObject({ observacao: 'nota' })
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ entradas: [falha(ERRO)] })

      await expect(new SupabaseEntradaRepository(client).criar(USER_ID, payload())).rejects.toBe(ERRO)
    })
  })

  describe('atualizar', () => {
    it('atualiza só a linha do usuário e devolve a entidade', async () => {
      const fake = criarSupabaseFake({ entradas: [ok(linhaEntrada({ id: ID, descricao: 'Novo' }))] })

      const entrada = await new SupabaseEntradaRepository(fake.client).atualizar(USER_ID, ID, payload({ descricao: 'Novo' }))

      expect(entrada.descricao).toBe('Novo')
      const consulta = fake.consultas[0]!
      expect(argumentos(consulta, 'update')![0]).toMatchObject({ descricao: 'Novo', categoria_id: 'cat-renda' })
      expect(consulta.chamadas).toContainEqual(['eq', 'id', ID])
      expect(consulta.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    })

    it('lança NotFoundError quando nenhuma linha é atualizada', async () => {
      const { client } = criarSupabaseFake({ entradas: [ok(null)] })

      await expect(new SupabaseEntradaRepository(client).atualizar(USER_ID, ID, payload())).rejects.toBeInstanceOf(
        NotFoundError,
      )
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ entradas: [falha(ERRO)] })

      await expect(new SupabaseEntradaRepository(client).atualizar(USER_ID, ID, payload())).rejects.toBe(ERRO)
    })
  })

  describe('remover', () => {
    it('remove só a linha do usuário', async () => {
      const fake = criarSupabaseFake({ entradas: [ok({ id: ID })] })

      await expect(new SupabaseEntradaRepository(fake.client).remover(USER_ID, ID)).resolves.toBeUndefined()

      const consulta = fake.consultas[0]!
      expect(usou(consulta, 'delete')).toBe(true)
      expect(consulta.chamadas).toContainEqual(['eq', 'id', ID])
      expect(consulta.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    })

    it('lança NotFoundError quando nenhuma linha é removida', async () => {
      const { client } = criarSupabaseFake({ entradas: [ok(null)] })

      const promessa = new SupabaseEntradaRepository(client).remover(USER_ID, ID)

      await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
      await expect(promessa).rejects.toMatchObject({ message: 'Entrada não encontrado.' })
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ entradas: [falha(ERRO)] })

      await expect(new SupabaseEntradaRepository(client).remover(USER_ID, ID)).rejects.toBe(ERRO)
    })
  })
})
