import type { ID } from '../../shared/types/common'
import type { FotoDoSprint } from '../entities/PlacarDoSprint'
import type { Sprint } from '../entities/Sprint'

export interface SprintRepository {
  /** Devolve o sprint da semana, criando-o se não existir (único por usuário e `inicio`, mesmo com acessos concorrentes). */
  garantir(userId: ID, inicio: string, fim: string): Promise<Sprint>
  marcarRotinaGerada(userId: ID, id: ID, quando: string): Promise<void>
  /** Sprints do usuário com fim até `ateFim` cujo fechamento ainda não foi aplicado por inteiro. */
  listarPendentesDeFechamento(userId: ID, ateFim: string): Promise<Sprint[]>
  /** Grava a foto e fecha, só se ainda estiver ABERTO (a foto nunca é regravada). `true` = esta chamada fechou. */
  fechar(userId: ID, id: ID, foto: FotoDoSprint, fechadoEm: string): Promise<boolean>
  marcarFechamentoAplicado(userId: ID, id: ID, quando: string): Promise<void>
  /** Grava (ou limpa, com `null`) a recompensa do sprint, só se ainda estiver ABERTO. `false` = já estava fechado, nada mudou. */
  definirRecompensa(userId: ID, id: ID, recompensa: string | null): Promise<boolean>
  /** Sprints FECHADOS com foto, do mais recente ao mais antigo; `total` é a contagem sem paginação. */
  listarFechados(userId: ID, page: number, pageSize: number): Promise<{ sprints: Sprint[]; total: number }>
}
