import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AtualizarSaida } from '../../../../src/application/use-cases/saidas/AtualizarSaida'
import type { Saida, SaidaPayload } from '../../../../src/domain/entities/Saida'
import {
  ConflictError,
  NotFoundError,
  SerieAlteradaError,
  ValidationError,
} from '../../../../src/domain/errors/DomainError'
import { CATEGORIAS, criarCategoriaRepositoryFake, criarSaidaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const ID_SAIDA = '123e4567-e89b-12d3-a456-426614174000'
const SERIE = 'serie-1'
const HOJE = '2026-09-15'

function saida(sobrescritas: Partial<Saida> = {}): Saida {
  return {
    id: ID_SAIDA,
    descricao: 'Aluguel',
    valor: 1500,
    data: '2026-08-10',
    categoriaId: CATEGORIAS.despesaFixa.id,
    tipo: 'OUTROS',
    status: 'PENDENTE',
    pagoEm: null,
    formaPagamento: 'PIX',
    recorrente: false,
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
    automatica: false,
    serieId: null,
    editadoManualmente: false,
    ...sobrescritas,
  }
}

function payload(sobrescritas: Partial<SaidaPayload> = {}): SaidaPayload {
  return {
    descricao: 'Aluguel',
    valor: 1500,
    data: '2026-08-10',
    categoriaId: CATEGORIAS.despesaFixa.id,
    tipo: 'OUTROS',
    status: 'PENDENTE',
    formaPagamento: 'PIX',
    recorrente: false,
    ...sobrescritas,
  }
}

function criarRepositorios(existentes: Saida[] = [], seguintes: Saida[] = []) {
  const saidas = criarSaidaRepositoryFake()
  saidas.listarSeguintesDaSerie.mockResolvedValue(seguintes)
  saidas.criar.mockImplementation(async (_userId: string, dados: SaidaPayload, controle = {}) =>
    saida({ ...dados, ...controle, id: 'nova' }),
  )
  saidas.buscarPorId.mockImplementation(async (_userId: string, id: string) => existentes.find((s) => s.id === id) ?? null)
  saidas.atualizar.mockImplementation(async (_userId: string, id: string, dados: SaidaPayload, controle = {}) =>
    saida({ ...existentes.find((s) => s.id === id), ...dados, ...controle }),
  )
  return { saidas, categorias: criarCategoriaRepositoryFake() }
}

/** Dados que chegaram ao repositório na primeira chamada de `atualizar`. */
const dadosAtualizados = (saidas: ReturnType<typeof criarSaidaRepositoryFake>) => saidas.atualizar.mock.calls[0]![2]

describe('AtualizarSaida', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('define pagoEm como hoje ao mudar de PENDENTE para PAGO', async () => {
    const { saidas, categorias } = criarRepositorios([saida({ status: 'PENDENTE' })])

    await new AtualizarSaida(saidas, categorias).execute(USER_ID, ID_SAIDA, payload({ status: 'PAGO' }))

    expect(dadosAtualizados(saidas).pagoEm).toBe(HOJE)
  })

  it('preserva o pagoEm original ao editar uma saída já paga que continua paga', async () => {
    const { saidas, categorias } = criarRepositorios([saida({ status: 'PAGO', pagoEm: '2026-08-12' })])

    await new AtualizarSaida(saidas, categorias).execute(USER_ID, ID_SAIDA, payload({ status: 'PAGO', valor: 1600 }))

    expect(dadosAtualizados(saidas).pagoEm).toBe('2026-08-12')
  })

  it('limpa pagoEm ao voltar de PAGO para PENDENTE', async () => {
    const { saidas, categorias } = criarRepositorios([saida({ status: 'PAGO', pagoEm: '2026-08-12' })])

    await new AtualizarSaida(saidas, categorias).execute(USER_ID, ID_SAIDA, payload({ status: 'PENDENTE' }))

    expect(dadosAtualizados(saidas).pagoEm).toBeNull()
  })

  it('define pagoEm como hoje para saída PAGA legada sem pagoEm', async () => {
    const { saidas, categorias } = criarRepositorios([saida({ status: 'PAGO', pagoEm: null })])

    await new AtualizarSaida(saidas, categorias).execute(USER_ID, ID_SAIDA, payload({ status: 'PAGO' }))

    expect(dadosAtualizados(saidas).pagoEm).toBe(HOJE)
  })

  it('atualiza só o registro informado, sem criar nada', async () => {
    const { saidas, categorias } = criarRepositorios([saida({ recorrente: true, serieId: SERIE })])

    await new AtualizarSaida(saidas, categorias).execute(USER_ID, ID_SAIDA, payload({ recorrente: true, valor: 1700 }))

    expect(saidas.atualizar).toHaveBeenCalledTimes(1)
    expect(saidas.atualizar.mock.calls[0]![1]).toBe(ID_SAIDA)
    expect(saidas.criar).not.toHaveBeenCalled()
  })

  it('marca como editado quando algo muda — inclusive marcar como PAGO', async () => {
    const { saidas, categorias } = criarRepositorios([saida()])

    await new AtualizarSaida(saidas, categorias).execute(USER_ID, ID_SAIDA, payload({ status: 'PAGO' }))

    expect(saidas.atualizar.mock.calls[0]![3]).toEqual({ editadoManualmente: true })
  })

  it('não marca como editado quando nada muda', async () => {
    const { saidas, categorias } = criarRepositorios([saida()])

    await new AtualizarSaida(saidas, categorias).execute(USER_ID, ID_SAIDA, payload())

    expect(saidas.atualizar.mock.calls[0]![3]).toEqual({ editadoManualmente: false })
  })

  it('mantém a descrição atual quando atual e payload são recorrentes', async () => {
    const { saidas, categorias } = criarRepositorios([saida({ recorrente: true, serieId: SERIE })])

    await new AtualizarSaida(saidas, categorias).execute(
      USER_ID,
      ID_SAIDA,
      payload({ recorrente: true, descricao: 'Aluguel novo' }),
    )

    expect(dadosAtualizados(saidas).descricao).toBe('Aluguel')
  })

  it('aplica a nova descrição quando a saída atual não é recorrente', async () => {
    const { saidas, categorias } = criarRepositorios([saida({ recorrente: false })])

    await new AtualizarSaida(saidas, categorias).execute(USER_ID, ID_SAIDA, payload({ descricao: 'Aluguel novo' }))

    expect(dadosAtualizados(saidas).descricao).toBe('Aluguel novo')
  })

  it('aplica a nova descrição quando a saída recorrente deixa de ser recorrente', async () => {
    const { saidas, categorias } = criarRepositorios([saida({ recorrente: true, serieId: SERIE })])

    await new AtualizarSaida(saidas, categorias).execute(
      USER_ID,
      ID_SAIDA,
      payload({ recorrente: false, descricao: 'Aluguel novo' }),
    )

    expect(dadosAtualizados(saidas)).toMatchObject({ descricao: 'Aluguel novo', recorrente: false })
  })

  it('trocar uma saída recorrente para categoria não fixa desliga a recorrência', async () => {
    const { saidas, categorias } = criarRepositorios([saida({ recorrente: true, serieId: SERIE })])

    await new AtualizarSaida(saidas, categorias).execute(
      USER_ID,
      ID_SAIDA,
      payload({ recorrente: true, categoriaId: CATEGORIAS.despesaVariavel.id }),
    )

    expect(dadosAtualizados(saidas)).toMatchObject({ recorrente: false, categoriaId: CATEGORIAS.despesaVariavel.id })
  })

  it('rejeita ligar a recorrência numa categoria não fixa com 422', async () => {
    const { saidas, categorias } = criarRepositorios([saida({ categoriaId: CATEGORIAS.investimento.id })])

    await expect(
      new AtualizarSaida(saidas, categorias).execute(
        USER_ID,
        ID_SAIDA,
        payload({ recorrente: true, categoriaId: CATEGORIAS.investimento.id }),
      ),
    ).rejects.toThrow(new ValidationError('Lançamento recorrente só é permitido na categoria Despesa Fixa.'))
    expect(saidas.atualizar).not.toHaveBeenCalled()
  })

  it('rejeita categoria inexistente ou de entrada com 422', async () => {
    const { saidas, categorias } = criarRepositorios([saida()])

    for (const categoriaId of ['cat-x', CATEGORIAS.rendaFixa.id]) {
      await expect(
        new AtualizarSaida(saidas, categorias).execute(USER_ID, ID_SAIDA, payload({ categoriaId })),
      ).rejects.toThrow(new ValidationError('Categoria inválida.'))
    }
    expect(saidas.atualizar).not.toHaveBeenCalled()
  })

  it('lança ConflictError para saída automática sem chamar atualizar', async () => {
    const { saidas, categorias } = criarRepositorios([saida({ automatica: true })])

    const promessa = new AtualizarSaida(saidas, categorias).execute(USER_ID, ID_SAIDA, payload())

    await expect(promessa).rejects.toBeInstanceOf(ConflictError)
    await expect(promessa).rejects.toMatchObject({ status: 409 })
    expect(saidas.atualizar).not.toHaveBeenCalled()
  })

  it('lança NotFoundError para id inexistente (inclusive o antigo id sintético de projeção)', async () => {
    const { saidas, categorias } = criarRepositorios([saida({ recorrente: true })])

    for (const id of ['223e4567-e89b-12d3-a456-426614174000', `${ID_SAIDA}_2026-09`]) {
      await expect(new AtualizarSaida(saidas, categorias).execute(USER_ID, id, payload())).rejects.toBeInstanceOf(
        NotFoundError,
      )
    }
    expect(saidas.atualizar).not.toHaveBeenCalled()
    expect(saidas.criar).not.toHaveBeenCalled()
  })

  it('repassa o userId a todas as chamadas dos repositórios', async () => {
    const { saidas, categorias } = criarRepositorios([saida()])

    await new AtualizarSaida(saidas, categorias).execute(USER_ID, ID_SAIDA, payload())

    expect(saidas.buscarPorId.mock.calls[0]![0]).toBe(USER_ID)
    expect(categorias.buscarPorId.mock.calls[0]![0]).toBe(USER_ID)
    expect(saidas.atualizar.mock.calls[0]![0]).toBe(USER_ID)
  })

  describe('desligar a recorrência', () => {
    const setembro = saida({ data: '2026-09-10', recorrente: true, serieId: SERIE })
    const outubro = saida({ id: 'out', data: '2026-10-10', recorrente: true, serieId: SERIE })
    const desligar = payload({ data: '2026-09-10' })

    it('mantém o registro, remove os meses seguintes e encerra a série', async () => {
      const { saidas, categorias } = criarRepositorios([setembro], [outubro])

      const atualizada = await new AtualizarSaida(saidas, categorias).execute(USER_ID, ID_SAIDA, desligar)

      expect(saidas.listarSeguintesDaSerie).toHaveBeenCalledWith(USER_ID, SERIE, '2026-09-10')
      expect(saidas.removerVarios).toHaveBeenCalledWith(USER_ID, ['out'])
      expect(saidas.marcarSerieEncerrada).toHaveBeenCalledWith(USER_ID, SERIE, true)
      expect(atualizada).toMatchObject({ id: ID_SAIDA, recorrente: false })
    })

    it('trocar para Despesa Variável conta como desativação', async () => {
      const { saidas, categorias } = criarRepositorios([setembro], [outubro])

      await new AtualizarSaida(saidas, categorias).execute(
        USER_ID,
        ID_SAIDA,
        payload({ data: '2026-09-10', recorrente: true, categoriaId: CATEGORIAS.despesaVariavel.id }),
      )

      expect(saidas.removerVarios).toHaveBeenCalledWith(USER_ID, ['out'])
      expect(saidas.marcarSerieEncerrada).toHaveBeenCalledWith(USER_ID, SERIE, true)
    })

    it('com mês seguinte alterado, exige confirmação antes de gravar qualquer coisa', async () => {
      const { saidas, categorias } = criarRepositorios([setembro], [{ ...outubro, editadoManualmente: true }])

      const execucao = new AtualizarSaida(saidas, categorias).execute(USER_ID, ID_SAIDA, desligar)

      await expect(execucao).rejects.toBeInstanceOf(SerieAlteradaError)
      await expect(execucao).rejects.toMatchObject({ detalhes: { mesesAfetados: ['2026-10'] } })
      expect(saidas.removerVarios).not.toHaveBeenCalled()
      expect(saidas.atualizar).not.toHaveBeenCalled()
    })

    it('com confirmação, remove os meses alterados e atualiza', async () => {
      const { saidas, categorias } = criarRepositorios([setembro], [{ ...outubro, editadoManualmente: true }])

      await new AtualizarSaida(saidas, categorias).execute(USER_ID, ID_SAIDA, desligar, { confirmar: true })

      expect(saidas.removerVarios).toHaveBeenCalledWith(USER_ID, ['out'])
      expect(saidas.atualizar).toHaveBeenCalled()
    })

    it('sem meses seguintes, só encerra a série', async () => {
      const { saidas, categorias } = criarRepositorios([setembro], [])

      await new AtualizarSaida(saidas, categorias).execute(USER_ID, ID_SAIDA, desligar)

      expect(saidas.removerVarios).not.toHaveBeenCalled()
      expect(saidas.marcarSerieEncerrada).toHaveBeenCalledWith(USER_ID, SERIE, true)
    })
  })

  describe('religar a recorrência', () => {
    it('reabre a série e volta a criar o mês seguinte, pendente', async () => {
      const desligada = saida({ data: '2026-09-10', recorrente: false, serieId: SERIE, status: 'PAGO', pagoEm: '2026-09-10' })
      const { saidas, categorias } = criarRepositorios([desligada], [])

      await new AtualizarSaida(saidas, categorias).execute(
        USER_ID,
        ID_SAIDA,
        payload({ data: '2026-09-10', recorrente: true, status: 'PAGO' }),
      )

      expect(saidas.atualizar.mock.calls[0]![3]).toMatchObject({ serieId: SERIE })
      expect(saidas.marcarSerieEncerrada).toHaveBeenCalledWith(USER_ID, SERIE, false)
      expect(saidas.criar).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ data: '2026-10-10', status: 'PENDENTE', pagoEm: null, recorrente: true }),
        { serieId: SERIE },
      )
    })

    it('saída que nunca foi de série ganha uma série nova; não duplica mês seguinte existente', async () => {
      const { saidas, categorias } = criarRepositorios([saida()], [])

      await new AtualizarSaida(saidas, categorias).execute(USER_ID, ID_SAIDA, payload({ recorrente: true }))

      expect(saidas.atualizar.mock.calls[0]![3]!.serieId).toMatch(/^[0-9a-f-]{36}$/)
      expect(saidas.criar).toHaveBeenCalledTimes(1)

      const comSeguinte = criarRepositorios([saida({ serieId: SERIE })], [saida({ id: 'out', data: '2026-09-10' })])
      await new AtualizarSaida(comSeguinte.saidas, comSeguinte.categorias).execute(
        USER_ID,
        ID_SAIDA,
        payload({ recorrente: true }),
      )
      expect(comSeguinte.saidas.criar).not.toHaveBeenCalled()
    })
  })
})
