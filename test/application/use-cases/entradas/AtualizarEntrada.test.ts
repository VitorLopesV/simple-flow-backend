import { describe, expect, it } from 'vitest'

import { AtualizarEntrada } from '../../../../src/application/use-cases/entradas/AtualizarEntrada'
import type { Entrada, EntradaPayload } from '../../../../src/domain/entities/Entrada'
import { NotFoundError, SerieAlteradaError, ValidationError } from '../../../../src/domain/errors/DomainError'
import { CATEGORIAS, criarCategoriaRepositoryFake, criarEntradaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const ID = '123e4567-e89b-12d3-a456-426614174000'
const SERIE = 'serie-1'

function entrada(sobrescritas: Partial<Entrada> = {}): Entrada {
  return {
    id: ID,
    descricao: 'Salário',
    valor: 5000,
    data: '2026-09-05',
    categoriaId: CATEGORIAS.rendaFixa.id,
    tipo: 'SALARIO',
    recorrente: false,
    observacao: null,
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
    serieId: null,
    editadoManualmente: false,
    ...sobrescritas,
  }
}

function payload(sobrescritas: Partial<EntradaPayload> = {}): EntradaPayload {
  return {
    descricao: 'Salário',
    valor: 5000,
    data: '2026-09-05',
    categoriaId: CATEGORIAS.rendaFixa.id,
    tipo: 'SALARIO',
    recorrente: false,
    observacao: null,
    ...sobrescritas,
  }
}

function criarRepositorios(existentes: Entrada[] = [], seguintes: Entrada[] = []) {
  const entradas = criarEntradaRepositoryFake()
  entradas.listarSeguintesDaSerie.mockResolvedValue(seguintes)
  entradas.criar.mockImplementation(async (_userId: string, dados: EntradaPayload, controle = {}) =>
    entrada({ ...dados, ...controle, id: 'nova' }),
  )
  entradas.buscarPorId.mockImplementation(async (_userId: string, id: string) => existentes.find((e) => e.id === id) ?? null)
  entradas.atualizar.mockImplementation(async (_userId: string, id: string, dados: EntradaPayload, controle = {}) =>
    entrada({ ...existentes.find((e) => e.id === id), ...dados, ...controle }),
  )
  return { entradas, categorias: criarCategoriaRepositoryFake() }
}

describe('AtualizarEntrada', () => {
  it('atualiza só o registro informado e marca como editado quando algo muda', async () => {
    const { entradas, categorias } = criarRepositorios([entrada()])

    const atualizada = await new AtualizarEntrada(entradas, categorias).execute(USER_ID, ID, payload({ valor: 5500 }))

    expect(entradas.atualizar).toHaveBeenCalledTimes(1)
    expect(entradas.atualizar).toHaveBeenCalledWith(USER_ID, ID, payload({ valor: 5500 }), { editadoManualmente: true })
    expect(atualizada.valor).toBe(5500)
    expect(entradas.criar).not.toHaveBeenCalled()
  })

  it('não marca como editado quando o payload é idêntico ao registro', async () => {
    const { entradas, categorias } = criarRepositorios([entrada()])

    await new AtualizarEntrada(entradas, categorias).execute(USER_ID, ID, payload())

    expect(entradas.atualizar.mock.calls[0]![3]).toEqual({ editadoManualmente: false })
  })

  it('mantém editado um registro que já tinha sido alterado antes', async () => {
    const { entradas, categorias } = criarRepositorios([entrada({ editadoManualmente: true })])

    await new AtualizarEntrada(entradas, categorias).execute(USER_ID, ID, payload())

    expect(entradas.atualizar.mock.calls[0]![3]).toEqual({ editadoManualmente: true })
  })

  it('preserva a descrição original enquanto a entrada continua recorrente', async () => {
    const { entradas, categorias } = criarRepositorios([entrada({ recorrente: true, serieId: SERIE })])

    await new AtualizarEntrada(entradas, categorias).execute(
      USER_ID,
      ID,
      payload({ recorrente: true, descricao: 'Outro nome' }),
    )

    expect(entradas.atualizar.mock.calls[0]![2]).toMatchObject({ descricao: 'Salário', recorrente: true })
  })

  it('aceita a nova descrição quando a recorrência é desligada', async () => {
    const { entradas, categorias } = criarRepositorios([entrada({ recorrente: true, serieId: SERIE })])

    await new AtualizarEntrada(entradas, categorias).execute(USER_ID, ID, payload({ descricao: 'Outro nome' }))

    expect(entradas.atualizar.mock.calls[0]![2]).toMatchObject({ descricao: 'Outro nome', recorrente: false })
  })

  it('trocar uma entrada recorrente para categoria não fixa desliga a recorrência (sem 422)', async () => {
    const { entradas, categorias } = criarRepositorios([entrada({ recorrente: true, serieId: SERIE })])

    await new AtualizarEntrada(entradas, categorias).execute(
      USER_ID,
      ID,
      payload({ recorrente: true, categoriaId: CATEGORIAS.rendaVariavel.id, descricao: 'Freela' }),
    )

    expect(entradas.atualizar.mock.calls[0]![2]).toMatchObject({ recorrente: false, descricao: 'Freela' })
  })

  it('rejeita ligar a recorrência numa categoria não fixa com 422', async () => {
    const { entradas, categorias } = criarRepositorios([entrada({ categoriaId: CATEGORIAS.outros.id })])

    const execucao = new AtualizarEntrada(entradas, categorias).execute(
      USER_ID,
      ID,
      payload({ recorrente: true, categoriaId: CATEGORIAS.outros.id }),
    )

    await expect(execucao).rejects.toThrow(
      new ValidationError('Lançamento recorrente só é permitido na categoria Renda Fixa.'),
    )
    expect(entradas.atualizar).not.toHaveBeenCalled()
  })

  it('rejeita categoria inexistente ou de saída com 422', async () => {
    const { entradas, categorias } = criarRepositorios([entrada()])

    for (const categoriaId of ['cat-x', CATEGORIAS.despesaFixa.id]) {
      await expect(
        new AtualizarEntrada(entradas, categorias).execute(USER_ID, ID, payload({ categoriaId })),
      ).rejects.toThrow(new ValidationError('Categoria inválida.'))
    }
    expect(entradas.atualizar).not.toHaveBeenCalled()
  })

  it('lança NotFoundError quando a entrada não existe (inclusive id de outro usuário)', async () => {
    const { entradas, categorias } = criarRepositorios()

    await expect(new AtualizarEntrada(entradas, categorias).execute(USER_ID, ID, payload())).rejects.toThrow(
      new NotFoundError('Entrada'),
    )
    expect(entradas.atualizar).not.toHaveBeenCalled()
  })

  describe('desligar a recorrência', () => {
    const setembro = entrada({ recorrente: true, serieId: SERIE })
    const outubro = entrada({ id: 'out', data: '2026-10-05', recorrente: true, serieId: SERIE })

    it('mantém o registro, remove os meses seguintes não alterados e encerra a série', async () => {
      const { entradas, categorias } = criarRepositorios([setembro], [outubro])

      const atualizada = await new AtualizarEntrada(entradas, categorias).execute(USER_ID, ID, payload())

      expect(entradas.listarSeguintesDaSerie).toHaveBeenCalledWith(USER_ID, SERIE, '2026-09-05')
      expect(entradas.removerVarios).toHaveBeenCalledWith(USER_ID, ['out'])
      expect(entradas.marcarSerieEncerrada).toHaveBeenCalledWith(USER_ID, SERIE, true)
      expect(atualizada).toMatchObject({ id: ID, recorrente: false })
      expect(entradas.criar).not.toHaveBeenCalled()
    })

    it('trocar para categoria não fixa conta como desativação', async () => {
      const { entradas, categorias } = criarRepositorios([setembro], [outubro])

      await new AtualizarEntrada(entradas, categorias).execute(
        USER_ID,
        ID,
        payload({ recorrente: true, categoriaId: CATEGORIAS.outros.id }),
      )

      expect(entradas.removerVarios).toHaveBeenCalledWith(USER_ID, ['out'])
      expect(entradas.marcarSerieEncerrada).toHaveBeenCalledWith(USER_ID, SERIE, true)
    })

    it('com mês seguinte alterado, exige confirmação e não grava nada', async () => {
      const { entradas, categorias } = criarRepositorios([setembro], [{ ...outubro, editadoManualmente: true }])

      const execucao = new AtualizarEntrada(entradas, categorias).execute(USER_ID, ID, payload())

      await expect(execucao).rejects.toBeInstanceOf(SerieAlteradaError)
      await expect(execucao).rejects.toMatchObject({ status: 409, detalhes: { mesesAfetados: ['2026-10'] } })
      expect(entradas.removerVarios).not.toHaveBeenCalled()
      expect(entradas.marcarSerieEncerrada).not.toHaveBeenCalled()
      expect(entradas.atualizar).not.toHaveBeenCalled()
    })

    it('com confirmação, remove os meses alterados também', async () => {
      const { entradas, categorias } = criarRepositorios([setembro], [{ ...outubro, editadoManualmente: true }])

      await new AtualizarEntrada(entradas, categorias).execute(USER_ID, ID, payload(), { confirmar: true })

      expect(entradas.removerVarios).toHaveBeenCalledWith(USER_ID, ['out'])
      expect(entradas.atualizar).toHaveBeenCalled()
    })

    it('sem meses seguintes, só encerra a série', async () => {
      const { entradas, categorias } = criarRepositorios([setembro], [])

      await new AtualizarEntrada(entradas, categorias).execute(USER_ID, ID, payload())

      expect(entradas.removerVarios).not.toHaveBeenCalled()
      expect(entradas.marcarSerieEncerrada).toHaveBeenCalledWith(USER_ID, SERIE, true)
    })
  })

  describe('religar a recorrência', () => {
    it('reabre a série e volta a criar o mês seguinte', async () => {
      const desligada = entrada({ recorrente: false, serieId: SERIE })
      const { entradas, categorias } = criarRepositorios([desligada], [])

      await new AtualizarEntrada(entradas, categorias).execute(USER_ID, ID, payload({ recorrente: true }))

      expect(entradas.atualizar.mock.calls[0]![3]).toEqual({ serieId: SERIE, editadoManualmente: true })
      expect(entradas.marcarSerieEncerrada).toHaveBeenCalledWith(USER_ID, SERIE, false)
      expect(entradas.criar).toHaveBeenCalledWith(USER_ID, payload({ recorrente: true, data: '2026-10-05' }), {
        serieId: SERIE,
      })
    })

    it('entrada que nunca foi de série ganha uma série nova', async () => {
      const { entradas, categorias } = criarRepositorios([entrada()], [])

      await new AtualizarEntrada(entradas, categorias).execute(USER_ID, ID, payload({ recorrente: true }))

      const serieId = entradas.atualizar.mock.calls[0]![3]!.serieId
      expect(serieId).toMatch(/^[0-9a-f-]{36}$/)
      expect(entradas.criar.mock.calls[0]![2]).toEqual({ serieId })
    })

    it('não duplica o mês seguinte se ele já existe', async () => {
      const desligada = entrada({ recorrente: false, serieId: SERIE })
      const { entradas, categorias } = criarRepositorios([desligada], [entrada({ id: 'out', data: '2026-10-05' })])

      await new AtualizarEntrada(entradas, categorias).execute(USER_ID, ID, payload({ recorrente: true }))

      expect(entradas.criar).not.toHaveBeenCalled()
    })
  })
})
