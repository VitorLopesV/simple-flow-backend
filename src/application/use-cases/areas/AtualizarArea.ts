import type { Area, AreaPayload } from '../../../domain/entities/Area'
import { ConflictError, NotFoundError } from '../../../domain/errors/DomainError'
import type { AreaRepository } from '../../../domain/repositories/AreaRepository'
import type { ID } from '../../../shared/types/common'

export class AtualizarArea {
  constructor(private readonly areaRepository: AreaRepository) {}

  async execute(userId: ID, id: ID, payload: AreaPayload): Promise<Area> {
    const area = await this.areaRepository.buscarPorId(userId, id)
    if (!area) throw new NotFoundError('Área')

    // A Rotina não troca de nome nem de cor: o frontend a identifica como a área do sistema.
    if (area.sistema) throw new ConflictError('A área Rotina não pode ser renomeada.')

    const mesmoNome = await this.areaRepository.buscarPorNome(userId, payload.nome)
    if (mesmoNome && mesmoNome.id !== id) throw new ConflictError('Já existe uma área com esse nome.')

    return this.areaRepository.atualizar(userId, id, payload)
  }
}
