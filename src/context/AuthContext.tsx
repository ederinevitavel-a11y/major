import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, testConnection } from '../firebase/config';
import { UserProfile } from '../types';
import { getUserProfile, isEmailWhitelisted, saveUserProfile, updateUserPresence } from '../services/firestoreService';
import { SUPER_ADMIN_EMAIL } from '../constants/guildData';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAuthorized: boolean;
  isAdmin: boolean;
  needsCharacterLink: boolean;
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

  const checkUserStatus = async (user: User | null) => {
    if (!user || !user.email) {
      setCurrentUser(null);
      setUserProfile(null);
      setIsAuthorized(false);
      setIsAdmin(false);
      setNeedsCharacterLink(false);
      setLoading(false);
      return;
    }

    const email = user.email.toLowerCase();
    const isSuper = email === SUPER_ADMIN_EMAIL.toLowerCase();

    // Whitelist check
    let authorized = isSuper;
    if (!authorized) {
      authorized = await isEmailWhitelisted(email);
    }

    setIsAuthorized(authorized);

    if (!authorized) {
      setUserProfile(null);
      setIsAdmin(false);
      setNeedsCharacterLink(false);
      setLoading(false);
      return;
    }

    // Profile check
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
        }
        setUserProfile(profile);
        setIsAdmin(isSuper || Boolean(profile.isAdmin));
        setNeedsCharacterLink(false);
      } else {
        // Needs to link Tibia character
        setUserProfile(null);
        setIsAdmin(isSuper);
        setNeedsCharacterLink(true);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      // If profile read failed, allow linking
      setNeedsCharacterLink(true);
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

  // Presence heartbeat: keeps users/{uid} updated as online while app is active
  useEffect(() => {
    if (!currentUser?.uid || !userProfile) return;

    const uid = currentUser.uid;

    // Ping immediately as online
    updateUserPresence(uid, true).catch(() => {});

    // Heartbeat every 40 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updateUserPresence(uid, true).catch(() => {});
      }
    }, 40000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateUserPresence(uid, true).catch(() => {});
      }
    };
    const handleFocus = () => {
      updateUserPresence(uid, true).catch(() => {});
    };
    const handleBeforeUnload = () => {
      updateUserPresence(uid, false).catch(() => {});
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
        await updateUserPresence(currentUser.uid, false).catch(() => {});
      }
      await firebaseSignOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
      setIsAuthorized(false);
      setIsAdmin(false);
      setNeedsCharacterLink(false);
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  const refreshProfile = async () => {
    if (currentUser) {
      await checkUserStatus(currentUser);
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
