import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import * as authService from './auth.service.js';

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const { email, usuario, password } = req.body as { email?: string; usuario?: string; password: string };
  const result = await authService.login({ email, usuario }, password);
  res.status(200).json(result);
});

export const meController = asyncHandler(async (req: Request, res: Response) => {
  const profile = await authService.getMe(req.user!.id);
  res.status(200).json(profile);
});

export const updateMeController = asyncHandler(async (req: Request, res: Response) => {
  const profile = await authService.updateMe(req.user!.id, req.body);
  res.status(200).json(profile);
});

export const refreshController = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken: string };
  const result = await authService.refresh(refreshToken);
  res.status(200).json(result);
});

export const logoutController = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken: string };
  await authService.logout(refreshToken);
  res.status(204).send();
});
