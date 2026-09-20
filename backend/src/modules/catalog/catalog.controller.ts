import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import * as catalogService from './catalog.service.js';

function userId(req: Request): number {
  return req.user!.id;
}

function paramId(req: Request): number {
  return Number(req.params.id);
}

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await catalogService.listCategories());
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await catalogService.getCategory(paramId(req)));
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await catalogService.createCategory(req.body, userId(req)));
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await catalogService.updateCategory(paramId(req), req.body, userId(req)));
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await catalogService.deleteCategory(paramId(req), userId(req));
  res.status(204).send();
});

export const listProducts = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await catalogService.listProducts());
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await catalogService.getProduct(paramId(req)));
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await catalogService.createProduct(req.body, userId(req)));
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await catalogService.updateProduct(paramId(req), req.body, userId(req)));
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await catalogService.deleteProduct(paramId(req), userId(req));
  res.status(204).send();
});

export const listPriceLists = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await catalogService.listPriceLists());
});

export const getPriceList = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await catalogService.getPriceList(paramId(req)));
});

export const createPriceList = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await catalogService.createPriceList(req.body, userId(req)));
});

export const updatePriceList = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await catalogService.updatePriceList(paramId(req), req.body, userId(req)));
});

export const deletePriceList = asyncHandler(async (req: Request, res: Response) => {
  await catalogService.deletePriceList(paramId(req), userId(req));
  res.status(204).send();
});

export const listPriceListItems = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await catalogService.listPriceListItems());
});

export const getPriceListItem = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await catalogService.getPriceListItem(paramId(req)));
});

export const createPriceListItem = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await catalogService.createPriceListItem(req.body, userId(req)));
});

export const updatePriceListItem = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await catalogService.updatePriceListItem(paramId(req), req.body, userId(req)));
});

export const deletePriceListItem = asyncHandler(async (req: Request, res: Response) => {
  await catalogService.deletePriceListItem(paramId(req), userId(req));
  res.status(204).send();
});
