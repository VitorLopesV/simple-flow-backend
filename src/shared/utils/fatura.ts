function diaDoMes(ano: number, mes: number, dia: number): string {
  // mes é 1-12; clampa o dia ao último dia do mês (ex.: dia 31 em fevereiro).
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const data = new Date(Date.UTC(ano, mes - 1, Math.min(dia, ultimoDia)))
  return data.toISOString().slice(0, 10)
}

/**
 * Calcula fechamento/vencimento da fatura de uma competência a partir dos dias
 * configurados no cartão. Se o dia de vencimento for menor ou igual ao de
 * fechamento, o vencimento cai no mês seguinte (padrão comum de cartão de crédito).
 */
export function calcularDatasFatura(
  cartao: { diaFechamento: number; diaVencimento: number },
  competencia: string,
): { fechamento: string; vencimento: string } {
  const [ano, mes] = competencia.split('-').map(Number)

  const fechamento = diaDoMes(ano, mes, cartao.diaFechamento)

  const vencimentoNoProximoMes = cartao.diaVencimento <= cartao.diaFechamento
  const vencimento = vencimentoNoProximoMes
    ? diaDoMes(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1, cartao.diaVencimento)
    : diaDoMes(ano, mes, cartao.diaVencimento)

  return { fechamento, vencimento }
}
