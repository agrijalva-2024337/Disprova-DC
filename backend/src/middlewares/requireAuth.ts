import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors/AppError.js';

type AccessPayload = {
  sub: string;
  roleId: number;
  type: 'access';
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('No autenticado', 401, 'UNAUTHORIZED');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new AppError('No autenticado', 401, 'UNAUTHORIZED');
    }

    const payload = jwt.verify(token, env.jwt.accessSecret) as AccessPayload;
    if (payload.type !== 'access' || !payload.sub) {
      throw new AppError('No autenticado', 401, 'UNAUTHORIZED');
    }

    const id = Number(payload.sub);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('No autenticado', 401, 'UNAUTHORIZED');
    }

    req.user = { id, roleId: payload.roleId };
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    next(new AppError('No autenticado', 401, 'UNAUTHORIZED'));
  }
};
