import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as catalogController from './catalog.controller.js';
import {
  createCategorySchema,
  createPriceListItemSchema,
  createPriceListSchema,
  createProductSchema,
  idParamSchema,
  updateCategorySchema,
  updatePriceListItemSchema,
  updatePriceListSchema,
  updateProductSchema,
} from './catalog.schema.js';

export const catalogRouter = Router();

const adminWrite = [requireAuth, requireRole('admin')] as const;
const readAuth = [requireAuth] as const;
const idParams = validateParams(idParamSchema);

catalogRouter.get('/categories', ...readAuth, catalogController.listCategories);
catalogRouter.get('/categories/:id', ...readAuth, idParams, catalogController.getCategory);
catalogRouter.post(
  '/categories',
  ...adminWrite,
  validateBody(createCategorySchema),
  catalogController.createCategory,
);
catalogRouter.put(
  '/categories/:id',
  ...adminWrite,
  idParams,
  validateBody(updateCategorySchema),
  catalogController.updateCategory,
);
catalogRouter.delete('/categories/:id', ...adminWrite, idParams, catalogController.deleteCategory);

catalogRouter.get('/products', ...readAuth, catalogController.listProducts);
catalogRouter.get('/products/:id', ...readAuth, idParams, catalogController.getProduct);
catalogRouter.post(
  '/products',
  ...adminWrite,
  validateBody(createProductSchema),
  catalogController.createProduct,
);
catalogRouter.put(
  '/products/:id',
  ...adminWrite,
  idParams,
  validateBody(updateProductSchema),
  catalogController.updateProduct,
);
catalogRouter.delete('/products/:id', ...adminWrite, idParams, catalogController.deleteProduct);

catalogRouter.get('/price-lists', ...readAuth, catalogController.listPriceLists);
catalogRouter.get('/price-lists/:id', ...readAuth, idParams, catalogController.getPriceList);
catalogRouter.post(
  '/price-lists',
  ...adminWrite,
  validateBody(createPriceListSchema),
  catalogController.createPriceList,
);
catalogRouter.put(
  '/price-lists/:id',
  ...adminWrite,
  idParams,
  validateBody(updatePriceListSchema),
  catalogController.updatePriceList,
);
catalogRouter.delete('/price-lists/:id', ...adminWrite, idParams, catalogController.deletePriceList);

catalogRouter.get('/price-list-items', ...readAuth, catalogController.listPriceListItems);
catalogRouter.get(
  '/price-list-items/:id',
  ...readAuth,
  idParams,
  catalogController.getPriceListItem,
);
catalogRouter.post(
  '/price-list-items',
  ...adminWrite,
  validateBody(createPriceListItemSchema),
  catalogController.createPriceListItem,
);
catalogRouter.put(
  '/price-list-items/:id',
  ...adminWrite,
  idParams,
  validateBody(updatePriceListItemSchema),
  catalogController.updatePriceListItem,
);
catalogRouter.delete(
  '/price-list-items/:id',
  ...adminWrite,
  idParams,
  catalogController.deletePriceListItem,
);
