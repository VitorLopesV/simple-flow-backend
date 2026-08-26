import cors from 'cors'
import express, { type Express } from 'express'

import { env } from './infrastructure/config/env'
import { errorHandler } from './presentation/http/middlewares/errorHandler'
import { routes } from './presentation/http/routes'

/** Composition root: monta middlewares e rotas. Compartilhado entre server.ts e api/index.ts. */
export function createApp(): Express {
  const app = express()

  app.use(
    cors({
      origin: env.corsOrigins,
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )
  app.use(express.json())

  app.use('/api', routes)

  app.use(errorHandler)

  return app
}
