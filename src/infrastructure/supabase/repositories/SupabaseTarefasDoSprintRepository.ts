import type { SupabaseClient } from '@supabase/supabase-js'

import type { TarefaDoSprint } from '../../../domain/entities/PlacarDoSprint'
import type { Dificuldade, Prioridade, TempoEstimado } from '../../../domain/entities/Tarefa'
import type { TarefasDoSprintRepository } from '../../../domain/repositories/TarefasDoSprintRepository'
import type { ID } from '../../../shared/types/common'
import type { Database } from '../database.types'

/**
 * Tarefas vinculadas ao sprint (`sprint_id`, #69). Conclusão e atraso são da #70 (sem coluna
 * ainda: toda tarefa vale como não concluída) e super task é da #65: por isso `concluida`,
 * `atrasada` e `superTask` saem fixos em `false`. Quando essas issues chegarem, só o mapeamento muda.
 */
export class SupabaseTarefasDoSprintRepository implements TarefasDoSprintRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listar(userId: ID, sprintId: ID, inicio: string, fim: string): Promise<TarefaDoSprint[]> {
    const { data, error } = await this.client
      .from('tarefas')
      .select('id, dia, tempo_estimado_minutos, dificuldade, prioridade')
      .eq('user_id', userId)
      .eq('sprint_id', sprintId)
      .gte('dia', inicio)
      .lte('dia', fim)
      .is('arquivada_em', null)

    if (error) throw error
    return data.flatMap((row) => {
      // Defesa: uma linha sem os campos de pontuação não tem como ser pontuada.
      if (!row.dia || !row.tempo_estimado_minutos || !row.dificuldade || !row.prioridade) return []
      return [
        {
          id: row.id,
          dia: row.dia,
          tempoEstimado: row.tempo_estimado_minutos as TempoEstimado,
          dificuldade: row.dificuldade as Dificuldade,
          prioridade: row.prioridade as Prioridade,
          concluida: false,
          atrasada: false,
          superTask: false,
        },
      ]
    })
  }
}
