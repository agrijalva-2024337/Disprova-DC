import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import type { AuditLogQuery } from './audit.schema.js';
import * as auditService from './audit.service.js';

/**
 * `validateQuery` ya reescribió `req.query` con los valores coercionados por
 * Zod, así que acá llega como número o fecha y no como texto de query string.
 */
export const listAuditLog = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await auditService.listAuditLog(req.query as AuditLogQuery));
});