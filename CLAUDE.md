# CLAUDE.md — Backend (SimpleFlow)

## Stack

- TypeScript 5.7 (`strict: true`), Node >= 20.19, **CommonJS** (não ESM, apesar do target ES2022).
- Express 4.
- Supabase (`@supabase/supabase-js`) como banco (Postgres via PostgREST) e Auth — **sem ORM**.
- Zod para validação de entrada.
- `serverless-http` para rodar o Express como function na Vercel (`api/index.ts`).
- Testes: Vitest instalado (`npm test`), mas **nenhum teste existe ainda** — cobertura 0%.
- **Sem ESLint/Prettier configurados.** Consistência de estilo é só por convenção — siga o código existente à risca.
- Parte de um monorepo com workspaces npm (raiz define `workspaces: ["frontend", "backend"]`); não crie um `package-lock.json` dentro de `backend/`.

## Arquitetura — Clean Architecture, 4 camadas

Fluxo de dependência: `presentation → application → domain ← infrastructure`.

```
src/
├── domain/                # entidades (interfaces) + interfaces de repositório + erros. Zero import externo.
├── application/use-cases/ # uma classe por ação, agrupada por subdomínio (auth/cartoes/categorias/dashboard/entradas/saidas)
├── infrastructure/        # implementações concretas (Supabase) das interfaces do domain
└── presentation/http/     # controllers, routes, middlewares, schemas Zod
```

Não há container de DI — a composição é manual dentro de cada controller (instancia repositório + use-case por request).

### Ao adicionar um recurso novo, replique exatamente este fluxo (use `entradas` como referência):

1. **Entidade** em `src/domain/entities/X.ts` (interface pura).
2. **Interface de repositório** em `src/domain/repositories/XRepository.ts`.
3. **Use-cases** em `src/application/use-cases/x/` — uma classe por ação (`CriarX`, `ListarX`, `AtualizarX`, `RemoverX`), construtor recebe o repositório por injeção, método `execute(...)`.
4. **Implementação Supabase** em `src/infrastructure/supabase/repositories/SupabaseXRepository.ts` — mapeamento manual row (snake_case) ↔ entidade (camelCase) via funções `paraX`/`paraLinha` locais no topo do arquivo.
5. **Schema Zod** em `src/presentation/http/schemas/x.schema.ts`.
6. **Controller** em `src/presentation/http/controllers/xController.ts` — objeto literal com métodos async (`listar`, `criar`, `atualizar`, `remover`), cada um instanciando o repositório (`new SupabaseXRepository(req.supabase!)`) e a use-case.
7. **Rotas** em `src/presentation/http/routes/x.routes.ts` — `router.use(authMiddleware)` no topo (a menos que a rota seja pública), `validate(schema, alvo)` por rota, handler envolto em `asyncHandler(...)`.
8. Registrar o router em `src/presentation/http/routes/index.ts`.

## Multi-tenancy — a regra mais importante do projeto

Isolamento em **dupla camada**, nunca remover nenhuma das duas:
1. RLS no Postgres (`user_id = auth.uid()` em toda tabela de domínio).
2. Filtro explícito `.eq('user_id', userId)` em toda query de repositório, mesmo já havendo RLS.

Três clients Supabase distintos — nunca misturar:
- `supabaseAdminClient` (service role) — **uso exclusivo** de `SupabaseAuthService.registrar` (criação de usuário). Nunca usar em repositórios de dados.
- `supabaseAnonClient()` — login/refresh/validação de token.
- `supabaseClientForRequest(accessToken)` — injetado em `req.supabase` pelo `authMiddleware`; é o client que todo repositório de dados deve usar (garante que `auth.uid()` resolve certo e o RLS funciona).

## Autenticação

- `authMiddleware` extrai `Bearer <token>` do header `Authorization`, popula `req.usuario` e `req.supabase`, lança `UnauthorizedError` (401) se ausente.
- Toda rota protegida usa `router.use(authMiddleware)` antes das definições de rota — controllers acessam `req.usuario!`/`req.supabase!` com non-null assertion, assumindo isso.
- Rotas públicas: `POST /auth/registro`, `POST /auth/login`, `POST /auth/refresh`.

## Tratamento de erros

- Hierarquia em `src/domain/errors/DomainError.ts`: `NotFoundError` (404), `ValidationError` (422), `UnauthorizedError` (401), `ConflictError` (409). Lance essas classes diretamente em use-cases/repositórios — nunca `throw new Error(...)` genérico para erros de negócio.
- `errorHandler` central (registrado por último em `app.ts`) trata `DomainError`, `ZodError` (422, usa a mensagem do primeiro issue) e qualquer outro erro (`console.error` + 500 genérico `{ message: 'Erro interno do servidor.' }` — nunca vaza stack trace).
- Todo handler de controller **deve** ser envolto em `asyncHandler(...)` (Express 4 não repassa rejeições de async automaticamente).
- Formato de erro `{ message: string }` é contrato fixo com `frontend/src/services/http.ts` — não mudar sem atualizar os dois lados.

## Validação (Zod)

- Um schema por recurso em `src/presentation/http/schemas/`, aplicado via middleware `validate(schema, alvo)` (`alvo`: `'body' | 'query' | 'params'`, default `'body'`).
- Query params numéricos: `z.coerce.number()` com `.default(...)`.
- Datas: validadas por **regex**, não `z.date()` — `YYYY-MM-DD` para datas, `YYYY-MM` para competência.
- IDs: `z.string().uuid(...)`.
- Regras condicionais via `.refine()`, quando um campo só faz sentido junto com outro.
- Mensagens de erro em português, por campo.

## Convenções de nomenclatura e estilo

- **Domínio de negócio em português**: entidades, campos, use-cases, controllers, mensagens de erro, variáveis (`Entrada`, `Saida`, `CriarEntrada`, `req.usuario`). Nomes técnicos genéricos ficam em inglês (`Repository`, `Router`, `middleware`).
- Use-cases: PascalCase verbo+substantivo, uma classe por arquivo.
- Controllers: objeto literal (não classe) com métodos async por ação.
- Imports sempre **relativos** — não há path aliases configurados no `tsconfig.json`.
- Comentários JSDoc curtos explicando o "porquê" de decisões não óbvias, em português — siga esse estilo, não documente o óbvio.
- Entidades de domínio são só `interface`s TS sem comportamento; tipos `*Payload` derivam via `Omit<Entidade, 'id'|'criadoEm'|...>`.

## Variáveis de ambiente

Carregadas via flag nativa do Node `--env-file=.env` (sem `dotenv`), validadas em `src/infrastructure/config/env.ts` (falha rápido no boot se faltar).

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — obrigatórias. **Nunca commitar, logar ou expor ao frontend a service role key.**
- `PORT` — opcional, default `3000`.
- `NODE_ENV` — opcional, default `development`.
- `CORS_ORIGINS` — opcional, lista separada por vírgula sem espaços, default `http://localhost:5173` (o frontend real roda na porta `5180` — confira `CORS_ORIGINS` no `.env` local antes de debugar CORS).

## Banco de dados / migrations

- Migrations SQL versionadas em `supabase/migrations/`, aplicadas via Supabase CLI/dashboard — não há migration runner no código Node.
- Ao criar tabela nova: adicionar RLS policy (`user_id = auth.uid()`, ou `user_id is null or user_id = auth.uid()` se houver registros "do sistema"), e trigger `set_atualizado_em` se a tabela tiver esse campo.
- Ao criar function/trigger nova: rodar o Security Advisor do Supabase depois e corrigir achados (o projeto já tem uma migration `fix_security_advisors` fazendo isso — é hábito esperado, não exceção).
- Sem ORM: repositórios usam o query builder do `supabase-js` (`.from().select().eq()...`), com `throw error` manual e mapeamento row↔entidade escrito à mão.

## Regra de negócio não óbvia: fatura de cartão

Gasto no cartão **não** é uma linha em `saidas`. Ele é lançado direto no cartão (`POST /cartoes/:cartaoId/transacoes` → `transacoes_cartao`, mesmo formato de uma saída, sem forma de pagamento nem situação próprias) e a fatura da competência é criada como `ABERTA` na primeira transação do mês. Por isso `saidaPayloadSchema` **não aceita** `formaPagamento: 'CARTAO_CREDITO'`.

Na aba Saídas o cartão aparece como **uma saída derivada por fatura** (`paraSaidaDeFatura` em `SupabaseSaidaRepository`, alimentada por `FaturaRepository.listarVencendoNoPeriodo`): id `sai_fat_<faturaId>`, data = vencimento, valor lido ao vivo, `automatica: true`. Nunca é persistida — editar/remover só pela aba Cartões. `AtualizarSaida`/`RemoverSaida` continuam bloqueando (`ConflictError`, 409) linhas com `automatica: true`; preserve essa proteção.

O `total` de `faturas` é sempre recalculado como a soma das transações (`recalcularTotal`), nunca por delta.

## Testes

Não há suíte ainda. Ao adicionar testes, usar Vitest (já instalado) e seguir a estrutura de camadas do projeto (testar use-cases isolando repositórios via mock/fake da interface do domain, não o client Supabase real).

## Scripts

```
npm run dev          # tsx watch --env-file=.env src/server.ts
npm run build         # tsc
npm run start         # node --env-file=.env dist/src/server.js
npm run type-check    # tsc --noEmit
npm test              # vitest run
```

Do monorepo raiz: `npm run dev:backend`, `npm run build:backend`, `npm run type-check:backend`.

## Deploy

Vercel, projeto separado do frontend (root directory `backend/`), function em `api/index.ts`. Detalhes completos em [`../DEPLOY.md`](../DEPLOY.md). Pontos a lembrar:
- Marcar "Include source files outside of the Root Directory" (monorepo com workspaces).
- Após mudar `CORS_ORIGINS`, é preciso **redeployar manualmente** — a env var não reinicia a function sozinha.
- Preview deployments do frontend não passam no CORS por padrão (comparação exata de origem, sem regex de subdomínio).
- Build na Vercel não roda `tsc` explicitamente — erros de type-check não bloqueiam o deploy automaticamente; rode `npm run type-check` manualmente antes de subir.
