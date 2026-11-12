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

export async function fetchGuildHighscores() {
  try {
    const res = await fetch(`${PROXY_BASE}/guild-highscores`);
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
