/** Variação percentual (fração, ex.: 0.1 = +10%) entre o valor atual e o anterior. */
export function calcularVariacao(atual: number, anterior: number): number {
  if (!anterior) return atual > 0 ? 1 : 0
  return (atual - anterior) / Math.abs(anterior)
}
