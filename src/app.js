import 'dotenv/config';
import './config/database.js';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sessionConfig from './config/session.js';
import csrfProtection from './middleware/csrf.js';
import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';
import requestLogger from './middleware/requestLogger.js';
import apiTasksRouter from './routes/apiTasks.js';
import authRouter from './routes/auth.js';
import categoriesRouter from './routes/categories.js';
import dashboardRouter from './routes/dashboard.js';
import notificationsRouter from './routes/notifications.js';
import onboardingRouter from './routes/onboarding.js';
import profileRouter from './routes/profile.js';
import searchRouter from './routes/search.js';
import subtasksRouter from './routes/subtasks.js';
import tagsRouter from './routes/tags.js';
import tasksRouter from './routes/tasks.js';
import { createViteAssetsHelper } from './utils/viteAssets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const viewsDir = path.join(__dirname, 'views');
const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction =
  process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';
const viteDevServerOrigin = process.env.VITE_DEV_SERVER_ORIGIN ?? 'http://localhost:5173';
const viteAssetTags = createViteAssetsHelper();

app.use((req, res, next) => {
  res.locals.cspNonce = randomUUID().replaceAll('-', '');
  next();
});

app.disable('x-powered-by');

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: isProduction
          ? ["'self'"]
          : ["'self'", viteDevServerOrigin, 'ws://localhost:5173', 'ws://127.0.0.1:5173'],
        fontSrc: ["'self'", 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        objectSrc: ["'none'"],
        scriptSrc: [
          "'self'",
          (req, res) => `'nonce-${res.locals.cspNonce}'`,
          ...(isProduction ? [] : [viteDevServerOrigin]),
        ],
        styleSrc: ["'self'", "'unsafe-inline'", ...(isProduction ? [] : [viteDevServerOrigin])],
      },
    },
  }),
);
app.use(compression());
app.use(
  cors(
    isProduction
      ? { origin: false }
      : {
          origin: viteDevServerOrigin,
          credentials: true,
        },
  ),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session(sessionConfig));
app.use(requestLogger);
app.use(
  express.static(publicDir, {
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      const relativePath = path.relative(publicDir, filePath).split(path.sep).join('/');

      if (relativePath.startsWith('dist/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return;
      }

      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    },
  }),
);
app.use(csrfProtection);

app.set('view engine', 'ejs');
app.set('views', viewsDir);

app.use((req, res, next) => {
  const flashMessages = Array.isArray(req.session.flashMessages) ? req.session.flashMessages : [];
  req.session.flashMessages = [];

  res.locals.currentUser = req.session.user || null;
  res.locals.csrfToken = req.csrfToken;
  res.locals.viteAssets = (entry = 'client/src/main.js') => viteAssetTags(entry);
  res.locals.flashMessages = flashMessages;
  res.locals.currentPath = req.originalUrl || req.path || '/';
  res.locals.appBarConfig = res.locals.appBarConfig || {};
  res.locals.fabConfig = res.locals.fabConfig || null;

  next();
});

app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

app.use('/api/tasks', apiTasksRouter);
app.use('/auth', authRouter);
app.use('/onboarding', onboardingRouter);
app.use('/tasks', tasksRouter);
app.use('/search', searchRouter);
app.use('/categories', categoriesRouter);
app.use('/tags', tagsRouter);
app.use('/subtasks', subtasksRouter);
app.use('/profile', profileRouter);
app.use('/dashboard', dashboardRouter);
app.use('/notifications', notificationsRouter);

app.use(notFound);
app.use(errorHandler);

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  app.listen(port, () => {
    console.info(`Todo app listening on http://localhost:${port}`);
  });
}

export default app;
