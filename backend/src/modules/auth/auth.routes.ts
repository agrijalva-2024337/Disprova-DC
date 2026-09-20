import { Router } from 'express';
import { validateBody } from '../../shared/http/validate.js';
import { loginController, refreshController } from './auth.controller.js';
import { loginSchema, refreshSchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post('/login', validateBody(loginSchema), loginController);
authRouter.post('/refresh', validateBody(refreshSchema), refreshController);
