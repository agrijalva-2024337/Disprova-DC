import type { Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError.js';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { listCashSessionsQuerySchema } from './cash.schema.js';
import * as cashService from './cash.service.js';

function userId(req: Request): number {
  return req.user!.id;
}

function paramId(req: Request): number {
  return Number(req.params.id);
}

export const openSession = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await cashService.openSession(req.body, userId(req)));
});

export const getCurrentSession = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await cashService.getCurrentSession(userId(req)));
});

export const closeSession = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(
    await cashService.closeSession(paramId(req), req.body, userId(req), req.user!.roleId),
  );
});

export const listSessions = asyncHandler(async (req: Request, res: Response) => {
  const parsed = listCashSessionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError('Parámetros inválidos', 400, 'VALIDATION_ERROR');
  }
  res.status(200).json(await cashService.listSessions(parsed.data));
});
