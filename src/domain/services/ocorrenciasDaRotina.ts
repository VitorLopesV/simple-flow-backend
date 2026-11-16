import type { ItemRotina } from '../entities/ItemRotina'

/** Uma ocorrência: o dia (`YYYY-MM-DD`) e a hora (`HH:MM`) opcional daquela vez. */
export interface Ocorrencia {
  data: string
  hora: string | null
}

export interface OcorrenciasDaRotina {
  /** Segunda a sexta: entram no sprint e pontuam. */
  diasUteis: Ocorrencia[]
  /** Sábado e domingo (só no modo "a cada N dias"): lembretes, fora do sprint e sem pontos. */
  lembretesFimDeSemana: Ocorrencia[]
}

const DIA_EM_MS = 86_400_000

/**
 * Datas são tratadas como UTC puro (`YYYY-MM-DD` → meia-noite UTC) para que o fuso do servidor
 * nunca desloque o dia; quem chama decide o "hoje" (ver `dataAtual`, em America/Sao_Paulo).
 */
function paraDia(dataIso: string): number {
  return Math.floor(Date.parse(`${dataIso}T00:00:00Z`) / DIA_EM_MS)
}

function paraIso(dia: number): string {
  return new Date(dia * DIA_EM_MS).toISOString().slice(0, 10)
}

/** ISO: 1 = segunda ... 7 = domingo. O dia 0 (01/01/1970) foi uma quinta. */
function diaDaSemana(dia: number): number {
  return ((((dia + 3) % 7) + 7) % 7) + 1
}

/** Ordem estável dentro do dia: vez sem hora primeiro, depois por horário. */
function compararVezes(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return -1
  if (b === null) return 1
  return a < b ? -1 : 1
}

/**
 * Ocorrências de um item de rotina em `[inicio, fim]` (ambos inclusivos, `YYYY-MM-DD`),
 * em ordem cronológica. Cada vez do dia é uma ocorrência separada. Intervalo invertido
 * devolve vazio.
 */
export function calcularOcorrencias(
  item: Pick<ItemRotina, 'repeticao' | 'vezes'>,
  inicio: string,
  fim: string,
): OcorrenciasDaRotina {
  const resultado: OcorrenciasDaRotina = { diasUteis: [], lembretesFimDeSemana: [] }
  const primeiro = paraDia(inicio)
  const ultimo = paraDia(fim)
  const horas = item.vezes.map((vez) => vez.hora).sort(compararVezes)
  const { repeticao } = item

  const adicionar = (dia: number) => {
    const util = diaDaSemana(dia) <= 5
    const lista = util ? resultado.diasUteis : resultado.lembretesFimDeSemana
    for (const hora of horas) lista.push({ data: paraIso(dia), hora })
  }

  if (repeticao.modo === 'DIAS_DA_SEMANA') {
    const dias = new Set<number>(repeticao.dias)
    for (let dia = primeiro; dia <= ultimo; dia++) {
      if (dias.has(diaDaSemana(dia))) adicionar(dia)
    }
    return resultado
  }

  const inicial = paraDia(repeticao.dataInicial)
  // Primeiro múltiplo do intervalo, a partir da data inicial, que não é anterior ao início.
  const passos = primeiro <= inicial ? 0 : Math.ceil((primeiro - inicial) / repeticao.intervalo)
  for (let dia = inicial + passos * repeticao.intervalo; dia <= ultimo; dia += repeticao.intervalo) {
    adicionar(dia)
  }
  return resultado
}
