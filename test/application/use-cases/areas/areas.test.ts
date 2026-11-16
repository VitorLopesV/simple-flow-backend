import { describe, expect, it } from 'vitest'

import { AtualizarArea } from '../../../../src/application/use-cases/areas/AtualizarArea'
import { CriarArea } from '../../../../src/application/use-cases/areas/CriarArea'
import { ListarAreas } from '../../../../src/application/use-cases/areas/ListarAreas'
import { RemoverArea } from '../../../../src/application/use-cases/areas/RemoverArea'
import type { Area } from '../../../../src/domain/entities/Area'
import { ConflictError, NotFoundError, ValidationError } from '../../../../src/domain/errors/DomainError'
import { criarAreaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const PAYLOAD = { nome: 'Estudos', cor: '#10b981' }
const AREA: Area = { id: 'area-1', ...PAYLOAD, sistema: false, criadoEm: '2026-01-01T00:00:00.000Z' }
const ROTINA: Area = { id: 'rotina', nome: 'Rotina', cor: '#6366f1', sistema: true, criadoEm: AREA.criadoEm }
const DESTINO: Area = { id: 'area-2', nome: 'Casa', cor: '#f59e0b', sistema: false, criadoEm: AREA.criadoEm }

describe('ListarAreas', () => {
  it('lista as áreas do usuário', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.listar.mockResolvedValue([ROTINA, AREA])

    await expect(new ListarAreas(repositorio).execute(USER_ID)).resolves.toEqual([ROTINA, AREA])
    expect(repositorio.listar).toHaveBeenCalledWith(USER_ID)
  })
})

describe('CriarArea', () => {
  it('cria quando o nome está livre', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.buscarPorNome.mockResolvedValue(null)
    repositorio.criar.mockResolvedValue(AREA)

    await expect(new CriarArea(repositorio).execute(USER_ID, PAYLOAD)).resolves.toBe(AREA)
    expect(repositorio.buscarPorNome).toHaveBeenCalledWith(USER_ID, 'Estudos')
    expect(repositorio.criar).toHaveBeenCalledWith(USER_ID, PAYLOAD)
  })

  it('recusa nome repetido (inclusive "Rotina") com ConflictError', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.buscarPorNome.mockResolvedValue(ROTINA)

    const promessa = new CriarArea(repositorio).execute(USER_ID, { nome: 'rotina', cor: '#000000' })

    await expect(promessa).rejects.toBeInstanceOf(ConflictError)
    expect(repositorio.criar).not.toHaveBeenCalled()
  })
})

describe('AtualizarArea', () => {
  it('atualiza a área', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(AREA)
    repositorio.buscarPorNome.mockResolvedValue(null)
    repositorio.atualizar.mockResolvedValue({ ...AREA, cor: '#000000' })

    const area = await new AtualizarArea(repositorio).execute(USER_ID, AREA.id, { nome: 'Estudos', cor: '#000000' })

    expect(area.cor).toBe('#000000')
    expect(repositorio.atualizar).toHaveBeenCalledWith(USER_ID, AREA.id, { nome: 'Estudos', cor: '#000000' })
  })

  it('permite manter o próprio nome (a busca por nome devolve a mesma área)', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(AREA)
    repositorio.buscarPorNome.mockResolvedValue(AREA)
    repositorio.atualizar.mockResolvedValue(AREA)

    await expect(new AtualizarArea(repositorio).execute(USER_ID, AREA.id, PAYLOAD)).resolves.toBe(AREA)
  })

  it('lança NotFoundError se a área não existe', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(null)

    await expect(new AtualizarArea(repositorio).execute(USER_ID, 'x', PAYLOAD)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('recusa renomear a Rotina', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(ROTINA)

    const promessa = new AtualizarArea(repositorio).execute(USER_ID, ROTINA.id, PAYLOAD)

    await expect(promessa).rejects.toBeInstanceOf(ConflictError)
    expect(repositorio.atualizar).not.toHaveBeenCalled()
  })

  it('recusa nome já usado por outra área', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(AREA)
    repositorio.buscarPorNome.mockResolvedValue(DESTINO)

    const promessa = new AtualizarArea(repositorio).execute(USER_ID, AREA.id, { nome: 'Casa', cor: '#000000' })

    await expect(promessa).rejects.toBeInstanceOf(ConflictError)
    expect(repositorio.atualizar).not.toHaveBeenCalled()
  })
})

describe('RemoverArea', () => {
  it('lança NotFoundError se a área não existe', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(null)

    await expect(new RemoverArea(repositorio).execute(USER_ID, 'x')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('recusa excluir a Rotina', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(ROTINA)

    await expect(new RemoverArea(repositorio).execute(USER_ID, ROTINA.id)).rejects.toBeInstanceOf(ConflictError)
    expect(repositorio.remover).not.toHaveBeenCalled()
  })

  it('remove direto uma área sem tarefas', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(AREA)
    repositorio.contarTarefas.mockResolvedValue(0)

    await new RemoverArea(repositorio).execute(USER_ID, AREA.id)

    expect(repositorio.remover).toHaveBeenCalledWith(USER_ID, AREA.id)
    expect(repositorio.moverTarefas).not.toHaveBeenCalled()
  })

  it('recusa área com tarefas sem escolha de destino, sem escrever nada', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(AREA)
    repositorio.contarTarefas.mockResolvedValue(3)

    await expect(new RemoverArea(repositorio).execute(USER_ID, AREA.id)).rejects.toBeInstanceOf(ConflictError)
    expect(repositorio.remover).not.toHaveBeenCalled()
    expect(repositorio.removerTarefas).not.toHaveBeenCalled()
  })

  it('exclui as tarefas junto e depois a área', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(AREA)
    repositorio.contarTarefas.mockResolvedValue(3)

    await new RemoverArea(repositorio).execute(USER_ID, AREA.id, { acao: 'EXCLUIR' })

    expect(repositorio.removerTarefas).toHaveBeenCalledWith(USER_ID, AREA.id)
    expect(repositorio.remover).toHaveBeenCalledWith(USER_ID, AREA.id)
  })

  it('move as tarefas para a área de destino e depois exclui', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValueOnce(AREA).mockResolvedValueOnce(DESTINO)
    repositorio.contarTarefas.mockResolvedValue(3)

    await new RemoverArea(repositorio).execute(USER_ID, AREA.id, { acao: 'MOVER', areaDestinoId: DESTINO.id })

    expect(repositorio.moverTarefas).toHaveBeenCalledWith(USER_ID, AREA.id, DESTINO.id)
    expect(repositorio.remover).toHaveBeenCalledWith(USER_ID, AREA.id)
  })

  it('recusa mover para a própria área', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(AREA)
    repositorio.contarTarefas.mockResolvedValue(1)

    const promessa = new RemoverArea(repositorio).execute(USER_ID, AREA.id, { acao: 'MOVER', areaDestinoId: AREA.id })

    await expect(promessa).rejects.toBeInstanceOf(ValidationError)
  })

  it('recusa destino inexistente', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValueOnce(AREA).mockResolvedValueOnce(null)
    repositorio.contarTarefas.mockResolvedValue(1)

    const promessa = new RemoverArea(repositorio).execute(USER_ID, AREA.id, { acao: 'MOVER', areaDestinoId: 'x' })

    await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
    expect(repositorio.remover).not.toHaveBeenCalled()
  })

  it('recusa mover tarefas para a Rotina', async () => {
    const repositorio = criarAreaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValueOnce(AREA).mockResolvedValueOnce(ROTINA)
    repositorio.contarTarefas.mockResolvedValue(1)

    const promessa = new RemoverArea(repositorio).execute(USER_ID, AREA.id, { acao: 'MOVER', areaDestinoId: ROTINA.id })

    await expect(promessa).rejects.toBeInstanceOf(ValidationError)
    expect(repositorio.moverTarefas).not.toHaveBeenCalled()
  })
})
