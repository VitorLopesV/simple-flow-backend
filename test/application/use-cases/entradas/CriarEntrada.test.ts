import { describe, expect, it } from 'vitest'

import { CriarEntrada } from '../../../../src/application/use-cases/entradas/CriarEntrada'
import type { Entrada, EntradaPayload } from '../../../../src/domain/entities/Entrada'
import { ValidationError } from '../../../../src/domain/errors/DomainError'
import { CATEGORIAS, criarCategoriaRepositoryFake, criarEntradaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const UUID = /^[0-9a-f-]{36}$/

function payload(sobrescritas: Partial<EntradaPayload> = {}): EntradaPayload {
  return {
    descricao: 'Salário',
    valor: 5000,
    data: '2026-08-05',
    categoriaId: CATEGORIAS.rendaFixa.id,
    tipo: 'SALARIO',
    recorrente: false,
    observacao: null,
    ...sobrescritas,
  }
}

function criarRepositorios() {
  const entradas = criarEntradaRepositoryFake()
  entradas.criar.mockImplementation(
    async (_userId: string, dados: EntradaPayload, controle = {}): Promise<Entrada> => ({
      ...dados,
      id: `entrada-${entradas.criar.mock.calls.length}`,
      criadoEm: '2026-08-05T12:00:00.000Z',
      atualizadoEm: '2026-08-05T12:00:00.000Z',
      serieId: null,
      editadoManualmente: false,
      ...controle,
    }),
  )
  return { entradas, categorias: criarCategoriaRepositoryFake() }
}

describe('CriarEntrada', () => {
  it('cria entrada avulsa uma vez só, sem série, e devolve a entrada criada', async () => {
    const { entradas, categorias } = criarRepositorios()

    const criada = await new CriarEntrada(entradas, categorias).execute(USER_ID, payload())

    expect(entradas.criar).toHaveBeenCalledTimes(1)
    expect(entradas.criar).toHaveBeenCalledWith(USER_ID, payload())
    expect(criada).toMatchObject({ id: 'entrada-1', serieId: null })
    expect(categorias.buscarPorId).toHaveBeenCalledWith(USER_ID, CATEGORIAS.rendaFixa.id)
  })

  it('entrada recorrente cria também o mês seguinte, na mesma série e no mesmo dia', async () => {
    const { entradas, categorias } = criarRepositorios()

    const criada = await new CriarEntrada(entradas, categorias).execute(USER_ID, payload({ recorrente: true }))

    expect(entradas.criar).toHaveBeenCalledTimes(2)
    const [, , controleOriginal] = entradas.criar.mock.calls[0]!
    const [, seguinte, controleSeguinte] = entradas.criar.mock.calls[1]!
    expect(controleOriginal!.serieId).toMatch(UUID)
    expect(controleSeguinte).toEqual(controleOriginal)
    expect(seguinte).toEqual(payload({ recorrente: true, data: '2026-09-05' }))
    expect(criada).toMatchObject({ id: 'entrada-1', data: '2026-08-05', serieId: controleOriginal!.serieId })
  })

  it('limita o dia do mês seguinte ao último dia do mês', async () => {
    const { entradas, categorias } = criarRepositorios()

    await new CriarEntrada(entradas, categorias).execute(USER_ID, payload({ recorrente: true, data: '2026-01-31' }))

    expect(entradas.criar.mock.calls[1]![1].data).toBe('2026-02-28')
  })

  it.each([
    ['Renda Variável', CATEGORIAS.rendaVariavel.id],
    ['Investimentos', CATEGORIAS.investimentos.id],
    ['Outros', CATEGORIAS.outros.id],
  ])('rejeita recorrente na categoria %s com 422, sem gravar nada', async (_nome, categoriaId) => {
    const { entradas, categorias } = criarRepositorios()

    const execucao = new CriarEntrada(entradas, categorias).execute(USER_ID, payload({ recorrente: true, categoriaId }))

    await expect(execucao).rejects.toThrow(
      new ValidationError('Lançamento recorrente só é permitido na categoria Renda Fixa.'),
    )
    expect(entradas.criar).not.toHaveBeenCalled()
  })

  it('aceita entrada não recorrente em categoria não fixa', async () => {
    const { entradas, categorias } = criarRepositorios()

    await new CriarEntrada(entradas, categorias).execute(USER_ID, payload({ categoriaId: CATEGORIAS.outros.id }))

    expect(entradas.criar).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['inexistente', 'cat-x'],
    ['de saída', CATEGORIAS.despesaFixa.id],
  ])('rejeita categoria %s com 422', async (_caso, categoriaId) => {
    const { entradas, categorias } = criarRepositorios()

    await expect(new CriarEntrada(entradas, categorias).execute(USER_ID, payload({ categoriaId }))).rejects.toThrow(
      new ValidationError('Categoria inválida.'),
    )
    expect(entradas.criar).not.toHaveBeenCalled()
  })

  it('propaga o erro do repositório', async () => {
    const { entradas, categorias } = criarRepositorios()
    const erro = new Error('falha no banco')
    entradas.criar.mockRejectedValueOnce(erro)

    await expect(new CriarEntrada(entradas, categorias).execute(USER_ID, payload())).rejects.toBe(erro)
  })
})
