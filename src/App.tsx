import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { ScheduleGrid } from './components/ScheduleGrid';
import { AdminPanel } from './components/AdminPanel';
import { MyReservations } from './components/MyReservations';
import { ReleasedRespawnsTab } from './components/ReleasedRespawnsTab';
import { QueroHuntTab } from './components/QueroHuntTab';
import { FirstLoginModal } from './components/FirstLoginModal';
import { ExportModal } from './components/ExportModal';
import {
  subscribeToReservations,
  getAllUserProfiles,
  subscribeToUserProfiles,
  getAllMemberDirectory,
  subscribeToMemberDirectory,
  syncMemberDirectoryFromUsers,
  getSystemStatus,
  updateSystemStatus,
  updateUserProfile,
  getDoubleXpRecord,
  saveDoubleXpRecord,
  subscribeToCustomRespawns,
  subscribeToReleasedRespawns,
  subscribeToLfgPosts,
  reconcileFixedReservationsWithUsers,
} from './services/firestoreService';
import { fetchGuildMembers, fetchCharacter, mapTibiaRankToPriority } from './services/tibiaDataService';
import { DEFAULT_GUILDS, getCanonicalPlayerName } from './constants/guildData';
import { Reservation, UserProfile, CustomRespawn, ReleasedRespawn, HuntDay, LfgPost, MainTab } from './types';
import {
  Sparkles,
  Lock,
  ArrowRight,
} from 'lucide-react';

const MainDashboard: React.FC = () => {
  const {
    currentUser,
    userProfile,
    loading,
    isAuthorized,
    isAdmin,
    needsCharacterLink,
    signInWithGoogle,
    signOut,
  } = useAuth();

  const [currentTab, setCurrentTab] = useState<MainTab>('schedule');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [customRespawns, setCustomRespawns] = useState<CustomRespawn[]>([]);
  const [releasedRespawns, setReleasedRespawns] = useState<ReleasedRespawn[]>([]);
  const [lfgPosts, setLfgPosts] = useState<LfgPost[]>([]);
  const [scheduleDay, setScheduleDay] = useState<HuntDay>('friday');
  const [scheduleSearch, setScheduleSearch] = useState<string>('');
  const [isExportOpen, setIsExportOpen] = useState(false);

  const hasSyncedDirectoryRef = useRef(false);
  const reconciledFixedIdsRef = useRef<Set<string>>(new Set());

  // Security: Only administrators fetch full /users profiles (which contain emails/PII).
  // Regular members only read the PII-free /member_directory collection.
  const refreshUsers = async () => {
    try {
      const list = isAdmin ? await getAllUserProfiles() : await getAllMemberDirectory();
      setUsersList(list);
    } catch (err) {
      console.warn('Erro ao carregar lista de membros:', err);
    }
  };

  useEffect(() => {
    if (loading || !currentUser || !isAuthorized) {
      setUsersList([]);
      setCustomRespawns([]);
      setReleasedRespawns([]);
      setLfgPosts([]);
      hasSyncedDirectoryRef.current = false;
      return;
    }

    // Real-time subscription: Admins read /users and keep /member_directory synced;
    // Regular members read strictly from PII-free /member_directory.
    const unsubUsers = isAdmin
      ? subscribeToUserProfiles(
          list => {
            setUsersList(list);
            if (!hasSyncedDirectoryRef.current && list.length > 0) {
              hasSyncedDirectoryRef.current = true;
              syncMemberDirectoryFromUsers(list).catch(() => {});
            }
          },
          err => console.warn('Erro ao sincronizar membros:', err)
        )
      : subscribeToMemberDirectory(
          list => {
            setUsersList(list);
          },
          err => console.warn('Erro ao sincronizar diretório de membros:', err)
        );

    // Real-time subscription to custom respawns
    const unsubCustom = subscribeToCustomRespawns(
      list => setCustomRespawns(list),
      err => console.warn('Erro ao sincronizar custom respawns:', err)
    );

    // Real-time subscription to released respawns
    const unsubReleased = subscribeToReleasedRespawns(
      list => setReleasedRespawns(list),
      err => console.warn('Erro ao sincronizar respaws liberados:', err)
    );

    // Real-time subscription to Quero Hunt (LFG) posts
    const unsubLfg = subscribeToLfgPosts(
      list => setLfgPosts(list),
      err => console.warn('Erro ao sincronizar Quero Hunt:', err)
    );

    return () => {
      unsubUsers();
      unsubCustom();
      unsubReleased();
      unsubLfg();
    };
  }, [loading, currentUser, isAuthorized, isAdmin]);

  // Automated daily 07:00 AM sync & XP capture check (Strictly Admin-only)
  useEffect(() => {
    if (loading || !currentUser || !isAuthorized || !isAdmin) return;

    const runDailyAutoSync = async () => {
      try {
        const now = new Date();
        const currentHour = now.getHours();
        if (currentHour < 7) return; // Only run at or after 07:00 AM

        const todayStr = now.toISOString().split('T')[0];
        const status = await getSystemStatus();
        if (status?.lastAutoSyncDate === todayStr) {
          return; // Already synced today
        }

        console.info('Iniciando atualização automática diária das 07:00 da API TibiaData...');
        const guildMemberMap = new Map<string, { level: number; vocation: string; rank: string }>();
        for (const g of DEFAULT_GUILDS) {
          try {
            const members = await fetchGuildMembers(g.name);
            members.forEach(m => {
              if (m.name) {
                guildMemberMap.set(m.name.trim().toLowerCase(), {
                  level: Number(m.level) || 0,
                  vocation: m.vocation || '',
                  rank: m.rank || '',
                });
              }
            });
          } catch {
            // ignore
          }
        }

        const users = await getAllUserProfiles();
        for (const u of users) {
          if (!u.charName) continue;
          const cleanName = u.charName.trim().toLowerCase();
          let foundLevel = 0;
          let foundVocation = u.vocation;
          let foundRank = u.rank;

          const guildMatch = guildMemberMap.get(cleanName);
          if (guildMatch && guildMatch.level > 0) {
            foundLevel = guildMatch.level;
            if (guildMatch.vocation) foundVocation = guildMatch.vocation;
            if (guildMatch.rank) {
              foundRank = mapTibiaRankToPriority(guildMatch.rank);
            }
          } else {
            const charInfo = await fetchCharacter(u.charName);
            if (charInfo && charInfo.level > 0) {
              foundLevel = charInfo.level;
              if (charInfo.vocation) foundVocation = charInfo.vocation;
              if (charInfo.rank) {
                foundRank = mapTibiaRankToPriority(charInfo.rank);
              }
            }
          }

          if (foundLevel > 0) {
            await updateUserProfile(u.uid, {
              level: foundLevel,
              vocation: foundVocation,
              rank: foundRank,
            });
          }

          const charInfo = await fetchCharacter(u.charName);
          if (charInfo) {
            const currentTotal = charInfo.experience;
            const existing = await getDoubleXpRecord(u.uid);
            const perDay = Math.floor(currentTotal / 3);
            await saveDoubleXpRecord({
              uid: u.uid,
              charName: u.charName,
              startExp: existing?.startExp ?? currentTotal,
              fridayExp: existing?.fridayExp ?? perDay,
              saturdayExp: existing?.saturdayExp ?? perDay,
              sundayExp: existing?.sundayExp ?? (currentTotal - perDay * 2),
              totalExp: currentTotal,
              lastCapturedAt: new Date().toISOString(),
            });
          }
        }

        await updateSystemStatus({ lastAutoSyncDate: todayStr });
        console.info('Atualização automática diária concluída com sucesso!');
      } catch (err) {
        console.warn('Erro na atualização automática diária:', err);
      }
    };

    runDailyAutoSync();
  }, [loading, currentUser, isAuthorized, isAdmin]);

  // Subscribe to real-time reservations with zero-knowledge data privacy
  useEffect(() => {
    if (loading || !currentUser || !isAuthorized) return;

    // If administrator, run sanitation check to ensure any legacy reservations have their sensitive fields isolated
    if (isAdmin) {
      import('./services/firestoreService').then(m => {
        m.sanitizeLegacyReservations().catch(err => console.warn('Legacy sanitization:', err));
      });
    }

    const unsub = subscribeToReservations(
      currentUser.uid,
      isAdmin,
      list => {
        setReservations(list);
      },
      undefined,
      userProfile?.charName
    );
    return () => unsub();
  }, [loading, currentUser, isAuthorized, isAdmin, userProfile?.charName]);

  // Admin auto-reconciliation: upgrade any stored fixed-* reservation docs to the player's real Firebase UID
  useEffect(() => {
    if (loading || !currentUser || !isAuthorized || !isAdmin) return;
    if (reservations.length === 0 || usersList.length === 0) return;

    const pending = reservations.filter(
      r => r.userUid?.startsWith('fixed-') && r.charName && !reconciledFixedIdsRef.current.has(r.id)
    );
    if (pending.length === 0) return;

    pending.forEach(r => reconciledFixedIdsRef.current.add(r.id));
    reconcileFixedReservationsWithUsers(pending, usersList).catch(() => {});
  }, [loading, currentUser, isAuthorized, isAdmin, reservations, usersList]);

  // Dynamically link reservations (especially fixed special schedule slots) to registered user accounts by character name,
  // while masking fixed-slot third-party details for non-admin members unless owned/shared/public.
  const linkedReservations = useMemo(() => {
    const userByCharName = new Map<string, UserProfile>();
    (usersList || []).forEach(u => {
      if (u.charName) {
        userByCharName.set(u.charName.trim().toLowerCase(), u);
      }
    });

    const myUid = currentUser?.uid || '';
    const myCleanChar = userProfile?.charName ? userProfile.charName.trim().toLowerCase() : '';
    const myCanonicalChar = userProfile?.charName ? getCanonicalPlayerName(userProfile.charName).toLowerCase() : '';

    return reservations.map(r => {
      if (!r.charName) return r;
      const cleanName = r.charName.trim().toLowerCase();
      const canonicalName = getCanonicalPlayerName(r.charName).toLowerCase();
      const matched = userByCharName.get(cleanName) || userByCharName.get(canonicalName);

      const resolvedUserUid = matched ? matched.uid : r.userUid;
      const resolvedRank = matched?.rank || r.userRank;

      if (!isAdmin) {
        const isOwn =
          (Boolean(myUid) && (resolvedUserUid === myUid || r.userUid === myUid)) ||
          (Boolean(myCleanChar) && (cleanName === myCleanChar || canonicalName === myCanonicalChar));
        const isPartyMember = Boolean(myUid && r.partyMemberUids?.includes(myUid));
        const ownerSharesWithMe = Boolean(
          myUid &&
          matched?.sharedWith &&
          (matched.sharedWith.includes(myUid) || matched.sharedWith.includes('all'))
        );
        const isPublic = Boolean(r.isPublicVisibility);

        if (!isOwn && !isPartyMember && !ownerSharesWithMe && !isPublic) {
          return {
            ...r,
            userUid: resolvedUserUid,
            charName: '',
            userRank: undefined,
            partyMembers: undefined,
            notes: undefined,
          };
        }
      }

      if (matched) {
        return {
          ...r,
          userUid: matched.uid,
          userRank: resolvedRank,
        };
      }
      return r;
    });
  }, [reservations, usersList, isAdmin, currentUser?.uid, userProfile?.charName]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC] dark:bg-[#0B0F19]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl overflow-hidden shadow-lg shadow-blue-500/20 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 animate-pulse flex items-center justify-center p-1">
            <img src="https://i.imgur.com/qOkoaTJ.png" alt="Major" className="h-full w-full object-contain" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Carregando Major...
          </span>
        </div>
      </div>
    );
  }

  // Not Logged In: Fullscreen Oberon Immersive Entrance
  if (!currentUser) {
    return (
      <div className="relative min-h-screen min-h-[100dvh] w-full overflow-hidden bg-slate-950 text-white flex flex-col justify-between selection:bg-blue-600 selection:text-white">
        {/* Fullscreen Oberon Artwork Background with flawless responsive centering */}
        <div className="absolute inset-0 z-0 bg-[#0a0d14] flex items-center justify-center overflow-hidden">
          <img
            src="/assets/oberon.jpeg"
            onError={(e) => {
              e.currentTarget.src = 'https://i.imgur.com/eHTMymv.jpeg';
            }}
            alt="Grand Master Oberon - Inferno de Double"
            className="w-full h-full object-cover object-[center_30%] sm:object-center select-none pointer-events-none scale-105 transition-transform duration-1000"
          />
          {/* Subtle gradient overlay for crystal clear contrast on all devices */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20 sm:bg-black/30 pointer-events-none" />
        </div>

        {/* Open spacer allowing unobstructed view of Oberon artwork */}
        <div className="flex-1" />

        {/* Bottom Area: Perfectly aligned bottom-left card and bottom-right copyright */}
        <footer className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-8 pt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 pointer-events-none">
          {/* Card no Canto Inferior Esquerdo */}
          <div className="pointer-events-auto w-full sm:w-auto inline-flex flex-col items-start gap-3.5 p-4 sm:p-5 rounded-3xl bg-black/85 backdrop-blur-xl border border-white/15 shadow-2xl shadow-black/90 max-w-full sm:max-w-xs md:max-w-sm">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg shadow-blue-500/25 bg-slate-900/95 border border-white/20 p-0.5 shrink-0">
                <img
                  src="https://i.imgur.com/qOkoaTJ.png"
                  alt="Major"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-md leading-tight">
                  Major
                </span>
                <span className="text-xs font-bold text-blue-400 drop-shadow-sm tracking-wide">
                  Inferno de Double
                </span>
              </div>
            </div>

            {/* Google Login Button */}
            <button
              onClick={() => signInWithGoogle()}
              className="w-full min-h-[48px] flex items-center justify-center gap-2.5 px-4 sm:px-5 py-3 rounded-2xl bg-[#2160FF] hover:bg-blue-600 active:scale-[0.98] text-white font-bold text-sm shadow-xl shadow-blue-500/35 border border-blue-400/30 hover:scale-[1.02] transition-all cursor-pointer whitespace-nowrap"
            >
              <svg className="h-4.5 w-4.5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Entrar com o Google</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </button>
          </div>

          {/* Minimal Copyright Pill on bottom-right */}
          <div className="pointer-events-auto self-center sm:self-end max-w-full px-4 py-2 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-[11px] sm:text-xs text-slate-300 shadow-xl select-none sm:whitespace-nowrap text-center">
            Major © 2026 • Todos os direitos reservados para Major
          </div>
        </footer>
      </div>
    );
  }

  // Logged in but not in whitelist
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] dark:bg-[#0B0F19] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <div className="h-14 w-14 rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-7 w-7" />
          </div>

          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            Acesso Pendente de Autorização
          </h2>

          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            O e-mail <strong className="text-slate-900 dark:text-white">{currentUser.email}</strong> ainda não está na lista de e-mails autorizados pelo administrador da guild.
          </p>

          <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 text-left">
            <p className="font-bold text-slate-900 dark:text-white mb-1">Como liberar seu acesso:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Envie seu e-mail para a liderança ou administradores da guild no Discord / WhatsApp.</li>
              <li>Após o admin cadastrar seu e-mail, atualize esta página.</li>
            </ol>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-xl bg-[#2160FF] text-white text-xs font-bold hover:bg-blue-700 transition-all cursor-pointer"
            >
              Verificar Novamente
            </button>
            <button
              onClick={() => signOut()}
              className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Entrar com Outro E-mail
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Needs character link on first login
  if (needsCharacterLink) {
    return <FirstLoginModal />;
  }

  // Full Authenticated SaaS Dashboard
  return (
    <div className="min-h-screen bg-[#F7F9FC] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 transition-colors">
      <Header
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (tab === 'schedule') {
            // keep or reset search
          }
          setCurrentTab(tab);
        }}
        onOpenExport={() => setIsExportOpen(true)}
        releasedCount={releasedRespawns.length}
        lfgCount={lfgPosts.length}
      />

      <main className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6 space-y-4 sm:space-y-5 overflow-x-hidden">
        {/* KPI Stats overview */}
        <StatsCards
          reservations={linkedReservations}
          users={usersList}
          isAdmin={isAdmin}
        />

        {/* Dynamic Tab Content */}
        {currentTab === 'schedule' && (
          <ScheduleGrid
            reservations={linkedReservations}
            usersList={usersList}
            customRespawns={customRespawns}
            initialDay={scheduleDay}
            initialSearch={scheduleSearch}
          />
        )}

        {/* Nova aba Quero Hunt! — cards de jogadores sem PT para a double */}
        {currentTab === 'lfg' && (
          <QueroHuntTab
            posts={lfgPosts}
            userProfile={userProfile}
            onNavigateToMyControls={() => setCurrentTab('my-schedule')}
          />
        )}

        {currentTab === 'released' && (
          <ReleasedRespawnsTab
            releasedList={releasedRespawns}
            usersList={usersList}
            onNavigateToSchedule={(day, respawnName) => {
              if (day) setScheduleDay(day);
              if (respawnName) setScheduleSearch(respawnName);
              setCurrentTab('schedule');
            }}
          />
        )}

        {currentTab === 'my-schedule' && (
          <MyReservations
            reservations={linkedReservations}
            userProfile={userProfile}
            usersList={usersList}
            onUpdateProfile={refreshUsers}
            lfgPosts={lfgPosts}
            onNavigateToLfg={() => setCurrentTab('lfg')}
          />
        )}

        {currentTab === 'members' && isAdmin && (
          <AdminPanel
            usersList={usersList}
            reservations={linkedReservations}
            onRefreshUsers={refreshUsers}
            customRespawns={customRespawns}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-5 pb-24 md:py-6 text-center text-xs text-slate-400 border-t border-slate-200 dark:border-slate-800">
        Major © 2026 • Todos os direitos reservados para Major
      </footer>

      {/* Export Schedule Modal */}
      {isExportOpen && (
        <ExportModal
          reservations={linkedReservations}
          onClose={() => setIsExportOpen(false)}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainDashboard />
    </AuthProvider>
  );
}
