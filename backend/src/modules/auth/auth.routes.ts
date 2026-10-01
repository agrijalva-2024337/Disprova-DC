import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { validateBody } from '../../shared/http/validate.js';
import { loginController, logoutController, meController, refreshController, updateMeController } from './auth.controller.js';
import { loginSchema, refreshSchema, updateProfileSchema } from './auth.schema.js';

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: "Inicia sesión"
 *     description: "Devuelve un access token (15 min) y un refresh token (7 días). Acepta correo o nombre de usuario. Requiere `activo: true`."
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
 *         description: Refresh token vencido, mal formado, de tipo incorrecto o ya usado. El cuerpo no dice cuál de esos fue.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: "Cierra la sesión de refresh"
 *     description: "Revoca el refresh token. No usa el access token. Si el token ya no servía, la respuesta es la misma."
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshBody'
 *     responses:
 *       204:
 *         description: "Listo. También si el token era inválido o la sesión no existía."
 *       400:
 *         description: Datos inválidos.
 *
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Perfil de quien tiene la sesión
 *     responses:
 *       200:
 *         description: Nombre, correo, usuario, foto y rol.
 *       401:
 *         description: Sin sesión.
 *   patch:
 *     tags: [Auth]
 *     summary: Edita el perfil de la sesión
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileBody'
 *     responses:
 *       200:
 *         description: Perfil actualizado.
 *       400:
 *         description: Datos inválidos.
 *       401:
 *         description: Sin sesión.
 *       409:
 *         description: El nombre de usuario ya existe (`USERNAME_TAKEN`).
 */
export const authRouter = Router();

authRouter.post('/login', validateBody(loginSchema), loginController);
authRouter.post('/refresh', validateBody(refreshSchema), refreshController);
authRouter.post('/logout', validateBody(refreshSchema), logoutController);
authRouter.get('/me', requireAuth, meController);
authRouter.patch('/me', requireAuth, validateBody(updateProfileSchema), updateMeController);
