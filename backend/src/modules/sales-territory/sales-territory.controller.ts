import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import * as salesTerritoryService from './sales-territory.service.js';

function userId(req: Request): number {
  return req.user!.id;
}

function paramId(req: Request): number {
  return Number(req.params.id);
}

function contactId(req: Request): number {
  return Number(req.params.contactId);
}

export const listZones = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await salesTerritoryService.listZones());
});

export const getZone = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await salesTerritoryService.getZone(paramId(req)));
});

export const createZone = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await salesTerritoryService.createZone(req.body, userId(req)));
});

export const updateZone = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await salesTerritoryService.updateZone(paramId(req), req.body, userId(req)));
});

export const deleteZone = asyncHandler(async (req: Request, res: Response) => {
  await salesTerritoryService.deleteZone(paramId(req), userId(req));
  res.status(204).send();
});

export const listClients = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await salesTerritoryService.listClients());
});

export const getClient = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await salesTerritoryService.getClient(paramId(req)));
});

export const createClient = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await salesTerritoryService.createClient(req.body, userId(req)));
});

export const updateClient = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await salesTerritoryService.updateClient(paramId(req), req.body, userId(req)));
});

export const deleteClient = asyncHandler(async (req: Request, res: Response) => {
  await salesTerritoryService.deleteClient(paramId(req), userId(req));
  res.status(204).send();
});

export const listClientContacts = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await salesTerritoryService.listClientContacts(paramId(req)));
});

export const getClientContact = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await salesTerritoryService.getClientContact(paramId(req), contactId(req)));
});

export const createClientContact = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await salesTerritoryService.createClientContact(paramId(req), req.body, userId(req)));
});

export const updateClientContact = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(
    await salesTerritoryService.updateClientContact(paramId(req), contactId(req), req.body, userId(req)),
  );
});

export const deleteClientContact = asyncHandler(async (req: Request, res: Response) => {
  await salesTerritoryService.deleteClientContact(paramId(req), contactId(req), userId(req));
  res.status(204).send();
});

export const getTodayRoute = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await salesTerritoryService.getTodayRoute());
});

export const createRouteVisit = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await salesTerritoryService.createRouteVisit(req.body, userId(req)));
});
