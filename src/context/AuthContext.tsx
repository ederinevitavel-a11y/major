import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, testConnection, db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { getUserProfile, saveUserProfile, updateUserPresence, ensureMemberDirectoryEntry } from '../services/firestoreService';
import { SUPER_ADMIN_EMAIL } from '../constants/guildData';

const PRESENCE_MIN_INTERVAL_MS = 210_000; // 3.5 minutes cooldown between presence writes
const PRESENCE_HEARTBEAT_MS = 240_000; // 4 minutes active heartbeat interval

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAuthorized: boolean;
  isAdmin: boolean;
  needsCharacterLink: boolean;
  profileLoadError: string | null;
  darkMode: boolean;
  toggleDarkMode: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [needsCharacterLink, setNeedsCharacterLink] = useState<boolean>(false);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('major_theme') === 'dark';
  });

  // Apply dark mode class to root
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('major_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('major_theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  // Initial test connection check
  useEffect(() => {
    testConnection().catch(err => console.warn('Firestore test connection:', err));
  }, []);

  const checkUserStatus = async (user: User | null, options?: { skipWhitelistCheck?: boolean }) => {
    if (!user || !user.email) {
      setCurrentUser(null);
      setUserProfile(null);
      setIsAuthorized(false);
      setIsAdmin(false);
      setNeedsCharacterLink(false);
      setProfileLoadError(null);
      setLoading(false);
      return;
    }

    const email = user.email.toLowerCase();
    const isSuper = email === SUPER_ADMIN_EMAIL.toLowerCase();

    // Single-read whitelist & role check (skip completely for Super Admin or authorized profile refresh)
    let authorized = isSuper || Boolean(options?.skipWhitelistCheck && isAuthorized);
    let isEmailAdmin = isSuper || Boolean(options?.skipWhitelistCheck && isAdmin);

    if (!isSuper && !options?.skipWhitelistCheck) {
      try {
        const emailDocSnap = await getDoc(doc(db, 'allowed_emails', encodeURIComponent(email)));
        if (emailDocSnap.exists()) {
          authorized = true;
          const data = emailDocSnap.data();
          if (data.role === 'admin') {
            isEmailAdmin = true;
          }
        }
      } catch (err) {
        console.warn('Check whitelist notice:', err);
      }
    }

    if (!authorized) {
      setIsAuthorized(false);
      setUserProfile(null);
      setIsAdmin(false);
      setNeedsCharacterLink(false);
      setLoading(false);
      return;
    }

    // Profile check (resolve isAdmin and profile before flipping isAuthorized to true to avoid transient non-admin queries)
    setProfileLoadError(null);
    try {
      let profile = await getUserProfile(user.uid);
      if (profile) {
        // If creator profile was previously saved as Leader, ensure his official API guild rank Challenger is respected while keeping admin rights
        if (isSuper && (profile.charName.toLowerCase() === 'eder' || profile.rank === 'Leader')) {
          profile = {
            ...profile,
            rank: 'Challenger',
            isAdmin: true,
          };
          saveUserProfile(profile).catch((err: unknown) => console.warn('Sync profile rank:', err));
        } else if (isEmailAdmin && !profile.isAdmin) {
          profile = {
            ...profile,
            isAdmin: true,
          };
          saveUserProfile(profile).catch((err: unknown) => console.warn('Sync profile admin:', err));
        }
        ensureMemberDirectoryEntry(profile).catch(() => {});
        setUserProfile(profile);
        setIsAdmin(isSuper || isEmailAdmin || Boolean(profile.isAdmin));
        setNeedsCharacterLink(false);
        setProfileLoadError(null);
        setIsAuthorized(true);
      } else {
        // Needs to link Tibia character
        setUserProfile(null);
        setIsAdmin(isSuper || isEmailAdmin);
        setNeedsCharacterLink(true);
        setProfileLoadError(null);
        setIsAuthorized(true);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      const rawMsg = err instanceof Error ? err.message : String(err);
      setIsAdmin(isSuper || isEmailAdmin);
      setNeedsCharacterLink(false);
      setProfileLoadError(rawMsg);
      setIsAuthorized(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      checkUserStatus(user);
    });

    return () => unsubscribe();
  }, []);

  // Presence heartbeat: throttled to keep Firestore writes & admin snapshot reads minimal
  useEffect(() => {
    if (!currentUser?.uid || !userProfile) return;

    const uid = currentUser.uid;
    const storageKey = `major_presence_ping_${uid}`;

    const pingIfDue = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      const lastLocalPing = Number(sessionStorage.getItem(storageKey) || '0');
      if (now - lastLocalPing < PRESENCE_MIN_INTERVAL_MS) return;

      sessionStorage.setItem(storageKey, String(now));
      updateUserPresence(uid, true).catch(() => {});
    };

    // Only ping on mount if stored/profile timestamp is stale (> 3.5 min)
    const storedPing = Number(sessionStorage.getItem(storageKey) || '0');
    const profileLastSeen = userProfile.lastSeenAt || 0;
    const latestKnown = Math.max(storedPing, userProfile.isOnline === false ? 0 : profileLastSeen);
    if (Date.now() - latestKnown >= PRESENCE_MIN_INTERVAL_MS) {
      sessionStorage.setItem(storageKey, String(Date.now()));
      updateUserPresence(uid, true).catch(() => {});
    } else if (latestKnown > storedPing) {
      sessionStorage.setItem(storageKey, String(latestKnown));
    }

    const interval = setInterval(pingIfDue, PRESENCE_HEARTBEAT_MS);
    const handleVisibility = () => pingIfDue();

    window.addEventListener('focus', pingIfDue);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', pingIfDue);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentUser?.uid, Boolean(userProfile)]);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Falha no login com Google:', error);
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      if (currentUser?.uid) {
        sessionStorage.removeItem(`major_presence_ping_${currentUser.uid}`);
        await updateUserPresence(currentUser.uid, false).catch(() => {});
      }
      await firebaseSignOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
      setIsAuthorized(false);
      setIsAdmin(false);
      setNeedsCharacterLink(false);
      setProfileLoadError(null);
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  const refreshProfile = async () => {
    if (currentUser) {
      setLoading(true);
      await checkUserStatus(currentUser, { skipWhitelistCheck: isAuthorized });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        isAuthorized,
        isAdmin,
        needsCharacterLink,
        profileLoadError,
        darkMode,
        toggleDarkMode,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
