import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db.js';
import { seedDatabase } from './seed/seed.js';
import { corsOriginChecker } from './config/cors.js';
import { selectiveBodyParser } from './middleware/bodyParser.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import folderRoutes from './routes/folderRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import logRoutes from './routes/logRoutes.js';
import myFilesRoutes from './routes/myFilesRoutes.js';
import favoritesRoutes from './routes/favoritesRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import recruitingRoutes from './routes/recruitingRoutes.js';
import dispatchRoutes from './routes/dispatchRoutes.js';
import { ensureDefaultLeadSources } from './services/leadSourceService.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Behind one reverse proxy in dev (Vite) and production (nginx). express-rate-limit
// reads the client IP from X-Forwarded-For and throws if trust proxy is disabled.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

const requiredEnv = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'MONGODB_URI'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: corsOriginChecker,
    credentials: true,
  })
);
app.use(selectiveBodyParser);
app.use(cookieParser());

app.use((_req, res, next) => {
  res.setHeader('X-App-Layer', 'express');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/health/upload-limits', (_req, res) => {
  res.json({
    appLayer: 'express',
    multerMaxFileSizeBytes: 50 * 1024 * 1024,
    multerMaxFileSizeLabel: '50MB',
    myFilesQuotaBytes: 50 * 1024 * 1024 * 1024,
    myFilesQuotaLabel: '50GB',
    blockedExtensions: ['zip', 'bat'],
    note:
      'If the browser shows HTML "413 Request Entity Too Large" with "nginx" in the body, the reverse proxy rejected the upload before Express. Run deploy/verify-upload-limits.ps1 after setting nginx client_max_body_size 50M.',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/my-files', myFilesRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/recruiting', recruitingRoutes);
app.use('/api/dispatch', dispatchRoutes);

app.use(errorHandler);

async function start() {
  await connectDB();
  await seedDatabase();
  await ensureDefaultLeadSources();
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
  server.requestTimeout = 10 * 60 * 1000;
  server.headersTimeout = 10 * 60 * 1000 + 1000;
  server.timeout = 0;
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
