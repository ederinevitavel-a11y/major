import express from 'express';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const API_BASE = 'https://missclick-league.web.app/api/v1';
  const TOKEN = 'mcl_AHt71vuSpEsyF4oaE1-Hciy7AOR-8H8RU3-DVrM53RQ';

  // Proxy route for members
  app.get('/api/missclick/members', async (req, res) => {
    try {
      const response = await fetch(`${API_BASE}/members`, {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
        },
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err: any) {
      console.error('Error proxying /members:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // Proxy route for guild-highscores
  app.get('/api/missclick/guild-highscores', async (req, res) => {
    try {
      const response = await fetch(`${API_BASE}/guild-highscores`, {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
        },
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err: any) {
      console.error('Error proxying /guild-highscores:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // Proxy route for character highscores
  app.get('/api/missclick/highscores', async (req, res) => {
    try {
      const { name, day } = req.query;
      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }
      let url = `${API_BASE}/highscores?name=${encodeURIComponent(String(name))}`;
      if (day) {
        url += `&day=${encodeURIComponent(String(day))}`;
      }
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
        },
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err: any) {
      console.error('Error proxying /highscores:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
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
