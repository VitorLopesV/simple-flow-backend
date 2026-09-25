import { NotFoundError } from '../../../domain/errors/DomainError'
import type { Entrada, EntradaPayload } from '../../../domain/entities/Entrada'
import type { EntradaRepository } from '../../../domain/repositories/EntradaRepository'
import { origemDoIdProjetado } from '../../../shared/utils/recorrencia'
import type { ID } from '../../../shared/types/common'

export class AtualizarEntrada {
  constructor(private readonly entradaRepository: EntradaRepository) {}

  async execute(userId: ID, id: ID, payload: EntradaPayload): Promise<Entrada> {
    const atual = await this.entradaRepository.buscarPorId(userId, id)
    if (atual) {
      // Nome de uma entrada recorrente é fixo entre suas ocorrências (ver abaixo) —
      // só aceita mudança de descrição quando a entrada deixa de ser recorrente.
      const descricao = atual.recorrente && payload.recorrente ? atual.descricao : payload.descricao
      return this.entradaRepository.atualizar(userId, id, { ...payload, descricao })
    }

    // Ocorrência projetada de uma recorrência (id sintético, nunca persistido — ver
    // `projetarRecorrencias`): editá-la materializa uma linha própria para este mês,
    // independente das demais, em vez de mudar o lançamento original.
    const projetado = origemDoIdProjetado(id)
    const origem = projetado && (await this.entradaRepository.buscarPorId(userId, projetado.origemId))
    if (!origem?.recorrente) throw new NotFoundError('Entrada')

    // Nome vem sempre do lançamento original, nunca do payload: as ocorrências de
    // uma série só continuam sendo reconhecidas como a mesma série enquanto
    // `chaveDaSerie` (descrição + categoria) casar entre elas.
    return this.entradaRepository.criar(userId, { ...payload, descricao: origem.descricao })
  }
}
