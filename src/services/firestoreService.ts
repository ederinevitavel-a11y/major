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
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { AllowedEmail, Reservation, ReservationSlot, ReservationDetails, UserProfile, HuntDay, DoubleXpSettings, DoubleXpRecord, CustomRespawn, ReleasedRespawn, LfgPost } from '../types';
import { SUPER_ADMIN_EMAIL } from '../constants/guildData';
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

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const path = `users/${profile.uid}`;
  try {
    const payload = cleanData({
      ...profile,
      updatedAt: new Date().toISOString(),
    } as unknown as Record<string, unknown>);
    await setDoc(doc(db, 'users', profile.uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
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
  const detailsMap = new Map<string, ReservationDetails>();
  let unsubDetails: Unsubscribe | null = null;

  const emit = () => {
    const getCleanName = (name: string) => (name || '').replace(/^[A-Z0-9]+\s*—\s*/, '');

    const firestoreKeySet = new Set(
      slotsList.flatMap(s => [
        s.id,
        `${s.day}_${getCleanName(s.respawnName)}_${s.timeSlot}`,
        `${s.day}_${s.slotType}_${getCleanName(s.respawnName)}_${s.timeSlot}`,
      ])
    );

    const fixedNotOverridden: Reservation[] = DEFAULT_FIXED_SCHEDULE.filter(
      fixed =>
        !firestoreKeySet.has(fixed.id) &&
        !firestoreKeySet.has(`${fixed.day}_${getCleanName(fixed.respawnName)}_${fixed.timeSlot}`) &&
        !firestoreKeySet.has(`${fixed.day}_${fixed.slotType}_${getCleanName(fixed.respawnName)}_${fixed.timeSlot}`)
    ).map(fixed => ({
      ...fixed,
      partyMemberUids: [],
    }));

    const firestoreMerged: Reservation[] = slotsList.map(slot => {
      const isOwner = Boolean(currentUserUid && slot.userUid === currentUserUid);
      const detail = detailsMap.get(slot.id);
      const canSee = isAdmin || isOwner || Boolean(detail);

      return {
        ...slot,
        respawnName: getCleanName(slot.respawnName),
        partyMemberUids: detail?.partyMemberUids || (slot as unknown as { partyMemberUids?: string[] }).partyMemberUids || [],
        // Strict Zero-Knowledge: regular members NEVER receive other players' character names, party, or notes!
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

  // 2. Subscribe to details strictly according to permissions
  if (isAdmin) {
    // Admin is authorized to observe all reservation details in real time
    unsubDetails = onSnapshot(
      collection(db, 'reservation_details'),
      snapshot => {
        detailsMap.clear();
        snapshot.docs.forEach(d => {
          detailsMap.set(d.id, { id: d.id, ...(d.data() as Omit<ReservationDetails, 'id'>) });
        });
        emit();
      },
      error => {
        console.warn('Admin reservation_details subscription:', error);
      }
    );
  } else if (currentUserUid) {
    // Regular member queries own reservation details + reservation details shared with them
    getAllUserProfiles().then(profiles => {
      const sharedByUids = profiles
        .filter(p => p.sharedWith && p.sharedWith.includes(currentUserUid))
        .map(p => p.uid);
      
      const allowedUids = Array.from(new Set([currentUserUid, ...sharedByUids])).slice(0, 10);

      const userQuery = query(
        collection(db, 'reservation_details'),
        where('userUid', 'in', allowedUids)
      );
      unsubDetails = onSnapshot(
        userQuery,
        snapshot => {
          detailsMap.clear();
          snapshot.docs.forEach(d => {
            detailsMap.set(d.id, { id: d.id, ...(d.data() as Omit<ReservationDetails, 'id'>) });
          });
          emit();
        },
        error => {
          console.warn('User reservation_details subscription:', error);
        }
      );
    }).catch(err => {
      console.warn('Error fetching shared profiles for reservation details:', err);
    });
  }

  return () => {
    unsubSlots();
    if (unsubDetails) unsubDetails();
  };
}

export async function setReservation(reservation: Reservation): Promise<void> {
  const pathSlot = `reservations/${reservation.id}`;
  const pathDetail = `reservation_details/${reservation.id}`;
  try {
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
      partyMemberUids: reservation.partyMemberUids || [],
      reservedAt: reservation.reservedAt || new Date().toISOString(),
    };

    // 2. Private details document
    const privateDetails: Record<string, unknown> = {
      id: reservation.id,
      charName: reservation.charName || '',
      userUid: reservation.userUid,
      userRank: reservation.userRank || 'Member',
      partyMembers: reservation.partyMembers || '',
      partyMemberUids: reservation.partyMemberUids || [],
      notes: reservation.notes || '',
      createdAt: reservation.reservedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    batch.set(doc(db, 'reservations', reservation.id), cleanData(publicSlot));
    batch.set(doc(db, 'reservation_details', reservation.id), cleanData(privateDetails));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathSlot);
    throw error;
  }
}

export async function deleteReservation(reservationId: string): Promise<void> {
  const path = `reservations/${reservationId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'reservations', reservationId));
    batch.delete(doc(db, 'reservation_details', reservationId));
    await batch.commit();
  } catch (error) {
    try {
      await deleteDoc(doc(db, 'reservations', reservationId));
      await deleteDoc(doc(db, 'reservation_details', reservationId));
    } catch {
      handleFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
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

    if (toDelete.length === 0) return 0;

    // Firestore batch limit is 500 operations (2 ops per slot: slot + details)
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
    return toDelete.length;
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
  const path = `released_respawns/${id}`;
  try {
    await setDoc(doc(db, 'released_respawns', id), {
      ...data,
      id,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
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






