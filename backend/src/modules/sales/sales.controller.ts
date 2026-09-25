import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { AppError } from '../../shared/errors/AppError.js';
import { listOrdersQuerySchema } from './sales.schema.js';
import * as salesService from './sales.service.js';

function userId(req: Request): number {
  return req.user!.id;
}

function paramId(req: Request): number {
  return Number(req.params.id);
}

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const parsed = listOrdersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError('Parámetros inválidos', 400, 'VALIDATION_ERROR');
  }
  res.status(200).json(
    await salesService.listOrders({
      clientId: parsed.data.clientId,
      userId: userId(req),
      pendientes: parsed.data.pendientes !== undefined,
    }),
  );
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await salesService.getOrder(paramId(req)));
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await salesService.createOrder(req.body, userId(req)));
});

export const confirmOrder = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await salesService.confirmOrder(paramId(req), userId(req)));
});

export const deliverOrder = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await salesService.deliverOrder(paramId(req), req.body, userId(req)));
});

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await salesService.cancelOrder(paramId(req), userId(req)));
});
