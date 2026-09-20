import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/AppError.js';

export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new AppError('Datos inválidos', 400, 'VALIDATION_ERROR'));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateParams(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(new AppError('Parámetro inválido', 400, 'VALIDATION_ERROR'));
      return;
    }
    Object.assign(req.params, result.data);
    next();
  };
}
