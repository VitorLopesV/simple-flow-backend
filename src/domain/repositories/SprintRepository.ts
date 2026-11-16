import type { ID } from '../../shared/types/common'
import type { Sprint } from '../entities/Sprint'

export interface SprintRepository {
  /** Devolve o sprint da semana, criando-o se não existir (único por usuário e `inicio`, mesmo com acessos concorrentes). */
  garantir(userId: ID, inicio: string, fim: string): Promise<Sprint>
  marcarRotinaGerada(userId: ID, id: ID, quando: string): Promise<void>
}
