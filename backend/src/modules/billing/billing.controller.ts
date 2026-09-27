import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { AppError } from '../../shared/errors/AppError.js';
import { invoicesQuerySchema } from './billing.schema.js';
import * as billingService from './billing.service.js';

function orderId(req: Request): number {
  return Number(req.params.id);
}

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const result = await billingService.createInvoiceForOrder(orderId(req), req.body, req.user!.id);
  // Facturar es una escritura: responde 201 la primera vez. Que la factura
  // quede pendiente de certificar NO es un error, así que no cambia el status.
  res.status(201).json(result.invoice);
});

export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await billingService.getInvoiceForOrder(orderId(req)));
});

export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  const parsed = invoicesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError('Parámetros inválidos', 400, 'VALIDATION_ERROR');
  }
  res.status(200).json(await billingService.listInvoices(parsed.data));
});