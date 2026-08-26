# Backend

API REST do SimpleFlow (Sistema de Controle Financeiro) — Node.js + TypeScript + Express,
seguindo arquitetura limpa (domain / application / infrastructure / presentation), com
Supabase (Postgres) como persistência e Supabase Auth para autenticação.

## Arquitetura

```
backend/
  api/index.ts            # entrada serverless (Vercel), embrulha o app com serverless-http
  src/
    server.ts              # entrada local: app.listen(3000)
    app.ts                  # composition root (CORS, JSON, rotas, error handler)
    domain/                 # entidades e interfaces de repositório (sem dependências externas)
    application/use-cases/  # uma classe por ação, dependendo só de interfaces do domain
    infrastructure/         # implementações Supabase dos repositórios + auth
    presentation/http/      # controllers, rotas Express, middlewares, schemas Zod
    shared/                 # tipos e utilitários compartilhados
  supabase/migrations/      # migrations SQL (schema, RLS, seed)
```

Fluxo de dependência: `presentation` → `application` → `domain` ← `infrastructure`. Os
repositórios são interfaces no `domain`, implementadas no `infrastructure` — as use-cases nunca
importam Supabase diretamente.

## Multi-tenant (isolamento entre usuários)

Cada usuário só enxerga os próprios dados. Isso é garantido em duas camadas:

1. **Row Level Security no Postgres** (`supabase/migrations/*_rls_policies.sql`): toda tabela
   de domínio tem policies restringindo linhas a `user_id = auth.uid()`.
2. **Client Supabase por requisição**: o `authMiddleware` valida o Bearer token e monta um
   client `supabase-js` com o JWT do usuário no header (`supabaseClientForRequest`) — assim
   `auth.uid()` resolve corretamente dentro do Postgres e o RLS realmente se aplica. Os
   repositórios ainda filtram por `userId` explicitamente, como defesa em profundidade.

O client com a service-role key (`supabaseAdminClient`) só é usado dentro de
`SupabaseAuthService`, para criar usuários — nunca nos repositórios de dados.

## Autenticação

O backend é o único ponto que fala com o Supabase Auth; o frontend nunca importa
`@supabase/supabase-js`, só chama estes endpoints via Axios e guarda os tokens recebidos.

| Método | Rota            | Descrição                                              |
| ------ | --------------- | ------------------------------------------------------- |
| POST   | `/auth/registro`| Cria o usuário no Supabase Auth e já retorna uma sessão  |
| POST   | `/auth/login`   | `{ email, senha }` → `{ accessToken, refreshToken, expiresIn, usuario }` |
| POST   | `/auth/refresh` | `{ refreshToken }` → novo par de tokens                  |
| GET    | `/auth/me`      | Retorna o usuário autenticado (requer `Authorization: Bearer`) |

Todos os demais endpoints abaixo exigem `Authorization: Bearer <accessToken>`.

## Setup local

```bash
cp .env.example .env   # preencher SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm install             # a partir da raiz do monorepo
npm run dev:backend     # sobe em http://localhost:3000/api
```

`SUPABASE_SERVICE_ROLE_KEY` é sensível (acesso admin) — nunca commitar, nunca logar, nunca
expor ao frontend.

## Endpoints de dados

> Os dois desvios abaixo em relação a uma versão anterior deste documento foram confirmados
> contra o código real do frontend (`frontend/src/services/*.ts`) e implementados assim de
> propósito: `/entradas/resumo` e `/saidas/resumo` recebem `competencia` (não `mes`/`ano`), e a
> listagem de faturas é `GET /cartoes/faturas` (não `/cartoes/:id/faturas`).

| Método | Rota                   | Descrição                                                              |
| ------ | ---------------------- | ----------------------------------------------------------------------- |
| GET    | `/categorias`          | Lista categorias do sistema + custom do usuário                         |
| GET    | `/entradas`            | Lista paginada (query: `mes`, `ano`, `categoriaId`, `busca`, `page`, `pageSize`) |
| GET    | `/entradas/resumo`     | Totalizadores do período (query: `competencia` = `YYYY-MM`)              |
| POST   | `/entradas`            | Cria entrada                                                             |
| PUT    | `/entradas/:id`        | Atualiza entrada                                                         |
| DELETE | `/entradas/:id`        | Remove entrada                                                           |
| GET    | `/saidas`              | Lista paginada (mesmos filtros + `status`)                               |
| GET    | `/saidas/resumo`       | Totalizadores do período (query: `competencia`)                         |
| POST   | `/saidas`              | Cria saída (se `formaPagamento=CARTAO_CREDITO`, também gera/atualiza a fatura do cartão) |
| PUT    | `/saidas/:id`          | Atualiza saída (rejeitado com 409 se `automatica: true`)                 |
| DELETE | `/saidas/:id`          | Remove saída (mesma restrição)                                           |
| GET    | `/cartoes`             | Lista cartões                                                            |
| POST   | `/cartoes`             | Cria cartão                                                              |
| PUT    | `/cartoes/:id`         | Atualiza cartão                                                          |
| DELETE | `/cartoes/:id`         | Remove cartão                                                            |
| GET    | `/cartoes/faturas`     | Cartões + fatura da competência (query: `competencia`, `cartaoId?`)      |
| PATCH  | `/faturas/:id/pagar`   | Marca fatura como paga                                                   |
| GET    | `/dashboard/resumo`    | Consolidado do período + série de 6 meses (query: `competencia`)         |

Os formatos de request/response estão tipados em `frontend/src/types` e espelhados nas
entidades de `src/domain/entities`.

## Deploy (Vercel)

Projeto Vercel separado, com root directory `backend/`. `vercel.json` reescreve `/api/*` para
a function serverless em `api/index.ts`. Guia passo a passo (criação dos dois projetos, env
vars de cada um e ajuste de CORS) em [`../DEPLOY.md`](../DEPLOY.md).
