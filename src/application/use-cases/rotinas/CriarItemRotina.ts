import type { ItemRotina, ItemRotinaPayload } from '../../../domain/entities/ItemRotina'
import { NotFoundError } from '../../../domain/errors/DomainError'
import type { AreaRepository } from '../../../domain/repositories/AreaRepository'
import type { ItemRotinaRepository } from '../../../domain/repositories/ItemRotinaRepository'
import type { ID } from '../../../shared/types/common'

export class CriarItemRotina {
  constructor(
    private readonly itemRotinaRepository: ItemRotinaRepository,
    private readonly areaRepository: AreaRepository,
  ) {}

  async execute(userId: ID, payload: ItemRotinaPayload): Promise<ItemRotina> {
    // O item sempre vai para a área Rotina do usuário; o cliente não escolhe a área.
    const rotina = (await this.areaRepository.listar(userId)).find((area) => area.sistema)
    if (!rotina) throw new NotFoundError('Área Rotina')

    return this.itemRotinaRepository.criar(userId, rotina.id, payload)
  }
}
