import { NotFoundError, SerieAlteradaError } from '../../../domain/errors/DomainError'
import type { OpcoesDeEncerramento } from '../../../domain/entities/Recorrencia'
import type { FaturaRepository } from '../../../domain/repositories/FaturaRepository'
import type { ID } from '../../../shared/types/common'
import { mesesAlterados } from '../../../shared/utils/recorrencia'

/**
 * Excluir um débito de uma série remove ele e os dos meses seguintes (os anteriores
 * ficam intactos) e encerra a série. Se algum mês seguinte foi alterado pelo
 * usuário, nada é removido sem `confirmar`.
 */
export class RemoverTransacaoCartao {
  constructor(private readonly faturaRepository: FaturaRepository) {}

  async execute(userId: ID, id: ID, opcoes: OpcoesDeEncerramento = {}): Promise<void> {
    const atual = await this.faturaRepository.buscarTransacaoPorId(userId, id)
    if (!atual) throw new NotFoundError('Transação do cartão')
    if (!atual.serieId) return this.faturaRepository.removerTransacao(userId, id)

    const seguintes = await this.faturaRepository.listarTransacoesSeguintesDaSerie(userId, atual.serieId, atual.data)
    const alterados = mesesAlterados(seguintes)
    if (alterados.length > 0 && !opcoes.confirmar) throw new SerieAlteradaError(alterados)

    await this.faturaRepository.removerTransacoes(userId, [id, ...seguintes.map((transacao) => transacao.id)])
    await this.faturaRepository.marcarSerieDeTransacoesEncerrada(userId, atual.serieId, true)
  }
}
