import type { Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError.js';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import {
  adjustmentSchema,
  createBatchSchema,
  createWarehouseSchema,
  entradaSchema,
  movementQuerySchema,
  stockQuerySchema,
  transferSchema,
} from './inventory.schema.js';
import * as inventoryService from './inventory.service.js';

function userId(req: Request): number {
  return req.user!.id;
}

function parseQuery<T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }, query: unknown): T {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new AppError('Parámetros inválidos', 400, 'VALIDATION_ERROR');
  }
  return result.data;
}

export const listWarehouses = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await inventoryService.listWarehouses());
});

export const listStock = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(stockQuerySchema, req.query);
  res.status(200).json(
    await inventoryService.listStock({
      warehouseId: query.warehouseId,
      productId: query.productId,
      soloDisponible: query.disponible !== undefined,
    }),
  );
});

export const listMovements = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(movementQuerySchema, req.query);
  res.status(200).json(await inventoryService.listMovements(query));
});

export const transfer = asyncHandler(async (req: Request, res: Response) => {
  const body = transferSchema.parse(req.body);
  res.status(201).json(await inventoryService.transferStock({ ...body, userId: userId(req) }));
});

export const adjust = asyncHandler(async (req: Request, res: Response) => {
  const body = adjustmentSchema.parse(req.body);
  res.status(201).json(await inventoryService.adjustStock({ ...body, userId: userId(req) }));
});

export const createWarehouse = asyncHandler(async (req: Request, res: Response) => {
  const body = createWarehouseSchema.parse(req.body);
  res.status(201).json(await inventoryService.createWarehouse(body));
});

export const createBatch = asyncHandler(async (req: Request, res: Response) => {
  const body = createBatchSchema.parse(req.body);
  res.status(201).json(await inventoryService.createBatch(body));
});

export const receiveStock = asyncHandler(async (req: Request, res: Response) => {
  const body = entradaSchema.parse(req.body);
  res.status(201).json(await inventoryService.receiveStock(body, userId(req)));
});
