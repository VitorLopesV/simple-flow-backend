import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RemoverArea } from '../../../src/application/use-cases/areas/RemoverArea'
import { ListarHistoricoDeSprints } from '../../../src/application/use-cases/sprints/ListarHistoricoDeSprints'
import { ArquivarTarefa } from '../../../src/application/use-cases/tarefas/ArquivarTarefa'
import { AtualizarTarefa } from '../../../src/application/use-cases/tarefas/AtualizarTarefa'
import { MoverTarefa } from '../../../src/application/use-cases/tarefas/MoverTarefa'
import { RemoverTarefa } from '../../../src/application/use-cases/tarefas/RemoverTarefa'
import {
  MENSAGEM_CONCLUIDA_NO_SPRINT_ABERTO_NAO_ARQUIVA,
  MENSAGEM_CONCLUIDA_NO_SPRINT_ABERTO_NAO_EXCLUI,
} from '../../../src/application/use-cases/tarefas/sprintAbertoDaTarefa'
import type { Area } from '../../../src/domain/entities/Area'
import type { FotoDoSprint } from '../../../src/domain/entities/PlacarDoSprint'
import type { Sprint } from '../../../src/domain/entities/Sprint'
import type { Tarefa } from '../../../src/domain/entities/Tarefa'
import { ConflictError } from '../../../src/domain/errors/DomainError'
import { MENSAGEM_TAREFA_CONCLUIDA } from '../../../src/domain/services/sprintDaTarefa'
import {
  criarAreaRepositoryFake,
  criarSprintRepositoryFake,
  criarSuperTaskRepositoryFake,
  criarTarefaRepositoryFake,
} from '../../helpers/repositoriosFake'

const USER = 'user-1'
// Quarta 2026-11-18 12:00 em São Paulo (sprint 16–20 aberto) e sábado 2026-11-21 (já fechado).
const QUARTA = new Date('2026-11-18T15:00:00.000Z')
const SABADO = new Date('2026-11-21T15:00:00.000Z')

const AREA: Area = { id: 'area-1', nome: 'Casa', cor: '#10b981', sistema: false, criadoEm: '2026-01-01T00:00:00.000Z' }
const DESTINO: Area = { id: 'area-2', nome: 'Estudos', cor: '#f59e0b', sistema: false, criadoEm: AREA.criadoEm }

const FOTO: FotoDoSprint = {
  total: 30,
  feitos: 30,
  percentual: 100,
  bonus: true,
  rotina: { diasComRotina: 0, diasCumpridos: 0, pontosPorDia: 40, total: 0, feitos: 0 },
  tarefas: { quantidade: 1, concluidas: 1, total: 30, feitos: 30 },
  recompensa: 'Pizza',
  detalhe: {
    tarefas: [
      { id: 'tar-1', titulo: 'Pintar', dia: '2026-11-18', hora: null, tempoEstimado: 60, dificuldade: 'DIFICIL', prioridade: 'ALTA', pontos: 30, pontosGanhos: 30, situacao: 'CONCLUIDA' },
    ],
    rotina: [],
  },
}

function sprint(situacao: 'ABERTO' | 'FECHADO'): Sprint {
  return {
    id: 'spr-1',
    inicio: '2026-11-16',
    fim: '2026-11-20',
    situacao,
    rotinaGeradaEm: null,
    criadoEm: '2026-01-01T00:00:00.000Z',
    recompensa: null,
    fechadoEm: situacao === 'FECHADO' ? '2026-11-21T02:59:00.000Z' : null,
    foto: situacao === 'FECHADO' ? FOTO : null,
    fechamentoAplicadoEm: situacao === 'FECHADO' ? '2026-11-21T02:59:05.000Z' : null,
  }
}

const CONCLUIDA: Tarefa = {
  id: 'tar-1',
  areaId: 'area-1',
  titulo: 'Pintar',
  dia: '2026-11-18',
  hora: null,
  tempoEstimado: 60,
  dificuldade: 'DIFICIL',
  prioridade: 'ALTA',
  notas: null,
  sprintId: 'spr-1',
  superTaskId: null,
  concluidaEm: '2026-11-18T14:00:00.000Z',
  concluida: true,
  atrasada: false,
  naoConcluidaNoSprintDe: null,
  arquivada: false,
  arquivadaEm: null,
  criadoEm: '2026-01-01T00:00:00.000Z',
}

function cenarioTarefa(tarefa: Tarefa, situacao: 'ABERTO' | 'FECHADO' | null) {
  const tarefas = criarTarefaRepositoryFake()
  const sprints = criarSprintRepositoryFake()
  const fecharVencidos = { execute: vi.fn().mockResolvedValue(0) }
  tarefas.buscarPorId.mockResolvedValue(tarefa)
  tarefas.remover.mockResolvedValue(undefined)
  tarefas.definirArquivamento.mockImplementation(async (_u: string, _id: string, quando: string | null) => ({
    ...tarefa,
    arquivada: quando !== null,
    arquivadaEm: quando,
  }))
  sprints.buscarPorId.mockResolvedValue(situacao ? sprint(situacao) : null)
  return { tarefas, sprints, fecharVencidos }
}

describe('RemoverArea com tarefas no sprint aberto (#73)', () => {
  function cenarioArea(noSprintAberto: number, total = 3) {
    const areas = criarAreaRepositoryFake()
    const fecharVencidos = { execute: vi.fn().mockResolvedValue(0) }
    areas.buscarPorId.mockImplementation(async (_u: string, id: string) => (id === AREA.id ? AREA : id === DESTINO.id ? DESTINO : null))
    areas.contarTarefas.mockResolvedValue(total)
    areas.contarTarefasNoSprintAberto.mockResolvedValue(noSprintAberto)
    return { areas, fecharVencidos, caso: new RemoverArea(areas, fecharVencidos) }
  }

  it.each([
    ['sem escolha', undefined],
    ['excluir junto', { acao: 'EXCLUIR' } as const],
    ['mover para outra área', { acao: 'MOVER', areaDestinoId: DESTINO.id } as const],
  ])('recusa com mensagem clara (%s) e não escreve nada', async (_nome, destino) => {
    const { areas, caso } = cenarioArea(2)

    const promessa = caso.execute(USER, AREA.id, destino, QUARTA)

    await expect(promessa).rejects.toBeInstanceOf(ConflictError)
    await expect(promessa).rejects.toThrow('tarefas no sprint aberto')
    expect(areas.moverTarefas).not.toHaveBeenCalled()
    expect(areas.removerTarefas).not.toHaveBeenCalled()
    expect(areas.remover).not.toHaveBeenCalled()
  })

  it('a trava vale mesmo quando só há uma tarefa concluída (ou filha de Super task) no sprint', async () => {
    // O repositório conta tarefas de qualquer estado cujo sprint esteja ABERTO.
    const { areas, caso } = cenarioArea(1, 1)
    await expect(caso.execute(USER, AREA.id, { acao: 'EXCLUIR' }, QUARTA)).rejects.toBeInstanceOf(ConflictError)
    expect(areas.remover).not.toHaveBeenCalled()
  })

  it('depois do fechamento libera: excluir junto', async () => {
    const { areas, caso } = cenarioArea(0)

    await caso.execute(USER, AREA.id, { acao: 'EXCLUIR' }, SABADO)

    expect(areas.removerTarefas).toHaveBeenCalledWith(USER, AREA.id)
    expect(areas.remover).toHaveBeenCalledWith(USER, AREA.id)
  })

  it('depois do fechamento libera: mover para outra área', async () => {
    const { areas, caso } = cenarioArea(0)

    await caso.execute(USER, AREA.id, { acao: 'MOVER', areaDestinoId: DESTINO.id }, SABADO)

    expect(areas.moverTarefas).toHaveBeenCalledWith(USER, AREA.id, DESTINO.id)
    expect(areas.remover).toHaveBeenCalledWith(USER, AREA.id)
  })

  it('fecha antes o sprint vencido (reserva do cron) e só então avalia a trava', async () => {
    const { areas, fecharVencidos, caso } = cenarioArea(0)
    const ordem: string[] = []
    fecharVencidos.execute.mockImplementation(async () => void ordem.push('fechar'))
    areas.contarTarefasNoSprintAberto.mockImplementation(async () => {
      ordem.push('contar')
      return 0
    })

    await caso.execute(USER, AREA.id, { acao: 'EXCLUIR' }, SABADO)

    expect(fecharVencidos.execute).toHaveBeenCalledWith(USER, SABADO)
    expect(ordem).toEqual(['fechar', 'contar'])
  })

  it('área sem tarefas segue livre', async () => {
    const { areas, caso } = cenarioArea(0, 0)
    await caso.execute(USER, AREA.id, undefined, QUARTA)
    expect(areas.remover).toHaveBeenCalledWith(USER, AREA.id)
  })
})

describe('tarefa concluída: excluir (#73)', () => {
  it('recusa enquanto o sprint dela está aberto, sem apagar nada', async () => {
    const { tarefas, sprints } = cenarioTarefa(CONCLUIDA, 'ABERTO')

    const promessa = new RemoverTarefa(tarefas, criarSuperTaskRepositoryFake(), sprints).execute(USER, 'tar-1', QUARTA)

    await expect(promessa).rejects.toBeInstanceOf(ConflictError)
    await expect(promessa).rejects.toThrow(MENSAGEM_CONCLUIDA_NO_SPRINT_ABERTO_NAO_EXCLUI)
    expect(tarefas.remover).not.toHaveBeenCalled()
    expect(sprints.buscarPorId).toHaveBeenCalledWith(USER, 'spr-1')
  })

  it('depois do fechamento libera (a concluída continua apontando para o sprint fechado)', async () => {
    const { tarefas, sprints } = cenarioTarefa(CONCLUIDA, 'FECHADO')
    await new RemoverTarefa(tarefas, criarSuperTaskRepositoryFake(), sprints).execute(USER, 'tar-1', SABADO)
    expect(tarefas.remover).toHaveBeenCalledWith(USER, 'tar-1')
  })

  it('concluída sem sprint (nenhum sprint aberto a proteger) também pode ser excluída', async () => {
    const { tarefas, sprints } = cenarioTarefa({ ...CONCLUIDA, sprintId: null }, null)
    await new RemoverTarefa(tarefas, criarSuperTaskRepositoryFake(), sprints).execute(USER, 'tar-1', SABADO)
    expect(tarefas.remover).toHaveBeenCalled()
    expect(sprints.buscarPorId).not.toHaveBeenCalled()
  })

  it('fecha antes o sprint vencido: não depende só do cron', async () => {
    const { tarefas, sprints, fecharVencidos } = cenarioTarefa(CONCLUIDA, 'FECHADO')
    await new RemoverTarefa(tarefas, criarSuperTaskRepositoryFake(), sprints, fecharVencidos).execute(USER, 'tar-1', SABADO)
    expect(fecharVencidos.execute).toHaveBeenCalledWith(USER, SABADO)
  })

  it('tarefa não concluída segue as travas de antes (dia passado no sprint)', async () => {
    const { tarefas, sprints } = cenarioTarefa({ ...CONCLUIDA, concluida: false, concluidaEm: null, dia: '2026-11-16' }, 'ABERTO')
    await expect(new RemoverTarefa(tarefas, criarSuperTaskRepositoryFake(), sprints).execute(USER, 'tar-1', QUARTA)).rejects.toBeInstanceOf(ConflictError)
    expect(tarefas.remover).not.toHaveBeenCalled()
  })
})

describe('tarefa concluída: arquivar (#73, ajusta a #70)', () => {
  it('recusa enquanto o sprint dela está aberto', async () => {
    const { tarefas, sprints } = cenarioTarefa(CONCLUIDA, 'ABERTO')

    const promessa = new ArquivarTarefa(tarefas, sprints).execute(USER, 'tar-1', QUARTA)

    await expect(promessa).rejects.toBeInstanceOf(ConflictError)
    await expect(promessa).rejects.toThrow(MENSAGEM_CONCLUIDA_NO_SPRINT_ABERTO_NAO_ARQUIVA)
    expect(tarefas.definirArquivamento).not.toHaveBeenCalled()
  })

  it('depois do fechamento arquiva, apesar de o dia já ter passado e de ela apontar para o sprint fechado', async () => {
    const { tarefas, sprints, fecharVencidos } = cenarioTarefa(CONCLUIDA, 'FECHADO')

    const arquivada = await new ArquivarTarefa(tarefas, sprints, fecharVencidos).execute(USER, 'tar-1', SABADO)

    expect(arquivada.arquivada).toBe(true)
    expect(tarefas.definirArquivamento).toHaveBeenCalledWith(USER, 'tar-1', SABADO.toISOString())
    expect(fecharVencidos.execute).toHaveBeenCalledWith(USER, SABADO)
  })

  it('já arquivada continua idempotente', async () => {
    const { tarefas, sprints } = cenarioTarefa({ ...CONCLUIDA, arquivada: true, arquivadaEm: '2026-11-22T00:00:00.000Z' }, 'FECHADO')
    await new ArquivarTarefa(tarefas, sprints).execute(USER, 'tar-1', SABADO)
    expect(tarefas.definirArquivamento).not.toHaveBeenCalled()
  })

  it('não concluída no sprint segue recusando (remova do sprint antes)', async () => {
    const { tarefas, sprints } = cenarioTarefa({ ...CONCLUIDA, concluida: false, concluidaEm: null, dia: '2026-11-19' }, 'ABERTO')
    await expect(new ArquivarTarefa(tarefas, sprints).execute(USER, 'tar-1', QUARTA)).rejects.toThrow('remova-a do sprint')
  })

  it('editar e mover de área seguem recusados em tarefa concluída, mesmo depois do fechamento', async () => {
    const { tarefas, sprints } = cenarioTarefa(CONCLUIDA, 'FECHADO')
    const edicao = { titulo: 'x', dia: null, hora: null, tempoEstimado: 60, dificuldade: 'MEDIA', prioridade: 'ALTA', notas: null } as const

    await expect(new AtualizarTarefa(tarefas, sprints).execute(USER, 'tar-1', edicao, SABADO)).rejects.toThrow(MENSAGEM_TAREFA_CONCLUIDA)
    await expect(new MoverTarefa(tarefas, criarAreaRepositoryFake()).execute(USER, 'tar-1', 'area-2', SABADO)).rejects.toThrow(MENSAGEM_TAREFA_CONCLUIDA)
    expect(tarefas.atualizar).not.toHaveBeenCalled()
    expect(tarefas.mover).not.toHaveBeenCalled()
  })
})

describe('foto e histórico depois de exclusões e arquivamentos (#73)', () => {
  beforeEach(() => vi.resetAllMocks())

  it('excluir ou arquivar depois do fechamento nunca toca o sprint nem a foto; o histórico segue completo', async () => {
    const tarefas = criarTarefaRepositoryFake()
    const sprints = criarSprintRepositoryFake()
    const areas = criarAreaRepositoryFake()
    const fechado = sprint('FECHADO')
    sprints.buscarPorId.mockResolvedValue(fechado)
    sprints.listarFechados.mockResolvedValue({ sprints: [fechado], total: 1 })
    tarefas.buscarPorId.mockResolvedValue(CONCLUIDA)
    tarefas.remover.mockResolvedValue(undefined)
    tarefas.definirArquivamento.mockResolvedValue({ ...CONCLUIDA, arquivada: true })
    areas.buscarPorId.mockResolvedValue(AREA)
    areas.contarTarefas.mockResolvedValue(1)
    areas.contarTarefasNoSprintAberto.mockResolvedValue(0)

    const historicoAntes = await new ListarHistoricoDeSprints(sprints).execute(USER, 1, 10)

    await new ArquivarTarefa(tarefas, sprints).execute(USER, 'tar-1', SABADO)
    await new RemoverTarefa(tarefas, criarSuperTaskRepositoryFake(), sprints).execute(USER, 'tar-1', SABADO)
    await new RemoverArea(areas).execute(USER, AREA.id, { acao: 'EXCLUIR' }, SABADO)

    const historicoDepois = await new ListarHistoricoDeSprints(sprints).execute(USER, 1, 10)
    expect(historicoDepois).toEqual(historicoAntes)
    expect(historicoDepois.items[0]!.tarefas.itens.map((item) => item.id)).toEqual(['tar-1'])
    expect(historicoDepois.items[0]!.total).toBe(30)
    // Nada que escreve no sprint foi chamado: a foto é só leitura depois do fechamento.
    expect(sprints.fechar).not.toHaveBeenCalled()
    expect(sprints.definirRecompensa).not.toHaveBeenCalled()
    expect(sprints.marcarFechamentoAplicado).not.toHaveBeenCalled()
    expect(fechado.foto).toBe(FOTO)
    expect(FOTO.detalhe.tarefas).toHaveLength(1)
  })
})
