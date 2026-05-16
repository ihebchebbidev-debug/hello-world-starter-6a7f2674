import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import routes from './routes/index.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { responseEnvelope } from './middleware/responseEnvelope.js';
import { swaggerSpec } from './config/swagger.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Correlation id must run before anything that logs or may error.
  app.use(requestId);

  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false })); // allow swagger-ui assets
  // CORS: allow any origin. Credentials enabled => we must reflect the
  // request's Origin header (wildcard "*" is rejected by browsers when
  // credentials are included). Non-browser callers (no Origin) are allowed.
  const corsOptions = {
    origin: (origin, cb) => cb(null, true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Request-Id', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
    maxAge: 86400,
    optionsSuccessStatus: 204,
  };
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  // gzip/deflate JSON > 1KB. Skip the SSE log stream which must stay un-buffered.
  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => {
        if (req.path.endsWith('/logs/stream')) return false;
        return compression.filter(req, res);
      },
    }),
  );
  app.use(requestLogger);
  app.use(apiLimiter);
  app.use(responseEnvelope);

  // OpenAPI / Swagger — opt out of envelope so the JSON spec is consumable by tools.
  app.get('/api/docs.json', (_req, res) => {
    res.locals.skipEnvelope = true;
    res.json(swaggerSpec);
  });
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'EcoBus V2 API Docs',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  app.use(env.apiPrefix, routes);

  // Browser-based end-to-end smoke test runner. Hits the live API on this
  // host with the seeded demo accounts. Safe to expose: it never reveals
  // secrets, and any data it creates (a trip + a few GPS pings + a test SOS)
  // lives under the seeded demo organization only.
  app.get(['/tests', '/tests/'], (_req, res) => {
    res.locals.skipEnvelope = true;
    res.sendFile(path.join(__dirname, 'public', 'tests.html'));
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
