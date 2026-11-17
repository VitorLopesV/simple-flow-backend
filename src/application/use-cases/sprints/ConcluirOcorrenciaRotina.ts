import type { OcorrenciaRotina } from '../../../domain/entities/OcorrenciaRotina'
import { ConflictError, NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { OcorrenciaRotinaRepository } from '../../../domain/repositories/OcorrenciaRotinaRepository'
import { MENSAGEM_SPRINT_FECHADO, sprintVencido } from '../../../domain/services/fechamentoDoSprint'
import { fimDoSprint, inicioDoSprintDoDia } from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'
import { dataAtual } from '../../../shared/utils/periodo'

export class ConcluirOcorrenciaRotina {
  constructor(private readonly ocorrenciaRepository: OcorrenciaRotinaRepository) {}

  /**
   * Uma ocorrência só é concluída no próprio dia (São Paulo), nem antes nem depois. A hora da rotina
   * só ordena a lista: não existe atraso na rotina. Idempotente: concluir de novo não muda o instante.
   */
  async execute(userId: ID, id: ID, agora: Date = new Date()): Promise<OcorrenciaRotina> {
    const ocorrencia = await this.ocorrenciaRepository.buscarPorId(userId, id)
    if (!ocorrencia) throw new NotFoundError('Ocorrência')
    if (ocorrencia.concluidaEm) return ocorrencia

    // Fechado (sexta 23:59 SP): a foto já foi, ou vai ser, tirada sem esta ocorrência. Lembrete de fim de semana não pontua.
    if (!ocorrencia.lembrete && sprintVencido(fimDoSprint(inicioDoSprintDoDia(ocorrencia.data)), agora)) {
      throw new ConflictError(MENSAGEM_SPRINT_FECHADO)
    }

    const hoje = dataAtual(agora)
    if (ocorrencia.data > hoje) throw new ValidationError('Esta rotina é de outro dia: só pode ser concluída no próprio dia.')
    if (ocorrencia.data < hoje) throw new ValidationError('O dia desta rotina já passou: ela só podia ser concluída no próprio dia.')

    return this.ocorrenciaRepository.concluir(userId, id, agora.toISOString())
  }
}
