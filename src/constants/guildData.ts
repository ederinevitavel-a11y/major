import { HuntDay, PriorityRank, SlotType } from '../types';

export const DAYS_CONFIG: Array<{ key: HuntDay; label: string; shortLabel: string; dateInfo: string }> = [
  { key: 'friday', label: 'Sexta-feira', shortLabel: 'SEX', dateInfo: 'Início do fim de semana' },
  { key: 'saturday', label: 'Sábado', shortLabel: 'SÁB', dateInfo: 'Pico de hunts da guild' },
  { key: 'sunday', label: 'Domingo', shortLabel: 'DOM', dateInfo: 'Fechamento de escala' },
];

export const NORMAL_TIME_SLOTS: string[] = [
  '06:00h – 09:00h',
  '09:00h – 11:20h',
  '11:20h – 13:40h',
  '13:40h – 16:00h',
  '16:00h – 18:20h',
  '18:20h – 20:40h',
  '20:40h – 23:00h',
  '23:00h – 01:20h',
  '01:20h – 03:40h',
  '03:40h – 06:00h',
];

export const THREE_HOUR_TIME_SLOTS: string[] = [
  '06:00h – 09:00h',
  '09:00h – 13:20h',
  '13:20h – 16:40h',
  '16:40h – 20:00h',
  '20:00h – 23:20h',
  '23:20h – 02:40h',
  '02:40h – 06:00h',
];

export const NORMAL_RESPAWNS: string[] = [
  'Asura Espelho',
  'Azzilon Castle',
  'Bloodfire Gorge',
  'Bulltair -1',
  'Bulltair -2',
  'Caminho Ferumbras',
  'Cobra Castelo',
  'Crystal Enigma',
  'DT -1',
  'DT -2',
  'Elfo de Fogo',
  'Falcon Subsolo',
  'Forgotten Crypt',
  'Goannas',
  'HFF',
  'Ingol (-1)',
  'Ingol (-2)',
  'Ingol (-3)',
  'Ingol (Surface)',
  'Inner Crypt',
  'Livro Energy',
  'Livro Fire',
  'Livro Ice',
  'Nimmersatt Dragon (+1)',
  'Nimmersatt Dragon (Normal)',
  'Norcferatu Castle',
  'Norcferatu Catacombs (Direita)',
  'Norcferatu Catacombs (Esquerda)',
  'Plague Seal',
  'Podzilla Roothing -2',
  'Pumin -1 / -2',
  'Quaras Podzilla',
  'Soul Fear',
  'Souls Earth',
  'Souls Energy',
  'True Asura',
  'Undead Seal',
  'Unhallowed Crypt',
  'Upper Roshamuul',
  'Warzone 3',
  'West',
];

export const THREE_HOUR_RESPAWNS: string[] = [];

export const PLANILHADOS_RESPAWNS: string[] = [
  'Darklight Core',
  'Gloom Pillars',
  'Jaded Roots',
  'Monster Graveyard Direita',
  'Monster Graveyard Esquerda',
  'Putrefactory',
  'Radiant Ascendancy',
  'Radiant Skyhold',
  'Souls Fire Raid',
  'Souls Thais',
  'Sparkling Pools',
];

export const PLANILHADOS_SLOTS_MAP: Record<string, string[]> = {
  'Darklight Core': ['18:00h – 20:00h', '20:00h – 22:30h'],
  'Gloom Pillars': ['06:15h – 08:30h', '08:30h – 12:00h', '19:15h – 22:30h', '21:00h – 23:00h', '22:30h – 01:00h'],
  'Jaded Roots': ['06:10h – 09:20h', '09:20h – 13:00h', '14:30h – 18:10h', '19:30h – 22:15h', '22:15h – 00:30h'],
  'Monster Graveyard Direita': ['06:30h – 08:00h'],
  'Monster Graveyard Esquerda': ['06:20h – 09:00h', '08:00h – 09:00h', '09:00h – 12:00h', '16:00h – 18:00h', '19:00h – 21:30h'],
  'Putrefactory': ['06:00h – 09:00h', '09:00h – 12:15h', '17:50h – 21:00h', '21:30h – 01:00h'],
  'Souls Fire Raid': ['13:00h – 14:00h', '23:00h – 01:30h'],
  'Souls Thais': ['14:00h – 17:35h', '19:30h – 22:00h', '20:00h – 22:30h'],
  'Sparkling Pools': ['06:20h – 09:00h'],
};

export const PLANILHADOS_COLOR_MAP: Record<string, { label: string; dotEmoji: string; badgeClass: string; borderClass: string; bgClass: string }> = {
  'Darklight Core': { label: '', dotEmoji: '', badgeClass: '', borderClass: 'border-slate-200 dark:border-slate-800', bgClass: '' },
  'Gloom Pillars': { label: '', dotEmoji: '', badgeClass: '', borderClass: 'border-slate-200 dark:border-slate-800', bgClass: '' },
  'Jaded Roots': { label: '', dotEmoji: '', badgeClass: '', borderClass: 'border-slate-200 dark:border-slate-800', bgClass: '' },
  'Monster Graveyard Direita': { label: '', dotEmoji: '', badgeClass: '', borderClass: 'border-slate-200 dark:border-slate-800', bgClass: '' },
  'Monster Graveyard Esquerda': { label: '', dotEmoji: '', badgeClass: '', borderClass: 'border-slate-200 dark:border-slate-800', bgClass: '' },
  'Putrefactory': { label: '', dotEmoji: '', badgeClass: '', borderClass: 'border-slate-200 dark:border-slate-800', bgClass: '' },
  'Radiant Ascendancy': { label: '', dotEmoji: '', badgeClass: '', borderClass: 'border-slate-200 dark:border-slate-800', bgClass: '' },
  'Radiant Skyhold': { label: '', dotEmoji: '', badgeClass: '', borderClass: 'border-slate-200 dark:border-slate-800', bgClass: '' },
  'Souls Fire Raid': { label: '', dotEmoji: '', badgeClass: '', borderClass: 'border-slate-200 dark:border-slate-800', bgClass: '' },
  'Souls Thais': { label: '', dotEmoji: '', badgeClass: '', borderClass: 'border-slate-200 dark:border-slate-800', bgClass: '' },
  'Sparkling Pools': { label: '', dotEmoji: '', badgeClass: '', borderClass: 'border-slate-200 dark:border-slate-800', bgClass: '' },
};

export const parseStartTime = (slot: string): number => {
  const match = slot.match(/^(\d{2}):(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
};

export const parseDayStartTime = (slot: string): number => {
  let min = parseStartTime(slot);
  if (min < 360) min += 1440; // 06:00h is 360 min. Slots from 00:00 to 05:59 belong to the end of the 24h cycle
  return min;
};

export const parseSlotRange = (slot: string): { start: number; end: number } => {
  const match = slot.match(/^(\d{2}):(\d{2})\s*–\s*(\d{2}):(\d{2})/);
  if (!match) return { start: 0, end: 0 };
  let start = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  let end = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
  if (end <= start) end += 1440;
  return { start, end };
};

export const formatMinutesToSlot = (startMin: number, endMin: number): string => {
  const formatHourMin = (totalMin: number) => {
    const modMin = (totalMin % 1440 + 1440) % 1440;
    const h = Math.floor(modMin / 60).toString().padStart(2, '0');
    const m = (modMin % 60).toString().padStart(2, '0');
    return `${h}:${m}h`;
  };
  return `${formatHourMin(startMin)} – ${formatHourMin(endMin)}`;
};

export const getPlanilhadoAllTimeSlots = (respawnName: string): string[] => {
  const customSlots = PLANILHADOS_SLOTS_MAP[respawnName] || [];
  if (customSlots.length === 0) return NORMAL_TIME_SLOTS;

  const customRanges = customSlots.map(s => parseSlotRange(s)).sort((a, b) => a.start - b.start);

  const dayStart = 360; // 06:00h
  const dayEnd = 1800; // 06:00h next day

  const resultSlots: string[] = [...customSlots];

  const splitGapInto2h20m = (gStart: number, gEnd: number) => {
    let current = gStart;
    const maxDuration = 140; // 2 hours and 20 minutes

    while (current < gEnd) {
      const remaining = gEnd - current;
      if (remaining <= 20) {
        break;
      }
      if (remaining <= maxDuration) {
        resultSlots.push(formatMinutesToSlot(current, gEnd));
        break;
      } else {
        const next = current + maxDuration;
        resultSlots.push(formatMinutesToSlot(current, next));
        current = next;
      }
    }
  };

  let lastEnd = dayStart;

  for (const range of customRanges) {
    let rangeStart = range.start;
    if (rangeStart < dayStart) rangeStart += 1440;
    let rangeEnd = range.end;
    if (rangeEnd < rangeStart) rangeEnd += 1440;

    if (rangeStart > lastEnd) {
      splitGapInto2h20m(lastEnd, rangeStart);
    }
    if (rangeEnd > lastEnd) {
      lastEnd = rangeEnd;
    }
  }

  if (lastEnd < dayEnd) {
    splitGapInto2h20m(lastEnd, dayEnd);
  }

  const uniqueSlots = Array.from(new Set(resultSlots));
  return uniqueSlots.sort((a, b) => parseDayStartTime(a) - parseDayStartTime(b));
};

export const PRIORITY_RANKS: PriorityRank[] = [
  'Leader',
  'Challenger',
  'Guardian',
  'Loyal',
  'Member',
  'Beginner',
  'Newcomer',
];

export const RANK_METADATA: Record<
  PriorityRank,
  { label: string; badgeClass: string; color: string; description: string }
> = {
  Leader: {
    label: 'Leader',
    badgeClass: 'bg-black text-white border-slate-900 dark:bg-black dark:text-white dark:border-slate-800 shadow-md',
    color: '#000000',
    description: 'Liderança máxima da guild (Preto)',
  },
  Challenger: {
    label: 'Challenger',
    badgeClass: 'bg-red-600 text-white border-red-700 dark:bg-red-600 dark:text-white dark:border-red-500 shadow-md',
    color: '#DC2626',
    description: 'Rank Challenger (Vermelho)',
  },
  Guardian: {
    label: 'Guardian',
    badgeClass: 'bg-purple-600 text-white border-purple-700 dark:bg-purple-600 dark:text-white dark:border-purple-500 shadow-md',
    color: '#9333EA',
    description: 'Rank Guardian (Roxo)',
  },
  Loyal: {
    label: 'Loyal',
    badgeClass: 'bg-emerald-600 text-white border-emerald-700 dark:bg-emerald-600 dark:text-white dark:border-emerald-500 shadow-md',
    color: '#059669',
    description: 'Rank Loyal (Verde)',
  },
  Member: {
    label: 'Member',
    badgeClass: 'bg-yellow-400 text-slate-950 border-yellow-500 dark:bg-yellow-400 dark:text-slate-950 dark:border-yellow-300 font-bold shadow-md',
    color: '#FACC15',
    description: 'Rank Member (Amarelo)',
  },
  Beginner: {
    label: 'Beginner',
    badgeClass: 'bg-blue-600 text-white border-blue-700 dark:bg-blue-600 dark:text-white dark:border-blue-500 shadow-md',
    color: '#2563EB',
    description: 'Rank Beginner (Azul)',
  },
  Newcomer: {
    label: 'Newcomer',
    badgeClass: 'bg-white text-slate-900 border-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-400 shadow-md',
    color: '#FFFFFF',
    description: 'Rank Newcomer (Branco)',
  },
};

export const DEFAULT_GUILDS = [
  { name: 'Missclick', apiUrl: 'https://api.tibiadata.com/v4/guild/Missclick' },
  { name: 'Caxambu', apiUrl: 'https://api.tibiadata.com/v4/guild/Caxambu' },
];

export const SUPER_ADMIN_EMAIL = 'ederinevitavel@gmail.com';
