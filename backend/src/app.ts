import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { checkDatabaseConnection } from './config/database.js';
import { errorHandler } from './shared/errors/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { cashRouter } from './modules/cash/cash.routes.js';
import { collectionsRouter } from './modules/collections/collections.routes.js';

import { returnsRouter } from './modules/returns/returns.routes.js';
import { salesRouter } from './modules/sales/sales.routes.js';
import { salesTerritoryRouter } from './modules/sales-territory/sales-territory.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { messagingRouter } from './modules/messaging/messaging.routes.js';
import { clientTokenRouter, publicStoreRouter } from './modules/public-store/public-store.routes.js';
import { invoicesRouter, orderInvoiceRouter } from './modules/billing/billing.routes.js';
import { rolesRouter, usersRouter } from './modules/users/users.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { openApiSpec } from './docs/openapi.js';

export const app = express();

const windowMs = 15 * 60 * 1000;

app.use(helmet());
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  }),
);
app.use(express.json());

if (process.env.NODE_ENV !== 'test') {
  app.use(
    '/api',
    rateLimit({
      windowMs,
      limit: 100,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs,
      limit: 5,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
}

app.get('/health', async (_req, res, next) => {
  try {
    const dbOk = await checkDatabaseConnection();
    if (!dbOk) {
      res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
      });
      return;
    }
    res.status(200).json({
      status: 'ok',
      database: 'connected',
    });
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth', authRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api', salesTerritoryRouter);
app.use('/api/orders', salesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/cash-sessions', cashRouter);
app.use('/api', collectionsRouter);
app.use('/api/returns', returnsRouter);
app.use('/api/messaging', messagingRouter);
app.use('/api/tokens', clientTokenRouter);
app.use('/api/public', publicStoreRouter);
// La factura cuelga del pedido: /api/orders/:id/invoice
app.use('/api/orders', orderInvoiceRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/users', usersRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/audit-log', auditRouter);

// Documentación: es documentación, no datos. Sin requireAuth a propósito.
app.get('/api/docs.json', (_req, res) => {
  res.status(200).json(openApiSpec);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  customSiteTitle: 'Disprova GyG — API',
  swaggerOptions: { persistAuthorization: true, docExpansion: 'none' },
}));

app.use(errorHandler);
