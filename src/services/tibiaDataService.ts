import { PriorityRank, TibiaGuildMember, TibiaGuildResponse } from '../types';
import { DEFAULT_GUILDS } from '../constants/guildData';

const CACHE_KEY_PREFIX = 'major_guild_cache_';
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes cache

interface CacheEntry {
  timestamp: number;
  data: TibiaGuildMember[];
  guildName: string;
}

export async function fetchGuildMembers(guildName: string): Promise<TibiaGuildMember[]> {
  const cleanName = guildName.trim();
  const cacheKey = `${CACHE_KEY_PREFIX}${cleanName.toLowerCase()}`;
  
  // Check localStorage cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const entry: CacheEntry = JSON.parse(cached);
      if (Date.now() - entry.timestamp < CACHE_TTL_MS && entry.data.length > 0) {
        return entry.data;
      }
    }
  } catch (err) {
    console.warn('Failed to read guild cache:', err);
  }

  // Fetch from TibiaData API v4
  const apiUrl = `https://api.tibiadata.com/v4/guild/${encodeURIComponent(cleanName)}`;
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`TibiaData API HTTP ${response.status}`);
    }

    const json: TibiaGuildResponse = await response.json();
    if (!json.guild || !Array.isArray(json.guild.members)) {
      throw new Error('Formato inválido retornado pela API da guilda');
    }

    const members = json.guild.members;

    // Save to cache
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data: members,
        guildName: cleanName,
      }));
    } catch {
      // Ignore storage full errors
    }

    return members;
  } catch (error) {
    console.error(`Erro ao consultar API da guilda ${cleanName}:`, error);

    // Fallback: Check expired cache if available
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const entry: CacheEntry = JSON.parse(cached);
        if (entry.data && entry.data.length > 0) {
          console.info(`Usando cache anterior para ${cleanName}`);
          return entry.data;
        }
      }
    } catch {
      // ignore
    }

    throw error;
  }
}

export interface CharacterSearchResult {
  found: boolean;
  member?: TibiaGuildMember;
  guildName?: string;
  suggestedRank?: PriorityRank;
}

export async function findCharacterInSupportedGuilds(
  charName: string,
  preferredGuild?: string
): Promise<CharacterSearchResult> {
  const targetChar = charName.trim().toLowerCase();
  const guildsToSearch = preferredGuild
    ? [preferredGuild, ...DEFAULT_GUILDS.map(g => g.name).filter(n => n.toLowerCase() !== preferredGuild.toLowerCase())]
    : DEFAULT_GUILDS.map(g => g.name);

  for (const guildName of guildsToSearch) {
    try {
      const members = await fetchGuildMembers(guildName);
      const match = members.find(m => m.name.toLowerCase() === targetChar);
      if (match) {
        return {
          found: true,
          member: match,
          guildName,
          suggestedRank: mapTibiaRankToPriority(match.rank),
        };
      }
    } catch {
      // Continue to next guild if one fails
    }
  }

  return { found: false };
}

export function mapTibiaRankToPriority(officialRank: string): PriorityRank {
  const lower = (officialRank || '').toLowerCase();
  if (lower.includes('leader') || lower.includes('lider')) {
    return 'Leader';
  }
  if (lower.includes('vice') || lower.includes('challenger') || lower.includes('commander')) {
    return 'Challenger';
  }
  if (lower.includes('guardian') || lower.includes('guard')) {
    return 'Guardian';
  }
  if (lower.includes('loyal') || lower.includes('veteran')) {
    return 'Loyal';
  }
  if (lower.includes('member') || lower.includes('membro')) {
    return 'Member';
  }
  if (lower.includes('beginner') || lower.includes('iniciante') || lower.includes('trial')) {
    return 'Beginner';
  }
  return 'Newcomer';
}

export interface TibiaCharacterInfo {
  name: string;
  level: number;
  experience: number;
  vocation: string;
  world: string;
  rank?: string;
}

export async function fetchCharacter(charName: string): Promise<TibiaCharacterInfo | null> {
  const clean = charName.trim();
  if (!clean) return null;
  const url = `https://api.tibiadata.com/v4/character/${encodeURIComponent(clean)}`;
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    const char = json.characters?.character;
    if (!char) return null;
    return {
      name: char.name,
      level: char.level || 0,
      experience: char.experience || 0,
      vocation: char.vocation || '',
      world: char.world || '',
      rank: char.guild?.rank || '',
    };
  } catch (err) {
    console.error(`Erro ao buscar personagem ${clean}:`, err);
    return null;
  }
}

