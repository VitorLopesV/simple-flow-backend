import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { authController } from '../controllers/authController'
import { authMiddleware } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { loginSchema, refreshSchema, registrarSchema } from '../schemas/auth.schema'

export const authRoutes = Router()

authRoutes.post('/registro', validate(registrarSchema), asyncHandler(authController.registrar))
authRoutes.post('/login', validate(loginSchema), asyncHandler(authController.login))
authRoutes.post('/refresh', validate(refreshSchema), asyncHandler(authController.refresh))
authRoutes.get('/me', authMiddleware, asyncHandler(authController.me))
