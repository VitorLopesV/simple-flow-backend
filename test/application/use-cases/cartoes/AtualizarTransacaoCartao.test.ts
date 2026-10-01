import { describe, expect, it } from 'vitest'

import { AtualizarTransacaoCartao } from '../../../../src/application/use-cases/cartoes/AtualizarTransacaoCartao'
import type { Cartao } from '../../../../src/domain/entities/Cartao'
import type { TransacaoCartao, TransacaoCartaoPayload } from '../../../../src/domain/entities/Fatura'
import { NotFoundError, ValidationError } from '../../../../src/domain/errors/DomainError'
import {
  CATEGORIAS,
  criarCartaoRepositoryFake,
  criarCategoriaRepositoryFake,
  criarFaturaRepositoryFake,
} from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const CARTAO_ID = 'cartao-1'
const TRANSACAO_ID = 'transacao-1'

const cartao: Cartao = {
  id: CARTAO_ID,
  nome: 'Nubank',
  bandeira: 'MASTERCARD',
  ultimosDigitos: '1234',
  limite: 5000,
  diaFechamento: 10,
  diaVencimento: 20,
  cor: '#820ad1',
  ativo: true,
  criadoEm: '2026-01-01T00:00:00.000Z',
}

function payload(sobrescritas: Partial<TransacaoCartaoPayload> = {}): TransacaoCartaoPayload {
  return {
    descricao: 'Mercado',
    valor: 200,
    data: '2026-09-15',
    categoriaId: CATEGORIAS.despesaVariavel.id,
    tipo: 'ALIMENTACAO',
    parcelaAtual: 1,
    totalParcelas: 1,
    recorrente: false,
    ...sobrescritas,
  }
}

function transacao(sobrescritas: Partial<TransacaoCartao> = {}): TransacaoCartao {
  return {
    ...payload(),
    id: TRANSACAO_ID,
    cartaoId: CARTAO_ID,
    faturaId: 'fatura-1',
    criadoEm: '2026-09-15T12:00:00.000Z',
    atualizadoEm: '2026-09-15T12:00:00.000Z',
    serieId: null,
    editadoManualmente: false,
    ...sobrescritas,
  }
}

const transacaoAtualizada = transacao({ atualizadoEm: '2026-09-16T12:00:00.000Z' })

function criarRepositorios(transacaoExistente: TransacaoCartao | null, cartaoExistente: Cartao | null) {
  const cartaoRepository = criarCartaoRepositoryFake()
  cartaoRepository.buscarPorId.mockResolvedValue(cartaoExistente)
  const faturaRepository = criarFaturaRepositoryFake()
  faturaRepository.buscarTransacaoPorId.mockResolvedValue(transacaoExistente)
  faturaRepository.atualizarTransacao.mockResolvedValue(transacaoAtualizada)
  return { cartaoRepository, faturaRepository, categoriaRepository: criarCategoriaRepositoryFake() }
}

function useCase(repositorios: ReturnType<typeof criarRepositorios>) {
  return new AtualizarTransacaoCartao(
    repositorios.cartaoRepository,
    repositorios.faturaRepository,
    repositorios.categoriaRepository,
  )
}

describe('AtualizarTransacaoCartao', () => {
  it('lança NotFoundError para transação inexistente sem consultar o CartaoRepository', async () => {
    const repositorios = criarRepositorios(null, cartao)

    const promessa = useCase(repositorios).execute(USER_ID, TRANSACAO_ID, payload())

    await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
    await expect(promessa).rejects.toMatchObject({ status: 404 })
    expect(repositorios.cartaoRepository.buscarPorId).not.toHaveBeenCalled()
  })

  it('lança NotFoundError quando o cartão da transação não existe sem chamar atualizarTransacao', async () => {
    const repositorios = criarRepositorios(transacao(), null)

    await expect(useCase(repositorios).execute(USER_ID, TRANSACAO_ID, payload())).rejects.toBeInstanceOf(NotFoundError)
    expect(repositorios.faturaRepository.atualizarTransacao).not.toHaveBeenCalled()
  })

  it('busca o cartão pelo cartaoId da transação atual e não pelo id da rota', async () => {
    const repositorios = criarRepositorios(transacao(), cartao)

    await useCase(repositorios).execute(USER_ID, TRANSACAO_ID, payload())

    expect(repositorios.cartaoRepository.buscarPorId).toHaveBeenCalledWith(USER_ID, CARTAO_ID)
  })

  it('atualiza com competência e datas corretas e marca como editada', async () => {
    const repositorios = criarRepositorios(transacao(), cartao)
    const dados = payload({ data: '2026-09-18', valor: 250 })

    await useCase(repositorios).execute(USER_ID, TRANSACAO_ID, dados)

    expect(repositorios.faturaRepository.atualizarTransacao).toHaveBeenCalledWith(
      USER_ID,
      TRANSACAO_ID,
      dados,
      { competencia: '2026-09', fechamento: '2026-09-10', vencimento: '2026-09-20' },
      { editadoManualmente: true },
    )
  })

  it('não marca como editada quando nada muda', async () => {
    const repositorios = criarRepositorios(transacao(), cartao)

    await useCase(repositorios).execute(USER_ID, TRANSACAO_ID, payload())

    expect(repositorios.faturaRepository.atualizarTransacao.mock.calls[0]![4]).toEqual({ editadoManualmente: false })
  })

  it('recalcula competência e datas quando a data é movida para outro mês', async () => {
    const repositorios = criarRepositorios(transacao(), cartao)

    await useCase(repositorios).execute(USER_ID, TRANSACAO_ID, payload({ data: '2026-11-03' }))

    expect(repositorios.faturaRepository.atualizarTransacao.mock.calls[0]![3]).toEqual({
      competencia: '2026-11',
      fechamento: '2026-11-10',
      vencimento: '2026-11-20',
    })
  })

  it('preserva a descrição enquanto a transação continua recorrente e libera ao desligar', async () => {
    const recorrente = transacao({ recorrente: true, categoriaId: CATEGORIAS.despesaFixa.id, serieId: 'serie-1' })
    const repositorios = criarRepositorios(recorrente, cartao)
    const base = { categoriaId: CATEGORIAS.despesaFixa.id, descricao: 'Streaming novo' }

    await useCase(repositorios).execute(USER_ID, TRANSACAO_ID, payload({ ...base, recorrente: true }))
    await useCase(repositorios).execute(USER_ID, TRANSACAO_ID, payload({ ...base, recorrente: false }))

    const [primeira, segunda] = repositorios.faturaRepository.atualizarTransacao.mock.calls
    expect(primeira![2]).toMatchObject({ descricao: 'Mercado', recorrente: true })
    expect(segunda![2]).toMatchObject({ descricao: 'Streaming novo', recorrente: false })
  })

  it('trocar uma transação recorrente para categoria não fixa desliga a recorrência', async () => {
    const recorrente = transacao({ recorrente: true, categoriaId: CATEGORIAS.despesaFixa.id, serieId: 'serie-1' })
    const repositorios = criarRepositorios(recorrente, cartao)

    await useCase(repositorios).execute(USER_ID, TRANSACAO_ID, payload({ recorrente: true }))

    expect(repositorios.faturaRepository.atualizarTransacao.mock.calls[0]![2]).toMatchObject({ recorrente: false })
  })

  it('rejeita ligar a recorrência em categoria não fixa e categoria inválida com 422', async () => {
    const repositorios = criarRepositorios(transacao(), cartao)

    await expect(useCase(repositorios).execute(USER_ID, TRANSACAO_ID, payload({ recorrente: true }))).rejects.toThrow(
      new ValidationError('Lançamento recorrente só é permitido na categoria Despesa Fixa.'),
    )
    await expect(
      useCase(repositorios).execute(USER_ID, TRANSACAO_ID, payload({ categoriaId: CATEGORIAS.rendaFixa.id })),
    ).rejects.toThrow(new ValidationError('Categoria inválida.'))
    expect(repositorios.faturaRepository.atualizarTransacao).not.toHaveBeenCalled()
  })

  it('devolve a transação retornada pelo repositório', async () => {
    const repositorios = criarRepositorios(transacao(), cartao)

    await expect(useCase(repositorios).execute(USER_ID, TRANSACAO_ID, payload())).resolves.toBe(transacaoAtualizada)
  })
})
