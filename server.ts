import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsonSyntaxErrorHandler, securityHeaders } from './server/middleware.ts';
import { createApiRouter } from './server/routes.ts';

const PORT = Number(process.env.PORT) || 3000;

export async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(express.json({ limit: '64kb' }));
  app.use(jsonSyntaxErrorHandler);

  app.use('/api', createApiRouter());

  const distDir = path.resolve(process.cwd(), 'dist');
  const distIndex = path.join(distDir, 'index.html');
  const useStaticProd =
    process.env.NODE_ENV === 'production' ||
    (fs.existsSync(distIndex) && process.env.DEV_VITE !== 'true');

  if (!useStaticProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      '/assets',
      express.static(path.join(distDir, 'assets'), {
        maxAge: '365d',
        immutable: true,
      })
    );
    app.use(
      '/src/assets',
      express.static(path.join(distDir, 'src/assets'), {
        maxAge: '7d',
      })
    );
    app.use(
      express.static(distDir, {
        index: false,
      })
    );
    app.get('*', (_req, res) => {
      if (!fs.existsSync(distIndex)) {
        res.status(503).send('Application build missing. Run npm run build first.');
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(distIndex);
    });
  }

  return app;
}

const isMainModule =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  createApp()
    .then((app) => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`LabLink server listening on http://0.0.0.0:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start LabLink server:', err);
      process.exit(1);
    });
}
