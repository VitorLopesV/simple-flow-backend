import type { ID } from '../../shared/types/common'
import type { FiltroTarefas, Tarefa, TarefaEdicao, TarefaPayload } from '../entities/Tarefa'

export interface TarefaRepository {
  /** Mais recentes primeiro. */
  listar(userId: ID, filtro: FiltroTarefas): Promise<Tarefa[]>
  buscarPorId(userId: ID, id: ID): Promise<Tarefa | null>
  /** `sprintId` entra na mesma escrita quando a criação já coloca a tarefa no sprint. */
  criar(userId: ID, payload: TarefaPayload, sprintId?: ID): Promise<Tarefa>
  /** `sprintId` omitido = mantém o vínculo atual; `null` tira do sprint. */
  atualizar(userId: ID, id: ID, edicao: TarefaEdicao, sprintId?: ID | null): Promise<Tarefa>
  /** Entra (`sprintId` + `dia`) ou sai (`null`, mantendo o dia) do sprint. */
  definirSprint(userId: ID, id: ID, vinculo: { sprintId: ID | null; dia?: string }): Promise<Tarefa>
  /** Grava `concluida_em`; só preenche se ainda não houver conclusão (ela é definitiva). */
  concluir(userId: ID, id: ID, concluidaEm: string): Promise<Tarefa>
  mover(userId: ID, id: ID, areaId: ID): Promise<Tarefa>
  /** `null` desarquiva. */
  definirArquivamento(userId: ID, id: ID, arquivadaEm: string | null): Promise<Tarefa>
  remover(userId: ID, id: ID): Promise<void>
}
