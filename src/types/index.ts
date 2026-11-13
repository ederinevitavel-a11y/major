export type PriorityRank =
  | 'Leader'
  | 'Challenger'
  | 'Guardian'
  | 'Loyal'
  | 'Member'
  | 'Beginner'
  | 'Newcomer';

export type HuntDay = 'friday' | 'saturday' | 'sunday';

export type SlotType = 'normal' | '3h' | 'planilhados';

export interface UserProfile {
  uid: string;
  email: string;
  charName: string;
  guildName: string;
  rank: PriorityRank;
  vocation: string;
  level: number;
  isAdmin: boolean;
  sharedWith?: string[];
  trackedXpUids?: string[];
  createdAt: string;
  updatedAt?: string;
  lastSeen?: string;
  lastSeenAt?: number;
  isOnline?: boolean;
}

export interface MemberDirectoryProfile {
  uid: string;
  charName: string;
  guildName: string;
  rank: PriorityRank;
  vocation: string;
  level: number;
  sharedWith?: string[];
  updatedAt?: string;
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
  isPublicVisibility?: boolean;
  partyMemberUids?: string[];
  reservedAt: string;
  releasedRespawnId?: string;
}

export interface ReservationDetails {
  id: string;
  charName: string;
  userUid: string;
  userRank: PriorityRank;
  partyMembers?: string;
  partyMemberUids?: string[];
  sharedViewerUids?: string[];
  isPublicVisibility?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  releasedRespawnId?: string;
}

export interface Reservation extends ReservationSlot {
  charName?: string;
  userRank?: PriorityRank;
  partyMembers?: string;
  partyMemberUids?: string[];
  sharedViewerUids?: string[];
  notes?: string;
  exactTime?: string;
  releasedRespawnId?: string;
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
  fridayDate?: string;
  saturdayDate?: string;
  sundayDate?: string;
  targetExp?: number;
  startExp?: number;
  lastCapturedAt?: string;
}

export interface CustomRespawn {
  id: string;
  name: string;
  type: 'normal' | '3h';
  addedBy: string;
  createdAt: string;
}

export interface ReleasedRespawn {
  id: string;
  respawnName: string;
  timeSlot: string;
  day: HuntDay;
  slotType: SlotType;
  charName: string;
  userUid: string;
  releasedAt: string;
  claimReservationId?: string;
}

export interface LfgPost {
  id: string; // typically userUid or unique key
  userUid: string;
  charName: string;
  level: number;
  vocation: string; // Elite Knight, Elder Druid, Master Sorcerer, Royal Paladin, etc.
  phone: string; // WhatsApp phone number
  days: HuntDay[]; // e.g. ['friday', 'saturday', 'sunday']
  timeSlots: string; // e.g. "Manhã e Tarde (08:00h – 16:00h)"
  notes?: string; // Goal, desired respawn or party role
  rank?: PriorityRank;
  createdAt: string;
  updatedAt?: string;
}

export interface SpecialRespawnsBackup {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  specialCount: number;
  respawnsCount: number;
  reservations: Reservation[];
  slotsConfig?: {
    baseSlotsMap: Record<string, string[]>;
    slotsByDay?: Partial<Record<string, Partial<Record<HuntDay, string[]>>>>;
    customSpecialRespawns?: CustomRespawn[];
  };
}

export type MainTab = 'schedule' | 'lfg' | 'released' | 'my-schedule' | 'members' | 'settings';


