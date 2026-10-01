import { describe, expect, it } from 'vitest'

import { RemoverTransacaoCartao } from '../../../../src/application/use-cases/cartoes/RemoverTransacaoCartao'
import type { TransacaoCartao } from '../../../../src/domain/entities/Fatura'
import { NotFoundError, SerieAlteradaError } from '../../../../src/domain/errors/DomainError'
import { criarFaturaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const ID = 'transacao-1'
const SERIE = 'serie-1'

function transacao(sobrescritas: Partial<TransacaoCartao> = {}): TransacaoCartao {
  return {
    id: ID,
    cartaoId: 'cartao-1',
    faturaId: 'fatura-set',
    descricao: 'Streaming',
    valor: 40,
    data: '2026-09-03',
    categoriaId: 'cat-fixa',
    tipo: 'LAZER',
    parcelaAtual: 1,
    totalParcelas: 1,
    recorrente: false,
    criadoEm: '2026-09-03T12:00:00.000Z',
    atualizadoEm: '2026-09-03T12:00:00.000Z',
    serieId: null,
    editadoManualmente: false,
    ...sobrescritas,
  }
}

function criarRepositorio(existente: TransacaoCartao | null, seguintes: TransacaoCartao[] = []) {
  const repositorio = criarFaturaRepositoryFake()
  repositorio.buscarTransacaoPorId.mockResolvedValue(existente)
  repositorio.listarTransacoesSeguintesDaSerie.mockResolvedValue(seguintes)
  repositorio.removerTransacao.mockResolvedValue(undefined)
  return repositorio
}

describe('RemoverTransacaoCartao', () => {
  it('transação avulsa: remove só ela e resolve undefined', async () => {
    const repositorio = criarRepositorio(transacao())

    await expect(new RemoverTransacaoCartao(repositorio).execute(USER_ID, ID)).resolves.toBeUndefined()

    expect(repositorio.removerTransacao).toHaveBeenCalledWith(USER_ID, ID)
    expect(repositorio.removerTransacoes).not.toHaveBeenCalled()
  })

  it('lança NotFoundError quando a transação não existe para o usuário', async () => {
    const repositorio = criarRepositorio(null)

    const promessa = new RemoverTransacaoCartao(repositorio).execute(USER_ID, ID)

    await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
    await expect(promessa).rejects.toMatchObject({ message: 'Transação do cartão não encontrado.' })
    expect(repositorio.removerTransacao).not.toHaveBeenCalled()
  })

  it('mês de uma série: remove ele e os seguintes e encerra a série', async () => {
    const outubro = transacao({ id: 'out', faturaId: 'fatura-out', data: '2026-10-03', recorrente: true, serieId: SERIE })
    const repositorio = criarRepositorio(transacao({ recorrente: true, serieId: SERIE }), [outubro])

    await new RemoverTransacaoCartao(repositorio).execute(USER_ID, ID)

    expect(repositorio.listarTransacoesSeguintesDaSerie).toHaveBeenCalledWith(USER_ID, SERIE, '2026-09-03')
    expect(repositorio.removerTransacoes).toHaveBeenCalledWith(USER_ID, [ID, 'out'])
    expect(repositorio.marcarSerieDeTransacoesEncerrada).toHaveBeenCalledWith(USER_ID, SERIE, true)
  })

  it('com mês seguinte alterado, exige confirmação; com ela, remove', async () => {
    const outubro = transacao({ id: 'out', data: '2026-10-03', serieId: SERIE, editadoManualmente: true })
    const repositorio = criarRepositorio(transacao({ recorrente: true, serieId: SERIE }), [outubro])

    await expect(new RemoverTransacaoCartao(repositorio).execute(USER_ID, ID)).rejects.toBeInstanceOf(SerieAlteradaError)
    expect(repositorio.removerTransacoes).not.toHaveBeenCalled()

    await new RemoverTransacaoCartao(repositorio).execute(USER_ID, ID, { confirmar: true })
    expect(repositorio.removerTransacoes).toHaveBeenCalledWith(USER_ID, [ID, 'out'])
  })
})
