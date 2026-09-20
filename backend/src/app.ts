import cors from 'cors';
import express from 'express';
import { checkDatabaseConnection } from './config/database.js';
import { errorHandler } from './shared/errors/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';

export const app = express();

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  }),
);
app.use(express.json());

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

app.use(errorHandler);
