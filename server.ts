import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import {
  handleCharacterHighscoresRequest,
  handleGuildHighscoresRequest,
  handleMembersRequest,
} from './api/missclick/_core.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/missclick/members', (req, res) => {
    void handleMembersRequest(req, res);
  });

  app.get('/api/missclick/guild-highscores', (req, res) => {
    void handleGuildHighscoresRequest(req, res);
  });

  app.post('/api/missclick/guild-highscores', (req, res) => {
    void handleGuildHighscoresRequest(req, res);
  });

  app.get('/api/missclick/highscores', (req, res) => {
    void handleCharacterHighscoresRequest(req, res);
  });

  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
