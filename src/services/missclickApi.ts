import { auth } from '../firebase/config';

const PROXY_BASE = '/api/missclick';

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchMissclickMembers() {
  try {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders) return null;
    const res = await fetch(`${PROXY_BASE}/members`, {
      headers: authHeaders,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Error fetching missclick members:', err);
    return null;
  }
}

export async function fetchGuildHighscores(
  playersHint?: Array<{ name: string; level?: number; vocation?: string }>,
  forceRefresh = false
) {
  try {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders) return null;
    const res =
      playersHint && playersHint.length > 0
        ? await fetch(`${PROXY_BASE}/guild-highscores${forceRefresh ? '?force=1' : ''}`, {
            method: 'POST',
            headers: {
              ...authHeaders,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ players: playersHint, force: forceRefresh }),
          })
        : await fetch(`${PROXY_BASE}/guild-highscores${forceRefresh ? '?force=1' : ''}`, {
            headers: authHeaders,
          });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Error fetching guild highscores:', err);
    return null;
  }
}

export async function fetchCharacterHighscores(name: string, day?: string) {
  try {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders) return null;
    let url = `${PROXY_BASE}/highscores?name=${encodeURIComponent(name)}`;
    if (day) url += `&day=${encodeURIComponent(day)}`;
    const res = await fetch(url, {
      headers: authHeaders,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Error fetching highscores for ${name}:`, err);
    return null;
  }
}
