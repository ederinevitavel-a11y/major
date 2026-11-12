const PROXY_BASE = '/api/missclick';

export async function fetchMissclickMembers() {
  try {
    const res = await fetch(`${PROXY_BASE}/members`);
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
    const res =
      playersHint && playersHint.length > 0
        ? await fetch(`${PROXY_BASE}/guild-highscores${forceRefresh ? '?force=1' : ''}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ players: playersHint, force: forceRefresh }),
          })
        : await fetch(`${PROXY_BASE}/guild-highscores${forceRefresh ? '?force=1' : ''}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Error fetching guild highscores:', err);
    return null;
  }
}

export async function fetchCharacterHighscores(name: string, day?: string) {
  try {
    let url = `${PROXY_BASE}/highscores?name=${encodeURIComponent(name)}`;
    if (day) url += `&day=${day}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Error fetching highscores for ${name}:`, err);
    return null;
  }
}
