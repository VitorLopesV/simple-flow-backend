import type { ItemRotina } from '../entities/ItemRotina'
import type { OcorrenciaPlanejada } from '../entities/OcorrenciaRotina'
import { addDias } from '../../shared/utils/periodo'
import { calcularOcorrencias, type Ocorrencia } from './ocorrenciasDaRotina'

export interface OcorrenciasDoSprint {
  /** Segunda a sexta: entram no sprint. */
  ocorrencias: OcorrenciaPlanejada[]
  /** Sábado e domingo da mesma semana (modo "a cada N dias"): lembretes. */
  lembretes: OcorrenciaPlanejada[]
}

function comIndice(item: Pick<ItemRotina, 'id' | 'nome'>, lista: Ocorrencia[]): OcorrenciaPlanejada[] {
  const porDia = new Map<string, number>()
  return lista.map(({ data, hora }) => {
    const indice = porDia.get(data) ?? 0
    porDia.set(data, indice + 1)
    return { itemId: item.id, nome: item.nome, data, hora, indice, ordem: 0 }
  })
}

function ordenar(lista: OcorrenciaPlanejada[]): OcorrenciaPlanejada[] {
  return lista
    .sort(
      (a, b) =>
        a.data.localeCompare(b.data) ||
        (a.hora ?? '').localeCompare(b.hora ?? '') ||
        a.nome.localeCompare(b.nome, 'pt-BR') ||
        (a.itemId ?? '').localeCompare(b.itemId ?? '') ||
        a.indice - b.indice,
    )
    .map((ocorrencia, ordem) => ({ ...ocorrencia, ordem }))
}

/**
 * Tudo o que a rotina atual produz na semana que começa em `inicio` (segunda). Função pura:
 * serve tanto para gerar as ocorrências no início do sprint quanto para a prévia do planejamento.
 */
export function calcularOcorrenciasDoSprint(itens: ItemRotina[], inicio: string): OcorrenciasDoSprint {
  const fimDaSemana = addDias(inicio, 6)
  const ocorrencias: OcorrenciaPlanejada[] = []
  const lembretes: OcorrenciaPlanejada[] = []

  for (const item of itens) {
    const calculadas = calcularOcorrencias(item, inicio, fimDaSemana)
    ocorrencias.push(...comIndice(item, calculadas.diasUteis))
    lembretes.push(...comIndice(item, calculadas.lembretesFimDeSemana))
  }
  return { ocorrencias: ordenar(ocorrencias), lembretes: ordenar(lembretes) }
}
