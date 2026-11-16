import type { SupabaseClient } from '@supabase/supabase-js'

import type { TarefaDoSprint } from '../../../domain/entities/PlacarDoSprint'
import type { TarefasDoSprintRepository } from '../../../domain/repositories/TarefasDoSprintRepository'
import type { ID } from '../../../shared/types/common'

/**
 * Ainda não há vínculo tarefa↔sprint (entrada/saída do sprint é a #69) nem conclusão
 * (#70, `concluida_em`): por ora nenhuma tarefa está no sprint e o placar só tem rotina.
 * Quando #69/#70 chegarem, é aqui que a leitura real entra (com `atrasada` calculada e
 * `superTask` da #65); o placar e a rota não mudam.
 */
export class SupabaseTarefasDoSprintRepository implements TarefasDoSprintRepository {
  constructor(readonly client: SupabaseClient) {}

  async listar(_userId: ID, _sprintId: ID, _inicio: string, _fim: string): Promise<TarefaDoSprint[]> {
    return []
  }
}
