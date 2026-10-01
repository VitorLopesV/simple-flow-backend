import { randomUUID } from 'node:crypto'

import { NotFoundError, SerieAlteradaError, ValidationError } from '../../../domain/errors/DomainError'
import type { TransacaoCartao, TransacaoCartaoPayload } from '../../../domain/entities/Fatura'
import type { OpcoesDeEncerramento } from '../../../domain/entities/Recorrencia'
import type { CartaoRepository } from '../../../domain/repositories/CartaoRepository'
import type { CategoriaRepository } from '../../../domain/repositories/CategoriaRepository'
import type { FaturaRepository } from '../../../domain/repositories/FaturaRepository'
import type { ID } from '../../../shared/types/common'
import {
  categoriaPermiteRecorrencia,
  houveAlteracao,
  mesesAlterados,
  mesmoDiaNoMesSeguinte,
} from '../../../shared/utils/recorrencia'
import { MENSAGEM_RECORRENCIA_SAIDA } from '../saidas/CriarSaida'
import { datasDaFatura } from './CriarTransacaoCartao'

/**
 * Editar a data pode mover o débito para a fatura de outra competência. Só o débito
 * informado muda — os outros meses da série não —, exceto ao desligar a recorrência
 * (remove os meses seguintes, com confirmação se algum foi alterado) ou religá-la
 * (volta a lançar o mês seguinte).
 */
export class AtualizarTransacaoCartao {
  constructor(
    private readonly cartaoRepository: CartaoRepository,
    private readonly faturaRepository: FaturaRepository,
    private readonly categoriaRepository: CategoriaRepository,
  ) {}

  async execute(
    userId: ID,
    id: ID,
    payload: TransacaoCartaoPayload,
    opcoes: OpcoesDeEncerramento = {},
  ): Promise<TransacaoCartao> {
    const atual = await this.faturaRepository.buscarTransacaoPorId(userId, id)
    if (!atual) throw new NotFoundError('Transação do cartão')

    const cartao = await this.cartaoRepository.buscarPorId(userId, atual.cartaoId)
    if (!cartao) throw new NotFoundError('Cartão')

    const categoria = await this.categoriaRepository.buscarPorId(userId, payload.categoriaId)
    if (categoria?.movimento !== 'SAIDA') throw new ValidationError('Categoria inválida.')

    const permiteRecorrencia = categoriaPermiteRecorrencia(categoria)
    if (payload.recorrente && !permiteRecorrencia && !atual.recorrente) {
      throw new ValidationError(MENSAGEM_RECORRENCIA_SAIDA)
    }

    // Trocar um débito recorrente para uma categoria não fixa desliga a recorrência.
    const recorrente = payload.recorrente && permiteRecorrencia
    // Nome de um débito recorrente é fixo — só muda quando ele deixa de ser recorrente.
    const descricao = atual.recorrente && recorrente ? atual.descricao : payload.descricao
    const dados = { ...payload, recorrente, descricao }
    const editadoManualmente = atual.editadoManualmente || houveAlteracao(atual, dados)
    const datas = datasDaFatura(cartao, dados.data)

    if (atual.recorrente && !recorrente && atual.serieId) {
      const seguintes = await this.faturaRepository.listarTransacoesSeguintesDaSerie(userId, atual.serieId, atual.data)
      const alterados = mesesAlterados(seguintes)
      if (alterados.length > 0 && !opcoes.confirmar) throw new SerieAlteradaError(alterados)

      if (seguintes.length > 0) {
        await this.faturaRepository.removerTransacoes(
          userId,
          seguintes.map((transacao) => transacao.id),
        )
      }
      await this.faturaRepository.marcarSerieDeTransacoesEncerrada(userId, atual.serieId, true)
      return this.faturaRepository.atualizarTransacao(userId, id, dados, datas, { editadoManualmente })
    }

    if (!atual.recorrente && recorrente) {
      const serieId = atual.serieId ?? randomUUID()
      const transacao = await this.faturaRepository.atualizarTransacao(userId, id, dados, datas, {
        serieId,
        editadoManualmente,
      })
      await this.faturaRepository.marcarSerieDeTransacoesEncerrada(userId, serieId, false)

      const seguintes = await this.faturaRepository.listarTransacoesSeguintesDaSerie(userId, serieId, transacao.data)
      if (seguintes.length === 0) {
        const dataSeguinte = mesmoDiaNoMesSeguinte(transacao.data)
        await this.faturaRepository.criarTransacao(
          userId,
          atual.cartaoId,
          { ...dados, data: dataSeguinte },
          datasDaFatura(cartao, dataSeguinte),
          { serieId },
        )
      }
      return transacao
    }

    return this.faturaRepository.atualizarTransacao(userId, id, dados, datas, { editadoManualmente })
  }
}
