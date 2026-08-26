import type { Periodo } from '../types/common'

/** Converte um período `{ mes, ano }` para o formato de competência `YYYY-MM` usado no banco. */
export function paraCompetencia(periodo: Periodo): string {
  return `${periodo.ano}-${String(periodo.mes).padStart(2, '0')}`
}

/** Converte uma competência `YYYY-MM` de volta para `{ mes, ano }`. */
export function paraPeriodo(competencia: string): Periodo {
  const [ano, mes] = competencia.split('-').map(Number)
  return { mes, ano }
}

/** Testa se uma data ISO `YYYY-MM-DD` cai dentro do período informado. */
export function dentroDoPeriodo(dataIso: string, periodo: Periodo): boolean {
  return dataIso.slice(0, 4) === String(periodo.ano) && Number(dataIso.slice(5, 7)) === periodo.mes
}

/** Primeiro e último dia (ISO `YYYY-MM-DD`) do mês de competência informado. */
export function limitesDoMes(periodo: Periodo): { inicio: string; fim: string } {
  const inicio = new Date(Date.UTC(periodo.ano, periodo.mes - 1, 1))
  const fim = new Date(Date.UTC(periodo.ano, periodo.mes, 0))
  return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) }
}

/** Soma (ou subtrai, com n negativo) meses a um período, ajustando o ano quando necessário. */
export function addMeses(periodo: Periodo, n: number): Periodo {
  const data = new Date(Date.UTC(periodo.ano, periodo.mes - 1 + n, 1))
  return { mes: data.getUTCMonth() + 1, ano: data.getUTCFullYear() }
}

export function mesAnterior(periodo: Periodo): Periodo {
  return addMeses(periodo, -1)
}

/** Os últimos `n` períodos terminando (inclusive) em `periodo`, em ordem cronológica. */
export function ultimosPeriodos(periodo: Periodo, n: number): Periodo[] {
  return Array.from({ length: n }, (_, i) => addMeses(periodo, i - (n - 1)))
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Rótulo curto para eixos de gráfico: `'ago/26'`. */
export function labelCurtoPeriodo(periodo: Periodo): string {
  return `${MESES_CURTOS[periodo.mes - 1]}/${String(periodo.ano).slice(-2)}`
}
