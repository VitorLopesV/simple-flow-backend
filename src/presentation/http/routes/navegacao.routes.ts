import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { navegacaoController } from '../controllers/navegacaoController'
import { authMiddleware } from '../middlewares/authMiddleware'

export const navegacaoRoutes = Router()

navegacaoRoutes.use(authMiddleware)
navegacaoRoutes.get('/limites', asyncHandler(navegacaoController.limites))
