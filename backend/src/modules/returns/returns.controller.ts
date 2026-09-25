import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import * as returnsService from './returns.service.js';

function userId(req: Request): number {
  return req.user!.id;
}

function paramId(req: Request): number {
  return Number(req.params.id);
}

export const createReturn = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await returnsService.createReturn(req.body, userId(req)));
});

export const acceptReturn = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await returnsService.acceptReturn(paramId(req), userId(req)));
});

export const rejectReturn = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await returnsService.rejectReturn(paramId(req)));
});
