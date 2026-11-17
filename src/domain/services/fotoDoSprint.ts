import type {
  DiaDeRotinaNaFoto,
  FotoDoSprint,
  TarefaDoSprint,
  TarefaNaFoto,
} from '../entities/PlacarDoSprint'
import { calcularPlacar, ehDiaUtil, tarefasPontuaveis } from './placarDoSprint'
import { pontosDaTarefa } from './pontuacao'

export interface OcorrenciaParaFoto {
  id?: string
  nome: string
  data: string
  hora: string | null
  ordem: number
  concluidaEm: string | null
  lembrete: boolean
}

/** Recompensa efetiva: a do sprint ou, se não houver, a padrão do usuário (vazia conta como ausente). */
export function recompensaEfetiva(doSprint: string | null, padrao: string | null): string | null {
  const limpa = (texto: string | null) => (texto && texto.trim() !== '' ? texto.trim() : null)
  return limpa(doSprint) ?? limpa(padrao)
}

function comparar(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Foto do fechamento (#72): o placar de `calcularPlacar` mais a recompensa efetiva e o detalhe de tarefas e rotina.
 * Espelha em TypeScript o `jsonb` montado por `fechar_sprint` (migration 20261116200000): mudou um, mude o outro.
 * Tarefas ordenadas por dia, hora (sem hora por último), título e id; rotina por dia, e dentro dele pela `ordem`.
 */
export function montarFoto(
  ocorrencias: OcorrenciaParaFoto[],
  tarefas: TarefaDoSprint[],
  inicio: string,
  fim: string,
  recompensa: string | null,
): FotoDoSprint {
  const doPlacar = ocorrencias.filter((o) => !o.lembrete)
  const placar = calcularPlacar(doPlacar, tarefas, inicio, fim)

  const porDia = new Map<string, OcorrenciaParaFoto[]>()
  for (const o of doPlacar) {
    if (o.data < inicio || o.data > fim || !ehDiaUtil(o.data)) continue
    porDia.set(o.data, [...(porDia.get(o.data) ?? []), o])
  }
  const rotina: DiaDeRotinaNaFoto[] = [...porDia.entries()]
    .sort(([a], [b]) => comparar(a, b))
    .map(([data, lista]) => ({
      data,
      cumprido: lista.every((o) => o.concluidaEm !== null),
      itens: [...lista]
        .sort((a, b) => a.ordem - b.ordem || comparar(a.id ?? '', b.id ?? ''))
        .map((o) => ({ nome: o.nome, hora: o.hora, concluida: o.concluidaEm !== null })),
    }))

  const itensDeTarefa: TarefaNaFoto[] = tarefasPontuaveis(tarefas, inicio, fim)
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      dia: t.dia,
      hora: t.hora,
      tempoEstimado: t.tempoEstimado,
      dificuldade: t.dificuldade,
      prioridade: t.prioridade,
      pontos: pontosDaTarefa(t),
      pontosGanhos: t.concluida ? pontosDaTarefa(t, t.atrasada) : 0,
      situacao: !t.concluida ? ('NAO_CONCLUIDA' as const) : t.atrasada ? ('ATRASADA' as const) : ('CONCLUIDA' as const),
    }))
    .sort(
      (a, b) =>
        comparar(a.dia, b.dia) ||
        (a.hora === null ? 1 : 0) - (b.hora === null ? 1 : 0) ||
        comparar(a.hora ?? '', b.hora ?? '') ||
        comparar(a.titulo, b.titulo) ||
        comparar(a.id, b.id),
    )

  return { ...placar, recompensa, detalhe: { tarefas: itensDeTarefa, rotina } }
}
