import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { AppError } from '../../shared/errors/AppError.js';
import * as usersService from './users.service.js';

function adminId(req: Request): number {
  return req.user!.id;
}

function paramId(req: Request): number {
  return Number(req.params.id);
}

export const listRoles = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await usersService.listRoles());
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const soloActivos = req.query.activo;
  const filtros =
    soloActivos === undefined ? {} : { activo: soloActivos !== 'false' && soloActivos !== '0' };
  res.status(200).json(await usersService.listUsers(filtros));
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await usersService.createUser(req.body, adminId(req)));
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await usersService.updateUser(paramId(req), req.body, adminId(req)));
});