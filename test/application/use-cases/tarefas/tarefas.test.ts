import { afterEach, describe, expect, it, vi } from 'vitest'

import { ArquivarTarefa } from '../../../../src/application/use-cases/tarefas/ArquivarTarefa'
import { AtualizarTarefa } from '../../../../src/application/use-cases/tarefas/AtualizarTarefa'
import { CriarTarefa } from '../../../../src/application/use-cases/tarefas/CriarTarefa'
import { DesarquivarTarefa } from '../../../../src/application/use-cases/tarefas/DesarquivarTarefa'
import { ListarTarefas } from '../../../../src/application/use-cases/tarefas/ListarTarefas'
import { MoverTarefa } from '../../../../src/application/use-cases/tarefas/MoverTarefa'
import { RemoverTarefa } from '../../../../src/application/use-cases/tarefas/RemoverTarefa'
import type { Area } from '../../../../src/domain/entities/Area'
import type { Tarefa, TarefaEdicao } from '../../../../src/domain/entities/Tarefa'
import { NotFoundError, ValidationError } from '../../../../src/domain/errors/DomainError'
import { criarAreaRepositoryFake, criarTarefaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const EDICAO: TarefaEdicao = {
  titulo: 'Pintar a casa',
  dia: null,
  hora: null,
  tempoEstimado: null,
  dificuldade: null,
  prioridade: null,
  notas: null,
}
const TAREFA: Tarefa = {
  id: 'tar-1',
  areaId: 'area-1',
  ...EDICAO,
  arquivada: false,
  arquivadaEm: null,
  criadoEm: '2026-01-01T00:00:00.000Z',
}
const ARQUIVADA: Tarefa = { ...TAREFA, arquivada: true, arquivadaEm: '2026-02-01T00:00:00.000Z' }
const AREA: Area = { id: 'area-1', nome: 'Casa', cor: '#f59e0b', sistema: false, criadoEm: TAREFA.criadoEm }
const OUTRA: Area = { ...AREA, id: 'area-2', nome: 'Estudos' }
const ROTINA: Area = { ...AREA, id: 'rotina', nome: 'Rotina', sistema: true }

afterEach(() => vi.useRealTimers())

describe('ListarTarefas', () => {
  it('repassa o filtro ao repositório', async () => {
    const repositorio = criarTarefaRepositoryFake()
    repositorio.listar.mockResolvedValue([TAREFA])
    const filtro = { areaId: 'area-1', incluirArquivadas: false }

    await expect(new ListarTarefas(repositorio).execute(USER_ID, filtro)).resolves.toEqual([TAREFA])
    expect(repositorio.listar).toHaveBeenCalledWith(USER_ID, filtro)
  })
})

describe('CriarTarefa', () => {
  const payload = { ...EDICAO, areaId: 'area-1' }

  it('cria na área existente que não é a Rotina', async () => {
    const tarefas = criarTarefaRepositoryFake()
    const areas = criarAreaRepositoryFake()
    areas.buscarPorId.mockResolvedValue(AREA)
    tarefas.criar.mockResolvedValue(TAREFA)

    await expect(new CriarTarefa(tarefas, areas).execute(USER_ID, payload)).resolves.toBe(TAREFA)
    expect(areas.buscarPorId).toHaveBeenCalledWith(USER_ID, 'area-1')
    expect(tarefas.criar).toHaveBeenCalledWith(USER_ID, payload)
  })

  it('lança NotFoundError quando a área não existe', async () => {
    const tarefas = criarTarefaRepositoryFake()
    const areas = criarAreaRepositoryFake()
    areas.buscarPorId.mockResolvedValue(null)

    await expect(new CriarTarefa(tarefas, areas).execute(USER_ID, payload)).rejects.toBeInstanceOf(NotFoundError)
    expect(tarefas.criar).not.toHaveBeenCalled()
  })

  it('recusa criar na Rotina com ValidationError', async () => {
    const tarefas = criarTarefaRepositoryFake()
    const areas = criarAreaRepositoryFake()
    areas.buscarPorId.mockResolvedValue(ROTINA)

    await expect(new CriarTarefa(tarefas, areas).execute(USER_ID, payload)).rejects.toBeInstanceOf(ValidationError)
    expect(tarefas.criar).not.toHaveBeenCalled()
  })
})

describe('AtualizarTarefa', () => {
  it('atualiza a tarefa existente', async () => {
    const repositorio = criarTarefaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(TAREFA)
    repositorio.atualizar.mockResolvedValue(TAREFA)

    await expect(new AtualizarTarefa(repositorio).execute(USER_ID, 'tar-1', EDICAO)).resolves.toBe(TAREFA)
    expect(repositorio.atualizar).toHaveBeenCalledWith(USER_ID, 'tar-1', EDICAO)
  })

  it('lança NotFoundError quando a tarefa não existe', async () => {
    const repositorio = criarTarefaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(null)

    await expect(new AtualizarTarefa(repositorio).execute(USER_ID, 'x', EDICAO)).rejects.toBeInstanceOf(NotFoundError)
    expect(repositorio.atualizar).not.toHaveBeenCalled()
  })
})

describe('MoverTarefa', () => {
  function cenario(origem: Area | null, destino: Area | null, tarefa: Tarefa | null = TAREFA) {
    const tarefas = criarTarefaRepositoryFake()
    const areas = criarAreaRepositoryFake()
    tarefas.buscarPorId.mockResolvedValue(tarefa)
    // A origem é a área atual da tarefa; qualquer outro id consultado é o destino.
    areas.buscarPorId.mockImplementation(async (_u: string, id: string) => (id === TAREFA.areaId ? origem : destino))
    tarefas.mover.mockResolvedValue({ ...TAREFA, areaId: 'area-2' })
    return { tarefas, areas, caso: new MoverTarefa(tarefas, areas) }
  }

  it('move para outra área comum', async () => {
    const { tarefas, caso } = cenario(AREA, OUTRA)

    await expect(caso.execute(USER_ID, 'tar-1', 'area-2')).resolves.toMatchObject({ areaId: 'area-2' })
    expect(tarefas.mover).toHaveBeenCalledWith(USER_ID, 'tar-1', 'area-2')
  })

  it('não escreve quando já está na área de destino', async () => {
    const { tarefas, caso } = cenario(AREA, AREA)

    await expect(caso.execute(USER_ID, 'tar-1', 'area-1')).resolves.toBe(TAREFA)
    expect(tarefas.mover).not.toHaveBeenCalled()
  })

  it('lança NotFoundError para tarefa inexistente', async () => {
    const { tarefas, caso } = cenario(AREA, OUTRA, null)

    await expect(caso.execute(USER_ID, 'x', 'area-2')).rejects.toBeInstanceOf(NotFoundError)
    expect(tarefas.mover).not.toHaveBeenCalled()
  })

  it('lança NotFoundError para área de destino inexistente', async () => {
    const { tarefas, caso } = cenario(AREA, null)

    await expect(caso.execute(USER_ID, 'tar-1', 'area-9')).rejects.toBeInstanceOf(NotFoundError)
    expect(tarefas.mover).not.toHaveBeenCalled()
  })

  it('recusa mover para a Rotina', async () => {
    const { tarefas, caso } = cenario(AREA, ROTINA)

    await expect(caso.execute(USER_ID, 'tar-1', 'rotina')).rejects.toBeInstanceOf(ValidationError)
    expect(tarefas.mover).not.toHaveBeenCalled()
  })

  it('recusa mover para fora da Rotina', async () => {
    const { tarefas, caso } = cenario(ROTINA, OUTRA)

    await expect(caso.execute(USER_ID, 'tar-1', 'area-2')).rejects.toBeInstanceOf(ValidationError)
    expect(tarefas.mover).not.toHaveBeenCalled()
  })

  it('segue quando a área de origem não é mais encontrada', async () => {
    const { tarefas, caso } = cenario(null, OUTRA)

    await caso.execute(USER_ID, 'tar-1', 'area-2')
    expect(tarefas.mover).toHaveBeenCalled()
  })
})

describe('ArquivarTarefa', () => {
  it('arquiva com a data de agora', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-01T10:00:00.000Z'))
    const repositorio = criarTarefaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(TAREFA)
    repositorio.definirArquivamento.mockResolvedValue(ARQUIVADA)

    await expect(new ArquivarTarefa(repositorio).execute(USER_ID, 'tar-1')).resolves.toBe(ARQUIVADA)
    expect(repositorio.definirArquivamento).toHaveBeenCalledWith(USER_ID, 'tar-1', '2026-03-01T10:00:00.000Z')
  })

  it('é idempotente: já arquivada não é reescrita', async () => {
    const repositorio = criarTarefaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(ARQUIVADA)

    await expect(new ArquivarTarefa(repositorio).execute(USER_ID, 'tar-1')).resolves.toBe(ARQUIVADA)
    expect(repositorio.definirArquivamento).not.toHaveBeenCalled()
  })

  it('lança NotFoundError para tarefa inexistente', async () => {
    const repositorio = criarTarefaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(null)

    await expect(new ArquivarTarefa(repositorio).execute(USER_ID, 'x')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('DesarquivarTarefa', () => {
  it('desarquiva limpando a data', async () => {
    const repositorio = criarTarefaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(ARQUIVADA)
    repositorio.definirArquivamento.mockResolvedValue(TAREFA)

    await expect(new DesarquivarTarefa(repositorio).execute(USER_ID, 'tar-1')).resolves.toBe(TAREFA)
    expect(repositorio.definirArquivamento).toHaveBeenCalledWith(USER_ID, 'tar-1', null)
  })

  it('é idempotente: não arquivada não é reescrita', async () => {
    const repositorio = criarTarefaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(TAREFA)

    await expect(new DesarquivarTarefa(repositorio).execute(USER_ID, 'tar-1')).resolves.toBe(TAREFA)
    expect(repositorio.definirArquivamento).not.toHaveBeenCalled()
  })

  it('lança NotFoundError para tarefa inexistente', async () => {
    const repositorio = criarTarefaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(null)

    await expect(new DesarquivarTarefa(repositorio).execute(USER_ID, 'x')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('RemoverTarefa', () => {
  it('remove a tarefa existente', async () => {
    const repositorio = criarTarefaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(TAREFA)
    repositorio.remover.mockResolvedValue(undefined)

    await new RemoverTarefa(repositorio).execute(USER_ID, 'tar-1')
    expect(repositorio.remover).toHaveBeenCalledWith(USER_ID, 'tar-1')
  })

  it('lança NotFoundError para tarefa inexistente', async () => {
    const repositorio = criarTarefaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(null)

    await expect(new RemoverTarefa(repositorio).execute(USER_ID, 'x')).rejects.toBeInstanceOf(NotFoundError)
    expect(repositorio.remover).not.toHaveBeenCalled()
  })
})
