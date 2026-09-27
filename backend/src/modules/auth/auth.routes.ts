import { Router } from 'express';
import { validateBody } from '../../shared/http/validate.js';
import { loginController, refreshController } from './auth.controller.js';
import { loginSchema, refreshSchema } from './auth.schema.js';

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: "Inicia sesión"
 *     description: "Devuelve un access token (15 min) y un refresh token (7 días). Requiere `activo: true` en el usuario."
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginBody'
 *     responses:
 *       200:
 *         description: Sesión iniciada. Incluye `accessToken`, `refreshToken` y el `user` con su rol.
 *       400:
 *         description: Datos inválidos.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Credenciales inválidas (`INVALID_CREDENTIALS`) o usuario inactivo.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       429:
 *         description: "Rate limit: máximo 5 intentos por 15 min."
 *
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Renueva el access token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshBody'
 *     responses:
 *       200:
 *         description: Par de tokens nuevo.
 *       400:
 *         description: Datos inválidos.
 *       401:
 *         description: Refresh token vencido, mal formado o de tipo incorrecto.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
export const authRouter = Router();

authRouter.post('/login', validateBody(loginSchema), loginController);
authRouter.post('/refresh', validateBody(refreshSchema), refreshController);
