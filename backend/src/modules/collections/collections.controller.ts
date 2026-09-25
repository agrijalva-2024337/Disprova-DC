import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import * as collectionsService from './collections.service.js';

function userId(req: Request): number {
  return req.user!.id;
}

function paramId(req: Request): number {
  return Number(req.params.id);
}

export const createPayment = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await collectionsService.createPayment(req.body, userId(req)));
});

export const applyPayment = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await collectionsService.applyPayment(paramId(req), req.body));
});

export const getAccount = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await collectionsService.getAccount(paramId(req)));
});

export const getAging = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await collectionsService.getAging(paramId(req)));
});

export const createCollectionVisit = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await collectionsService.createCollectionVisit(req.body, userId(req)));
});
