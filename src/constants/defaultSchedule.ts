import { Reservation, HuntDay, SlotType, PriorityRank } from '../types';

export interface FixedScheduleItem {
  id: string;
  day: HuntDay;
  slotType: SlotType;
  respawnName: string;
  timeSlot: string;
  charName: string;
  userRank: PriorityRank;
  userUid: string;
  notes?: string;
  exactTime?: string;
  isOccupied: boolean;
  reservedAt: string;
}

export const DEFAULT_FIXED_SCHEDULE: FixedScheduleItem[] = [
  // ==========================================
  // ==========================================
  // 🟡 AB1 — Forgotten Crypt (Especial / Planilhado)
  // Prezord | 19:30–22:00 | Sexta, Sábado e Domingo
  // ==========================================
  {
    id: 'fixed-special-forgottencrypt-prezord-fri',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Forgotten Crypt',
    timeSlot: '19:30h – 22:00h',
    charName: 'Prezord',
    userRank: 'Beginner',
    userUid: 'fixed-prezord',
    notes: 'Horário Planilhado: 19:30 – 22:00',
    exactTime: '19:30 – 22:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-special-forgottencrypt-prezord-sat',
    day: 'saturday',
    slotType: 'planilhados',
    respawnName: 'Forgotten Crypt',
    timeSlot: '19:30h – 22:00h',
    charName: 'Prezord',
    userRank: 'Beginner',
    userUid: 'fixed-prezord',
    notes: 'Horário Planilhado: 19:30 – 22:00',
    exactTime: '19:30 – 22:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-special-forgottencrypt-prezord-sun',
    day: 'sunday',
    slotType: 'planilhados',
    respawnName: 'Forgotten Crypt',
    timeSlot: '19:30h – 22:00h',
    charName: 'Prezord',
    userRank: 'Beginner',
    userUid: 'fixed-prezord',
    notes: 'Horário Planilhado: 19:30 – 22:00',
    exactTime: '19:30 – 22:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // ==========================================
  // 🔵 Unhallowed Crypt (Normal)
  // Eder | 20:40–23:00 | Sexta, Sábado e Domingo
  // ==========================================
  {
    id: 'fixed-ab3-eder-fri',
    day: 'friday',
    slotType: 'normal',
    respawnName: 'Unhallowed Crypt',
    timeSlot: '20:40h – 23:00h',
    charName: 'Eder',
    userRank: 'Challenger',
    userUid: 'fixed-eder',
    notes: 'Horário: 20:40 – 23:00',
    exactTime: '20:40 – 23:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-ab3-eder-sat',
    day: 'saturday',
    slotType: 'normal',
    respawnName: 'Unhallowed Crypt',
    timeSlot: '20:40h – 23:00h',
    charName: 'Eder',
    userRank: 'Challenger',
    userUid: 'fixed-eder',
    notes: 'Horário: 20:40 – 23:00',
    exactTime: '20:40 – 23:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-ab3-eder-sun',
    day: 'sunday',
    slotType: 'normal',
    respawnName: 'Unhallowed Crypt',
    timeSlot: '20:40h – 23:00h',
    charName: 'Eder',
    userRank: 'Challenger',
    userUid: 'fixed-eder',
    notes: 'Horário: 20:40 – 23:00',
    exactTime: '20:40 – 23:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // ==========================================
  // 🟡 B1 — Jaded Roots (3h Special)
  // 1. Teko Brand | 06:10–09:20 | Todos os dias (Slots: 05:00–08:00 e 08:00–12:20 até 09:20)
  // 2. Joseh Implacavel | 09:20–13:00 | Todos os dias (Slots: 08:00–12:20 a partir de 09:20 e 12:20–15:40 até 13:00)
  // 3. Cirokids | 14:30–18:10 | Todos os dias (Slots: 12:20–15:40 a partir de 14:30 e 15:40–19:00 até 18:10)
  // 4. Serz | 19:30–22:15 | Sexta
  // 5. Cirokids | 22:15–00:30 | Sexta
  // ==========================================
  // --- Teko Brand (06:10–09:20) ---
  {
    id: 'fixed-b1-teko-fri-1',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Jaded Roots',
    timeSlot: '06:10h – 09:20h',
    charName: 'Teko Brand',
    userRank: 'Leader',
    userUid: 'fixed-teko',
    notes: 'Horário Planilhado: 06:10 – 09:20',
    exactTime: '06:10 – 09:20',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-b1-teko-sat-1',
    day: 'saturday',
    slotType: 'planilhados',
    respawnName: 'Jaded Roots',
    timeSlot: '06:10h – 09:20h',
    charName: 'Teko Brand',
    userRank: 'Leader',
    userUid: 'fixed-teko',
    notes: 'Horário Planilhado: 06:10 – 09:20',
    exactTime: '06:10 – 09:20',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-b1-teko-sun-1',
    day: 'sunday',
    slotType: 'planilhados',
    respawnName: 'Jaded Roots',
    timeSlot: '06:10h – 09:20h',
    charName: 'Teko Brand',
    userRank: 'Leader',
    userUid: 'fixed-teko',
    notes: 'Horário Planilhado: 06:10 – 09:20',
    exactTime: '06:10 – 09:20',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- Joseh Implacavel (09:20–13:00) ---
  {
    id: 'fixed-b1-joseh-fri-1',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Jaded Roots',
    timeSlot: '09:20h – 13:00h',
    charName: 'Joseh Implacavel',
    userRank: 'Leader',
    userUid: 'fixed-joseh',
    notes: 'Horário Planilhado: 09:20 – 13:00',
    exactTime: '09:20 – 13:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-b1-joseh-sat-1',
    day: 'saturday',
    slotType: 'planilhados',
    respawnName: 'Jaded Roots',
    timeSlot: '09:20h – 13:00h',
    charName: 'Joseh Implacavel',
    userRank: 'Leader',
    userUid: 'fixed-joseh',
    notes: 'Horário Planilhado: 09:20 – 13:00',
    exactTime: '09:20 – 13:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-b1-joseh-sun-1',
    day: 'sunday',
    slotType: 'planilhados',
    respawnName: 'Jaded Roots',
    timeSlot: '09:20h – 13:00h',
    charName: 'Joseh Implacavel',
    userRank: 'Leader',
    userUid: 'fixed-joseh',
    notes: 'Horário Planilhado: 09:20 – 13:00',
    exactTime: '09:20 – 13:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- Cirokids (14:30–18:10) ---
  {
    id: 'fixed-b1-cirokids1-fri',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Jaded Roots',
    timeSlot: '14:30h – 18:10h',
    charName: 'Cirokids',
    userRank: 'Leader',
    userUid: 'fixed-cirokids',
    notes: 'Horário Planilhado: 14:30 – 18:10',
    exactTime: '14:30 – 18:10',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-b1-cirokids1-sat',
    day: 'saturday',
    slotType: 'planilhados',
    respawnName: 'Jaded Roots',
    timeSlot: '14:30h – 18:10h',
    charName: 'Cirokids',
    userRank: 'Leader',
    userUid: 'fixed-cirokids',
    notes: 'Horário Planilhado: 14:30 – 18:10',
    exactTime: '14:30 – 18:10',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-b1-cirokids1-sun',
    day: 'sunday',
    slotType: 'planilhados',
    respawnName: 'Jaded Roots',
    timeSlot: '14:30h – 18:10h',
    charName: 'Cirokids',
    userRank: 'Leader',
    userUid: 'fixed-cirokids',
    notes: 'Horário Planilhado: 14:30 – 18:10',
    exactTime: '14:30 – 18:10',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- Serz (19:30–22:15) ---
  {
    id: 'fixed-b1-serz-fri',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Jaded Roots',
    timeSlot: '19:30h – 22:15h',
    charName: 'Serz',
    userRank: 'Challenger',
    userUid: 'fixed-serz',
    notes: 'Horário Planilhado: 19:30 – 22:15',
    exactTime: '19:30 – 22:15',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- Cirokids (22:15–00:30) ---
  {
    id: 'fixed-b1-cirokids2-fri',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Jaded Roots',
    timeSlot: '22:15h – 00:30h',
    charName: 'Cirokids',
    userRank: 'Leader',
    userUid: 'fixed-cirokids',
    notes: 'Horário Planilhado: 22:15 – 00:30',
    exactTime: '22:15 – 00:30',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // ==========================================
  // 🟡 B2 — Putrefactory (3h Special)
  // 1. Sihid Drakell | 06:00–09:00 | Todos os dias
  // 2. Arkelogon | 09:00–12:15 | Sábado e domingo
  // 3. Arkelogon | 17:50–21:00 | Sexta
  // 4. Exalted Ragha | 21:30–01:00 | Todos os dias
  // ==========================================
  // --- Sihid Drakell (06:00–09:00) ---
  {
    id: 'fixed-b2-sihid-fri',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Putrefactory',
    timeSlot: '06:00h – 09:00h',
    charName: 'Sihid Drakell',
    userRank: 'Leader',
    userUid: 'fixed-sihid',
    notes: 'Horário Planilhado: 06:00 – 09:00',
    exactTime: '06:00 – 09:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-b2-sihid-sat',
    day: 'saturday',
    slotType: 'planilhados',
    respawnName: 'Putrefactory',
    timeSlot: '06:00h – 09:00h',
    charName: 'Sihid Drakell',
    userRank: 'Leader',
    userUid: 'fixed-sihid',
    notes: 'Horário Planilhado: 06:00 – 09:00',
    exactTime: '06:00 – 09:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-b2-sihid-sun',
    day: 'sunday',
    slotType: 'planilhados',
    respawnName: 'Putrefactory',
    timeSlot: '06:00h – 09:00h',
    charName: 'Sihid Drakell',
    userRank: 'Leader',
    userUid: 'fixed-sihid',
    notes: 'Horário Planilhado: 06:00 – 09:00',
    exactTime: '06:00 – 09:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- Arkelogon (09:00–12:15 | Sáb e Dom) ---
  {
    id: 'fixed-b2-arke1-sat',
    day: 'saturday',
    slotType: 'planilhados',
    respawnName: 'Putrefactory',
    timeSlot: '09:00h – 12:15h',
    charName: 'Arkelogon',
    userRank: 'Guardian',
    userUid: 'fixed-arkelogon',
    notes: 'Horário Planilhado: 09:00 – 12:15',
    exactTime: '09:00 – 12:15',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-b2-arke1-sun',
    day: 'sunday',
    slotType: 'planilhados',
    respawnName: 'Putrefactory',
    timeSlot: '09:00h – 12:15h',
    charName: 'Arkelogon',
    userRank: 'Guardian',
    userUid: 'fixed-arkelogon',
    notes: 'Horário Planilhado: 09:00 – 12:15',
    exactTime: '09:00 – 12:15',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- Arkelogon (17:50–21:00 | Sexta) ---
  {
    id: 'fixed-b2-arke2-fri-1',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Putrefactory',
    timeSlot: '17:50h – 21:00h',
    charName: 'Arkelogon',
    userRank: 'Guardian',
    userUid: 'fixed-arkelogon',
    notes: 'Horário Planilhado: 17:50 – 21:00',
    exactTime: '17:50 – 21:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- Exalted Ragha (21:30–01:00 | Todos os dias - Jogador: Ragha Healer) ---
  {
    id: 'fixed-b2-ragha-fri-1',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Putrefactory',
    timeSlot: '21:30h – 01:00h',
    charName: 'Exalted Ragha',
    userRank: 'Leader',
    userUid: 'fixed-raghahealer',
    notes: 'Horário Planilhado: 21:30 – 01:00 (Ragha Healer)',
    exactTime: '21:30 – 01:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-b2-ragha-sat-1',
    day: 'saturday',
    slotType: 'planilhados',
    respawnName: 'Putrefactory',
    timeSlot: '21:30h – 01:00h',
    charName: 'Exalted Ragha',
    userRank: 'Leader',
    userUid: 'fixed-raghahealer',
    notes: 'Horário Planilhado: 21:30 – 01:00 (Ragha Healer)',
    exactTime: '21:30 – 01:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-b2-ragha-sun-1',
    day: 'sunday',
    slotType: 'planilhados',
    respawnName: 'Putrefactory',
    timeSlot: '21:30h – 01:00h',
    charName: 'Exalted Ragha',
    userRank: 'Leader',
    userUid: 'fixed-raghahealer',
    notes: 'Horário Planilhado: 21:30 – 01:00 (Ragha Healer)',
    exactTime: '21:30 – 01:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // ==========================================
  // 🔴 B3 — Gloom Pillars (3h Special)
  // 1. Lady Blackarrow | 06:15–08:30 | Sexta
  // 2. Ragha Healer | 08:30–12:00 | Sexta
  // 3. Metaleiro Veeloz | 19:15–22:30 | Sexta
  // 4. Xbloodyx | 21:00–23:00 | Sábado e Domingo
  // 5. Xbloodyx | 22:30–01:00 | Sexta
  // ==========================================
  // --- Lady Blackarrow (06:15–08:30) ---
  {
    id: 'fixed-b3-lady-fri-1',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Gloom Pillars',
    timeSlot: '06:15h – 08:30h',
    charName: 'Lady Blackarrow',
    userRank: 'Guardian',
    userUid: 'fixed-ladyblackarrow',
    notes: 'Horário Planilhado: 06:15 – 08:30',
    exactTime: '06:15 – 08:30',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- Ragha Healer (08:30–12:00) ---
  {
    id: 'fixed-b3-raghahealer-fri',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Gloom Pillars',
    timeSlot: '08:30h – 12:00h',
    charName: 'Ragha Healer',
    userRank: 'Leader',
    userUid: 'fixed-raghahealer',
    notes: 'Horário Planilhado: 08:30 – 12:00',
    exactTime: '08:30 – 12:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- Metaleiro Veeloz (19:15–22:30) ---
  {
    id: 'fixed-b3-metaleiro-fri-1',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Gloom Pillars',
    timeSlot: '19:15h – 22:30h',
    charName: 'Metaleiro Veeloz',
    userRank: 'Leader',
    userUid: 'fixed-metaleiro',
    notes: 'Horário Planilhado: 19:15 – 22:30',
    exactTime: '19:15 – 22:30',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- Xbloodyx (21:00–23:00 | Sáb e Dom) ---
  {
    id: 'fixed-b3-xbloodyx1-sat-1',
    day: 'saturday',
    slotType: 'planilhados',
    respawnName: 'Gloom Pillars',
    timeSlot: '21:00h – 23:00h',
    charName: 'Xbloodyx',
    userRank: 'Leader',
    userUid: 'fixed-xbloodyx',
    notes: 'Horário Planilhado: 21:00 – 23:00',
    exactTime: '21:00 – 23:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-b3-xbloodyx1-sun-1',
    day: 'sunday',
    slotType: 'planilhados',
    respawnName: 'Gloom Pillars',
    timeSlot: '21:00h – 23:00h',
    charName: 'Xbloodyx',
    userRank: 'Leader',
    userUid: 'fixed-xbloodyx',
    notes: 'Horário Planilhado: 21:00 – 23:00',
    exactTime: '21:00 – 23:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- Xbloodyx (22:30–01:00 | Sexta) ---
  {
    id: 'fixed-b3-xbloodyx2-fri',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Gloom Pillars',
    timeSlot: '22:30h – 01:00h',
    charName: 'Xbloodyx',
    userRank: 'Leader',
    userUid: 'fixed-xbloodyx',
    notes: 'Horário Planilhado: 22:30 – 01:00',
    exactTime: '22:30 – 01:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // ==========================================
  // 🔴 B4 — Darklight Core
  // 1. Mestre nolol | 18:00–20:00 | Sexta, Sábado e Domingo
  // 2. Pari Suave | 20:00–22:30 | Sexta
  // ==========================================
  // --- Mestre nolol (18:00–20:00) ---
  {
    id: 'fixed-b4-mestre-fri-1',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Darklight Core',
    timeSlot: '18:00h – 20:00h',
    charName: 'Mestre Nolol',
    userRank: 'Challenger',
    userUid: 'fixed-mestre',
    notes: 'Horário Planilhado: 18:00 – 20:00',
    exactTime: '18:00 – 20:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-b4-mestre-sat-1',
    day: 'saturday',
    slotType: 'planilhados',
    respawnName: 'Darklight Core',
    timeSlot: '18:00h – 20:00h',
    charName: 'Mestre Nolol',
    userRank: 'Challenger',
    userUid: 'fixed-mestre',
    notes: 'Horário Planilhado: 18:00 – 20:00',
    exactTime: '18:00 – 20:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-b4-mestre-sun-1',
    day: 'sunday',
    slotType: 'planilhados',
    respawnName: 'Darklight Core',
    timeSlot: '18:00h – 20:00h',
    charName: 'Mestre Nolol',
    userRank: 'Challenger',
    userUid: 'fixed-mestre',
    notes: 'Horário Planilhado: 18:00 – 20:00',
    exactTime: '18:00 – 20:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- Pari Suave (20:00–22:30 | Sexta) ---
  {
    id: 'fixed-b4-pari-fri-1',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Darklight Core',
    timeSlot: '20:00h – 22:30h',
    charName: 'Pari Suave',
    userRank: 'Challenger',
    userUid: 'fixed-parisuave',
    notes: 'Horário Planilhado: 20:00 – 22:30',
    exactTime: '20:00 – 22:30',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // ==========================================
  // 🟡 G1 — Monster Graveyard Esquerda
  // 1. Ekssiano | 05:20–08:00 | Todos os dias
  // 2. kokiris | 08:00–09:00 | Sexta
  // 3. Jackson Knight | 09:00–12:00 | Sexta
  // 4. Urrk | 16:00–18:00 | Domingo
  // 5. Urrk | 19:00–21:30 | Sexta
  // ==========================================
  // --- Ekssiano (05:20–08:00) ---
  {
    id: 'fixed-g1-ekssiano-fri',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Monster Graveyard Esquerda',
    timeSlot: '05:20h – 08:00h',
    charName: 'Ekssiano',
    userRank: 'Loyal',
    userUid: 'fixed-ekssiano',
    notes: 'Horário Planilhado: 05:20 – 08:00',
    exactTime: '05:20 – 08:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-g1-ekssiano-sat',
    day: 'saturday',
    slotType: 'planilhados',
    respawnName: 'Monster Graveyard Esquerda',
    timeSlot: '05:20h – 08:00h',
    charName: 'Ekssiano',
    userRank: 'Loyal',
    userUid: 'fixed-ekssiano',
    notes: 'Horário Planilhado: 05:20 – 08:00',
    exactTime: '05:20 – 08:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-g1-ekssiano-sun',
    day: 'sunday',
    slotType: 'planilhados',
    respawnName: 'Monster Graveyard Esquerda',
    timeSlot: '05:20h – 08:00h',
    charName: 'Ekssiano',
    userRank: 'Loyal',
    userUid: 'fixed-ekssiano',
    notes: 'Horário Planilhado: 05:20 – 08:00',
    exactTime: '05:20 – 08:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- kokiris (08:00–09:00) ---
  {
    id: 'fixed-g1-kokiris-fri',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Monster Graveyard Esquerda',
    timeSlot: '08:00h – 09:00h',
    charName: 'Kokiris',
    userRank: 'Guardian',
    userUid: 'fixed-kokiris',
    notes: 'Horário Planilhado: 08:00 – 09:00',
    exactTime: '08:00 – 09:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- Jackson Knight (09:00–12:00) ---
  {
    id: 'fixed-g1-jackson-fri',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Monster Graveyard Esquerda',
    timeSlot: '09:00h – 12:00h',
    charName: 'Jackson Knight',
    userRank: 'Challenger',
    userUid: 'fixed-jackson',
    notes: 'Horário Planilhado: 09:00 – 12:00',
    exactTime: '09:00 – 12:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- Urrk (16:00–18:00 | Domingo) ---
  {
    id: 'fixed-g1-urrk1-sun-1',
    day: 'sunday',
    slotType: 'planilhados',
    respawnName: 'Monster Graveyard Esquerda',
    timeSlot: '16:00h – 18:00h',
    charName: 'Urrk',
    userRank: 'Challenger',
    userUid: 'fixed-urrk',
    notes: 'Horário Planilhado: 16:00 – 18:00',
    exactTime: '16:00 – 18:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- Urrk (19:00–21:30 | Sexta) ---
  {
    id: 'fixed-g1-urrk2-fri-1',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Monster Graveyard Esquerda',
    timeSlot: '19:00h – 21:30h',
    charName: 'Urrk',
    userRank: 'Challenger',
    userUid: 'fixed-urrk',
    notes: 'Horário Planilhado: 19:00 – 21:30',
    exactTime: '19:00 – 21:30',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // ==========================================
  // 🟢 G4 — Sparkling Pools
  // Matshow Megalomaniaco | 06:20–09:00 | Sexta
  // ==========================================
  {
    id: 'fixed-g4-matshow-fri',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Sparkling Pools',
    timeSlot: '06:20h – 09:00h',
    charName: 'Matshow Megalomaniaco',
    userRank: 'Member',
    userUid: 'fixed-matshow',
    notes: 'Horário Planilhado: 06:20 – 09:00',
    exactTime: '06:20 – 09:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // ==========================================
  // 🟡 G6 — Monster Graveyard Direita
  // kokiris | 06:30–08:00 | Sexta
  // ==========================================
  {
    id: 'fixed-g6-kokiris-fri',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Monster Graveyard Direita',
    timeSlot: '06:30h – 08:00h',
    charName: 'Kokiris',
    userRank: 'Guardian',
    userUid: 'fixed-kokiris',
    notes: 'Horário Planilhado: 06:30 – 08:00',
    exactTime: '06:30 – 08:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // ==========================================
  // 🟡 Y1 — Souls Fire Raid
  // 1. Moonryel | 13:00–14:00 | Todos os dias
  // 2. Moonryel | 23:00–01:30 | Todos os dias
  // ==========================================
  // --- Moonryel (13:00–14:00) ---
  {
    id: 'fixed-y1-moonryel1-fri',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Souls Fire Raid',
    timeSlot: '13:00h – 14:00h',
    charName: 'Moonryel',
    userRank: 'Member',
    userUid: 'fixed-moonryel',
    notes: 'Horário Planilhado: 13:00 – 14:00',
    exactTime: '13:00 – 14:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-y1-moonryel1-sat',
    day: 'saturday',
    slotType: 'planilhados',
    respawnName: 'Souls Fire Raid',
    timeSlot: '13:00h – 14:00h',
    charName: 'Moonryel',
    userRank: 'Member',
    userUid: 'fixed-moonryel',
    notes: 'Horário Planilhado: 13:00 – 14:00',
    exactTime: '13:00 – 14:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-y1-moonryel1-sun',
    day: 'sunday',
    slotType: 'planilhados',
    respawnName: 'Souls Fire Raid',
    timeSlot: '13:00h – 14:00h',
    charName: 'Moonryel',
    userRank: 'Member',
    userUid: 'fixed-moonryel',
    notes: 'Horário Planilhado: 13:00 – 14:00',
    exactTime: '13:00 – 14:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // --- Moonryel (23:00–01:30 | Todos os dias) ---
  {
    id: 'fixed-y1-moonryel2-fri-1',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Souls Fire Raid',
    timeSlot: '23:00h – 01:30h',
    charName: 'Moonryel',
    userRank: 'Member',
    userUid: 'fixed-moonryel',
    notes: 'Horário Planilhado: 23:00 – 01:30',
    exactTime: '23:00 – 01:30',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-y1-moonryel2-sat-1',
    day: 'saturday',
    slotType: 'planilhados',
    respawnName: 'Souls Fire Raid',
    timeSlot: '23:00h – 01:30h',
    charName: 'Moonryel',
    userRank: 'Member',
    userUid: 'fixed-moonryel',
    notes: 'Horário Planilhado: 23:00 – 01:30',
    exactTime: '23:00 – 01:30',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  {
    id: 'fixed-y1-moonryel2-sun-1',
    day: 'sunday',
    slotType: 'planilhados',
    respawnName: 'Souls Fire Raid',
    timeSlot: '23:00h – 01:30h',
    charName: 'Moonryel',
    userRank: 'Member',
    userUid: 'fixed-moonryel',
    notes: 'Horário Planilhado: 23:00 – 01:30',
    exactTime: '23:00 – 01:30',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },

  // ==========================================
  // 🟡 Y6 — Souls Thais
  // 1. Shoxiez | 14:00–17:35 | Sexta e Sábado
  // 2. Theresa Fisher | 19:30–22:00 | Sexta
  // ==========================================
  // --- Shoxiez (14:00–17:35 | Sexta) ---
  {
    id: 'fixed-y6-shoxiez-fri-1',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Souls Thais',
    timeSlot: '14:00h – 17:35h',
    charName: 'Shoxiez',
    userRank: 'Challenger',
    userUid: 'fixed-shoxiez',
    notes: 'Horário Planilhado: 14:00 – 17:35',
    exactTime: '14:00 – 17:35',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  // --- Shoxiez (14:00–17:35 | Sábado) ---
  {
    id: 'fixed-y6-shoxiez-sat-1',
    day: 'saturday',
    slotType: 'planilhados',
    respawnName: 'Souls Thais',
    timeSlot: '14:00h – 17:35h',
    charName: 'Shoxiez',
    userRank: 'Challenger',
    userUid: 'fixed-shoxiez',
    notes: 'Horário Planilhado: 14:00 – 17:35',
    exactTime: '14:00 – 17:35',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
  // --- Theresa Fisher (19:30–22:00 | Sexta) ---
  {
    id: 'fixed-y6-theresa-fri',
    day: 'friday',
    slotType: 'planilhados',
    respawnName: 'Souls Thais',
    timeSlot: '19:30h – 22:00h',
    charName: 'Theresa Fisher',
    userRank: 'Guardian',
    userUid: 'fixed-theresa',
    notes: 'Horário Planilhado: 19:30 – 22:00',
    exactTime: '19:30 – 22:00',
    isOccupied: true,
    reservedAt: new Date().toISOString(),
  },
];
