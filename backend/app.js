import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// IMPORTANT: Load .env BEFORE any other imports that might use env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyCookie from '@fastify/cookie';
import cors from '@fastify/cors';

import scoreRoutes from './routes/scores.js';
import gameRoutes from './routes/games.js';
import playerRoutes from './routes/players.js';
import feedbackRoutes from './routes/feedback.js';
import authRoutes from './routes/auth.js';
import { handleError } from './utils/errorHandler.js';

// trustProxy: wichtig, wenn hinter einem Proxy (Render/Nginx/Heroku etc.)
const fastify = Fastify({ logger: true, trustProxy: true });

fastify.setErrorHandler(handleError);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [];

await fastify.register(cors, {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
  // Cookie-basierte Sessions: Credentialed-Requests erlauben.
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 200
});

// Cookies für die (optionale) Session-Auth. Unsignierte Cookies genügen —
// das Session-Token ist bereits ein 256-bit-Geheimnis.
await fastify.register(fastifyCookie);

await fastify.register(fastifyHelmet, {
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", ...allowedOrigins]
    }
  }
});

// Globales Rate-Limit: 120 Requests pro Minute, IP-basiert.
// Kein Auth-Header-Keying, da die App keine echte Authentifizierung kennt
// und ein gespoofter Header das Limit sonst trivial umgehen würde.
await fastify.register(fastifyRateLimit, {
  max: 120,
  timeWindow: '1 minute',

  keyGenerator: (req) => `ip:${req.ip}`,

  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
    'retry-after': true,
  },

  errorResponseBuilder: (req, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Try again in ${Math.ceil(context.after / 1000)} seconds.`,
  }),

  // Falls der Store ausfällt: Requests nicht komplett blockieren
  skipOnError: true,
});

fastify.register(scoreRoutes, { prefix: '/api/scores' });
fastify.register(gameRoutes, { prefix: '/api/games' });
fastify.register(playerRoutes, { prefix: '/api/players' });
fastify.register(feedbackRoutes, { prefix: '/api/feedback' });
fastify.register(authRoutes, { prefix: '/api/auth' });

fastify.get('/', async (req, reply) => {
  reply.send({ status: 'ok', service: 'Urban Golf API' });
});

const PORT = process.env.PORT || 3000;

fastify.listen({ port: PORT, host: '0.0.0.0' }, err => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
