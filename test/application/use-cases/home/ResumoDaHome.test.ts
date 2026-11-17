import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ResumoDaHome } from '../../../../src/application/use-cases/home/ResumoDaHome'
import type { Saida } from '../../../../src/domain/entities/Saida'
import type { Tarefa } from '../../../../src/domain/entities/Tarefa'
import { criarSaidaRepositoryFake, criarTarefaRepositoryFake } from '../../../helpers/repositoriosFake'

// Novembro/2026: segunda 16, sexta 20, sábado 21, domingo 22, segunda 23. São Paulo = UTC-3.
const SEGUNDA_MEIO_DIA = new Date('2026-11-16T15:00:00Z') // 12:00 SP
const SPRINT = { id: 's1', inicio: '2026-11-16', fim: '2026-11-20', situacao: 'ABERTO', foto: null, fechadoEm: null }
const FOTO = {
  total: 300,
  feitos: 285,
  percentual: 95,
  bonus: true,
  recompensa: 'Pizza',
  rotina: {},
  tarefas: {},
  detalhe: { tarefas: [], rotina: [] },
}
const DASHBOARD = {
  totalEntradas: 5000,
  totalSaidas: 2000,
  saldo: 3000,
  totalFaturas: 400,
  variacaoEntradas: 5,
  variacaoSaidas: -2,
  serieEntradas: [{ rotulo: 'nov/26', valor: 5000 }],
  serieSaidas: [{ rotulo: 'nov/26', valor: 2000 }],
  gastosPorCategoria: [{ nome: 'X', cor: '#000', total: 1 }],
  transacoesRecentes: [],
}

function ocorrencia(sobrescritas: Record<string, unknown> = {}) {
  return { id: 'o1', itemId: 'i1', nome: 'Treino', data: '2026-11-16', hora: null, indice: 0, ordem: 0, concluidaEm: null, ...sobrescritas }
}

function dadosDoSprint(sobrescritas: Record<string, unknown> = {}) {
  return {
    sprint: SPRINT,
    iniciado: true,
    previa: false,
    ocorrencias: [],
    lembretes: [],
    recompensaPadrao: null,
    recompensaEfetiva: null,
    ...sobrescritas,
  }
}

function tarefa(sobrescritas: Partial<Tarefa> = {}): Tarefa {
  return {
    id: 't1',
    areaId: 'a1',
    titulo: 'Tarefa',
    dia: '2026-11-16',
    hora: null,
    tempoEstimado: 60,
    dificuldade: 'MEDIA',
    prioridade: 'ALTA',
    notas: null,
    sprintId: 's1',
    superTaskId: null,
    concluidaEm: null,
    concluida: false,
    atrasada: false,
    naoConcluidaNoSprintDe: null,
    arquivada: false,
    arquivadaEm: null,
    criadoEm: '2026-11-01T00:00:00Z',
    ...sobrescritas,
  }
}

function conta(sobrescritas: Partial<Saida> = {}): Saida {
  return {
    id: 'sai1',
    descricao: 'Luz',
    valor: 100.1,
    data: '2026-11-01',
    categoriaId: 'cat',
    tipo: 'CONTA',
    status: 'PENDENTE',
    vencimento: '2026-11-18',
    pagoEm: null,
    formaPagamento: 'BOLETO',
    cartaoId: null,
    recorrente: false,
    observacao: null,
    criadoEm: '',
    atualizadoEm: '',
    automatica: false,
    serieId: null,
    editadoManualmente: false,
    ...sobrescritas,
  }
}

describe('ResumoDaHome', () => {
  const obterSprint = { execute: vi.fn() }
  const tarefasDoSprint = { listar: vi.fn(), devolverNaoConcluidas: vi.fn() }
  const tarefas = criarTarefaRepositoryFake()
  const saidas = criarSaidaRepositoryFake()
  const dashboard = { execute: vi.fn() }

  const usar = (agora: Date) =>
    new ResumoDaHome(obterSprint, tarefasDoSprint, tarefas, saidas, dashboard).execute('u1', agora)

  beforeEach(() => {
    vi.resetAllMocks()
    obterSprint.execute.mockResolvedValue(dadosDoSprint())
    tarefasDoSprint.listar.mockResolvedValue([])
    tarefas.listarDoDia.mockResolvedValue([])
    saidas.listarPendentesVencendoEntre.mockResolvedValue([])
    dashboard.execute.mockResolvedValue(DASHBOARD)
  })

  it('busca o sprint atual (que fecha o vencido) e consulta tudo só do usuário informado', async () => {
    await usar(SEGUNDA_MEIO_DIA)

    expect(obterSprint.execute).toHaveBeenCalledWith('u1', 'ATUAL', SEGUNDA_MEIO_DIA)
    expect(obterSprint.execute).toHaveBeenCalledTimes(1)
    expect(tarefasDoSprint.listar).toHaveBeenCalledWith('u1', 's1', '2026-11-16', '2026-11-20')
    expect(tarefas.listarDoDia).toHaveBeenCalledWith('u1', '2026-11-16')
    expect(saidas.listarPendentesVencendoEntre).toHaveBeenCalledWith('u1', '2026-11-16', '2026-11-22')
    expect(dashboard.execute).toHaveBeenCalledWith('u1', { mes: 11, ano: 2026 })
  })

  describe('missão do dia', () => {
    it('traz só as ocorrências de hoje, por hora, com as sem hora no fim e a situação de cada uma', async () => {
      obterSprint.execute.mockResolvedValue(
        dadosDoSprint({
          ocorrencias: [
            ocorrencia({ id: 'sem-hora', nome: 'Meditar', ordem: 0 }),
            ocorrencia({ id: 'tarde', nome: 'Ler', hora: '18:00', ordem: 2 }),
            ocorrencia({ id: 'manha', nome: 'Treino', hora: '07:30', ordem: 1, concluidaEm: '2026-11-16T10:00:00Z' }),
            ocorrencia({ id: 'amanha', data: '2026-11-17', hora: '06:00' }),
          ],
        }),
      )

      const { missaoDoDia } = await usar(SEGUNDA_MEIO_DIA)

      expect(missaoDoDia.ocorrencias.map((o) => o.id)).toEqual(['manha', 'tarde', 'sem-hora'])
      expect(missaoDoDia.ocorrencias[0]).toMatchObject({ concluida: true, concluidaEm: '2026-11-16T10:00:00Z' })
      expect(missaoDoDia.ocorrencias[1]).toMatchObject({ concluida: false, concluidaEm: null })
      expect(missaoDoDia).toMatchObject({ total: 3, concluidas: 1 })
    })

    it('a hora só ordena: ocorrência pendente de hora já passada não gera atraso', async () => {
      obterSprint.execute.mockResolvedValue(dadosDoSprint({ ocorrencias: [ocorrencia({ hora: '07:00' })] }))

      const { missaoDoDia } = await usar(new Date('2026-11-16T23:00:00Z'))

      expect(missaoDoDia.ocorrencias[0]).not.toHaveProperty('atrasada')
      expect(missaoDoDia.ocorrencias[0]!.concluida).toBe(false)
    })

    it('desempata horas iguais pela ordem do sprint', async () => {
      obterSprint.execute.mockResolvedValue(
        dadosDoSprint({
          ocorrencias: [ocorrencia({ id: 'b', hora: '08:00', ordem: 5 }), ocorrencia({ id: 'a', hora: '08:00', ordem: 4 })],
        }),
      )

      const { missaoDoDia } = await usar(SEGUNDA_MEIO_DIA)

      expect(missaoDoDia.ocorrencias.map((o) => o.id)).toEqual(['a', 'b'])
    })
  })

  describe('tarefas de hoje', () => {
    it('ordena por hora (sem hora no fim, desempate por título) e marca no sprint e a conclusão', async () => {
      tarefas.listarDoDia.mockResolvedValue([
        tarefa({ id: 'sem-b', titulo: 'B sem hora' }),
        tarefa({ id: 'sem-a', titulo: 'A sem hora', sprintId: null }),
        tarefa({ id: 'tarde', hora: '15:00', titulo: 'Tarde' }),
        tarefa({ id: 'cedo', hora: '08:00', titulo: 'Cedo', concluida: true, concluidaEm: '2026-11-16T12:00:00Z' }),
      ])

      const { tarefasDeHoje } = await usar(SEGUNDA_MEIO_DIA)

      expect(tarefasDeHoje.map((t) => t.id)).toEqual(['cedo', 'tarde', 'sem-a', 'sem-b'])
      expect(tarefasDeHoje.find((t) => t.id === 'sem-a')).toMatchObject({ noSprint: false, concluida: false, dia: '2026-11-16' })
      expect(tarefasDeHoje.find((t) => t.id === 'cedo')).toMatchObject({ noSprint: true, concluida: true })
    })

    it('pendente com hora: atrasada só depois de início + tempo estimado (exatamente no limite não atrasa)', async () => {
      tarefas.listarDoDia.mockResolvedValue([tarefa({ hora: '09:00', tempoEstimado: 60 })])

      // Limite = 10:00 SP = 13:00Z.
      const antes = await usar(new Date('2026-11-16T12:59:00Z'))
      const noLimite = await usar(new Date('2026-11-16T13:00:00Z'))
      const depois = await usar(new Date('2026-11-16T13:01:00Z'))

      expect(antes.tarefasDeHoje[0]!.atrasada).toBe(false)
      expect(noLimite.tarefasDeHoje[0]!.atrasada).toBe(false)
      expect(depois.tarefasDeHoje[0]!.atrasada).toBe(true)
    })

    it('pendente sem hora nunca está atrasada durante o próprio dia, nem às 23:59', async () => {
      tarefas.listarDoDia.mockResolvedValue([tarefa({ hora: null })])

      const resumo = await usar(new Date('2026-11-17T02:59:00Z')) // 23:59 SP de segunda

      expect(resumo.hoje).toBe('2026-11-16')
      expect(resumo.tarefasDeHoje[0]!.atrasada).toBe(false)
    })

    it('concluída usa o atraso já calculado na conclusão, não o instante de agora', async () => {
      tarefas.listarDoDia.mockResolvedValue([
        tarefa({ id: 'no-prazo', hora: '09:00', concluida: true, atrasada: false, concluidaEm: '2026-11-16T12:30:00Z' }),
        tarefa({ id: 'fora', hora: '09:00', concluida: true, atrasada: true, concluidaEm: '2026-11-16T14:00:00Z' }),
      ])

      const { tarefasDeHoje } = await usar(new Date('2026-11-16T22:00:00Z'))

      expect(tarefasDeHoje.map((t) => [t.id, t.atrasada])).toEqual([
        ['no-prazo', false],
        ['fora', true],
      ])
    })
  })

  describe('placar', () => {
    it('sprint aberto: calcula ao vivo pela mesma função do placar (sem recalcular a fórmula)', async () => {
      obterSprint.execute.mockResolvedValue(
        dadosDoSprint({
          ocorrencias: [ocorrencia({ concluidaEm: '2026-11-16T12:00:00Z' })],
          recompensaPadrao: 'Cinema',
          recompensaEfetiva: 'Cinema',
        }),
      )

      const { placar } = await usar(SEGUNDA_MEIO_DIA)

      expect(placar).toEqual({
        sprintId: 's1',
        inicio: '2026-11-16',
        fim: '2026-11-20',
        fechado: false,
        fechadoEm: null,
        total: 40,
        feitos: 40,
        percentual: 100,
        bonus: true,
        recompensa: 'Cinema',
      })
    })

    it('sprint fechado: devolve a foto gravada, com a recompensa do fechamento', async () => {
      obterSprint.execute.mockResolvedValue(
        dadosDoSprint({
          sprint: { ...SPRINT, situacao: 'FECHADO', foto: FOTO, fechadoEm: '2026-11-21T02:59:00Z' },
          recompensaEfetiva: 'Pizza',
        }),
      )

      const { placar } = await usar(new Date('2026-11-21T15:00:00Z'))

      expect(placar).toMatchObject({ fechado: true, fechadoEm: '2026-11-21T02:59:00Z', total: 300, feitos: 285, percentual: 95, bonus: true, recompensa: 'Pizza' })
      expect(tarefasDoSprint.listar).not.toHaveBeenCalled()
    })
  })

  describe('contas da semana', () => {
    it('consulta segunda a domingo da semana de hoje e marca as já vencidas', async () => {
      saidas.listarPendentesVencendoEntre.mockResolvedValue([
        conta({ id: 'ontem', vencimento: '2026-11-17', valor: 10.1 }),
        conta({ id: 'hoje', vencimento: '2026-11-18', valor: 20.2 }),
        conta({ id: 'fatura', vencimento: '2026-11-22', valor: 30, automatica: true }),
      ])

      const { contasDaSemana, semana } = await usar(new Date('2026-11-18T15:00:00Z'))

      expect(semana).toEqual({ inicio: '2026-11-16', fim: '2026-11-22' })
      expect(saidas.listarPendentesVencendoEntre).toHaveBeenCalledWith('u1', '2026-11-16', '2026-11-22')
      expect(contasDaSemana.contas.map((c) => [c.id, c.vencida])).toEqual([
        ['ontem', true],
        ['hoje', false],
        ['fatura', false],
      ])
      expect(contasDaSemana).toMatchObject({ total: 60.3, quantidade: 3 })
      expect(contasDaSemana.contas[2]).toMatchObject({ automatica: true, vencimento: '2026-11-22', formaPagamento: 'BOLETO' })
    })

    it('vazio: total 0 e lista vazia', async () => {
      const { contasDaSemana } = await usar(SEGUNDA_MEIO_DIA)

      expect(contasDaSemana).toEqual({ total: 0, quantidade: 0, contas: [] })
    })

    it('no sábado e no domingo a semana continua sendo a que acabou (segunda a domingo)', async () => {
      const sabado = await usar(new Date('2026-11-21T15:00:00Z'))
      const domingo = await usar(new Date('2026-11-22T15:00:00Z'))

      expect(sabado.semana).toEqual({ inicio: '2026-11-16', fim: '2026-11-22' })
      expect(domingo.semana).toEqual({ inicio: '2026-11-16', fim: '2026-11-22' })
    })

    it('segunda 00:00 SP (03:00Z) já é a semana nova; domingo 23:59 SP (02:59Z de segunda) ainda é a velha', async () => {
      await usar(new Date('2026-11-23T02:59:00Z'))
      await usar(new Date('2026-11-23T03:00:00Z'))

      expect(saidas.listarPendentesVencendoEntre).toHaveBeenNthCalledWith(1, 'u1', '2026-11-16', '2026-11-22')
      expect(saidas.listarPendentesVencendoEntre).toHaveBeenNthCalledWith(2, 'u1', '2026-11-23', '2026-11-29')
    })
  })

  describe('finanças do mês', () => {
    it('reaproveita o resumo do dashboard da competência atual, só com saldo e fluxo', async () => {
      const { financas } = await usar(SEGUNDA_MEIO_DIA)

      expect(financas).toEqual({
        competencia: '2026-11',
        totalEntradas: 5000,
        totalSaidas: 2000,
        saldo: 3000,
        totalFaturas: 400,
        variacaoEntradas: 5,
        variacaoSaidas: -2,
        serieEntradas: DASHBOARD.serieEntradas,
        serieSaidas: DASHBOARD.serieSaidas,
      })
    })

    it('usa o mês de São Paulo na virada: 30/11 23:30 SP (UTC já em dezembro) ainda é novembro', async () => {
      await usar(new Date('2026-12-01T02:30:00Z'))

      expect(dashboard.execute).toHaveBeenCalledWith('u1', { mes: 11, ano: 2026 })
    })
  })

  describe('lembretes de fim de semana', () => {
    it('aparecem durante a semana, ordenados por data e hora', async () => {
      obterSprint.execute.mockResolvedValue(
        dadosDoSprint({
          lembretes: [
            ocorrencia({ id: 'dom', data: '2026-11-22', hora: '10:00', ordem: 9 }),
            ocorrencia({ id: 'sab-sem', data: '2026-11-21', hora: null, ordem: 7 }),
            ocorrencia({ id: 'sab', data: '2026-11-21', hora: '09:00', ordem: 8, concluidaEm: '2026-11-21T13:00:00Z' }),
          ],
        }),
      )

      const resumo = await usar(SEGUNDA_MEIO_DIA)

      expect(resumo.lembretes.map((l) => l.id)).toEqual(['sab', 'sab-sem', 'dom'])
      expect(resumo.lembretes[0]).toMatchObject({ concluida: true, data: '2026-11-21' })
      expect(resumo.missaoDoDia.ocorrencias).toEqual([])
    })
  })

  describe('fim de semana e viradas', () => {
    function sprintFechado(lembretes: unknown[] = []) {
      return dadosDoSprint({
        sprint: { ...SPRINT, situacao: 'FECHADO', foto: FOTO, fechadoEm: '2026-11-21T02:59:00Z' },
        ocorrencias: [ocorrencia({ data: '2026-11-20' })],
        lembretes,
        recompensaEfetiva: 'Pizza',
      })
    }

    it.each([
      ['sábado 00:00 SP', '2026-11-21T03:00:00Z', '2026-11-21'],
      ['sábado ao meio-dia', '2026-11-21T15:00:00Z', '2026-11-21'],
      ['domingo 23:59 SP', '2026-11-23T02:59:00Z', '2026-11-22'],
    ])('%s: missão do dia vazia, placar é a foto e os lembretes aparecem', async (_nome, instante, hoje) => {
      obterSprint.execute.mockResolvedValue(sprintFechado([ocorrencia({ id: 'l', data: '2026-11-22' })]))

      const resumo = await usar(new Date(instante))

      expect(resumo.hoje).toBe(hoje)
      expect(resumo.fimDeSemana).toBe(true)
      expect(resumo.missaoDoDia).toEqual({ total: 0, concluidas: 0, ocorrencias: [] })
      expect(resumo.placar).toMatchObject({ fechado: true, total: 300, recompensa: 'Pizza' })
      expect(resumo.lembretes.map((l) => l.id)).toEqual(['l'])
    })

    it('fim de semana: tarefas de hoje são só as planejadas para o dia (sem sprint)', async () => {
      obterSprint.execute.mockResolvedValue(sprintFechado())
      tarefas.listarDoDia.mockResolvedValue([tarefa({ dia: '2026-11-21', sprintId: null, titulo: 'Faxina' })])

      const resumo = await usar(new Date('2026-11-21T15:00:00Z'))

      expect(tarefas.listarDoDia).toHaveBeenCalledWith('u1', '2026-11-21')
      expect(resumo.tarefasDeHoje).toEqual([expect.objectContaining({ titulo: 'Faxina', noSprint: false, dia: '2026-11-21' })])
    })

    it('sexta 23:58 SP (02:58Z de sábado) ainda é dia útil e o sprint não é de fim de semana', async () => {
      const resumo = await usar(new Date('2026-11-21T02:58:59Z'))

      expect(resumo.hoje).toBe('2026-11-20')
      expect(resumo.fimDeSemana).toBe(false)
    })

    it('segunda 00:00 SP (03:00Z) é o sprint novo, dia útil', async () => {
      obterSprint.execute.mockResolvedValue(
        dadosDoSprint({
          sprint: { ...SPRINT, inicio: '2026-11-23', fim: '2026-11-27' },
          ocorrencias: [ocorrencia({ data: '2026-11-23', hora: '08:00' })],
        }),
      )

      const resumo = await usar(new Date('2026-11-23T03:00:00Z'))

      expect(resumo.hoje).toBe('2026-11-23')
      expect(resumo.fimDeSemana).toBe(false)
      expect(resumo.missaoDoDia.total).toBe(1)
      expect(tarefas.listarDoDia).toHaveBeenCalledWith('u1', '2026-11-23')
    })
  })

  it('propaga o erro de qualquer fonte sem montar resposta parcial', async () => {
    const erro = new Error('falha')
    saidas.listarPendentesVencendoEntre.mockRejectedValue(erro)

    await expect(usar(SEGUNDA_MEIO_DIA)).rejects.toBe(erro)
  })
})
