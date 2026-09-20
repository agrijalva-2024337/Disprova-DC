import type { RequestHandler } from 'express';
import { prisma } from '../config/prisma.js';
import { AppError } from '../shared/errors/AppError.js';

export function requireRole(...allowed: string[]): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.user) {
        throw new AppError('No autenticado', 401, 'UNAUTHORIZED');
      }

      const role = await prisma.role.findUnique({
        where: { id: req.user.roleId },
      });

      if (!role || !allowed.includes(role.nombre)) {
        throw new AppError('No autorizado', 403, 'FORBIDDEN');
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
