import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as controller from './users.controller.js';
import { createUserSchema, idParamSchema, updateUserSchema } from './users.schema.js';

// Alta y edición de usuarios: cambiar la organización es cosa de admin.
const adminWrite = [requireAuth, requireRole('admin')] as const;
const idParams = validateParams(idParamSchema);

export const usersRouter = Router();

usersRouter.get('/', ...adminWrite, controller.listUsers);
usersRouter.post('/', ...adminWrite, validateBody(createUserSchema), controller.createUser);
usersRouter.put('/:id', ...adminWrite, idParams, validateBody(updateUserSchema), controller.updateUser);

/** Catálogo de roles. Montado en /api/roles. */
export const rolesRouter = Router();

rolesRouter.get('/', ...adminWrite, controller.listRoles);