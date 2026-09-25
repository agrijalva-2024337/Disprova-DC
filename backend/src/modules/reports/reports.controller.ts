import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import * as reportsService from './reports.service.js';

export const salesToday = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await reportsService.salesToday());
});

export const collectionsToday = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await reportsService.collectionsToday());
});

export const aging = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await reportsService.agingReport());
});
