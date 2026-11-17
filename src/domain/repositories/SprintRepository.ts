import type { ID } from '../../shared/types/common'
import type { PlacarDoSprint } from '../entities/PlacarDoSprint'
import type { Sprint } from '../entities/Sprint'

export interface SprintRepository {
  /** Devolve o sprint da semana, criando-o se não existir (único por usuário e `inicio`, mesmo com acessos concorrentes). */
  garantir(userId: ID, inicio: string, fim: string): Promise<Sprint>
  marcarRotinaGerada(userId: ID, id: ID, quando: string): Promise<void>
  /** Sprints do usuário com fim até `ateFim` cujo fechamento ainda não foi aplicado por inteiro. */
  listarPendentesDeFechamento(userId: ID, ateFim: string): Promise<Sprint[]>
  /** Grava a foto e fecha, só se ainda estiver ABERTO (a foto nunca é regravada). `true` = esta chamada fechou. */
  fechar(userId: ID, id: ID, foto: PlacarDoSprint, fechadoEm: string): Promise<boolean>
  marcarFechamentoAplicado(userId: ID, id: ID, quando: string): Promise<void>
}
