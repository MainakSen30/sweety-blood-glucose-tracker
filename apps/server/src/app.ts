import cors from 'cors';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { readingsRouter } from './modules/readings/readings.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { HttpError } from './utils/errors.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/readings', readingsRouter);
app.use('/api/reports', reportsRouter);

app.use((_request, response) => {
  response.status(404).json({
    status: 'error',
    message: 'Route not found',
  });
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      status: 'error',
      message: error.message,
    });
    return;
  }

  // body-parser (used by express.json()) throws a SyntaxError with a numeric
  // `statusCode` and `type: 'entity.parse.failed'` when the request body is
  // malformed JSON. These errors expose a client-supplied status code and
  // should be returned as 400, not 500.
  if (
    error instanceof SyntaxError &&
    'statusCode' in error &&
    'type' in error &&
    (error as SyntaxError & { type: string }).type === 'entity.parse.failed'
  ) {
    response.status(400).json({
      status: 'error',
      message: 'Invalid JSON in request body.',
    });
    return;
  }

  console.error('Unhandled request error:', error);
  response.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
});

export default app;
