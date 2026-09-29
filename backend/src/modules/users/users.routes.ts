import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as controller from './users.controller.js';
import { createUserSchema, idParamSchema, updateUserSchema } from './users.schema.js';

// Alta y edición de usuarios: cambiar la organización es cosa de admin.
const adminWrite = [requireAuth, requireRole('admin')] as const;
const idParams = validateParams(idParamSchema);

/**
 * @openapi
 * /roles:
 *   get:
 *     tags: [Usuarios]
 *     summary: "Lista los roles disponibles"
 *     description: "Devuelve id, nombre y permisos de cada rol. Solo admin."
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Los roles del sistema." }
 *       401: { description: "Sin token o vencido." }
 *       403: { description: "El usuario no es admin (`FORBIDDEN`)." }
 *
 * /users:
 *   get:
 *     tags: [Usuarios]
 *     summary: "Lista los usuarios"
 *     description: >
 *       Nunca devuelve `passwordHash`: la respuesta pasa por un DTO propio.
 *       Cada usuario trae `rol` con el nombre de su rol, que es lo que el
 *       panel necesita para pintar la columna. Admite `?activo=true|false`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: activo, schema: { type: string, enum: ["true", "false"] }, description: "Filtra por estado." }
 *     responses:
 *       200: { description: "`[{ id, nombre, email, roleId, rol, activo, createdAt }]`." }
 *       401: { description: "Sin token o vencido." }
 *       403: { description: "El usuario no es admin (`FORBIDDEN`)." }
 *   post:
 *     tags: [Usuarios]
 *     summary: "Crea un usuario"
 *     description: >
 *       La contraseña se hashea con bcrypt (10 rondas) antes de tocar la base.
 *       Si el email ya existe responde 409 `CONFLICT`; si el `roleId` no
 *       corresponde a un rol, 422 `ROLE_NOT_FOUND`. Queda el alta registrada
 *       en `audit_log` con entidad `User`.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [nombre, email, password, roleId], properties: { nombre: { type: string }, email: { type: string, format: email }, password: { type: string, minLength: 8 }, roleId: { type: integer }, activo: { type: boolean } } }
 *     responses:
 *       201: { description: "Usuario creado, sin `passwordHash`." }
 *       400: { description: "Datos inválidos." }
 *       401: { description: "Sin token o vencido." }
 *       403: { description: "El usuario no es admin (`FORBIDDEN`)." }
 *       409: { description: "Ya existe un usuario con ese email (`CONFLICT`)." }
 *       422: { description: "El rol no existe (`ROLE_NOT_FOUND`)." }
 *
 * /users/{id}:
 *   get:
 *     tags: [Usuarios]
 *     summary: "Devuelve un usuario"
 *     description: >
 *       Mismo DTO que la lista: id, nombre, email, roleId, rol, activo y
 *       createdAt. Nunca incluye `passwordHash`. Solo admin.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "`{ id, nombre, email, roleId, rol, activo, createdAt }`." }
 *       401: { description: "Sin token o vencido." }
 *       403: { description: "El usuario no es admin (`FORBIDDEN`)." }
 *       404: { description: "Usuario no encontrado (`NOT_FOUND`)." }
 *   put:
 *     tags: [Usuarios]
 *     summary: "Actualiza un usuario"
 *     description: >
 *       Actualiza nombre, email, rol y `activo`. NO cambia la contraseña: un
 *       hash nuevo en un PUT sin querer deja al usuario sin saber su clave.
 *       Queda la edición registrada en `audit_log` con entidad `User`.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { nombre: { type: string }, email: { type: string, format: email }, roleId: { type: integer }, activo: { type: boolean } } }
 *     responses:
 *       200: { description: "Usuario actualizado, sin `passwordHash`." }
 *       400: { description: "Datos inválidos." }
 *       401: { description: "Sin token o vencido." }
 *       403: { description: "El usuario no es admin (`FORBIDDEN`)." }
 *       404: { description: "Usuario no encontrado (`NOT_FOUND`)." }
 *       409: { description: "Ese email pertenece a otro usuario (`CONFLICT`)." }
 *       422: { description: "El rol no existe (`ROLE_NOT_FOUND`)." }
 */
export const usersRouter = Router();

usersRouter.get('/', ...adminWrite, controller.listUsers);
usersRouter.get('/:id', ...adminWrite, idParams, controller.getUser);
usersRouter.post('/', ...adminWrite, validateBody(createUserSchema), controller.createUser);
usersRouter.put('/:id', ...adminWrite, idParams, validateBody(updateUserSchema), controller.updateUser);

/** Catálogo de roles. Montado en /api/roles. */
export const rolesRouter = Router();

rolesRouter.get('/', ...adminWrite, controller.listRoles);