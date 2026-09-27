import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import * as messagingService from './messaging.service.js';

function userId(req: Request): number {
  return req.user!.id;
}

function paramId(req: Request): number {
  return Number(req.params.id);
}

function clientId(req: Request): number {
  return Number(req.params.clientId);
}

function templateId(req: Request): number {
  return Number(req.query.templateId);
}

export const listTemplates = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await messagingService.listTemplates());
});

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await messagingService.createTemplate(req.body, userId(req)));
});

export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await messagingService.updateTemplate(paramId(req), req.body, userId(req)));
});

export const deactivateTemplate = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await messagingService.deactivateTemplate(paramId(req), userId(req)));
});

export const getClientLink = asyncHandler(async (req: Request, res: Response) => {
  res
    .status(200)
    .json(await messagingService.buildLinkForClient(clientId(req), templateId(req), userId(req)));
});

export const sendToClient = asyncHandler(async (req: Request, res: Response) => {
  res
    .status(200)
    .json(await messagingService.sendToClient(clientId(req), templateId(req), userId(req)));
});

export const getClientHistory = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await messagingService.listClientHistory(clientId(req)));
});

export const broadcastToday = asyncHandler(async (req: Request, res: Response) => {
  res
    .status(200)
    .json(await messagingService.broadcastToday(Number(req.body.templateId), userId(req)));
});