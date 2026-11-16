import { describe, expect, it } from 'vitest'

import { AtualizarItemRotina } from '../../../../src/application/use-cases/rotinas/AtualizarItemRotina'
import { CriarItemRotina } from '../../../../src/application/use-cases/rotinas/CriarItemRotina'
import { ListarItensRotina } from '../../../../src/application/use-cases/rotinas/ListarItensRotina'
import { RemoverItemRotina } from '../../../../src/application/use-cases/rotinas/RemoverItemRotina'
import type { Area } from '../../../../src/domain/entities/Area'
import type { ItemRotina, ItemRotinaPayload } from '../../../../src/domain/entities/ItemRotina'
import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { criarAreaRepositoryFake, criarItemRotinaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const PAYLOAD: ItemRotinaPayload = {
  nome: 'Remédio',
  repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1, 3] },
  vezes: [{ hora: '08:00' }, { hora: '20:00' }],
}
const ITEM: ItemRotina = { id: 'rot-1', areaId: 'rotina', ...PAYLOAD, criadoEm: '2026-01-01T00:00:00.000Z' }
const AREA: Area = { id: 'casa', nome: 'Casa', cor: '#f59e0b', sistema: false, criadoEm: ITEM.criadoEm }
const ROTINA: Area = { ...AREA, id: 'rotina', nome: 'Rotina', sistema: true }

describe('ListarItensRotina', () => {
  it('lista os itens do usuário', async () => {
    const repo = criarItemRotinaRepositoryFake()
    repo.listar.mockResolvedValue([ITEM])

    await expect(new ListarItensRotina(repo).execute(USER_ID)).resolves.toEqual([ITEM])
    expect(repo.listar).toHaveBeenCalledWith(USER_ID)
  })
})

describe('CriarItemRotina', () => {
  it('grava na área Rotina do usuário', async () => {
    const repo = criarItemRotinaRepositoryFake()
    const areas = criarAreaRepositoryFake()
    areas.listar.mockResolvedValue([ROTINA, AREA])
    repo.criar.mockResolvedValue(ITEM)

    await expect(new CriarItemRotina(repo, areas).execute(USER_ID, PAYLOAD)).resolves.toBe(ITEM)
    expect(repo.criar).toHaveBeenCalledWith(USER_ID, 'rotina', PAYLOAD)
  })

  it('NotFoundError quando o usuário não tem a área Rotina', async () => {
    const repo = criarItemRotinaRepositoryFake()
    const areas = criarAreaRepositoryFake()
    areas.listar.mockResolvedValue([AREA])

    await expect(new CriarItemRotina(repo, areas).execute(USER_ID, PAYLOAD)).rejects.toBeInstanceOf(NotFoundError)
    expect(repo.criar).not.toHaveBeenCalled()
  })
})

describe('AtualizarItemRotina', () => {
  it('atualiza o item existente', async () => {
    const repo = criarItemRotinaRepositoryFake()
    repo.buscarPorId.mockResolvedValue(ITEM)
    repo.atualizar.mockResolvedValue(ITEM)

    await expect(new AtualizarItemRotina(repo).execute(USER_ID, 'rot-1', PAYLOAD)).resolves.toBe(ITEM)
    expect(repo.atualizar).toHaveBeenCalledWith(USER_ID, 'rot-1', PAYLOAD)
  })

  it('NotFoundError quando o item não existe, sem escrever', async () => {
    const repo = criarItemRotinaRepositoryFake()
    repo.buscarPorId.mockResolvedValue(null)

    await expect(new AtualizarItemRotina(repo).execute(USER_ID, 'x', PAYLOAD)).rejects.toBeInstanceOf(NotFoundError)
    expect(repo.atualizar).not.toHaveBeenCalled()
  })
})

describe('RemoverItemRotina', () => {
  it('remove o item existente', async () => {
    const repo = criarItemRotinaRepositoryFake()
    repo.buscarPorId.mockResolvedValue(ITEM)

    await new RemoverItemRotina(repo).execute(USER_ID, 'rot-1')
    expect(repo.remover).toHaveBeenCalledWith(USER_ID, 'rot-1')
  })

  it('NotFoundError quando o item não existe, sem remover', async () => {
    const repo = criarItemRotinaRepositoryFake()
    repo.buscarPorId.mockResolvedValue(null)

    await expect(new RemoverItemRotina(repo).execute(USER_ID, 'x')).rejects.toBeInstanceOf(NotFoundError)
    expect(repo.remover).not.toHaveBeenCalled()
  })
})
