import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  Unsubscribe,
  writeBatch,
  deleteField,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { AllowedEmail, Reservation, ReservationSlot, ReservationDetails, UserProfile, MemberDirectoryProfile, HuntDay, DoubleXpSettings, DoubleXpRecord, CustomRespawn, ReleasedRespawn, LfgPost, SpecialRespawnsBackup } from '../types';
import { SUPER_ADMIN_EMAIL, parseSlotRange, PLANILHADOS_RESPAWNS, THREE_HOUR_RESPAWNS } from '../constants/guildData';
import { DEFAULT_FIXED_SCHEDULE } from '../constants/defaultSchedule';

// ---- ALLOWED EMAILS ----
export async function getAllowedEmails(): Promise<AllowedEmail[]> {
  const path = 'allowed_emails';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<AllowedEmail, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function isEmailWhitelisted(email: string): Promise<boolean> {
  const clean = email.trim().toLowerCase();
  if (clean === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return true;
  }
  const path = `allowed_emails/${encodeURIComponent(clean)}`;
  try {
    const snap = await getDoc(doc(db, 'allowed_emails', encodeURIComponent(clean)));
    return snap.exists();
  } catch (error) {
    // If not found or read restricted, fallback
    console.warn('Check whitelist notice:', error);
    return false;
  }
}

export async function addAllowedEmail(email: string, role: 'admin' | 'member', addedBy: string, note?: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  const path = `allowed_emails/${encodeURIComponent(clean)}`;
  try {
    await setDoc(doc(db, 'allowed_emails', encodeURIComponent(clean)), {
      email: clean,
      role,
      addedBy,
      note: note || '',
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeAllowedEmail(email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  const path = `allowed_emails/${encodeURIComponent(clean)}`;
  try {
    await deleteDoc(doc(db, 'allowed_emails', encodeURIComponent(clean)));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---- USER PROFILES ----
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

function toMemberDirectoryPayload(profile: Partial<UserProfile> & { uid: string }): Record<string, unknown> {
  return cleanData({
    uid: profile.uid,
    charName: profile.charName,
    guildName: profile.guildName,
    rank: profile.rank,
    vocation: profile.vocation,
    level: profile.level,
    sharedWith: profile.sharedWith,
    updatedAt: new Date().toISOString(),
  });
}

function directoryDocToUserProfile(d: MemberDirectoryProfile): UserProfile {
  return {
    uid: d.uid,
    email: '',
    charName: d.charName || '',
    guildName: d.guildName || 'Missclick',
    rank: d.rank || 'Member',
    vocation: d.vocation || '',
    level: typeof d.level === 'number' ? d.level : 0,
    isAdmin: false,
    sharedWith: d.sharedWith || [],
    createdAt: '',
    updatedAt: d.updatedAt,
  };
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const path = `users/${profile.uid}`;
  try {
    const nowIso = new Date().toISOString();
    const payload = cleanData({
      ...profile,
      updatedAt: nowIso,
    } as unknown as Record<string, unknown>);
    const dirPayload = cleanData({
      uid: profile.uid,
      charName: profile.charName,
      guildName: profile.guildName,
      rank: profile.rank,
      vocation: profile.vocation,
      level: profile.level,
      sharedWith: profile.sharedWith ?? [],
      updatedAt: nowIso,
    });
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', profile.uid), payload);
    batch.set(doc(db, 'member_directory', profile.uid), dirPayload);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  const path = `users/${uid}`;
  try {
    const nowIso = new Date().toISOString();
    await updateDoc(doc(db, 'users', uid), {
      ...updates,
      updatedAt: nowIso,
    });

    const dirUpdates: Record<string, unknown> = {};
    if (updates.charName !== undefined) dirUpdates.charName = updates.charName;
    if (updates.guildName !== undefined) dirUpdates.guildName = updates.guildName;
    if (updates.rank !== undefined) dirUpdates.rank = updates.rank;
    if (updates.vocation !== undefined) dirUpdates.vocation = updates.vocation;
    if (updates.level !== undefined) dirUpdates.level = updates.level;
    if (updates.sharedWith !== undefined) dirUpdates.sharedWith = updates.sharedWith;

    if (Object.keys(dirUpdates).length > 0) {
      dirUpdates.updatedAt = nowIso;
      try {
        await updateDoc(doc(db, 'member_directory', uid), dirUpdates);
      } catch {
        // Fallback if directory entry doesn't exist yet
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          const full = snap.data() as UserProfile;
          await setDoc(doc(db, 'member_directory', uid), toMemberDirectoryPayload({ ...full, ...updates }));
        }
      }
    }

    if (updates.sharedWith !== undefined) {
      try {
        const ownDetailsSnap = await getDocs(
          query(collection(db, 'reservation_details'), where('userUid', '==', uid))
        );
        if (!ownDetailsSnap.empty) {
          const syncBatch = writeBatch(db);
          ownDetailsSnap.docs.forEach(d => {
            syncBatch.update(d.ref, {
              sharedViewerUids: updates.sharedWith || [],
              updatedAt: nowIso,
            });
          });
          await syncBatch.commit();
        }
      } catch (syncErr) {
        console.warn('Reservation details sharedViewerUids sync notice:', syncErr);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function ensureMemberDirectoryEntry(profile: UserProfile): Promise<void> {
  if (!profile?.uid) return;
  try {
    const dirRef = doc(db, 'member_directory', profile.uid);
    const snap = await getDoc(dirRef);
    if (!snap.exists()) {
      await setDoc(dirRef, cleanData({
        uid: profile.uid,
        charName: profile.charName,
        guildName: profile.guildName,
        rank: profile.rank,
        vocation: profile.vocation,
        level: profile.level,
        sharedWith: profile.sharedWith ?? [],
        updatedAt: new Date().toISOString(),
      }));
    }
  } catch (err) {
    console.debug('Member directory sync notice:', err);
  }
}

export async function syncMemberDirectoryFromUsers(users: UserProfile[]): Promise<void> {
  if (!users || users.length === 0) return;
  try {
    const dirSnap = await getDocs(collection(db, 'member_directory'));
    const existingMap = new Map<string, MemberDirectoryProfile>();
    dirSnap.docs.forEach(d => existingMap.set(d.id, d.data() as MemberDirectoryProfile));

    const toSync = users.filter(u => {
      if (!u.uid || !u.charName) return false;
      const cur = existingMap.get(u.uid);
      if (!cur) return true;
      return (
        cur.charName !== u.charName ||
        cur.rank !== u.rank ||
        cur.guildName !== u.guildName ||
        cur.level !== u.level ||
        cur.vocation !== u.vocation ||
        JSON.stringify(cur.sharedWith || []) !== JSON.stringify(u.sharedWith || [])
      );
    });

    if (toSync.length === 0) return;
    const chunkSize = 400;
    for (let i = 0; i < toSync.length; i += chunkSize) {
      const batch = writeBatch(db);
      toSync.slice(i, i + chunkSize).forEach(u => {
        batch.set(
          doc(db, 'member_directory', u.uid),
          cleanData({
            uid: u.uid,
            charName: u.charName,
            guildName: u.guildName,
            rank: u.rank,
            vocation: u.vocation,
            level: u.level,
            sharedWith: u.sharedWith ?? [],
            updatedAt: new Date().toISOString(),
          })
        );
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('Directory backfill notice:', err);
  }
}

export async function getAllUserProfiles(): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => d.data() as UserProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function getAllMemberDirectory(): Promise<UserProfile[]> {
  const path = 'member_directory';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => directoryDocToUserProfile(d.data() as MemberDirectoryProfile));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

// Live real-time subscription to user profiles directory (for administrators)
export function subscribeToUserProfiles(
  callback: (profiles: UserProfile[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    snapshot => {
      const profiles = snapshot.docs.map(d => d.data() as UserProfile);
      callback(profiles);
    },
    error => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// Live real-time subscription to PII-free member directory (for regular whitelisted members)
export function subscribeToMemberDirectory(
  callback: (profiles: UserProfile[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'member_directory';
  return onSnapshot(
    collection(db, path),
    snapshot => {
      const profiles = snapshot.docs.map(d => directoryDocToUserProfile(d.data() as MemberDirectoryProfile));
      callback(profiles);
    },
    error => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// Real-time user presence heartbeat
export async function updateUserPresence(uid: string, isOnline: boolean = true): Promise<void> {
  if (!uid) return;
  const path = `users/${uid}`;
  try {
    const now = new Date();
    await updateDoc(doc(db, 'users', uid), {
      isOnline,
      lastSeen: now.toISOString(),
      lastSeenAt: now.getTime(),
    });
  } catch (error) {
    // Non-fatal presence ping notice
    console.debug('Presence heartbeat notice:', error);
  }
}

// Helper: Determine if a user is currently online in the app (default heartbeat window: 300 seconds / 5 minutes)
export function isUserOnline(user: UserProfile | undefined | null, thresholdSeconds: number = 300): boolean {
  if (!user) return false;
  // If explicitly flagged offline
  if (user.isOnline === false) return false;
  const now = Date.now();
  const lastTime = user.lastSeenAt || (user.lastSeen ? new Date(user.lastSeen).getTime() : 0);
  if (!lastTime) return false;
  return now - lastTime <= thresholdSeconds * 1000;
}

// Utility to sanitize payloads and strip any undefined fields before writing to Firestore
function cleanData<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        cleaned[key] = cleanData(val as Record<string, unknown>);
      } else {
        cleaned[key] = val;
      }
    }
  }
  return cleaned;
}

// ---- ZERO-KNOWLEDGE SPLIT RESERVATIONS ----
// Public slots (/reservations): id, day, slotType, timeSlot, respawnName, userUid, isOccupied.
// Private details (/reservation_details): charName, userRank, partyMembers, notes (Restricted to owner & admin).
export function subscribeToReservations(
  currentUserUid: string | null | undefined,
  isAdmin: boolean,
  callback: (reservations: Reservation[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  let slotsList: ReservationSlot[] = [];
  let deletedFixedIds = new Set<string>();
  const ownDetailsMap = new Map<string, ReservationDetails>();
  const publicDetailsMap = new Map<string, ReservationDetails>();
  const partyDetailsMap = new Map<string, ReservationDetails>();
  const sharedDetailsMap = new Map<string, ReservationDetails>();
  const detailsMap = new Map<string, ReservationDetails>();
  let unsubDetails: Unsubscribe | null = null;
  let unsubPublicDetails: Unsubscribe | null = null;
  let unsubPartyDetails: Unsubscribe | null = null;
  let unsubSharedDetails: Unsubscribe | null = null;

  const rebuildDetailsMap = () => {
    detailsMap.clear();
    publicDetailsMap.forEach((v, k) => detailsMap.set(k, v));
    sharedDetailsMap.forEach((v, k) => detailsMap.set(k, v));
    partyDetailsMap.forEach((v, k) => detailsMap.set(k, v));
    ownDetailsMap.forEach((v, k) => detailsMap.set(k, v));
  };

  const emit = () => {
    const getCleanName = (name: string) => (name || '').replace(/^[A-Z0-9]+\s*—\s*/, '');

    // Ignore legacy Forgotten Crypt normal/20:40h-23:00h reservations so 22:00h-00:20h stays free
    const activeSlotsList = slotsList.filter(s => {
      const cleanRespawn = getCleanName(s.respawnName).trim().toLowerCase();
      if (s.id.startsWith('fixed-ab1-prezord')) return false;
      if (cleanRespawn === 'forgotten crypt') {
        if (s.slotType === 'normal') return false;
        if ((s.timeSlot || '').includes('20:40')) return false;
      }
      if (cleanRespawn === 'gloom pillars' && (s.day === 'saturday' || s.day === 'sunday')) {
        const detail = detailsMap.get(s.id);
        const charName = (detail?.charName || (s as unknown as { charName?: string }).charName || '').trim().toLowerCase();
        const isXbloodyxDoc =
          s.id.toLowerCase().includes('xbloodyx') ||
          s.userUid === 'fixed-xbloodyx' ||
          charName === 'xbloodyx';
        if (isXbloodyxDoc && (s.timeSlot || '').includes('19:15')) {
          return false;
        }
      }
      return true;
    });

    const firestoreKeySet = new Set(
      activeSlotsList.flatMap(s => [
        s.id,
        `${s.day}_${getCleanName(s.respawnName)}_${s.timeSlot}`,
        `${s.day}_${s.slotType}_${getCleanName(s.respawnName)}_${s.timeSlot}`,
      ])
    );

    const fixedNotOverridden: Reservation[] = DEFAULT_FIXED_SCHEDULE.filter(
      fixed =>
        !deletedFixedIds.has(fixed.id) &&
        !firestoreKeySet.has(fixed.id) &&
        !firestoreKeySet.has(`${fixed.day}_${getCleanName(fixed.respawnName)}_${fixed.timeSlot}`) &&
        !firestoreKeySet.has(`${fixed.day}_${fixed.slotType}_${getCleanName(fixed.respawnName)}_${fixed.timeSlot}`)
    ).map(fixed => ({
      ...fixed,
      partyMemberUids: [],
    }));

    const firestoreMerged: Reservation[] = activeSlotsList.map(slot => {
      const isOwner = Boolean(currentUserUid && slot.userUid === currentUserUid);
      const detail = detailsMap.get(slot.id);
      const canSee = isAdmin || isOwner || Boolean(detail);

      return {
        ...slot,
        respawnName: getCleanName(slot.respawnName),
        isPublicVisibility: slot.isPublicVisibility || detail?.isPublicVisibility || false,
        partyMemberUids: detail?.partyMemberUids || (slot as unknown as { partyMemberUids?: string[] }).partyMemberUids || [],
        // Strict Zero-Knowledge: regular members NEVER receive other players' character names, party, or notes unless visibility is granted!
        charName: canSee
          ? (detail?.charName || (slot as unknown as { charName?: string }).charName || '')
          : '',
        userRank: canSee
          ? (detail?.userRank || (slot as unknown as { userRank?: Reservation['userRank'] }).userRank || 'Member')
          : undefined,
        partyMembers: canSee
          ? (detail?.partyMembers || (slot as unknown as { partyMembers?: string }).partyMembers)
          : undefined,
        notes: canSee
          ? (detail?.notes || (slot as unknown as { notes?: string }).notes)
          : undefined,
      };
    });

    // Deduplicate merged list by unique key (day + respawn + timeSlot)
    const seenKeys = new Set<string>();
    const deduplicatedResult: Reservation[] = [];

    for (const item of [...firestoreMerged, ...fixedNotOverridden]) {
      const key = `${item.day}_${getCleanName(item.respawnName)}_${item.timeSlot}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        deduplicatedResult.push(item);
      }
    }

    callback(deduplicatedResult);
  };

  // 1. Subscribe to public slot occupancy
  const unsubSlots = onSnapshot(
    collection(db, 'reservations'),
    snapshot => {
      slotsList = snapshot.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<ReservationSlot, 'id'>),
      }));
      emit();
    },
    error => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'reservations');
    }
  );

  // 1b. Subscribe to deleted fixed schedule overrides
  const unsubDeletedFixed = onSnapshot(
    doc(db, 'settings', 'deleted_fixed_reservations'),
    snapshot => {
      const data = snapshot.data() as { ids?: string[] } | undefined;
      deletedFixedIds = new Set(Array.isArray(data?.ids) ? data.ids : []);
      emit();
    },
    error => {
      console.warn('Deleted fixed schedule subscription:', error);
    }
  );

  // 2. Subscribe to details strictly according to permissions
  if (isAdmin) {
    // Admin is authorized to observe all reservation details in real time
    unsubDetails = onSnapshot(
      collection(db, 'reservation_details'),
      snapshot => {
        ownDetailsMap.clear();
        snapshot.docs.forEach(d => {
          ownDetailsMap.set(d.id, { id: d.id, ...(d.data() as Omit<ReservationDetails, 'id'>) });
        });
        rebuildDetailsMap();
        emit();
      },
      error => {
        console.warn('Admin reservation_details subscription:', error);
      }
    );
  } else if (currentUserUid) {
    // 2a. Own reservation details
    unsubDetails = onSnapshot(
      query(collection(db, 'reservation_details'), where('userUid', '==', currentUserUid)),
      snapshot => {
        ownDetailsMap.clear();
        snapshot.docs.forEach(d => {
          ownDetailsMap.set(d.id, { id: d.id, ...(d.data() as Omit<ReservationDetails, 'id'>) });
        });
        rebuildDetailsMap();
        emit();
      },
      error => {
        console.warn('Own reservation_details subscription:', error);
      }
    );

    // 2b. Public-visibility reservation details
    unsubPublicDetails = onSnapshot(
      query(collection(db, 'reservation_details'), where('isPublicVisibility', '==', true)),
      snapshot => {
        publicDetailsMap.clear();
        snapshot.docs.forEach(d => {
          publicDetailsMap.set(d.id, { id: d.id, ...(d.data() as Omit<ReservationDetails, 'id'>) });
        });
        rebuildDetailsMap();
        emit();
      },
      error => {
        console.warn('Public reservation_details subscription:', error);
      }
    );

    // 2c. Party member reservation details
    unsubPartyDetails = onSnapshot(
      query(collection(db, 'reservation_details'), where('partyMemberUids', 'array-contains', currentUserUid)),
      snapshot => {
        partyDetailsMap.clear();
        snapshot.docs.forEach(d => {
          partyDetailsMap.set(d.id, { id: d.id, ...(d.data() as Omit<ReservationDetails, 'id'>) });
        });
        rebuildDetailsMap();
        emit();
      },
      error => {
        console.warn('Party reservation_details subscription:', error);
      }
    );

    // 2d. Reservations shared directly with this member or 'all' via sharedViewerUids
    unsubSharedDetails = onSnapshot(
      query(
        collection(db, 'reservation_details'),
        where('sharedViewerUids', 'array-contains-any', [currentUserUid, 'all'])
      ),
      snapshot => {
        sharedDetailsMap.clear();
        snapshot.docs.forEach(d => {
          sharedDetailsMap.set(d.id, { id: d.id, ...(d.data() as Omit<ReservationDetails, 'id'>) });
        });
        rebuildDetailsMap();
        emit();
      },
      error => {
        console.warn('Shared reservation_details subscription:', error);
      }
    );
  }

  return () => {
    unsubSlots();
    unsubDeletedFixed();
    if (unsubDetails) unsubDetails();
    if (unsubPublicDetails) unsubPublicDetails();
    if (unsubPartyDetails) unsubPartyDetails();
    if (unsubSharedDetails) unsubSharedDetails();
  };
}

async function resolveOwnerSharedWith(userUid: string): Promise<string[]> {
  if (!userUid || userUid.startsWith('fixed-')) return [];
  try {
    const snap = await getDoc(doc(db, 'member_directory', userUid));
    if (snap.exists()) {
      const data = snap.data() as Partial<MemberDirectoryProfile>;
      if (Array.isArray(data.sharedWith)) return data.sharedWith;
    }
  } catch {
    // ignore
  }
  return [];
}

export async function setReservation(reservation: Reservation): Promise<void> {
  const pathSlot = `reservations/${reservation.id}`;
  try {
    const sharedViewerUids =
      reservation.sharedViewerUids ?? (await resolveOwnerSharedWith(reservation.userUid));
    const batch = writeBatch(db);

    // 1. Public anonymous slot (strictly no charName, no partyMembers, no notes)
    const publicSlot: Record<string, unknown> = {
      id: reservation.id,
      day: reservation.day,
      slotType: reservation.slotType,
      timeSlot: reservation.timeSlot,
      respawnName: reservation.respawnName,
      userUid: reservation.userUid,
      isOccupied: true,
      isPublicVisibility: reservation.isPublicVisibility ?? false,
      partyMemberUids: reservation.partyMemberUids || [],
      reservedAt: reservation.reservedAt || new Date().toISOString(),
      releasedRespawnId: reservation.releasedRespawnId,
    };

    // 2. Private details document
    const privateDetails: Record<string, unknown> = {
      id: reservation.id,
      charName: reservation.charName || '',
      userUid: reservation.userUid,
      userRank: reservation.userRank || 'Member',
      partyMembers: reservation.partyMembers || '',
      partyMemberUids: reservation.partyMemberUids || [],
      sharedViewerUids,
      isPublicVisibility: reservation.isPublicVisibility ?? false,
      notes: reservation.notes || '',
      createdAt: reservation.reservedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      releasedRespawnId: reservation.releasedRespawnId,
    };

    batch.set(doc(db, 'reservations', reservation.id), cleanData(publicSlot));
    batch.set(doc(db, 'reservation_details', reservation.id), cleanData(privateDetails));
    if (reservation.id.startsWith('fixed-') || DEFAULT_FIXED_SCHEDULE.some(f => f.id === reservation.id)) {
      batch.set(
        doc(db, 'settings', 'deleted_fixed_reservations'),
        { ids: arrayRemove(reservation.id), updatedAt: new Date().toISOString() },
        { merge: true }
      );
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathSlot);
    throw error;
  }
}

export async function updateReservationVisibility(reservationId: string, isPublicVisibility: boolean): Promise<void> {
  const path = `reservations/${reservationId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'reservations', reservationId), { isPublicVisibility });
    batch.update(doc(db, 'reservation_details', reservationId), { isPublicVisibility });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function deleteReservation(reservationId: string): Promise<void> {
  const path = `reservations/${reservationId}`;
  const isFixedScheduleItem =
    reservationId.startsWith('fixed-') ||
    DEFAULT_FIXED_SCHEDULE.some(f => f.id === reservationId);

  try {
    const [slotSnap, detailSnap] = await Promise.all([
      getDoc(doc(db, 'reservations', reservationId)),
      getDoc(doc(db, 'reservation_details', reservationId)),
    ]);

    const batch = writeBatch(db);
    let hasOps = false;

    if (slotSnap.exists()) {
      batch.delete(doc(db, 'reservations', reservationId));
      hasOps = true;
    }
    if (detailSnap.exists()) {
      batch.delete(doc(db, 'reservation_details', reservationId));
      hasOps = true;
    }
    if (isFixedScheduleItem) {
      batch.set(
        doc(db, 'settings', 'deleted_fixed_reservations'),
        { ids: arrayUnion(reservationId), updatedAt: new Date().toISOString() },
        { merge: true }
      );
      hasOps = true;
    }

    if (hasOps) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function clearAllReservations(dayFilter?: HuntDay): Promise<number> {
  const path = 'reservations';
  try {
    const snap = await getDocs(collection(db, path));
    const toDelete = snap.docs.filter(d => {
      if (!dayFilter) return true;
      const data = d.data();
      return data.day === dayFilter;
    });

    const fixedIdsForScope = DEFAULT_FIXED_SCHEDULE.filter(
      f => !dayFilter || f.day === dayFilter
    ).map(f => f.id);

    const batchSize = 200;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const chunk = toDelete.slice(i, i + batchSize);
      const batch = writeBatch(db);
      chunk.forEach(docSnap => {
        batch.delete(docSnap.ref);
        batch.delete(doc(db, 'reservation_details', docSnap.id));
      });
      await batch.commit();
    }

    if (fixedIdsForScope.length > 0) {
      await setDoc(
        doc(db, 'settings', 'deleted_fixed_reservations'),
        { ids: arrayUnion(...fixedIdsForScope), updatedAt: new Date().toISOString() },
        { merge: true }
      );
    }

    return toDelete.length + fixedIdsForScope.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

// One-time auto sanitizer for legacy reservations to guarantee no character names linger in the public collection
export async function sanitizeLegacyReservations(): Promise<number> {
  try {
    const snap = await getDocs(collection(db, 'reservations'));
    let cleanedCount = 0;
    const batch = writeBatch(db);

    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>;
      if (data.charName || data.partyMembers || data.notes || data.userRank) {
        // Ensure reservation_details has the legacy data
        const detailRef = doc(db, 'reservation_details', d.id);
        const detailData = {
          id: d.id,
          charName: (data.charName as string) || '',
          userUid: (data.userUid as string) || '',
          userRank: (data.userRank as string) || 'Member',
          partyMembers: (data.partyMembers as string) || '',
          notes: (data.notes as string) || '',
          createdAt: (data.reservedAt as string) || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        batch.set(detailRef, cleanData(detailData), { merge: true });

        // Strip sensitive fields from public reservation document
        batch.update(d.ref, {
          charName: deleteField(),
          partyMembers: deleteField(),
          notes: deleteField(),
          userRank: deleteField(),
        });
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      await batch.commit();
      console.info(`Sanitized and isolated ${cleanedCount} legacy reservation(s) into private details.`);
    }

    // One-time cleanup for Forgotten Crypt migration to Especiais (19:30–22:00 Prezord, 22:00+ free)
    const migrationRef = doc(db, 'settings', 'forgotten_crypt_special_v1');
    const migrationSnap = await getDoc(migrationRef);
    if (!migrationSnap.exists()) {
      const cleanupBatch = writeBatch(db);
      let removedCount = 0;

      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown>;
        const respawnName = String(data.respawnName || '').replace(/^[A-Z0-9]+\s*—\s*/, '').trim().toLowerCase();
        const timeSlot = String(data.timeSlot || '');
        const slotType = String(data.slotType || '');
        const range = parseSlotRange(timeSlot);

        const isLegacyPrezord = d.id.startsWith('fixed-ab1-prezord');
        const isLegacyForgottenCrypt =
          respawnName === 'forgotten crypt' &&
          (slotType === 'normal' || timeSlot.includes('20:40') || range.start >= 1320);

        if (isLegacyPrezord || isLegacyForgottenCrypt) {
          cleanupBatch.delete(d.ref);
          cleanupBatch.delete(doc(db, 'reservation_details', d.id));
          removedCount++;
        }
      }

      cleanupBatch.set(migrationRef, {
        migratedAt: new Date().toISOString(),
        removedCount,
      });
      await cleanupBatch.commit();
      if (removedCount > 0) {
        console.info(`Cleaned ${removedCount} legacy Forgotten Crypt reservation(s).`);
      }
    }

    // One-time cleanup for Gloom Pillars Xbloodyx Sat/Sun change (19:15–22:30 -> 21:00–23:00)
    const gloomMigrationRef = doc(db, 'settings', 'gloom_pillars_xbloodyx_v1');
    const gloomMigrationSnap = await getDoc(gloomMigrationRef);
    if (!gloomMigrationSnap.exists()) {
      const detailsSnap = await getDocs(collection(db, 'reservation_details'));
      const detailsCharMap = new Map<string, string>();
      detailsSnap.docs.forEach(detailDoc => {
        const dData = detailDoc.data() as Record<string, unknown>;
        if (dData.charName) {
          detailsCharMap.set(detailDoc.id, String(dData.charName));
        }
      });

      const gloomBatch = writeBatch(db);
      let gloomRemovedCount = 0;

      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown>;
        const respawnName = String(data.respawnName || '').replace(/^[A-Z0-9]+\s*—\s*/, '').trim().toLowerCase();
        const day = String(data.day || '');
        const timeSlot = String(data.timeSlot || '');
        const charName = (detailsCharMap.get(d.id) || String(data.charName || '')).trim().toLowerCase();

        const isXbloodyx =
          charName === 'xbloodyx' ||
          d.id.toLowerCase().includes('xbloodyx') ||
          String(data.userUid || '') === 'fixed-xbloodyx';

        const isWeekendGloomOldSlot =
          respawnName === 'gloom pillars' &&
          (day === 'saturday' || day === 'sunday') &&
          isXbloodyx &&
          (timeSlot.includes('19:15') ||
            ((d.id === 'fixed-b3-xbloodyx1-sat-1' || d.id === 'fixed-b3-xbloodyx1-sun-1') &&
              !timeSlot.includes('21:00')));

        if (isWeekendGloomOldSlot) {
          gloomBatch.delete(d.ref);
          gloomBatch.delete(doc(db, 'reservation_details', d.id));
          gloomRemovedCount++;
        }
      }

      gloomBatch.set(gloomMigrationRef, {
        migratedAt: new Date().toISOString(),
        removedCount: gloomRemovedCount,
      });
      await gloomBatch.commit();
      if (gloomRemovedCount > 0) {
        console.info(`Cleaned ${gloomRemovedCount} legacy Gloom Pillars Xbloodyx reservation(s).`);
      }
    }

    // Backfill claimReservationId on any existing released_respawns docs so members can claim them atomically
    const releasedSnap = await getDocs(collection(db, 'released_respawns'));
    const releasedToPatch = releasedSnap.docs.filter(d => !d.data().claimReservationId);
    if (releasedToPatch.length > 0) {
      const relBatch = writeBatch(db);
      releasedToPatch.forEach(d => {
        const rd = d.data() as Partial<ReleasedRespawn>;
        if (rd.day && rd.respawnName && rd.timeSlot) {
          const claimReservationId = `${rd.day}_${rd.respawnName.replace(/[^a-zA-Z0-9]/g, '-')}_${rd.timeSlot.replace(/[^a-zA-Z0-9]/g, '-')}`;
          relBatch.update(d.ref, { claimReservationId });
        }
      });
      await relBatch.commit();
    }

    // Backfill sharedViewerUids, partyMemberUids, and isPublicVisibility on existing reservation_details
    const [allDetailsSnap, dirSnap] = await Promise.all([
      getDocs(collection(db, 'reservation_details')),
      getDocs(collection(db, 'member_directory')),
    ]);
    const dirShareMap = new Map<string, string[]>();
    dirSnap.docs.forEach(d => {
      const dd = d.data() as Partial<MemberDirectoryProfile>;
      if (Array.isArray(dd.sharedWith)) {
        dirShareMap.set(d.id, dd.sharedWith);
      }
    });
    const detailsToPatch = allDetailsSnap.docs.filter(d => {
      const data = d.data() as Record<string, unknown>;
      return (
        data.sharedViewerUids === undefined ||
        data.partyMemberUids === undefined ||
        data.isPublicVisibility === undefined
      );
    });
    if (detailsToPatch.length > 0) {
      for (let i = 0; i < detailsToPatch.length; i += 200) {
        const patchBatch = writeBatch(db);
        detailsToPatch.slice(i, i + 200).forEach(d => {
          const data = d.data() as Partial<ReservationDetails>;
          const ownerShared = data.userUid ? (dirShareMap.get(data.userUid) || []) : [];
          patchBatch.update(d.ref, {
            sharedViewerUids: data.sharedViewerUids ?? ownerShared,
            partyMemberUids: data.partyMemberUids ?? [],
            isPublicVisibility: data.isPublicVisibility ?? false,
          });
        });
        await patchBatch.commit();
      }
    }

    return cleanedCount;
  } catch (err) {
    console.warn('Legacy reservations sanitization notice:', err);
    return 0;
  }
}

// ---- DOUBLE XP & EXPERIENCE TRACKING ----
export async function getDoubleXpSettings(): Promise<DoubleXpSettings | null> {
  const path = 'settings/double_xp';
  try {
    const snap = await getDoc(doc(db, 'settings', 'double_xp'));
    if (snap.exists()) {
      return snap.data() as DoubleXpSettings;
    }
    return null;
  } catch (err) {
    console.warn('Get double xp settings error:', err);
    return null;
  }
}

export async function saveDoubleXpSettings(settings: DoubleXpSettings): Promise<void> {
  const path = 'settings/double_xp';
  try {
    await setDoc(doc(db, 'settings', 'double_xp'), cleanData({
      ...settings,
      updatedAt: new Date().toISOString(),
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

export async function getDoubleXpRecord(uid: string): Promise<DoubleXpRecord | null> {
  const path = `double_xp_records/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'double_xp_records', uid));
    if (snap.exists()) {
      return snap.data() as DoubleXpRecord;
    }
    return null;
  } catch (err) {
    console.warn('Get double xp record error:', err);
    return null;
  }
}

export async function getAllDoubleXpRecords(): Promise<DoubleXpRecord[]> {
  const path = 'double_xp_records';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => d.data() as DoubleXpRecord);
  } catch (err) {
    console.warn('Get all double xp records error:', err);
    return [];
  }
}

export async function saveDoubleXpRecord(record: DoubleXpRecord): Promise<void> {
  const path = `double_xp_records/${record.uid}`;
  try {
    await setDoc(doc(db, 'double_xp_records', record.uid), cleanData({
      ...record,
      lastCapturedAt: new Date().toISOString(),
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

export async function getSystemStatus(): Promise<{ lastAutoSyncDate?: string } | null> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'system_status'));
    if (snap.exists()) {
      return snap.data() as { lastAutoSyncDate?: string };
    }
    return null;
  } catch (err) {
    console.warn('Get system status error:', err);
    return null;
  }
}

export async function updateSystemStatus(status: { lastAutoSyncDate: string }): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'system_status'), cleanData({
      ...status,
      updatedAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('Update system status error:', err);
  }
}

// ---- CUSTOM RESPAWNS ----
export async function getCustomRespawns(): Promise<CustomRespawn[]> {
  const path = 'custom_respawns';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<CustomRespawn, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function addCustomRespawn(name: string, type: 'normal' | '3h', addedBy: string): Promise<void> {
  const cleanName = name.trim();
  if (!cleanName) return;
  const id = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const path = `custom_respawns/${id}`;
  try {
    await setDoc(doc(db, 'custom_respawns', id), {
      name: cleanName,
      type,
      addedBy,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeCustomRespawn(id: string): Promise<void> {
  const path = `custom_respawns/${id}`;
  try {
    await deleteDoc(doc(db, 'custom_respawns', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToCustomRespawns(
  callback: (list: CustomRespawn[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'custom_respawns';
  return onSnapshot(
    collection(db, path),
    snapshot => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<CustomRespawn, 'id'>) }));
      callback(list);
    },
    error => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ---- RELEASED RESPAWNS ----
export async function getReleasedRespawns(): Promise<ReleasedRespawn[]> {
  const path = 'released_respawns';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ReleasedRespawn, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function addReleasedRespawn(data: Omit<ReleasedRespawn, 'id'>): Promise<void> {
  const id = `${data.day}_${data.respawnName.replace(/[^a-zA-Z0-9]/g, '-')}_${data.timeSlot.replace(/[^a-zA-Z0-9]/g, '-')}_${Date.now()}`;
  const claimReservationId =
    data.claimReservationId ||
    `${data.day}_${data.respawnName.replace(/[^a-zA-Z0-9]/g, '-')}_${data.timeSlot.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const path = `released_respawns/${id}`;
  try {
    await setDoc(doc(db, 'released_respawns', id), cleanData({
      ...data,
      id,
      claimReservationId,
    } as unknown as Record<string, unknown>));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function claimReleasedRespawn(
  releasedItem: ReleasedRespawn,
  reservation: Reservation
): Promise<void> {
  const path = `released_respawns/${releasedItem.id}`;
  const targetReservationId = releasedItem.claimReservationId || reservation.id;
  try {
    const sharedViewerUids =
      reservation.sharedViewerUids ?? (await resolveOwnerSharedWith(reservation.userUid));
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();

    const publicSlot: Record<string, unknown> = {
      id: targetReservationId,
      day: reservation.day,
      slotType: reservation.slotType,
      timeSlot: reservation.timeSlot,
      respawnName: reservation.respawnName,
      userUid: reservation.userUid,
      isOccupied: true,
      isPublicVisibility: reservation.isPublicVisibility ?? false,
      partyMemberUids: reservation.partyMemberUids || [],
      reservedAt: reservation.reservedAt || nowIso,
      releasedRespawnId: releasedItem.id,
    };

    const privateDetails: Record<string, unknown> = {
      id: targetReservationId,
      charName: reservation.charName || '',
      userUid: reservation.userUid,
      userRank: reservation.userRank || 'Member',
      partyMembers: reservation.partyMembers || '',
      partyMemberUids: reservation.partyMemberUids || [],
      sharedViewerUids,
      isPublicVisibility: reservation.isPublicVisibility ?? false,
      notes: reservation.notes || '',
      createdAt: reservation.reservedAt || nowIso,
      updatedAt: nowIso,
      releasedRespawnId: releasedItem.id,
    };

    batch.delete(doc(db, 'released_respawns', releasedItem.id));
    batch.set(doc(db, 'reservations', targetReservationId), cleanData(publicSlot));
    batch.set(doc(db, 'reservation_details', targetReservationId), cleanData(privateDetails));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function deleteReleasedRespawn(releasedId: string): Promise<void> {
  const path = `released_respawns/${releasedId}`;
  try {
    await deleteDoc(doc(db, 'released_respawns', releasedId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToReleasedRespawns(
  callback: (list: ReleasedRespawn[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'released_respawns';
  return onSnapshot(
    collection(db, path),
    snapshot => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ReleasedRespawn, 'id'>) }));
      callback(list);
    },
    error => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ---- QUERO HUNT! (LFG POSTS) ----
export async function getLfgPosts(): Promise<LfgPost[]> {
  const path = 'lfg_posts';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<LfgPost, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveLfgPost(post: LfgPost): Promise<void> {
  const path = `lfg_posts/${post.id}`;
  try {
    const payload = cleanData({
      ...post,
      updatedAt: new Date().toISOString(),
    } as unknown as Record<string, unknown>);
    await setDoc(doc(db, 'lfg_posts', post.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function deleteLfgPost(postId: string): Promise<void> {
  const path = `lfg_posts/${postId}`;
  try {
    await deleteDoc(doc(db, 'lfg_posts', postId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export function subscribeToLfgPosts(
  callback: (list: LfgPost[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'lfg_posts';
  return onSnapshot(
    collection(db, path),
    snapshot => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<LfgPost, 'id'>) }));
      // Sort by newest updated
      list.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
      callback(list);
    },
    error => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ---- ADMIN SPECIAL RESPAWNS BACKUPS ----
export function isSpecialReservation(r: Pick<Reservation, 'slotType' | 'respawnName'>): boolean {
  if (r.slotType === 'planilhados' || r.slotType === '3h') return true;
  const cleanName = (r.respawnName || '')
    .replace(/^[A-Z0-9]+\s*—\s*/i, '')
    .replace(/[()]/g, '')
    .trim()
    .toLowerCase();
  const specialSet = new Set(
    [...PLANILHADOS_RESPAWNS, ...THREE_HOUR_RESPAWNS].map(n => n.trim().toLowerCase())
  );
  return specialSet.has(cleanName);
}

export async function saveSpecialRespawnsBackup(
  backup: Omit<SpecialRespawnsBackup, 'id'>
): Promise<SpecialRespawnsBackup> {
  const id = `backup-${Date.now()}`;
  const path = `admin_backups/${id}`;
  try {
    const cleanedReservations = backup.reservations.map(r =>
      cleanData(r as unknown as Record<string, unknown>)
    );
    const cleanedCustomRespawns = (backup.slotsConfig?.customSpecialRespawns || []).map(c =>
      cleanData(c as unknown as Record<string, unknown>)
    );

    const payload = cleanData({
      id,
      name: backup.name,
      createdAt: backup.createdAt || new Date().toISOString(),
      createdBy: backup.createdBy,
      specialCount: backup.specialCount,
      respawnsCount: backup.respawnsCount,
      reservations: cleanedReservations,
      slotsConfig: backup.slotsConfig
        ? {
            baseSlotsMap: backup.slotsConfig.baseSlotsMap,
            slotsByDay: backup.slotsConfig.slotsByDay || {},
            customSpecialRespawns: cleanedCustomRespawns,
          }
        : undefined,
    } as unknown as Record<string, unknown>);

    await setDoc(doc(db, 'admin_backups', id), payload);
    return {
      ...backup,
      id,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export function subscribeToSpecialRespawnsBackups(
  callback: (list: SpecialRespawnsBackup[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'admin_backups';
  return onSnapshot(
    collection(db, path),
    snapshot => {
      const list = snapshot.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<SpecialRespawnsBackup, 'id'>),
      }));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(list);
    },
    error => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function deleteSpecialRespawnsBackup(backupId: string): Promise<void> {
  const path = `admin_backups/${backupId}`;
  try {
    await deleteDoc(doc(db, 'admin_backups', backupId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function restoreSpecialRespawnsBackup(
  reservationsToRestore: Reservation[],
  customSpecialRespawns?: CustomRespawn[]
): Promise<number> {
  const path = 'reservations';
  try {
    // 1. Fetch existing reservations and delete all special ones (leave normal 2h20m reservations untouched)
    const snap = await getDocs(collection(db, 'reservations'));
    const existingSpecialDocs = snap.docs.filter(d => {
      const data = d.data() as Partial<Reservation>;
      return isSpecialReservation({
        slotType: (data.slotType as Reservation['slotType']) || 'normal',
        respawnName: String(data.respawnName || ''),
      });
    });

    const deleteChunkSize = 180;
    for (let i = 0; i < existingSpecialDocs.length; i += deleteChunkSize) {
      const chunk = existingSpecialDocs.slice(i, i + deleteChunkSize);
      const batch = writeBatch(db);
      chunk.forEach(docSnap => {
        batch.delete(docSnap.ref);
        batch.delete(doc(db, 'reservation_details', docSnap.id));
      });
      await batch.commit();
    }

    // 2. Restore backed-up special reservations split cleanly into zero-knowledge public/private collections
    const validReservations = reservationsToRestore.filter(
      r => r && r.id && r.day && r.respawnName && r.timeSlot
    );

    const writeChunkSize = 180;
    for (let i = 0; i < validReservations.length; i += writeChunkSize) {
      const chunk = validReservations.slice(i, i + writeChunkSize);
      const batch = writeBatch(db);

      chunk.forEach(r => {
        const publicSlot: Record<string, unknown> = {
          id: r.id,
          day: r.day,
          slotType: r.slotType || 'planilhados',
          timeSlot: r.timeSlot,
          respawnName: r.respawnName,
          userUid: r.userUid || `fixed-${(r.charName || 'player').toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          isOccupied: true,
          isPublicVisibility: r.isPublicVisibility ?? false,
          partyMemberUids: r.partyMemberUids || [],
          reservedAt: r.reservedAt || new Date().toISOString(),
        };

        const privateDetails: Record<string, unknown> = {
          id: r.id,
          charName: r.charName || '',
          userUid: publicSlot.userUid,
          userRank: r.userRank || 'Member',
          partyMembers: r.partyMembers || '',
          partyMemberUids: r.partyMemberUids || [],
          sharedViewerUids: r.sharedViewerUids || [],
          isPublicVisibility: r.isPublicVisibility ?? false,
          notes: r.notes || '',
          createdAt: r.reservedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        batch.set(doc(db, 'reservations', r.id), cleanData(publicSlot));
        batch.set(doc(db, 'reservation_details', r.id), cleanData(privateDetails));
      });

      await batch.commit();
    }

    // 3. Restore any missing custom 3h special respawns included in the backup
    if (customSpecialRespawns && customSpecialRespawns.length > 0) {
      const customSnap = await getDocs(collection(db, 'custom_respawns'));
      const existingCustomIds = new Set(customSnap.docs.map(d => d.id));
      const customBatch = writeBatch(db);
      let hasCustomWrites = false;

      customSpecialRespawns.forEach(c => {
        if (c.id && c.name && !existingCustomIds.has(c.id)) {
          customBatch.set(doc(db, 'custom_respawns', c.id), cleanData({
            name: c.name,
            type: c.type || '3h',
            addedBy: c.addedBy || 'backup-restore',
            createdAt: c.createdAt || new Date().toISOString(),
          }));
          hasCustomWrites = true;
        }
      });

      if (hasCustomWrites) {
        await customBatch.commit();
      }
    }

    // 4. Clear deleted fixed schedule overrides when restoring special respawns backup
    await setDoc(
      doc(db, 'settings', 'deleted_fixed_reservations'),
      { ids: [], updatedAt: new Date().toISOString() },
      { merge: true }
    );

    return validReservations.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}







