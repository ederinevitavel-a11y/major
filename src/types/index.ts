export type PriorityRank =
  | 'Leader'
  | 'Challenger'
  | 'Guardian'
  | 'Loyal'
  | 'Member'
  | 'Beginner'
  | 'Newcomer';

export type HuntDay = 'friday' | 'saturday' | 'sunday';

export type SlotType = 'normal' | '3h';

export interface UserProfile {
  uid: string;
  email: string;
  charName: string;
  guildName: string;
  rank: PriorityRank;
  vocation: string;
  level: number;
  isAdmin: boolean;
  createdAt: string;
  updatedAt?: string;
  lastSeen?: string;
  lastSeenAt?: number;
  isOnline?: boolean;
}

export interface AllowedEmail {
  id: string;
  email: string;
  role: 'admin' | 'member';
  addedBy: string;
  createdAt: string;
  note?: string;
}

export interface ReservationSlot {
  id: string; // e.g. "friday_Unhallowed-Crypt_08:00h-10:20h"
  day: HuntDay;
  slotType: SlotType;
  timeSlot: string;
  respawnName: string;
  userUid: string;
  isOccupied?: boolean;
  reservedAt: string;
}

export interface ReservationDetails {
  id: string;
  charName: string;
  userUid: string;
  userRank: PriorityRank;
  partyMembers?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Reservation extends ReservationSlot {
  charName?: string;
  userRank?: PriorityRank;
  partyMembers?: string;
  notes?: string;
}

export interface TibiaGuildMember {
  name: string;
  title: string;
  rank: string;
  vocation: string;
  level: number;
  joined: string;
  status: string;
}

export interface TibiaGuildResponse {
  guild: {
    name: string;
    world: string;
    description: string;
    members_total: number;
    members_invited: number;
    members: TibiaGuildMember[];
  };
  information: {
    api: {
      version: number;
      release: string;
    };
    timestamp: string;
  };
}

export interface DoubleXpSettings {
  startDate: string;
  endDate: string;
  updatedAt?: string;
}

export interface DoubleXpRecord {
  uid: string;
  charName: string;
  fridayExp: number;
  saturdayExp: number;
  sundayExp: number;
  totalExp: number;
  startExp?: number;
  lastCapturedAt?: string;
}

