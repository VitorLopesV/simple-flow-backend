import type { SupabaseClient } from '@supabase/supabase-js'

import type { TarefaDoSprint } from '../../../domain/entities/PlacarDoSprint'
import type { Dificuldade, Prioridade, TempoEstimado } from '../../../domain/entities/Tarefa'
import type { TarefasDoSprintRepository } from '../../../domain/repositories/TarefasDoSprintRepository'
import { tarefaAtrasada } from '../../../domain/services/atraso'
import type { ID } from '../../../shared/types/common'
import type { Database } from '../database.types'

/**
 * Tarefas vinculadas ao sprint (`sprint_id`, #69). `concluida` vem de `concluida_em` e `atrasada`
 * de `tarefaAtrasada` (#70, sempre contra o dia atual da tarefa); `superTask` é da #65 e segue `false`.
 */
export class SupabaseTarefasDoSprintRepository implements TarefasDoSprintRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listar(userId: ID, sprintId: ID, inicio: string, fim: string): Promise<TarefaDoSprint[]> {
    const { data, error } = await this.client
      .from('tarefas')
      .select('id, dia, hora, tempo_estimado_minutos, dificuldade, prioridade, concluida_em')
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
          concluida: row.concluida_em !== null,
          atrasada:
            row.concluida_em !== null &&
            tarefaAtrasada(
              { dia: row.dia, hora: row.hora, tempoEstimado: row.tempo_estimado_minutos },
              new Date(row.concluida_em),
            ),
          superTask: false,
        },
      ]
    })
  }
}
