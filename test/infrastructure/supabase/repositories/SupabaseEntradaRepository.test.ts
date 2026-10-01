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
    tipo: 'SALARIO',
    recorrente: false,
    ...sobrescritas,
  }
}

/** Responde à query de `listarDoPeriodo` com as linhas dentro do intervalo, ordenadas como o `.order('data', desc)` pede. */
function porPeriodo(linhas: EntradaRow[]) {
  return (consulta: ConsultaRegistrada) => {
    const [, inicio] = argumentos(consulta, 'gte')!
    const [, fim] = argumentos(consulta, 'lte')!
    return ok(
      linhas
        .filter((linha) => linha.data >= String(inicio) && linha.data <= String(fim))
        .sort((a, b) => b.data.localeCompare(a.data)),
    )
  }
}

describe('SupabaseEntradaRepository', () => {
  describe('listarDoPeriodo', () => {
    it('mapeia as linhas de snake_case para camelCase, convertendo valor para número', async () => {
      const linha = linhaEntrada({
        valor: '1234.56' as unknown as number,
        observacao: 'bônus',
        recorrente: true,
        serie_id: 'serie-1',
        editado_manualmente: true,
      })
      const { client } = criarSupabaseFake({ entradas: porPeriodo([linha]) })

      const [entrada] = await new SupabaseEntradaRepository(client).listarDoPeriodo(USER_ID, AGOSTO)

      expect(entrada).toEqual({
        id: 'ent-1',
        descricao: 'Salário',
        valor: 1234.56,
        data: '2026-08-05',
        categoriaId: 'cat-renda',
        tipo: 'SALARIO',
        recorrente: true,
        observacao: 'bônus',
        criadoEm: '2026-08-01T00:00:00.000Z',
        atualizadoEm: '2026-08-02T00:00:00.000Z',
        serieId: 'serie-1',
        editadoManualmente: true,
      })
    })

    it('consulta só o mês informado, filtrando por user_id e ordenando da mais recente para a mais antiga', async () => {
      const fake = criarSupabaseFake({ entradas: porPeriodo([]) })

      await new SupabaseEntradaRepository(fake.client).listarDoPeriodo(USER_ID, AGOSTO)

      expect(fake.consultasDe('entradas')).toHaveLength(1)
      expect(fake.consultas[0]!.chamadas).toEqual([
        ['select', '*'],
        ['eq', 'user_id', USER_ID],
        ['gte', 'data', '2026-08-01'],
        ['lte', 'data', '2026-08-31'],
        ['order', 'data', { ascending: false }],
      ])
    })

    it('não projeta nada: um mês sem registros fica vazio mesmo com série recorrente antes dele', async () => {
      const julho = linhaEntrada({ id: 'jul', data: '2026-07-05', recorrente: true, serie_id: 'serie-1' })
      const { client } = criarSupabaseFake({ entradas: porPeriodo([julho]) })

      await expect(new SupabaseEntradaRepository(client).listarDoPeriodo(USER_ID, AGOSTO)).resolves.toEqual([])
    })

    it('propaga o erro da consulta', async () => {
      const { client } = criarSupabaseFake({ entradas: [falha(ERRO)] })

      await expect(new SupabaseEntradaRepository(client).listarDoPeriodo(USER_ID, AGOSTO)).rejects.toBe(ERRO)
    })
  })

  describe('listar', () => {
    const linhas = [
      linhaEntrada({ id: 'e1', descricao: 'Salário', data: '2026-08-05', categoria_id: 'cat-renda' }),
      linhaEntrada({ id: 'e2', descricao: 'Freela', data: '2026-08-10', categoria_id: 'cat-extra', tipo: 'FREELANCE', observacao: 'Site' }),
      linhaEntrada({ id: 'e3', descricao: 'Venda', data: '2026-08-15', categoria_id: 'cat-extra', tipo: 'REEMBOLSO' }),
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

    it('filtra por tipo', async () => {
      const { client } = criarSupabaseFake({ entradas: porPeriodo(linhas) })

      const pagina = await new SupabaseEntradaRepository(client).listar(USER_ID, {
        periodo: AGOSTO,
        tipo: 'FREELANCE',
        page: 1,
        pageSize: 20,
      })

      expect(pagina.items.map((entrada) => entrada.id)).toEqual(['e2'])
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
          tipo: 'SALARIO',
          recorrente: false,
          observacao: null,
          user_id: USER_ID,
        },
      ])
      expect(usou(fake.consultas[0]!, 'single')).toBe(true)
    })

    it('grava o serie_id informado no controle da série', async () => {
      const fake = criarSupabaseFake({ entradas: [ok(linhaEntrada())] })

      await new SupabaseEntradaRepository(fake.client).criar(USER_ID, payload({ recorrente: true }), { serieId: 'serie-1' })

      expect(argumentos(fake.consultas[0]!, 'insert')![0]).toMatchObject({ recorrente: true, serie_id: 'serie-1', user_id: USER_ID })
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

    it('grava editado_manualmente só quando informado no controle', async () => {
      const fake = criarSupabaseFake({ entradas: [ok(linhaEntrada()), ok(linhaEntrada())] })
      const repositorio = new SupabaseEntradaRepository(fake.client)

      await repositorio.atualizar(USER_ID, ID, payload(), { editadoManualmente: true })
      await repositorio.atualizar(USER_ID, ID, payload())

      expect(argumentos(fake.consultas[0]!, 'update')![0]).toMatchObject({ editado_manualmente: true })
      expect(argumentos(fake.consultas[1]!, 'update')![0]).not.toHaveProperty('editado_manualmente')
      expect(argumentos(fake.consultas[1]!, 'update')![0]).not.toHaveProperty('serie_id')
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

  describe('listarSeguintesDaSerie', () => {
    it('busca os registros da série a partir do mês seguinte, do usuário, do mais antigo para o mais novo', async () => {
      const fake = criarSupabaseFake({ entradas: [ok([linhaEntrada({ id: 'out', data: '2026-10-05', serie_id: 'serie-1' })])] })

      const seguintes = await new SupabaseEntradaRepository(fake.client).listarSeguintesDaSerie(USER_ID, 'serie-1', '2026-09-05')

      expect(seguintes.map((registro) => [registro.id, registro.serieId])).toEqual([['out', 'serie-1']])
      expect(fake.consultas[0]!.chamadas).toEqual([
        ['select', '*'],
        ['eq', 'user_id', USER_ID],
        ['eq', 'serie_id', 'serie-1'],
        ['gte', 'data', '2026-10-01'],
        ['order', 'data', { ascending: true }],
      ])
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ entradas: [falha(ERRO)] })

      await expect(new SupabaseEntradaRepository(client).listarSeguintesDaSerie(USER_ID, 'serie-1', '2026-09-05')).rejects.toBe(ERRO)
    })
  })

  describe('removerVarios', () => {
    it('remove só as linhas informadas do usuário', async () => {
      const fake = criarSupabaseFake({ entradas: [ok(null)] })

      await new SupabaseEntradaRepository(fake.client).removerVarios(USER_ID, ['a', 'b'])

      expect(fake.consultas[0]!.chamadas).toEqual([
        ['delete'],
        ['eq', 'user_id', USER_ID],
        ['in', 'id', ['a', 'b']],
      ])
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ entradas: [falha(ERRO)] })

      await expect(new SupabaseEntradaRepository(client).removerVarios(USER_ID, ['a'])).rejects.toBe(ERRO)
    })
  })

  describe('marcarSerieEncerrada', () => {
    it('marca todas as linhas da série do usuário', async () => {
      const fake = criarSupabaseFake({ entradas: [ok(null), ok(null)] })
      const repositorio = new SupabaseEntradaRepository(fake.client)

      await repositorio.marcarSerieEncerrada(USER_ID, 'serie-1', true)
      await repositorio.marcarSerieEncerrada(USER_ID, 'serie-1', false)

      expect(fake.consultas[0]!.chamadas).toEqual([
        ['update', { serie_encerrada: true }],
        ['eq', 'user_id', USER_ID],
        ['eq', 'serie_id', 'serie-1'],
      ])
      expect(argumentos(fake.consultas[1]!, 'update')).toEqual([{ serie_encerrada: false }])
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ entradas: [falha(ERRO)] })

      await expect(new SupabaseEntradaRepository(client).marcarSerieEncerrada(USER_ID, 'serie-1', true)).rejects.toBe(ERRO)
    })
  })
})
