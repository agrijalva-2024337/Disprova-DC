import cors from 'cors';
import express from 'express';
import rateLimit, { type Options } from 'express-rate-limit';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { checkDatabaseConnection } from './config/database.js';
import { env } from './config/env.js';
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

app.use(helmet());
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  }),
);
app.use(express.json());

/**
 * El limitador de express-rate-limit respondía texto plano, pero el frontend
 * (y cualquier cliente) lee los errores como JSON con la forma
 * { error: { message, code } }. Sin esto, un 429 llegaba al navegador como
 * "Error 429": un código sin explicación, que es justo lo que hace que un
 * bloqueo de quince minutos parezca un fallo del sistema.
 *
 * Se incluye el tiempo que falta para reintentar, que viene en la cabecera
 * RateLimit-Reset.
 */
function limiteExceedido(minutos: number): Options['handler'] {
  return (_req, res) => {
    const reset = Number(res.getHeader('RateLimit-Reset') ?? 0);
    const minutosRestantes = reset > 0 ? Math.max(1, Math.ceil(reset / 60)) : minutos;
    res.status(429).json({
      error: {
        message:
          `Demasiados intentos. Esperá ${minutosRestantes} ` +
          `${minutosRestantes === 1 ? 'minuto' : 'minutos'} e intentá de nuevo.`,
        code: 'RATE_LIMITED',
        details: { retryAfterSeconds: reset || minutos * 60 },
      },
    });
  };
}

if (process.env.NODE_ENV !== 'test') {
  const ventanaMin = Math.round(env.rateLimit.windowMs / 60000);

  app.use(
    '/api',
    rateLimit({
      windowMs: env.rateLimit.windowMs,
      limit: env.rateLimit.apiMax,
      standardHeaders: true,
      legacyHeaders: false,
      handler: limiteExceedido(ventanaMin),
    }),
  );
  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: env.rateLimit.windowMs,
      limit: env.rateLimit.loginMax,
      standardHeaders: true,
      legacyHeaders: false,
      handler: limiteExceedido(ventanaMin),
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
