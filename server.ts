import express from 'express';
import { createServer as createViteServer } from 'vite';

function parseTibiaXp(str: string): number {
  if (!str) return 0;
  const clean = str.trim().toLowerCase();
  if (clean.endsWith('kkk')) {
    const num = parseFloat(clean.replace('kkk', '').replace(',', '.'));
    return Math.round(num * 1_000_000_000);
  }
  if (clean.endsWith('kk')) {
    const num = parseFloat(clean.replace('kk', '').replace(',', '.'));
    return Math.round(num * 1_000_000);
  }
  if (clean.endsWith('k')) {
    const num = parseFloat(clean.replace('k', '').replace(',', '.'));
    return Math.round(num * 1_000);
  }
  const digits = clean.replace(/[^0-9]/g, '');
  return parseInt(digits, 10) || 0;
}

async function scrapePlayerYesterdayExp(charName: string) {
  try {
    const res = await fetch(`https://missclick-league.web.app/players/${encodeURIComponent(charName)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return null;
    const text = await res.text();

    // Look for attendance card: XP DD/MM/YYYY and value (RSC payload or rendered HTML)
    const m =
      text.match(/XP\s+(\d{2}\/\d{2}\/\d{4})[\s\S]{1,160}?children\\?":\\?"([^"\\]+)/i) ||
      text.match(/XP\s+(\d{2}\/\d{2}\/\d{4})<\/p><p[^>]*>([^<]+)<\/p>/i);

    let yesterdayExp = 0;
    let formattedXp = '';
    let xpDate = '';

    if (m) {
      xpDate = m[1];
      formattedXp = m[2];
      yesterdayExp = parseTibiaXp(formattedXp);
    }

    const vocM =
      text.match(/vocation-[a-z]+\.webp[^>]*alt="([^"]+)"/i) ||
      text.match(/\b(Elder Druid|Royal Paladin|Elite Knight|Master Sorcerer|Exalted Monk)\b/i);
    const lvlM = text.match(/Level\s*(?:<!--\s*-->|\s|",")*\s*([0-9][0-9.,]*)/i);
    const parsedLevel = lvlM ? parseInt(lvlM[1].replace(/[.,]/g, ''), 10) || 0 : 0;

    return {
      name: charName,
      level: parsedLevel || undefined,
      vocation: vocM?.[1] || undefined,
      yesterdayExp,
      expYesterday: yesterdayExp,
      formattedXp,
      xpDate,
    };
  } catch (err) {
    console.warn(`Error scraping player ${charName}:`, err);
    return null;
  }
}

async function fetchLeaderboardPlayersFallback(): Promise<Array<{ name: string; level?: number; vocation?: string }>> {
  try {
    const res = await fetch('https://missclick-league.web.app/leaderboard/daily', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (res.ok) {
      const html = await res.text();
      const rowRegex = /vocation-[a-z]+\.webp\?v=hq"\s+alt="([^"]+)"[\s\S]{0,250}?href="\/players\/[^"]+">([^<]+)<\/a>[\s\S]{0,160}?data-label="Level">([^<]+)<\/span>/gi;
      const players: Array<{ name: string; level?: number; vocation?: string }> = [];
      const seen = new Set<string>();
      let match: RegExpExecArray | null;
      while ((match = rowRegex.exec(html)) !== null && players.length < 40) {
        const vocation = match[1].trim();
        const name = match[2].trim();
        const level = parseInt(match[3].replace(/[.,]/g, ''), 10) || 0;
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          players.push({ name, level, vocation });
        }
      }
      if (players.length > 0) return players;
    }
  } catch (err) {
    console.warn('Error fetching daily leaderboard fallback:', err);
  }

  try {
    const tdRes = await fetch('https://api.tibiadata.com/v4/guild/Missclick');
    if (tdRes.ok) {
      const tdData = await tdRes.json();
      const members = tdData?.guild?.members || [];
      return members.slice(0, 40).map((m: any) => ({
        name: m.name,
        level: m.level,
        vocation: m.vocation,
      }));
    }
  } catch (err) {
    console.warn('Error fetching TibiaData fallback:', err);
  }

  return [];
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const API_BASE = 'https://missclick-league.web.app/api/v1';
  const TOKEN = 'mcl_AHt71vuSpEsyF4oaE1-Hciy7AOR-8H8RU3-DVrM53RQ';

  let apiRateLimitedUntil = 0;
  let guildHighscoresCache: { data: any; timestamp: number } | null = null;
  const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

  // Proxy route for members with TibiaData fallback
  app.get('/api/missclick/members', async (req, res) => {
    try {
      if (Date.now() > apiRateLimitedUntil) {
        const response = await fetch(`${API_BASE}/members`, {
          headers: {
            'Authorization': `Bearer ${TOKEN}`,
          },
        });
        if (response.status === 429) {
          apiRateLimitedUntil = Date.now() + 10 * 60 * 1000;
        } else if (response.ok) {
          const data = await response.json();
          return res.status(response.status).json(data);
        }
      }

      const tdRes = await fetch('https://api.tibiadata.com/v4/guild/Missclick');
      if (tdRes.ok) {
        const tdData = await tdRes.json();
        return res.json({ members: tdData?.guild?.members || [], source: 'tibiadata-fallback' });
      }
      res.status(502).json({ error: 'Unable to load members' });
    } catch (err: any) {
      console.error('Error proxying /members:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // Shared handler for guild-highscores (supports GET and POST with players hint)
  const handleGuildHighscores = async (req: express.Request, res: express.Response) => {
    try {
      const force = req.query.force === '1' || req.body?.force === true;
      const bodyPlayers: Array<{ name: string; level?: number; vocation?: string }> = Array.isArray(req.body?.players)
        ? req.body.players
        : [];

      if (!force && guildHighscoresCache && Date.now() - guildHighscoresCache.timestamp < CACHE_TTL_MS) {
        return res.json(guildHighscoresCache.data);
      }

      // 1. Try official API if not rate-limited
      if (Date.now() > apiRateLimitedUntil) {
        try {
          const response = await fetch(`${API_BASE}/guild-highscores`, {
            headers: {
              'Authorization': `Bearer ${TOKEN}`,
            },
          });
          if (response.status === 429) {
            apiRateLimitedUntil = Date.now() + 10 * 60 * 1000;
          } else if (response.ok) {
            const data = await response.json();
            const list = Array.isArray(data) ? data : (data?.members || data?.players || data?.highscores || []);
            if (Array.isArray(list) && list.length > 0 && !data?.error) {
              guildHighscoresCache = { data, timestamp: Date.now() };
              return res.json(data);
            }
          }
        } catch {
          // continue to live scraping fallback
        }
      }

      // 2. Fallback: scrape live player sheets from Missclick League for guild players
      let targetPlayers: Array<{ name: string; level?: number; vocation?: string }> = bodyPlayers
        .filter(p => p && p.name)
        .map(p => ({ name: String(p.name).trim(), level: p.level, vocation: p.vocation }));

      if (targetPlayers.length === 0) {
        targetPlayers = (await fetchLeaderboardPlayersFallback()).slice(0, 30);
      } else {
        // Also merge top leaderboard players up to 35 total if list is small
        if (targetPlayers.length < 20) {
          const lbPlayers = await fetchLeaderboardPlayersFallback();
          const existingNames = new Set(targetPlayers.map(p => p.name.toLowerCase()));
          for (const lp of lbPlayers) {
            if (!existingNames.has(lp.name.toLowerCase()) && targetPlayers.length < 35) {
              existingNames.add(lp.name.toLowerCase());
              targetPlayers.push(lp);
            }
          }
        }
      }

      // Deduplicate and cap at 60 players to keep response fast
      const uniquePlayers: Array<{ name: string; level?: number; vocation?: string }> = [];
      const seen = new Set<string>();
      for (const p of targetPlayers) {
        const key = p.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          uniquePlayers.push(p);
        }
        if (uniquePlayers.length >= 60) break;
      }

      const results: any[] = [];
      const batchSize = 15;
      for (let i = 0; i < uniquePlayers.length; i += batchSize) {
        const batch = uniquePlayers.slice(i, i + batchSize);
        const batchRes = await Promise.all(
          batch.map(async p => {
            const scraped = await scrapePlayerYesterdayExp(p.name);
            return {
              name: p.name,
              level: scraped?.level || p.level || 0,
              vocation: scraped?.vocation || p.vocation || 'N/D',
              yesterdayExp: scraped?.yesterdayExp ?? 0,
              expYesterday: scraped?.yesterdayExp ?? 0,
              formattedXp: scraped?.formattedXp || '0 XP',
              xpDate: scraped?.xpDate || '',
            };
          })
        );
        results.push(...batchRes);
      }

      results.sort((a, b) => (b.yesterdayExp - a.yesterdayExp) || ((b.level || 0) - (a.level || 0)));

      const latestXpDate = results.find(r => r.xpDate)?.xpDate || '';
      const payload = {
        players: results,
        xpDate: latestXpDate,
        source: 'missclick-league-live',
        updatedAt: new Date().toISOString(),
      };

      if (results.length > 0) {
        guildHighscoresCache = { data: payload, timestamp: Date.now() };
      }

      return res.json(payload);
    } catch (err: any) {
      console.error('Error in /guild-highscores:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  };

  app.get('/api/missclick/guild-highscores', handleGuildHighscores);
  app.post('/api/missclick/guild-highscores', handleGuildHighscores);

  // Route for character highscores with live fallback
  app.get('/api/missclick/highscores', async (req, res) => {
    try {
      const { name, day } = req.query;
      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }

      let resultData: any = null;

      // 1. Try official API first
      try {
        let url = `${API_BASE}/highscores?name=${encodeURIComponent(String(name))}`;
        if (day) {
          url += `&day=${encodeURIComponent(String(day))}`;
        }
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${TOKEN}`,
          },
        });
        if (response.ok) {
          resultData = await response.json();
        }
      } catch {
        // api request failed, continue to fallback
      }

      // 2. If API was rate limited (429) or lacked yesterday's exp, fetch player sheet from Missclick League
      if (!resultData || resultData.error || (!resultData.yesterdayExp && !resultData.expYesterday)) {
        const scraped = await scrapePlayerYesterdayExp(String(name));
        if (scraped && scraped.yesterdayExp > 0) {
          return res.json({
            ...(resultData && !resultData.error ? resultData : {}),
            ...scraped,
          });
        }
      }

      if (resultData && !resultData.error) {
        return res.json(resultData);
      }

      // Return clean fallback
      res.json({
        name: String(name),
        yesterdayExp: 0,
        expYesterday: 0,
        formattedXp: '0 XP',
      });
    } catch (err: any) {
      console.error('Error in /highscores:', err);
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
