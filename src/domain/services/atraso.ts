import { addMinutos, dataHoraAtual } from '../../shared/utils/periodo'

/** Campos da tarefa que definem o prazo dela. */
export interface PrazoDaTarefa {
  /** YYYY-MM-DD */
  dia: string | null
  /** HH:MM (ou HH:MM:SS) */
  hora: string | null
  /** Em minutos. */
  tempoEstimado: number | null
}

/**
 * Tarefa concluída fora do prazo (vale 20% dos pontos). Tudo em America/Sao_Paulo:
 * - com hora: atrasada se concluída DEPOIS de início + tempo estimado (exatamente no limite não conta);
 * - sem hora: atrasada se concluída depois do dia da tarefa.
 * O `dia` é o atual da tarefa: replanejar para outro sprint já move o prazo. Sem dia, não há prazo.
 */
export function tarefaAtrasada(prazo: PrazoDaTarefa, concluidaEm: Date): boolean {
  if (prazo.dia === null) return false
  const concluidaLocal = dataHoraAtual(concluidaEm)

  if (prazo.hora === null) return concluidaLocal.slice(0, 10) > prazo.dia

  const limite = addMinutos(`${prazo.dia}T${prazo.hora.slice(0, 5)}`, prazo.tempoEstimado ?? 0)
  return concluidaLocal > limite
}
