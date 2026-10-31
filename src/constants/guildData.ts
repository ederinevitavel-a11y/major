import { HuntDay, PriorityRank, SlotType } from '../types';

export const DAYS_CONFIG: Array<{ key: HuntDay; label: string; shortLabel: string; dateInfo: string }> = [
  { key: 'friday', label: 'Sexta-feira', shortLabel: 'SEX', dateInfo: 'Início do fim de semana' },
  { key: 'saturday', label: 'Sábado', shortLabel: 'SÁB', dateInfo: 'Pico de hunts da guild' },
  { key: 'sunday', label: 'Domingo', shortLabel: 'DOM', dateInfo: 'Fechamento de escala' },
];

export const NORMAL_TIME_SLOTS: string[] = [
  '05:00h – 08:00h',
  '08:00h – 10:20h',
  '10:20h – 12:40h',
  '12:40h – 15:00h',
  '15:00h – 17:20h',
  '17:20h – 19:40h',
  '19:40h – 22:00h',
  '22:00h – 00:20h',
  '00:20h – 02:40h',
  '02:40h – 05:00h',
];

export const THREE_HOUR_TIME_SLOTS: string[] = [
  '05:00h – 08:00h',
  '08:00h – 12:20h',
  '12:20h – 15:40h',
  '15:40h – 19:00h',
  '19:00h – 22:20h',
  '22:20h – 01:40h',
  '01:40h – 05:00h',
];

export const NORMAL_RESPAWNS: string[] = [
  'Asura Espelho',
  'Azzilon Castle',
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
  'Livro Energy',
  'Livro Fire',
  'Livro Ice',
  'Monster Graveyard (Direita)',
  'Monster Graveyard (Esquerda)',
  'Nimmersatt Dragon (+1)',
  'Nimmersatt Dragon (Normal)',
  'Norcferatu Castle',
  'Norcferatu Catacombs (Direita)',
  'Norcferatu Catacombs (Esquerda)',
  'Podzilla Roothing -2',
  'Pumin -1 / -2',
  'Rotten Wasteland',
  'Souls Venore',
  'Sparkling Polls (Alt)',
  'Sparkling Polls (Normal)',
  'Unhallowed Crypt',
  'Upper Roshamuul',
  'Warzone 3',
  'West',
];

export const THREE_HOUR_RESPAWNS: string[] = [
  'Darklight',
  'Gloom Pillars',
  'Jaded Roots',
  'Putrefactory',
  'Radiant Ascendancy',
  'Radiant Skyhold',
];

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
