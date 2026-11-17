import type { PlacarDoSprint, TarefaDoSprint } from '../entities/PlacarDoSprint'
import { CONFIGURACAO_PONTUACAO, pontosDaTarefa } from './pontuacao'

export interface OcorrenciaParaPlacar {
  data: string
  concluidaEm: string | null
}

/** Sábado (6) e domingo (0) nunca pontuam. */
export function ehDiaUtil(dataIso: string): boolean {
  const dia = new Date(`${dataIso}T00:00:00Z`).getUTCDay()
  return dia >= 1 && dia <= 5
}

/** Tarefas que pontuam no sprint: sem Super task, em dia útil e dentro da semana. */
export function tarefasPontuaveis(tarefas: TarefaDoSprint[], inicio: string, fim: string): TarefaDoSprint[] {
  return tarefas.filter((t) => !t.superTask && ehDiaUtil(t.dia) && t.dia >= inicio && t.dia <= fim)
}

/**
 * Placar do sprint. Rotina: cada dia útil com ocorrência vale 40, tudo ou nada; dia sem
 * rotina fica fora do total e dos feitos. Tarefa entra no total com os pontos cheios;
 * concluída atrasada soma só 20% nos feitos.
 */
export function calcularPlacar(
  ocorrencias: OcorrenciaParaPlacar[],
  tarefas: TarefaDoSprint[],
  inicio: string,
  fim: string,
): PlacarDoSprint {
  const porDia = new Map<string, boolean>()
  for (const { data, concluidaEm } of ocorrencias) {
    if (data < inicio || data > fim || !ehDiaUtil(data)) continue
    porDia.set(data, (porDia.get(data) ?? true) && concluidaEm !== null)
  }
  const pontosPorDia = CONFIGURACAO_PONTUACAO.pontosDoDiaDeRotina
  const diasCumpridos = [...porDia.values()].filter(Boolean).length
  const rotina = {
    diasComRotina: porDia.size,
    diasCumpridos,
    pontosPorDia,
    total: porDia.size * pontosPorDia,
    feitos: diasCumpridos * pontosPorDia,
  }

  const pontuaveis = tarefasPontuaveis(tarefas, inicio, fim)
  const concluidas = pontuaveis.filter((t) => t.concluida)
  const placarTarefas = {
    quantidade: pontuaveis.length,
    concluidas: concluidas.length,
    total: pontuaveis.reduce((soma, t) => soma + pontosDaTarefa(t), 0),
    feitos: concluidas.reduce((soma, t) => soma + pontosDaTarefa(t, t.atrasada), 0),
  }

  const total = rotina.total + placarTarefas.total
  const feitos = rotina.feitos + placarTarefas.feitos
  return {
    total,
    feitos,
    percentual: total === 0 ? 0 : Math.round((feitos / total) * 1000) / 10,
    bonus: total > 0 && feitos * 10 >= total * CONFIGURACAO_PONTUACAO.bonusAPartirDeDecimos,
    rotina,
    tarefas: placarTarefas,
  }
}
