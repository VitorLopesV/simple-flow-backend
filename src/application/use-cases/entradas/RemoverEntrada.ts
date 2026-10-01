import { NotFoundError, SerieAlteradaError } from '../../../domain/errors/DomainError'
import type { OpcoesDeEncerramento } from '../../../domain/entities/Recorrencia'
import type { EntradaRepository } from '../../../domain/repositories/EntradaRepository'
import type { ID } from '../../../shared/types/common'
import { mesesAlterados } from '../../../shared/utils/recorrencia'

/**
 * Excluir um mês de uma série remove ele e os meses seguintes (os anteriores ficam
 * intactos) e encerra a série. Se algum mês seguinte foi alterado pelo usuário, nada
 * é removido sem `confirmar`.
 */
export class RemoverEntrada {
  constructor(private readonly entradaRepository: EntradaRepository) {}

  async execute(userId: ID, id: ID, opcoes: OpcoesDeEncerramento = {}): Promise<void> {
    const atual = await this.entradaRepository.buscarPorId(userId, id)
    if (!atual) throw new NotFoundError('Entrada')
    if (!atual.serieId) return this.entradaRepository.remover(userId, id)

    const seguintes = await this.entradaRepository.listarSeguintesDaSerie(userId, atual.serieId, atual.data)
    const alterados = mesesAlterados(seguintes)
    if (alterados.length > 0 && !opcoes.confirmar) throw new SerieAlteradaError(alterados)

    await this.entradaRepository.removerVarios(userId, [id, ...seguintes.map((entrada) => entrada.id)])
    await this.entradaRepository.marcarSerieEncerrada(userId, atual.serieId, true)
  }
}
