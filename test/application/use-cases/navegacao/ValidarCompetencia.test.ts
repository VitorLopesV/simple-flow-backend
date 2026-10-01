import { describe, expect, it } from 'vitest'

import { ValidarCompetencia } from '../../../../src/application/use-cases/navegacao/ValidarCompetencia'
import { ValidationError } from '../../../../src/domain/errors/DomainError'
import { criarNavegacaoRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const SETEMBRO = () => new Date('2026-09-15T15:00:00.000Z')

function validar(primeiraData: string | null) {
  const repositorio = criarNavegacaoRepositoryFake()
  repositorio.primeiraDataComDados.mockResolvedValue(primeiraData)
  return new ValidarCompetencia(repositorio, SETEMBRO)
}

describe('ValidarCompetencia', () => {
  it.each(['2026-01', '2026-05', '2026-09', '2026-10'])('aceita %s (dentro de 2026-01 a 2026-10)', async (competencia) => {
    await expect(validar('2026-01-20').execute(USER_ID, competencia)).resolves.toBeUndefined()
  })

  it.each(['2025-12', '2026-11'])('rejeita %s com 422 e o intervalo permitido na mensagem', async (competencia) => {
    const execucao = validar('2026-01-20').execute(USER_ID, competencia)

    await expect(execucao).rejects.toBeInstanceOf(ValidationError)
    await expect(execucao).rejects.toThrow('Competência fora do intervalo permitido (2026-01 a 2026-10).')
  })

  it('usuário sem dados: aceita só o mês atual e o seguinte', async () => {
    await expect(validar(null).execute(USER_ID, '2026-09')).resolves.toBeUndefined()
    await expect(validar(null).execute(USER_ID, '2026-10')).resolves.toBeUndefined()
    await expect(validar(null).execute(USER_ID, '2026-08')).rejects.toBeInstanceOf(ValidationError)
  })
})
