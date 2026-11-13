import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
  body?: any;
}

export interface ApiResponse {
  setHeader(name: string, value: string): unknown;
  status(code: number): ApiResponse;
  json(data: unknown): unknown;
}

interface FirebaseConfigFile {
  projectId: string;
  firestoreDatabaseId?: string;
}

function loadFirebaseConfig(): FirebaseConfigFile {
  const candidates = [
    new URL('../../firebase-applet-config.json', import.meta.url),
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return JSON.parse(fs.readFileSync(candidate, 'utf8')) as FirebaseConfigFile;
      }
    } catch {
      // try next candidate
    }
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID || 'rapid-clone-hcb1c',
    firestoreDatabaseId:
      process.env.FIRESTORE_DATABASE_ID || 'ai-studio-02e85900-b9da-40d2-bed2-a56c703d6737',
  };
}

const firebaseConfig = loadFirebaseConfig();
const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId || '(default)';
const SUPER_ADMIN_EMAILS = new Set(['ederinevitavel@gmail.com', 'admissclick@gmail.com']);
const API_BASE = 'https://missclick-league.web.app/api/v1';
const VALID_CHAR_NAME_REGEX = /^[a-zA-Z0-9\s'._-]+$/;
const CACHE_TTL_MS = 3 * 60 * 1000;
const FORCE_REFRESH_COOLDOWN_MS = 30 * 1000;

let googleCertsCache: { certs: Record<string, string>; expiresAt: number } | null = null;
const whitelistCache = new Map<string, { authorized: boolean; isAdmin: boolean; expiresAt: number }>();
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const forceRefreshByUser = new Map<string, number>();
const guildHighscoresCache = new Map<string, { data: any; timestamp: number }>();
let apiRateLimitedUntil = 0;

function decodeBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  return Buffer.from(pad ? normalized + '='.repeat(4 - pad) : normalized, 'base64');
}

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  if (googleCertsCache && Date.now() < googleCertsCache.expiresAt) {
    return googleCertsCache.certs;
  }
  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Google public certs: ${res.status}`);
  }
  const certs = (await res.json()) as Record<string, string>;
  const cc = res.headers.get('cache-control') || '';
  const maxAgeMatch = cc.match(/max-age=(\d+)/i);
  const maxAgeMs = maxAgeMatch ? Math.max(60, parseInt(maxAgeMatch[1], 10)) * 1000 : 3600 * 1000;
  googleCertsCache = { certs, expiresAt: Date.now() + maxAgeMs };
  return certs;
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  isAdmin: boolean;
}

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSig] = parts;
  const header = JSON.parse(decodeBase64Url(encodedHeader).toString('utf8')) as {
    alg?: string;
    kid?: string;
  };
  if (header.alg !== 'RS256' || !header.kid) return null;

  const certs = await getGooglePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) return null;

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();
  const signatureValid = verifier.verify(certPem, decodeBase64Url(encodedSig));
  if (!signatureValid) return null;

  const payload = JSON.parse(decodeBase64Url(encodedPayload).toString('utf8')) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
  };

  const nowSec = Math.floor(Date.now() / 1000);
  if (
    payload.aud !== FIREBASE_PROJECT_ID ||
    payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` ||
    typeof payload.sub !== 'string' ||
    !payload.sub ||
    typeof payload.exp !== 'number' ||
    payload.exp <= nowSec ||
    typeof payload.iat !== 'number' ||
    payload.iat > nowSec + 300 ||
    typeof payload.email !== 'string' ||
    !payload.email ||
    payload.email_verified !== true
  ) {
    return null;
  }

  const email = payload.email.trim().toLowerCase();
  return {
    uid: payload.sub,
    email,
    isAdmin: SUPER_ADMIN_EMAILS.has(email),
  };
}

async function checkWhitelistAccess(
  user: VerifiedFirebaseUser,
  idToken: string
): Promise<{ authorized: boolean; isAdmin: boolean }> {
  if (SUPER_ADMIN_EMAILS.has(user.email)) {
    return { authorized: true, isAdmin: true };
  }

  const cacheKey = `${user.uid}:${user.email}`;
  const cached = whitelistCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return { authorized: cached.authorized, isAdmin: cached.isAdmin };
  }

  const candidateIds = Array.from(new Set([encodeURIComponent(user.email), user.email]));
  for (const docId of candidateIds) {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_PROJECT_ID
    )}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents/allowed_emails/${encodeURIComponent(
      docId
    )}`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (resp.ok) {
      const docJson = (await resp.json()) as {
        fields?: { role?: { stringValue?: string } };
      };
      const isAdmin = docJson?.fields?.role?.stringValue === 'admin';
      whitelistCache.set(cacheKey, {
        authorized: true,
        isAdmin,
        expiresAt: Date.now() + 2 * 60 * 1000,
      });
      return { authorized: true, isAdmin };
    }
  }

  whitelistCache.set(cacheKey, {
    authorized: false,
    isAdmin: false,
    expiresAt: Date.now() + 30 * 1000,
  });
  return { authorized: false, isAdmin: false };
}

function pruneMapIfLarge<K, V>(map: Map<K, V>, isExpired: (v: V) => boolean, maxSize = 500) {
  if (map.size <= maxSize) return;
  for (const [k, v] of map.entries()) {
    if (isExpired(v)) map.delete(k);
  }
  if (map.size > maxSize) {
    const excess = map.size - maxSize;
    let removed = 0;
    for (const k of map.keys()) {
      map.delete(k);
      if (++removed >= excess) break;
    }
  }
}

function checkUserRateLimit(uid: string, limit = 40, windowMs = 60_000): boolean {
  const now = Date.now();
  pruneMapIfLarge(rateLimitMap, v => now > v.resetAt);
  pruneMapIfLarge(whitelistCache, v => now >= v.expiresAt);
  const entry = rateLimitMap.get(uid);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(uid, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count += 1;
  return true;
}

function applySecurityHeaders(res: ApiResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

export async function authenticateRequest(
  req: ApiRequest,
  res: ApiResponse
): Promise<VerifiedFirebaseUser | null> {
  applySecurityHeaders(res);
  try {
    const rawHeader = req.headers.authorization || req.headers.Authorization || '';
    const authHeader = Array.isArray(rawHeader) ? rawHeader[0] || '' : rawHeader;
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      res.status(401).json({ error: 'Autenticação necessária.' });
      return null;
    }
    const idToken = match[1].trim();
    const verifiedUser = await verifyFirebaseIdToken(idToken);
    if (!verifiedUser) {
      res.status(401).json({ error: 'Token de sessão inválido ou expirado.' });
      return null;
    }
    const access = await checkWhitelistAccess(verifiedUser, idToken);
    if (!access.authorized) {
      res.status(403).json({ error: 'Usuário sem permissão na guilda.' });
      return null;
    }
    if (!checkUserRateLimit(verifiedUser.uid)) {
      res.status(429).json({ error: 'Muitas requisições. Aguarde um instante.' });
      return null;
    }
    return {
      ...verifiedUser,
      isAdmin: verifiedUser.isAdmin || access.isAdmin,
    };
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ error: 'Falha ao validar autenticação.' });
    return null;
  }
}

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
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return null;
    const text = await res.text();

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

async function fetchLeaderboardPlayersFallback(): Promise<
  Array<{ name: string; level?: number; vocation?: string }>
> {
  try {
    const res = await fetch('https://missclick-league.web.app/leaderboard/daily', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (res.ok) {
      const html = await res.text();
      const rowRegex =
        /vocation-[a-z]+\.webp\?v=hq"\s+alt="([^"]+)"[\s\S]{0,250}?href="\/players\/[^"]+">([^<]+)<\/a>[\s\S]{0,160}?data-label="Level">([^<]+)<\/span>/gi;
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

function getApiToken(): string {
  return process.env.MISSCLICK_API_TOKEN?.trim() || '';
}

function getQueryString(query: Record<string, unknown> | undefined, key: string): string {
  const val = query?.[key];
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return '';
}

export async function handleMembersRequest(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const user = await authenticateRequest(req, res);
  if (!user) return;

  const TOKEN = getApiToken();
  try {
    if (TOKEN && Date.now() > apiRateLimitedUntil) {
      const response = await fetch(`${API_BASE}/members`, {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
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
    return res.status(502).json({ error: 'Não foi possível carregar os membros.' });
  } catch (err) {
    console.error('Error proxying /members:', err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}

export async function handleGuildHighscoresRequest(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const user = await authenticateRequest(req, res);
  if (!user) return;

  const TOKEN = getApiToken();
  try {
    const uid = user.uid;
    const now = Date.now();
    const forceQuery = getQueryString(req.query, 'force');
    const requestedForce = forceQuery === '1' || req.body?.force === true;
    const lastUserForce = forceRefreshByUser.get(uid) || 0;
    const canForce = requestedForce && now - lastUserForce >= FORCE_REFRESH_COOLDOWN_MS;
    if (canForce) {
      pruneMapIfLarge(forceRefreshByUser, v => now - v >= FORCE_REFRESH_COOLDOWN_MS);
      forceRefreshByUser.set(uid, now);
    }

    const bodyPlayers: Array<{ name: string; level?: number; vocation?: string }> = Array.isArray(
      req.body?.players
    )
      ? req.body.players
      : [];

    const sanitizedBodyPlayers = bodyPlayers
      .filter(
        p =>
          p &&
          typeof p.name === 'string' &&
          p.name.trim().length > 0 &&
          p.name.trim().length <= 60 &&
          VALID_CHAR_NAME_REGEX.test(p.name.trim())
      )
      .slice(0, 60)
      .map(p => ({ name: String(p.name).trim(), level: p.level, vocation: p.vocation }));

    const cacheKey =
      sanitizedBodyPlayers.length > 0
        ? sanitizedBodyPlayers
            .map(p => p.name.toLowerCase())
            .sort()
            .join('|')
        : '__default__';

    const cachedEntry = guildHighscoresCache.get(cacheKey);
    if (!canForce && cachedEntry && now - cachedEntry.timestamp < CACHE_TTL_MS) {
      return res.json(cachedEntry.data);
    }

    if (TOKEN && Date.now() > apiRateLimitedUntil) {
      try {
        const response = await fetch(`${API_BASE}/guild-highscores`, {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
          },
        });
        if (response.status === 429) {
          apiRateLimitedUntil = Date.now() + 10 * 60 * 1000;
        } else if (response.ok) {
          const data = await response.json();
          const list = Array.isArray(data)
            ? data
            : data?.members || data?.players || data?.highscores || [];
          if (Array.isArray(list) && list.length > 0 && !data?.error) {
            pruneMapIfLarge(guildHighscoresCache, v => Date.now() - v.timestamp >= CACHE_TTL_MS, 15);
            guildHighscoresCache.set('__default__', { data, timestamp: Date.now() });
            return res.json(data);
          }
        }
      } catch {
        // continue to live scraping fallback
      }
    }

    let targetPlayers: Array<{ name: string; level?: number; vocation?: string }> = [
      ...sanitizedBodyPlayers,
    ];

    if (targetPlayers.length === 0) {
      targetPlayers = (await fetchLeaderboardPlayersFallback()).slice(0, 30);
    } else if (targetPlayers.length < 20) {
      const lbPlayers = await fetchLeaderboardPlayersFallback();
      const existingNames = new Set(targetPlayers.map(p => p.name.toLowerCase()));
      for (const lp of lbPlayers) {
        if (!existingNames.has(lp.name.toLowerCase()) && targetPlayers.length < 35) {
          existingNames.add(lp.name.toLowerCase());
          targetPlayers.push(lp);
        }
      }
    }

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

    results.sort((a, b) => b.yesterdayExp - a.yesterdayExp || (b.level || 0) - (a.level || 0));

    const latestXpDate = results.find(r => r.xpDate)?.xpDate || '';
    const payload = {
      players: results,
      xpDate: latestXpDate,
      source: 'missclick-league-live',
      updatedAt: new Date().toISOString(),
    };

    if (results.length > 0) {
      pruneMapIfLarge(guildHighscoresCache, v => Date.now() - v.timestamp >= CACHE_TTL_MS, 15);
      guildHighscoresCache.set(cacheKey, { data: payload, timestamp: Date.now() });
    }

    return res.json(payload);
  } catch (err) {
    console.error('Error in /guild-highscores:', err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}

export async function handleCharacterHighscoresRequest(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const user = await authenticateRequest(req, res);
  if (!user) return;

  const TOKEN = getApiToken();
  try {
    const cleanName = getQueryString(req.query, 'name').trim();
    const rawDay = getQueryString(req.query, 'day').trim();

    if (!cleanName || cleanName.length > 60 || !VALID_CHAR_NAME_REGEX.test(cleanName)) {
      return res.status(400).json({ error: 'Parâmetro name inválido.' });
    }
    const cleanDay = /^[a-zA-Z0-9_-]{1,20}$/.test(rawDay) ? rawDay : undefined;

    let resultData: any = null;

    if (TOKEN) {
      try {
        let url = `${API_BASE}/highscores?name=${encodeURIComponent(cleanName)}`;
        if (cleanDay) {
          url += `&day=${encodeURIComponent(cleanDay)}`;
        }
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
          },
        });
        if (response.ok) {
          resultData = await response.json();
        }
      } catch {
        // api request failed, continue to fallback
      }
    }

    if (!resultData || resultData.error || (!resultData.yesterdayExp && !resultData.expYesterday)) {
      const scraped = await scrapePlayerYesterdayExp(cleanName);
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

    return res.json({
      name: cleanName,
      yesterdayExp: 0,
      expYesterday: 0,
      formattedXp: '0 XP',
    });
  } catch (err) {
    console.error('Error in /highscores:', err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
