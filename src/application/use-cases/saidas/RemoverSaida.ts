import { ConflictError, NotFoundError, SerieAlteradaError } from '../../../domain/errors/DomainError'
import type { OpcoesDeEncerramento } from '../../../domain/entities/Recorrencia'
import type { SaidaRepository } from '../../../domain/repositories/SaidaRepository'
import type { ID } from '../../../shared/types/common'
import { mesesAlterados } from '../../../shared/utils/recorrencia'

/**
 * Excluir um mês de uma série remove ele e os meses seguintes (os anteriores ficam
 * intactos) e encerra a série. Se algum mês seguinte foi alterado pelo usuário
 * (inclusive marcado como PAGO), nada é removido sem `confirmar`.
 */
export class RemoverSaida {
  constructor(private readonly saidaRepository: SaidaRepository) {}

  async execute(userId: ID, id: ID, opcoes: OpcoesDeEncerramento = {}): Promise<void> {
    const atual = await this.saidaRepository.buscarPorId(userId, id)
    if (!atual) throw new NotFoundError('Saída')
    if (atual.automatica) {
      throw new ConflictError(
        'Esta saída foi gerada automaticamente pela fatura do cartão e não pode ser removida diretamente.',
      )
    }
    if (!atual.serieId) return this.saidaRepository.remover(userId, id)

    const seguintes = await this.saidaRepository.listarSeguintesDaSerie(userId, atual.serieId, atual.data)
    const alterados = mesesAlterados(seguintes)
    if (alterados.length > 0 && !opcoes.confirmar) throw new SerieAlteradaError(alterados)

    await this.saidaRepository.removerVarios(userId, [id, ...seguintes.map((saida) => saida.id)])
    await this.saidaRepository.marcarSerieEncerrada(userId, atual.serieId, true)
  }
}
