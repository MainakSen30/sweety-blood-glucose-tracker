import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { healthRouter } from './modules/health/health.routes.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRouter);

app.use((_request, response) => {
  response.status(404).json({
    status: 'error',
    message: 'Route not found',
  });
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  console.error('Unhandled request error:', error);
  response.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
});

export default app;
