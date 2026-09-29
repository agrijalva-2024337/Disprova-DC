import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { AppError } from '../../shared/errors/AppError.js';
import * as publicStoreService from './public-store.service.js';

function adminId(req: Request): number {
  return req.user!.id;
}

function clientId(req: Request): number {
  return Number(req.params.clientId);
}

function tokenId(req: Request): number {
  return Number(req.params.id);
}

/** El token NO habilita endpoints internos: acá siempre hace falta JWT + admin. */
export const createClientAccessToken = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(
    await publicStoreService.createClientAccessToken(clientId(req), req.body, adminId(req)),
  );
});

export const listClientAccessTokens = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await publicStoreService.listClientAccessTokens(clientId(req)));
});

export const revokeClientAccessToken = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await publicStoreService.revokeClientAccessToken(tokenId(req), adminId(req)));
});

export const getPublicCatalog = asyncHandler(async (req: Request, res: Response) => {
  if (!req.publicClient) {
    throw new AppError('Token de acceso inválido', 401, 'PUBLIC_TOKEN_INVALID');
  }
  res.status(200).json(await publicStoreService.getPublicCatalog(req.publicClient));
});

export const createPublicOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.publicClient) {
    throw new AppError('Token de acceso inválido', 401, 'PUBLIC_TOKEN_INVALID');
  }
  const result = await publicStoreService.createPublicOrder(req.publicClient, req.body);
  // Igual que en /api/orders: un alta nueva responde 201 y una
  // idempotencyKey repetida devuelve el pedido ya creado con 200.
  res.status(result.created ? 201 : 200).json(result.order);
});