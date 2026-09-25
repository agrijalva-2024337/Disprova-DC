import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as catalogController from './catalog.controller.js';
import {
  createCategorySchema,
  createPriceListItemSchema,
  createPriceListSchema,
  createProductImageSchema,
  createProductSchema,
  createProductUnitSchema,
  idParamSchema,
  productChildParamSchema,
  productIdParamSchema,
  updateCategorySchema,
  updatePriceListItemSchema,
  updatePriceListSchema,
  updateProductImageSchema,
  updateProductSchema,
  updateProductUnitSchema,
} from './catalog.schema.js';

export const catalogRouter = Router();

const adminWrite = [requireAuth, requireRole('admin')] as const;
const readAuth = [requireAuth] as const;
const idParams = validateParams(idParamSchema);
const productParams = validateParams(productIdParamSchema);
const childParams = validateParams(productChildParamSchema);

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

catalogRouter.get('/products/:productId/units', ...readAuth, productParams, catalogController.listProductUnits);
catalogRouter.get(
  '/products/:productId/units/:id',
  ...readAuth,
  childParams,
  catalogController.getProductUnit,
);
catalogRouter.post(
  '/products/:productId/units',
  ...adminWrite,
  productParams,
  validateBody(createProductUnitSchema),
  catalogController.createProductUnit,
);
catalogRouter.put(
  '/products/:productId/units/:id',
  ...adminWrite,
  childParams,
  validateBody(updateProductUnitSchema),
  catalogController.updateProductUnit,
);
catalogRouter.delete(
  '/products/:productId/units/:id',
  ...adminWrite,
  childParams,
  catalogController.deactivateProductUnit,
);

catalogRouter.get('/products/:productId/images', ...readAuth, productParams, catalogController.listProductImages);
catalogRouter.get(
  '/products/:productId/images/:id',
  ...readAuth,
  childParams,
  catalogController.getProductImage,
);
catalogRouter.post(
  '/products/:productId/images',
  ...adminWrite,
  productParams,
  validateBody(createProductImageSchema),
  catalogController.createProductImage,
);
catalogRouter.put(
  '/products/:productId/images/:id',
  ...adminWrite,
  childParams,
  validateBody(updateProductImageSchema),
  catalogController.updateProductImage,
);
catalogRouter.delete(
  '/products/:productId/images/:id',
  ...adminWrite,
  childParams,
  catalogController.deleteProductImage,
);

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
