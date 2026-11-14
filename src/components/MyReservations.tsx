import React, { useState, useEffect } from 'react';
import { Reservation, UserProfile, LfgPost, HuntDay } from '../types';
import { Calendar, Clock, MapPin, User, Shield, CheckCircle2, Users, Eye, Share2, Plus, X, UserPlus, Search, Settings, RefreshCw, Zap, Award, TrendingUp, UserCheck, Settings2, Trash2, AlertTriangle, Loader2, Swords, Phone, Pencil, MessageCircle, Flame, Lock } from 'lucide-react';
import {
  DAYS_CONFIG,
  RANK_METADATA,
  getCanonicalPlayerName,
  parseDayStartTime,
  resolveAgendaCanonicalReservation,
  getReservationDedupeKey,
} from '../constants/guildData';
import { updateUserProfile, addReleasedRespawn, deleteReservation, deleteLfgPost, updateReservationVisibility } from '../services/firestoreService';
import { fetchCharacter, TibiaCharacterInfo } from '../services/tibiaDataService';
import { fetchCharacterHighscores } from '../services/missclickApi';
import { useAuth } from '../context/AuthContext';
import { ReservationModal } from './ReservationModal';
import { QueroHuntModal } from './QueroHuntModal';

interface MyReservationsProps {
  reservations: Reservation[];
  userProfile: UserProfile | null;
  usersList: UserProfile[];
  onUpdateProfile?: () => Promise<void>;
  lfgPosts?: LfgPost[];
  onNavigateToLfg?: () => void;
}

export const MyReservations: React.FC<MyReservationsProps> = ({
  reservations,
  userProfile,
  usersList,
  onUpdateProfile,
  lfgPosts = [],
  onNavigateToLfg,
}) => {
  const { refreshProfile } = useAuth();
  const [selectedDay, setSelectedDay] = useState<string>('friday');
  const [isLfgModalOpen, setIsLfgModalOpen] = useState(false);
  const [deletingLfg, setDeletingLfg] = useState(false);

  const myLfgPost = lfgPosts.find(p => p.userUid === userProfile?.uid);

  // Party sharing state
  const [sharingUids, setSharingUids] = useState<string[]>(userProfile?.sharedWith || []);
  const [isPartyManageOpen, setIsPartyManageOpen] = useState(false);
  const [isAddPartyOpen, setIsAddPartyOpen] = useState(false);
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const [savingShare, setSavingShare] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Tracked XP Players state
  const [trackedUids, setTrackedUids] = useState<string[]>(userProfile?.trackedXpUids || []);
  const [isAddTrackOpen, setIsAddTrackOpen] = useState(false);
  const [trackSearchQuery, setTrackSearchQuery] = useState('');
  const [trackedCharMap, setTrackedCharMap] = useState<Record<string, TibiaCharacterInfo>>({});
  const [loadingTracked, setLoadingTracked] = useState(false);

  // Automatic API Character XP state
  const [charInfo, setCharInfo] = useState<TibiaCharacterInfo | null>(null);
  const [loadingXp, setLoadingXp] = useState(false);
  const [xpToast, setXpToast] = useState<string | null>(null);

  // Reservation management modal state from My Controls
  const [editingReservationModal, setEditingReservationModal] = useState<Reservation | null>(null);

  // In-app confirmation modal state for Liberar Respawn (avoiding window.confirm)
  const [releaseConfirmModal, setReleaseConfirmModal] = useState<Reservation | null>(null);
  const [isReleasing, setIsReleasing] = useState(false);

  const handleOpenReleaseConfirm = (res: Reservation) => {
    const myChar = userProfile?.charName?.trim().toLowerCase() || '';
    const myCanonical = getCanonicalPlayerName(userProfile?.charName).toLowerCase();
    const resChar = res.charName?.trim().toLowerCase() || '';
    const resCanonical = getCanonicalPlayerName(res.charName).toLowerCase();
    const isMarkedPlayer =
      (Boolean(myChar) &&
        (resChar === myChar ||
          resCanonical === myChar ||
          resChar === myCanonical ||
          resCanonical === myCanonical)) ||
      (Boolean(userProfile?.uid) && res.userUid === userProfile?.uid);
    const canRelease = isMarkedPlayer || userProfile?.rank === 'Leader' || Boolean(userProfile?.isAdmin);

    if (!canRelease) {
      setShareToast('Apenas o jogador marcado como quem pegou o respawn (ou líder/admin) pode liberá-lo.');
      setTimeout(() => setShareToast(null), 4000);
      return;
    }

    setReleaseConfirmModal(res);
  };

  const executeReleaseRespawn = async () => {
    if (!releaseConfirmModal) return;
    const res = releaseConfirmModal;
    setIsReleasing(true);

    try {
      await addReleasedRespawn({
        respawnName: res.respawnName,
        timeSlot: res.timeSlot,
        day: res.day,
        slotType: res.slotType || 'normal',
        charName: res.charName || userProfile?.charName || 'Membro',
        userUid: userProfile?.uid || res.userUid || '',
        releasedAt: new Date().toISOString(),
      });

      await deleteReservation(res.id);

      setShareToast(`Respawn "${res.respawnName}" liberado com sucesso! Horário disponibilizado para a guild.`);
      setTimeout(() => setShareToast(null), 4500);
      setReleaseConfirmModal(null);
    } catch (err) {
      console.error('Erro ao liberar respawn:', err);
      setShareToast('Erro ao liberar respawn. Tente novamente.');
      setTimeout(() => setShareToast(null), 4500);
    } finally {
      setIsReleasing(false);
    }
  };

  const [updatingVisId, setUpdatingVisId] = useState<string | null>(null);

  const handleToggleVisibility = async (res: Reservation) => {
    if (!res.id) return;
    setUpdatingVisId(res.id);
    try {
      const nextVal = !res.isPublicVisibility;
      await updateReservationVisibility(res.id, nextVal);
      res.isPublicVisibility = nextVal;
      setShareToast(
        nextVal
          ? `Visibilidade liberada: Seu nome agora está visível para a guilda neste respawn.`
          : `Visibilidade privada: Membros comuns agora veem apenas "Ocupado" com cadeado.`
      );
      setTimeout(() => setShareToast(null), 4500);
    } catch (err) {
      console.error('Erro ao alternar visibilidade:', err);
      setShareToast('Erro ao atualizar visibilidade da reserva.');
      setTimeout(() => setShareToast(null), 3000);
    } finally {
      setUpdatingVisId(null);
    }
  };

  useEffect(() => {
    if (userProfile?.sharedWith !== undefined) {
      setSharingUids(userProfile.sharedWith || []);
    }
    if (userProfile?.trackedXpUids !== undefined) {
      setTrackedUids(userProfile.trackedXpUids || []);
    }
  }, [userProfile?.sharedWith, userProfile?.trackedXpUids]);

  // Automatic XP fetch on mount or when charName changes (Yesterday's Exp)
  const fetchCharacterXpAuto = async () => {
    if (!userProfile?.charName) return;
    setLoadingXp(true);
    try {
      // 1. Fetch yesterday's XP from highscores / missclick API
      const hsData = await fetchCharacterHighscores(userProfile.charName);

      // 2. Also fetch character details from TibiaData for current level, vocation, world, and total exp
      const info = await fetchCharacter(userProfile.charName);

      const yesterdayExp = typeof hsData?.yesterdayExp === 'number'
        ? hsData.yesterdayExp
        : typeof hsData?.expYesterday === 'number'
        ? hsData.expYesterday
        : typeof hsData?.exp_yesterday === 'number'
        ? hsData.exp_yesterday
        : undefined;

      const xpDate = hsData?.xpDate || hsData?.date || undefined;

      setCharInfo({
        name: info?.name || hsData?.name || userProfile.charName,
        level: info?.level || hsData?.level || userProfile.level,
        experience: info?.experience || 0,
        yesterdayExp: yesterdayExp !== undefined ? yesterdayExp : 0,
        xpDate,
        vocation: info?.vocation || hsData?.vocation || userProfile.vocation,
        world: info?.world || hsData?.world || '',
      });

      if (yesterdayExp !== undefined && yesterdayExp > 0) {
        setXpToast('Experiência feita ontem obtida com sucesso!');
        setTimeout(() => setXpToast(null), 3000);
      }
    } catch (err) {
      console.warn('Erro ao buscar XP de ontem:', err);
      const info = await fetchCharacter(userProfile.charName);
      if (info) {
        setCharInfo({
          ...info,
          yesterdayExp: 0,
        });
      }
    } finally {
      setLoadingXp(false);
    }
  };

  useEffect(() => {
    fetchCharacterXpAuto();
  }, [userProfile?.charName]);

  // Fetch XP for all tracked players (Yesterday's Exp)
  useEffect(() => {
    const fetchTrackedPlayersXp = async () => {
      if (!trackedUids || trackedUids.length === 0) {
        setTrackedCharMap({});
        return;
      }
      setLoadingTracked(true);
      const newMap: Record<string, TibiaCharacterInfo> = {};
      for (const uid of trackedUids) {
        const u = usersList.find(item => item.uid === uid);
        if (u && u.charName) {
          try {
            const hsData = await fetchCharacterHighscores(u.charName);
            const info = await fetchCharacter(u.charName);

            const yesterdayExp = typeof hsData?.yesterdayExp === 'number'
              ? hsData.yesterdayExp
              : typeof hsData?.expYesterday === 'number'
              ? hsData.expYesterday
              : typeof hsData?.exp_yesterday === 'number'
              ? hsData.exp_yesterday
              : undefined;

            newMap[uid] = {
              name: info?.name || hsData?.name || u.charName,
              level: info?.level || hsData?.level || u.level,
              experience: info?.experience || 0,
              yesterdayExp: yesterdayExp !== undefined ? yesterdayExp : 0,
              xpDate: hsData?.xpDate || hsData?.date || undefined,
              vocation: info?.vocation || hsData?.vocation || u.vocation,
              world: info?.world || hsData?.world || '',
            };
          } catch {
            // ignore
          }
        }
      }
      setTrackedCharMap(newMap);
      setLoadingTracked(false);
    };

    fetchTrackedPlayersXp();
  }, [trackedUids, usersList]);

  const updateTrackedUids = async (updated: string[]) => {
    setTrackedUids(updated);
    if (!userProfile?.uid) return;
    try {
      await updateUserProfile(userProfile.uid, { trackedXpUids: updated });
      await refreshProfile();
      if (onUpdateProfile) await onUpdateProfile();
      setShareToast('Lista de jogadores para acompanhamento de XP atualizada!');
      setTimeout(() => setShareToast(null), 4000);
    } catch (err) {
      console.error('Erro ao atualizar jogadores rastreados:', err);
    }
  };

  const addTrackedPlayer = (targetUid: string) => {
    if (trackedUids.includes(targetUid)) return;
    const updated = [...trackedUids, targetUid];
    updateTrackedUids(updated);
  };

  const removeTrackedPlayer = (targetUid: string) => {
    const updated = trackedUids.filter(id => id !== targetUid);
    updateTrackedUids(updated);
  };

  const updateSharing = async (updated: string[]) => {
    setSharingUids(updated);
    if (!userProfile?.uid) return;
    setSavingShare(true);
    try {
      await updateUserProfile(userProfile.uid, { sharedWith: updated });
      await refreshProfile();
      if (onUpdateProfile) await onUpdateProfile();
      setShareToast('Permissões de visão da party atualizadas com sucesso!');
      setTimeout(() => setShareToast(null), 4000);
    } catch (err) {
      console.error('Erro ao atualizar compartilhamento:', err);
      setShareToast('Erro ao salvar permissões.');
    } finally {
      setSavingShare(false);
    }
  };

  const addPartyMember = (targetUid: string) => {
    if (sharingUids.includes(targetUid)) return;
    const updated = [...sharingUids, targetUid];
    updateSharing(updated);
  };

  const removePartyMember = (targetUid: string) => {
    const updated = sharingUids.filter(id => id !== targetUid);
    updateSharing(updated);
  };

  const myCharName = userProfile?.charName?.trim().toLowerCase() || '';
  const myCanonicalChar = getCanonicalPlayerName(userProfile?.charName).toLowerCase();
  const myUserId = userProfile?.uid || '';

  const isOwnedReservation = (res: Reservation): boolean => {
    if (res.isOccupied === false) return false;
    const resChar = res.charName?.trim().toLowerCase() || '';
    const canonicalResChar = getCanonicalPlayerName(res.charName).toLowerCase();
    const resUserId = res.userUid || '';
    return Boolean(
      (myUserId && resUserId === myUserId) ||
        (myCharName &&
          resChar &&
          (resChar === myCharName ||
            canonicalResChar === myCharName ||
            resChar === myCanonicalChar ||
            canonicalResChar === myCanonicalChar))
    );
  };

  const deduplicateAndSortHunts = (list: Reservation[]): Reservation[] => {
    const map = new Map<string, Reservation>();
    for (const item of list) {
      const canonical = resolveAgendaCanonicalReservation(item);
      const key = getReservationDedupeKey(canonical);
      if (!map.has(key)) {
        map.set(key, canonical);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => parseDayStartTime(a.timeSlot) - parseDayStartTime(b.timeSlot)
    );
  };

  const myReservations = deduplicateAndSortHunts(reservations.filter(isOwnedReservation));
  const myReservationKeys = new Set(myReservations.map(r => getReservationDedupeKey(r)));

  const sharedReservations = deduplicateAndSortHunts(
    reservations.filter(res => {
      if (res.isOccupied === false) return false;
      if (isOwnedReservation(res)) return false;
      const key = getReservationDedupeKey(resolveAgendaCanonicalReservation(res));
      if (myReservationKeys.has(key)) return false;

      const resUserId = res.userUid || '';
      const resChar = res.charName?.trim() || '';
      if (!resChar) return false;

      const explicitlyInHuntParty = Boolean(myUserId && res.partyMemberUids?.includes(myUserId));
      const canonicalResChar = getCanonicalPlayerName(resChar).toLowerCase();
      const ownerProfile = usersList.find(
        u =>
          (resUserId && u.uid === resUserId) ||
          (u.charName &&
            (u.charName.trim().toLowerCase() === resChar.toLowerCase() ||
              getCanonicalPlayerName(u.charName).toLowerCase() === canonicalResChar))
      );
      const ownerSharedWithMe = Boolean(myUserId && ownerProfile?.sharedWith?.includes(myUserId));

      return Boolean(explicitlyInHuntParty || ownerSharedWithMe);
    })
  );

  const filteredMyByDay = myReservations.filter(res => res.day === selectedDay);
  const filteredSharedByDay = sharedReservations.filter(res => res.day === selectedDay);

  const otherUsers = usersList.filter(u => u.uid !== myUserId);

  const isSharedWithAll = sharingUids.includes('all');

  const toggleShareWithAll = () => {
    if (isSharedWithAll) {
      updateSharing(sharingUids.filter(id => id !== 'all'));
    } else {
      updateSharing([...sharingUids, 'all']);
    }
  };

  const selectedPartyMembers = otherUsers
    .filter(u => sharingUids.includes(u.uid))
    .sort((a, b) => a.charName.localeCompare(b.charName));

  const availableUsersToAdd = otherUsers
    .filter(u => !sharingUids.includes(u.uid))
    .filter(u => {
      if (!partySearchQuery.trim()) return true;
      const q = partySearchQuery.toLowerCase();
      return (
        u.charName.toLowerCase().includes(q) ||
        u.guildName.toLowerCase().includes(q) ||
        (u.vocation || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.charName.localeCompare(b.charName));

  const trackedUsersList = usersList.filter(u => trackedUids.includes(u.uid));

  const availableUsersToTrack = otherUsers
    .filter(u => !trackedUids.includes(u.uid))
    .filter(u => {
      if (!trackSearchQuery.trim()) return true;
      const q = trackSearchQuery.toLowerCase();
      return (
        u.charName.toLowerCase().includes(q) ||
        u.guildName.toLowerCase().includes(q) ||
        (u.vocation || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.charName.localeCompare(b.charName));

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {(shareToast || xpToast) && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 shadow-md animate-in fade-in duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-bold">{shareToast || xpToast}</span>
        </div>
      )}

      {/* Streamlined Header & Quick Actions Bar */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider">
              Missclick
            </span>
            <span className="text-xs text-slate-400 font-mono truncate">• {userProfile?.charName || 'Personagem'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Painel de Controle
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0 w-full md:w-auto">
          <button
            type="button"
            onClick={() => {
              setTrackSearchQuery('');
              setIsAddTrackOpen(true);
            }}
            className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/25 transition-all cursor-pointer whitespace-nowrap"
          >
            <UserCheck className="h-4 w-4 shrink-0" />
            <span>Incluir Jogadores (XP)</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPartyManageOpen(true)}
            className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#2160FF] hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition-all cursor-pointer whitespace-nowrap"
            title="Liberar visibilidade dos seus respawns para outros membros ou para toda a guilda"
          >
            <Eye className="h-4 w-4 shrink-0" />
            <span className="truncate">Dê visibilidade ({isSharedWithAll ? 'Toda Guilda' : `${selectedPartyMembers.length}`})</span>
          </button>
        </div>
      </div>

      {/* Automatic Character Experience Card (No day cards) */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shadow-sm shrink-0">
            <Award className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">Personagem Vinculado</div>
            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="truncate">{charInfo?.name || userProfile?.charName || 'Não definido'}</span>
              {charInfo?.level && (
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-xs font-bold tabular-nums shrink-0">
                  Lv. {charInfo.level}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {charInfo?.vocation || userProfile?.vocation || 'Vocação N/D'} • {charInfo?.world || 'Mundo N/D'}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/60 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Experiência (Ontem)</span>
            <span className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums block truncate">
              {loadingXp
                ? 'Sincronizando...'
                : typeof charInfo?.yesterdayExp === 'number'
                ? `${charInfo.yesterdayExp.toLocaleString('pt-BR')} XP`
                : '0 XP'}
            </span>
            {charInfo?.xpDate && (
              <span className="text-[10px] text-slate-400 block mt-0.5 tabular-nums">
                Data: {charInfo.xpDate}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={fetchCharacterXpAuto}
            disabled={loadingXp}
            title="Atualizar XP"
            aria-label="Atualizar XP"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 shadow-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loadingXp ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tracked Players XP Section */}
      {trackedUsersList.length > 0 && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  XP ({trackedUsersList.length})
                </h3>
                <p className="text-[11px] text-slate-500">Monitore o progresso de experiência dos jogadores adicionados.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trackedUsersList.map(u => {
              const info = trackedCharMap[u.uid];
              const rankMeta = RANK_METADATA[u.rank];
              return (
                <div key={u.uid} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3 relative group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-xl font-bold text-xs border shrink-0 ${rankMeta?.badgeClass || 'bg-slate-100 text-slate-800'}`}>
                        {u.charName.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-black truncate text-slate-900 dark:text-white">
                          {u.charName}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {u.guildName} • Lv {info?.level || u.level}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTrackedPlayer(u.uid)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      title="Remover acompanhamento"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Experiência (Ontem)</span>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {loadingTracked && !info
                          ? 'Carregando...'
                          : typeof info?.yesterdayExp === 'number'
                          ? `${info.yesterdayExp.toLocaleString('pt-BR')} XP`
                          : '0 XP'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Vocação</span>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 truncate max-w-[120px] block">
                        {info?.vocation || u.vocation || 'N/D'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Helpful banner for released respawns */}
      <div className="bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-blue-500/10 border border-blue-200/60 dark:border-blue-900/40 rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold">
            <Zap className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white">
              Liberação de Respawns para a Guild
            </h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Caso aconteça algum imprevisto e você não possa caçar no horário planilhado, clique em <strong>"Liberar Respawn"</strong>, o mesmo ficará disponível para outros jogadores da guild.
            </p>
          </div>
        </div>
      </div>

      {/* QUERO HUNT! AVAILABILITY REGISTRATION SECTION */}
      <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 h-44 w-44 rounded-full bg-gradient-to-br from-red-500/10 via-amber-500/10 to-transparent blur-2xl pointer-events-none" />

        {myLfgPost ? (
          /* Active announcement card */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-600 text-white flex items-center justify-center font-bold shadow-md shadow-red-500/20">
                  <Swords className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Seu Anúncio no Quero Hunt!
                    </h3>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Visível na aba Quero Hunt!
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Outros membros podem ver sua disponibilidade e te chamar no WhatsApp.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {onNavigateToLfg && (
                  <button
                    type="button"
                    onClick={onNavigateToLfg}
                    className="flex-1 sm:flex-initial min-h-[40px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>Ver no Quero Hunt!</span>
                    <span className="text-[10px]">→</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsLfgModalOpen(true)}
                  className="min-h-[40px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  disabled={deletingLfg}
                  onClick={async () => {
                    if (!myLfgPost) return;
                    setDeletingLfg(true);
                    try {
                      await deleteLfgPost(myLfgPost.id);
                      setShareToast('Seu anúncio no Quero Hunt! foi removido.');
                      setTimeout(() => setShareToast(null), 3000);
                    } catch (err) {
                      console.error('Erro ao remover anúncio:', err);
                    } finally {
                      setDeletingLfg(false);
                    }
                  }}
                  className="min-h-[40px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Excluir</span>
                </button>
              </div>
            </div>

            {/* Quick Preview Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Personagem & Vocação</span>
                <span className="text-xs font-black text-slate-900 dark:text-white block mt-0.5">
                  {myLfgPost.charName} (Lv. {myLfgPost.level})
                </span>
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  {myLfgPost.vocation}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Telefone / WhatsApp</span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono block mt-0.5 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {myLfgPost.phone}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Dias Marcados</span>
                <div className="flex items-center gap-1 mt-1">
                  {[
                    { key: 'friday' as HuntDay, label: 'SEX' },
                    { key: 'saturday' as HuntDay, label: 'SÁB' },
                    { key: 'sunday' as HuntDay, label: 'DOM' },
                  ].map(d => {
                    const active = myLfgPost.days && myLfgPost.days.includes(d.key);
                    return (
                      <span
                        key={d.key}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                          active
                            ? 'bg-rose-500 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-400 opacity-40'
                        }`}
                      >
                        {d.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Horários</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-0.5 truncate">
                  {myLfgPost.timeSlots || 'Flexível'}
                </span>
              </div>
            </div>

            {myLfgPost.notes && (
              <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-950 dark:text-amber-200">
                <span className="text-[10px] uppercase font-black text-amber-700 dark:text-amber-400 block mb-0.5">
                  Observação cadastrada:
                </span>
                <p className="font-medium italic">"{myLfgPost.notes}"</p>
              </div>
            )}
          </div>
        ) : (
          /* Empty / Call to Action */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-600 text-white flex items-center justify-center font-bold shadow-md shadow-red-500/25 shrink-0">
                <Flame className="h-6 w-6 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Quero Hunt! — Está sem Party para a Double?
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-black uppercase">
                    Novo
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                  Cadastre seus horários, vocação e WhatsApp. Seu card ficará imediatamente visível na aba <strong>Quero Hunt!</strong> para outros membros te convidarem para o time.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsLfgModalOpen(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white text-xs font-black shadow-lg shadow-red-500/25 transition-all cursor-pointer whitespace-nowrap shrink-0 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Swords className="h-4 w-4" />
              <span>Anunciar Disponibilidade +</span>
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4 sm:space-y-6">
          {/* Day Selector Tabs */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 bg-white dark:bg-slate-900 p-1.5 sm:p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            {DAYS_CONFIG.map(day => {
              const totalDayCount = myReservations.filter(r => r.day === day.key).length + sharedReservations.filter(r => r.day === day.key).length;
              const isSelected = selectedDay === day.key;

              return (
                <button
                  key={day.key}
                  onClick={() => setSelectedDay(day.key)}
                  className={`min-h-[44px] flex items-center justify-between gap-1 px-2.5 sm:px-4 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#2160FF] text-white shadow-lg shadow-blue-500/30'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 hidden xs:inline sm:inline" />
                    <span className="sm:hidden truncate">{day.shortLabel}</span>
                    <span className="hidden sm:inline truncate">{day.label}</span>
                  </div>
                  <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums shrink-0 ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {totalDayCount}
                  </span>
                </button>
              );
            })}
          </div>

      {/* Grid Layout for Personal & Shared Reservations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* 1. Minhas Hunts */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Minhas Hunts Confirmadas
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {filteredMyByDay.length === 0 ? 'Nenhum horário alocado.' : `${filteredMyByDay.length} horário(s) confirmado(s).`}
                </p>
              </div>
            </div>
          </div>

          {filteredMyByDay.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                <Clock className="h-6 w-6" />
              </div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Nenhum horário marcado neste dia
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Vá na aba <span className="font-bold text-blue-600">Agenda</span> para visualizar os horários.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMyByDay.map((res, index) => (
                <div
                  key={res.id || `my-res-${index}`}
                  onClick={() => setEditingReservationModal(res)}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group hover:border-blue-400 dark:hover:border-blue-500"
                  title="Clique para gerenciar, editar party ou liberar esta hunt"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-xs font-black font-mono tabular-nums">
                        <Clock className="h-3 w-3" />
                        {res.timeSlot}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {res.day === 'friday' ? 'Sexta-feira' : res.day === 'saturday' ? 'Sábado' : 'Domingo'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Confirmado
                      </span>
                    </div>
                    <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{res.respawnName}</span>
                    </div>
                    {(res.partyMembers || (res.partyMemberUids && res.partyMemberUids.length > 0)) && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold truncate">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          Party: {res.partyMembers || res.partyMemberUids?.map(uid => usersList.find(u => u.uid === uid)?.charName).filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                    {res.notes && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate">
                        Obs: {res.notes}
                      </div>
                    )}
                  </div>

                  <div className="w-full sm:w-auto sm:text-right shrink-0 flex flex-col sm:items-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/70 dark:border-slate-700/60">
                    <div className="flex sm:block items-center justify-between text-xs">
                      <div className="font-bold text-slate-700 dark:text-slate-300">{res.charName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Toque p/ Party</div>
                    </div>
                    {(isOwnedReservation(res) || userProfile?.rank === 'Leader' || userProfile?.isAdmin) && (
                      <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-1.5 sm:flex-wrap sm:justify-end w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleToggleVisibility(res);
                          }}
                          disabled={updatingVisId === res.id}
                          className={`min-h-[40px] sm:min-h-[32px] px-2.5 py-1.5 rounded-xl sm:rounded-lg text-[11px] sm:text-[10px] font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 whitespace-nowrap ${
                            res.isPublicVisibility
                              ? 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900/90 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                          }`}
                          title={
                            res.isPublicVisibility
                              ? 'Visível para a guilda. Clique para ocultar o seu nome (mostrar apenas Ocupado para membros).'
                              : 'Privado para membros comuns (mostra apenas Ocupado com cadeado). Clique para liberar visibilidade do seu nome.'
                          }
                        >
                          {res.isPublicVisibility ? (
                            <>
                              <Eye className="h-3.5 w-3.5 sm:h-3 sm:w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>Visível Guild</span>
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5 sm:h-3 sm:w-3 text-slate-500 shrink-0" />
                              <span>Privado</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleOpenReleaseConfirm(res);
                          }}
                          className="min-h-[40px] sm:min-h-[32px] px-2.5 py-1.5 rounded-xl sm:rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] sm:text-[10px] font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 whitespace-nowrap"
                          title="Liberar este respawn para a guild"
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:h-3 sm:w-3 shrink-0" />
                          <span>Liberar</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Respawns da Party */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Respawns da Party (Compartilhados)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {filteredSharedByDay.length === 0 ? 'Nenhum respawn compartilhado.' : `${filteredSharedByDay.length} horário(s) visíveis.`}
                </p>
              </div>
            </div>
          </div>

          {filteredSharedByDay.length === 0 ? (
            <div className="text-center py-10 px-4">
              <p className="text-xs text-slate-400 italic">Nenhum parceiro de party liberou a visão de respawns para você neste dia.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSharedByDay.map((res, index) => (
                <div
                  key={res.id || `shared-res-${index}`}
                  className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 shadow-xs hover:shadow-sm transition-all flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-black font-mono">
                        <Clock className="h-3 w-3" />
                        {res.timeSlot}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {res.day === 'friday' ? 'Sexta-feira' : res.day === 'saturday' ? 'Sábado' : 'Domingo'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200 flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        Party View
                      </span>
                    </div>
                    <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{res.respawnName}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{res.charName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Party Member</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Modal to Add Players to Track XP */}
      {isAddTrackOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Incluir Jogadores para Acompanhar XP
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTrackOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={trackSearchQuery}
                onChange={e => setTrackSearchQuery(e.target.value)}
                placeholder="Buscar por nome do char ou guilda..."
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 pl-9 text-sm sm:text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {availableUsersToTrack.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Nenhum jogador encontrado com este termo ou todos já estão sendo acompanhados.
                </div>
              ) : (
                availableUsersToTrack.map(u => {
                  const rankMeta = RANK_METADATA[u.rank];
                  return (
                    <div
                      key={u.uid}
                      className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3 hover:border-emerald-500/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold text-xs border shrink-0 ${rankMeta?.badgeClass || 'bg-slate-100 text-slate-800'}`}>
                          {u.charName.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-black truncate text-slate-900 dark:text-white">
                            {u.charName}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {u.guildName} • {u.rank} • Lv {u.level}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => addTrackedPlayer(u.uid)}
                        className="min-h-[40px] flex items-center gap-1 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Acompanhar</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAddTrackOpen(false)}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Drawer for Managing Party Visibility */}
      {isPartyManageOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 sm:space-y-5">
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                  <Share2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Gerenciar Visibilidade da Party
                  </h3>
                  <p className="text-xs text-slate-500">Escolha quem pode ver os horários que você pegou.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPartyManageOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Global Guild Visibility Toggle */}
            <div className="p-3.5 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Liberar visibilidade para todos os membros
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  Quando ativo, todos os membros da guilda poderão ver seu nome nos seus respawns. Quando desativado, apenas os membros selecionados abaixo (ou admins) verão seu nome.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleShareWithAll}
                className={`min-h-[40px] w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  isSharedWithAll
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-300'
                }`}
              >
                {isSharedWithAll ? 'Liberado (Toda Guild)' : 'Apenas Selecionados'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Membros com acesso ({selectedPartyMembers.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setPartySearchQuery('');
                  setIsAddPartyOpen(true);
                }}
                className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Adicionar Membro</span>
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {selectedPartyMembers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 italic">
                  Nenhum membro na sua party com acesso liberado.
                </div>
              ) : (
                selectedPartyMembers.map(u => {
                  const rankMeta = RANK_METADATA[u.rank];
                  return (
                    <div key={u.uid} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-xl font-bold text-xs border shrink-0 ${rankMeta?.badgeClass || 'bg-slate-100 text-slate-800'}`}>
                          {u.charName.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-black truncate text-slate-900 dark:text-white">
                            {u.charName}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {u.guildName} • {u.rank} • Lv {u.level}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removePartyMember(u.uid)}
                        className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors cursor-pointer shrink-0"
                      >
                        Remover
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPartyManageOpen(false)}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal to Add Party Member with Search and Alphabetical Order */}
      {isAddPartyOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Adicionar Jogador à Party
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPartyOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={partySearchQuery}
                onChange={e => setPartySearchQuery(e.target.value)}
                placeholder="Buscar por nome do char ou guilda..."
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 pl-9 text-sm sm:text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {availableUsersToAdd.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Nenhum jogador encontrado com este termo ou todos já possuem acesso.
                </div>
              ) : (
                availableUsersToAdd.map(u => {
                  const rankMeta = RANK_METADATA[u.rank];
                  return (
                    <div
                      key={u.uid}
                      className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3 hover:border-blue-500/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold text-xs border shrink-0 ${rankMeta?.badgeClass || 'bg-slate-100 text-slate-800'}`}>
                          {u.charName.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-black truncate text-slate-900 dark:text-white">
                            {u.charName}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {u.guildName} • {u.rank} • Lv {u.level}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => addPartyMember(u.uid)}
                        className="min-h-[40px] flex items-center gap-1 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Liberar</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAddPartyOpen(false)}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reservation management modal from My Controls */}
      {editingReservationModal && (
        <ReservationModal
          day={editingReservationModal.day}
          slotType={editingReservationModal.slotType || 'normal'}
          respawnName={editingReservationModal.respawnName}
          timeSlot={editingReservationModal.timeSlot}
          existingReservation={editingReservationModal}
          usersList={usersList}
          onClose={() => setEditingReservationModal(null)}
        />
      )}

      {/* Modal de Confirmacao In-App para Liberar Respawn */}
      {releaseConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5 pb-safe">
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Liberar Respawn
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Disponibilizar este horário para outros membros
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 shrink-0">Respawn:</span>
                <strong className="text-slate-900 dark:text-white font-black text-right truncate">{releaseConfirmModal.respawnName}</strong>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 shrink-0">Horário:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{releaseConfirmModal.timeSlot}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 shrink-0">Dia:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {releaseConfirmModal.day === 'friday' ? 'Sexta-feira' : releaseConfirmModal.day === 'saturday' ? 'Sábado' : 'Domingo'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 shrink-0">Jogador Marcado:</span>
                <strong className="text-slate-900 dark:text-white truncate">{releaseConfirmModal.charName || userProfile?.charName}</strong>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Tem certeza que deseja liberar este respawn? Ele será removido das suas reservas e ficará imediatamente visível e disponível para todos os jogadores na aba <strong className="text-blue-600 dark:text-blue-400">Respaws Liberados</strong> e no grid geral.
            </p>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isReleasing}
                onClick={() => setReleaseConfirmModal(null)}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isReleasing}
                onClick={executeReleaseRespawn}
                className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isReleasing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Liberando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Confirmar Liberação</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Quero Hunt! */}
      <QueroHuntModal
        isOpen={isLfgModalOpen}
        onClose={() => setIsLfgModalOpen(false)}
        userProfile={userProfile}
        existingPost={myLfgPost}
      />
    </div>
  );
};
