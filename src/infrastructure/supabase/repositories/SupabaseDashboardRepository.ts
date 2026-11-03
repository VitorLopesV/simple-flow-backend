import type { SupabaseClient } from '@supabase/supabase-js'

import type { Entrada } from '../../../domain/entities/Entrada'
import type { AcaoAtividade, DashboardResumo, TransacaoRecente } from '../../../domain/entities/Dashboard'
import type { Saida, SaidaTipo } from '../../../domain/entities/Saida'
import type { DashboardRepository } from '../../../domain/repositories/DashboardRepository'
import type { ID, Periodo, SeriePonto } from '../../../shared/types/common'
import { labelCurtoPeriodo, limitesDoMes, ultimosPeriodos } from '../../../shared/utils/periodo'
import { calcularVariacao } from '../../../shared/utils/variacao'
import type { Database } from '../database.types'
import { SupabaseEntradaRepository } from './SupabaseEntradaRepository'
import { SupabaseFaturaRepository } from './SupabaseFaturaRepository'
import { SupabaseSaidaRepository } from './SupabaseSaidaRepository'

const MESES_NO_GRAFICO = 6
const TRANSACOES_RECENTES = 8

type AtividadeRow = Database['public']['Tables']['atividades']['Row']

function somar(registros: { valor: number }[]): number {
  return registros.reduce((soma, item) => soma + item.valor, 0)
}

/**
 * Quanto das saídas é fatura de cartão. Sai do mesmo conjunto que alimenta o total de
 * saídas (as saídas derivadas de fatura, ver `paraSaidaDeFatura`) — antes era uma query
 * própria por competência, ou seja, uma definição de mês diferente do resto do
 * dashboard: a fatura de setembro que vence em outubro contava nos dois meses.
 */
function somarFaturas(saidas: Saida[]): number {
  return somar(saidas.filter((saida) => saida.automatica && saida.formaPagamento === 'CARTAO_CREDITO'))
}

/**
 * Recebe um client Supabase escopado no JWT do usuário — o RLS já restringe as
 * queries ao próprio usuário; o filtro explícito por userId é defesa em profundidade.
 */
export class SupabaseDashboardRepository implements DashboardRepository {
  private readonly entradaRepository: SupabaseEntradaRepository
  private readonly saidaRepository: SupabaseSaidaRepository
  private readonly faturaRepository: SupabaseFaturaRepository

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.entradaRepository = new SupabaseEntradaRepository(supabase)
    this.saidaRepository = new SupabaseSaidaRepository(supabase)
    this.faturaRepository = new SupabaseFaturaRepository(supabase)
  }

  /**
   * Histórico (tabela atividades, preenchida por trigger) para o card de transações
   * recentes: a última ação de cada registro que ainda existe e os registros removidos
   * cuja data cai no mês — estes só existem aqui, como cópia.
   */
  private async buscarAtividades(
    userId: ID,
    periodo: Periodo,
    registroIds: ID[],
  ): Promise<[Map<ID, AtividadeRow>, AtividadeRow[]]> {
    const { inicio, fim } = limitesDoMes(periodo)

    const [doRegistro, removidos] = await Promise.all([
      registroIds.length
        ? this.supabase
            .from('atividades')
            .select('*')
            .eq('user_id', userId)
            .in('registro_id', registroIds)
            .order('criado_em', { ascending: true })
        : Promise.resolve({ data: [] as AtividadeRow[], error: null }),
      this.supabase
        .from('atividades')
        .select('*')
        .eq('user_id', userId)
        .eq('acao', 'REMOVIDO')
        .gte('data', inicio)
        .lte('data', fim)
        .order('criado_em', { ascending: false })
        .limit(TRANSACOES_RECENTES),
    ])

    if (doRegistro.error) throw doRegistro.error
    if (removidos.error) throw removidos.error

    // Em ordem cronológica, a última ação de cada registro sobrescreve as anteriores.
    const ultimaPorRegistro = new Map<ID, AtividadeRow>()
    for (const atividade of doRegistro.data) ultimaPorRegistro.set(atividade.registro_id, atividade)

    return [ultimaPorRegistro, removidos.data]
  }

  async resumo(userId: ID, periodo: Periodo): Promise<DashboardResumo> {
    const periodos = ultimosPeriodos(periodo, MESES_NO_GRAFICO)

    // Cada mês da janela vem da mesma leitura de `listar`/`resumo` de entradas/saídas
    // — assim o gráfico e o card "no período" nunca divergem das telas.
    //
    // As faturas do mês são buscadas de novo à parte: nas saídas cada uma já chega
    // somada numa saída só, sem as transações que o detalhe de cartões precisa.
    const [entradasPorPeriodo, saidasPorPeriodo, faturasDoMes, transacoesCartaoDoPeriodo, categoriasRes] =
      await Promise.all([
        Promise.all(periodos.map((p) => this.entradaRepository.listarDoPeriodo(userId, p))),
        Promise.all(periodos.map((p) => this.saidaRepository.listarDoPeriodo(userId, p))),
        this.faturaRepository.listarVencendoNoPeriodo(userId, periodo),
        this.faturaRepository.listarTransacoesDoPeriodo(userId, periodo),
        this.supabase.from('categorias').select('id, nome, cor'),
      ])

    if (categoriasRes.error) throw categoriasRes.error

    const categoriaPorId = new Map(categoriasRes.data.map((categoria) => [categoria.id, categoria]))

    const indiceAtual = periodos.length - 1
    const entradasDoMes: Entrada[] = entradasPorPeriodo[indiceAtual]!
    const saidasDoMes: Saida[] = saidasPorPeriodo[indiceAtual]!

    const totalEntradas = somar(entradasDoMes)
    const totalSaidas = somar(saidasDoMes)
    const totalFaturas = somarFaturas(saidasDoMes)

    const serieEntradas: SeriePonto[] = periodos.map((p, i) => ({
      label: labelCurtoPeriodo(p),
      valor: somar(entradasPorPeriodo[i]!),
    }))
    const serieSaidas: SeriePonto[] = periodos.map((p, i) => ({
      label: labelCurtoPeriodo(p),
      valor: somar(saidasPorPeriodo[i]!),
    }))
    const serieFaturas: SeriePonto[] = periodos.map((p, i) => ({
      label: labelCurtoPeriodo(p),
      valor: somarFaturas(saidasPorPeriodo[i]!),
    }))

    const porCategoria = (registros: { categoriaId: string; valor: number }[]) => {
      const agrupado = new Map<string, number>()
      for (const registro of registros) {
        agrupado.set(registro.categoriaId, (agrupado.get(registro.categoriaId) ?? 0) + registro.valor)
      }
      return [...agrupado.entries()]
        .map(([categoriaId, total]) => {
          const categoria = categoriaPorId.get(categoriaId)
          return { nome: categoria?.nome ?? 'Outros', cor: categoria?.cor ?? '#94a3b8', total }
        })
        .sort((a, b) => b.total - a.total)
    }
    const gastosPorCategoria = porCategoria(saidasDoMes)
    const entradasPorCategoria = porCategoria(entradasDoMes)

    const [ultimaAcaoPorRegistro, removidos] = await this.buscarAtividades(userId, periodo, [
      ...entradasDoMes.map((entrada) => entrada.id),
      // A fatura é uma saída derivada (id sai_fat_*): não existe no histórico.
      ...saidasDoMes.filter((saida) => !saida.automatica).map((saida) => saida.id),
      ...transacoesCartaoDoPeriodo.map((transacao) => transacao.id),
    ])

    const transacoesCartaoDoMes = faturasDoMes.flatMap((fatura) => fatura.transacoes)
    const agrupadoPorTipo = new Map<SaidaTipo, number>()
    for (const transacao of transacoesCartaoDoMes) {
      agrupadoPorTipo.set(transacao.tipo, (agrupadoPorTipo.get(transacao.tipo) ?? 0) + transacao.valor)
    }
    const gastosCartoesPorTipo = [...agrupadoPorTipo.entries()]
      .map(([tipo, total]) => ({ tipo, total }))
      .sort((a, b) => b.total - a.total)
    const gastosCartoesPorCategoria = porCategoria(transacoesCartaoDoMes)

    const nomeECor = (categoriaId: string) => {
      const categoria = categoriaPorId.get(categoriaId)
      return { categoriaNome: categoria?.nome ?? 'Sem categoria', categoriaCor: categoria?.cor ?? '#94a3b8' }
    }

    /**
     * Última ação de cada registro; sem histórico (dado anterior ao histórico ou gerado
     * pelo job de recorrência) vale "adicionado" na data de criação.
     */
    const acaoDe = (id: string, criadoEm: string): Pick<TransacaoRecente, 'acao' | 'ocorridoEm'> => {
      const ultima = ultimaAcaoPorRegistro.get(id)
      return { acao: (ultima?.acao as AcaoAtividade | undefined) ?? 'ADICIONADO', ocorridoEm: ultima?.criado_em ?? criadoEm }
    }

    const transacoesRecentes: TransacaoRecente[] = [
      ...entradasDoMes.map<TransacaoRecente>((entrada) => ({
        id: entrada.id,
        tipo: 'ENTRADA',
        ...acaoDe(entrada.id, entrada.criadoEm),
        descricao: entrada.descricao,
        valor: entrada.valor,
        data: entrada.data,
        ...nomeECor(entrada.categoriaId),
      })),
      // A fatura entra como movimentação de cartão; as demais saídas, como saída.
      ...saidasDoMes.map<TransacaoRecente>((saida) => ({
        id: saida.id,
        tipo: saida.automatica && saida.formaPagamento === 'CARTAO_CREDITO' ? 'CARTAO' : 'SAIDA',
        ...acaoDe(saida.id, saida.criadoEm),
        descricao: saida.descricao,
        valor: saida.valor,
        data: saida.data,
        ...nomeECor(saida.categoriaId),
      })),
      // Lançamentos de cartão entram pela data da compra: a saída da fatura só mostra o
      // total, e aqui o usuário vê cada compra no cartão (mesma regra do mock do frontend).
      ...transacoesCartaoDoPeriodo.map<TransacaoRecente>((transacao) => ({
        id: transacao.id,
        tipo: 'CARTAO',
        ...acaoDe(transacao.id, transacao.criadoEm),
        descricao: transacao.descricao,
        valor: transacao.valor,
        data: transacao.data,
        ...nomeECor(transacao.categoriaId),
      })),
      // Removidos: o registro não existe mais, só a cópia guardada no histórico.
      ...removidos.map<TransacaoRecente>((atividade) => ({
        id: atividade.registro_id,
        tipo: atividade.tipo as TransacaoRecente['tipo'],
        acao: 'REMOVIDO',
        ocorridoEm: atividade.criado_em,
        descricao: atividade.descricao,
        valor: Number(atividade.valor),
        data: atividade.data,
        ...nomeECor(atividade.categoria_id ?? ''),
      })),
    ]
      .sort((a, b) => b.ocorridoEm.localeCompare(a.ocorridoEm) || b.data.localeCompare(a.data))
      .slice(0, TRANSACOES_RECENTES)

    return {
      totalEntradas,
      totalSaidas,
      saldo: totalEntradas - totalSaidas,
      totalFaturas,
      variacaoEntradas: calcularVariacao(totalEntradas, serieEntradas.at(-2)?.valor ?? 0),
      variacaoSaidas: calcularVariacao(totalSaidas, serieSaidas.at(-2)?.valor ?? 0),
      serieEntradas,
      serieSaidas,
      serieFaturas,
      gastosPorCategoria,
      entradasPorCategoria,
      gastosCartoesPorTipo,
      gastosCartoesPorCategoria,
      transacoesRecentes,
    }
  }
}
