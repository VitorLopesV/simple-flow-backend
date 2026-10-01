import { describe, expect, it } from 'vitest'

import { AtualizarEntrada } from '../../../../src/application/use-cases/entradas/AtualizarEntrada'
import type { Entrada, EntradaPayload } from '../../../../src/domain/entities/Entrada'
import { NotFoundError, ValidationError } from '../../../../src/domain/errors/DomainError'
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

function criarRepositorios(existentes: Entrada[] = []) {
  const entradas = criarEntradaRepositoryFake()
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
})
