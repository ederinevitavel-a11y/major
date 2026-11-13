import React, { useState, useEffect, useMemo } from 'react';
import { AllowedEmail, PriorityRank, UserProfile, Reservation, HuntDay, CustomRespawn, ReleasedRespawn } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  getAllowedEmails,
  addAllowedEmail,
  removeAllowedEmail,
  updateUserProfile,
  isUserOnline,
  addCustomRespawn,
  removeCustomRespawn,
  subscribeToReleasedRespawns,
  deleteReservation,
} from '../services/firestoreService';
import { fetchGuildMembers, fetchCharacter, mapTibiaRankToPriority } from '../services/tibiaDataService';
import { fetchGuildHighscores, fetchCharacterHighscores, fetchMissclickMembers } from '../services/missclickApi';
import { PRIORITY_RANKS, RANK_METADATA, DEFAULT_GUILDS, SUPER_ADMIN_EMAIL, DAYS_CONFIG, SPECIAL_SCHEDULE_PLAYERS } from '../constants/guildData';
import { ResetScheduleModal } from './ResetScheduleModal';
import { AdminAssignModal } from './AdminAssignModal';
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Edit2,
  Check,
  X,
  RefreshCw,
  Search,
  ExternalLink,
  Users,
  AlertCircle,
  Loader2,
  RotateCcw,
  Calendar,
  Layers,
  CheckCircle2,
  Target,
  Filter,
  Sparkles,
  Wifi,
  WifiOff,
  Zap,
  Eye,
  EyeOff,
  FileSpreadsheet,
  UserCheck,
  Clock,
  Copy,
  Archive,
} from 'lucide-react';
import { ExportModal } from './ExportModal';
import { SpecialBackupPanel } from './SpecialBackupPanel';

interface AdminPanelProps {
  usersList: UserProfile[];
  reservations: Reservation[];
  onRefreshUsers: () => Promise<void>;
  customRespawns?: CustomRespawn[];
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  usersList,
  reservations,
  onRefreshUsers,
  customRespawns = [],
}) => {
  const { currentUser } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'assign' | 'emails' | 'apis' | 'released' | 'backup'>('assign');
  const [releasedRespawnsList, setReleasedRespawnsList] = useState<ReleasedRespawn[]>([]);
  const [isExcelBackupOpen, setIsExcelBackupOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeToReleasedRespawns(list => {
      setReleasedRespawnsList(list);
    });
    return () => unsub();
  }, []);

  const [guildHighscoresData, setGuildHighscoresData] = useState<any>(null);
  const [loadingGuildHs, setLoadingGuildHs] = useState(false);
  const [guildHsError, setGuildHsError] = useState<string | null>(null);

  const loadGuildHighscores = async (forceRefresh = false) => {
    setLoadingGuildHs(true);
    setGuildHsError(null);
    try {
      const hintMap = new Map<string, { name: string; level?: number; vocation?: string }>();
      usersList.forEach(u => {
        if (u.charName) {
          hintMap.set(u.charName.trim().toLowerCase(), {
            name: u.charName.trim(),
            level: u.level,
            vocation: u.vocation,
          });
        }
      });
      SPECIAL_SCHEDULE_PLAYERS.forEach(sp => {
        const key = sp.charName.trim().toLowerCase();
        if (!hintMap.has(key)) {
          hintMap.set(key, { name: sp.charName });
        }
      });

      const data = await fetchGuildHighscores(Array.from(hintMap.values()), forceRefresh);
      if (!data || data.error) {
        setGuildHsError('Não foi possível obter os dados de experiência da API no momento. Tente novamente em instantes.');
      } else {
        setGuildHighscoresData(data);
      }
    } catch (err) {
      console.error(err);
      setGuildHsError('Erro ao carregar experiência dos jogadores. Tente novamente.');
    } finally {
      setLoadingGuildHs(false);
    }
  };

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetModalDay, setResetModalDay] = useState<HuntDay>('friday');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dedicated Rank Filter State
  const [selectedRank, setSelectedRank] = useState<'all' | PriorityRank>('all');
  const [filterOnlineOnly, setFilterOnlineOnly] = useState<boolean>(false);
  const [hiddenPlayerUids, setHiddenPlayerUids] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Assign Respawn Modal State
  const [assignUser, setAssignUser] = useState<UserProfile | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Allowed Emails State
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member');
  const [newNote, setNewNote] = useState('');
  const [loadingEmails, setLoadingEmails] = useState(false);

  // Custom respawn management state
  const [newHuntName, setNewHuntName] = useState('');
  const [newHuntType, setNewHuntType] = useState<'normal' | '3h'>('normal');
  const [addingHunt, setAddingHunt] = useState(false);

  const handleAddHunt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHuntName.trim()) return;
    setAddingHunt(true);
    try {
      await addCustomRespawn(newHuntName.trim(), newHuntType, currentUser?.email || 'admin');
      setNewHuntName('');
      setToastMessage(`Hunt "${newHuntName.trim()}" adicionada com sucesso!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setToastMessage('Erro ao adicionar hunt.');
    } finally {
      setAddingHunt(false);
    }
  };

  const handleDeleteHunt = async (id: string, name: string) => {
    try {
      await removeCustomRespawn(id);
      setToastMessage(`Hunt "${name}" removida com sucesso.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setToastMessage('Erro ao remover hunt.');
    }
  };

  const [syncingLevels, setSyncingLevels] = useState(false);

  const handleSyncAllLevels = async () => {
    setSyncingLevels(true);
    try {
      let count = 0;
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

      for (const u of usersList) {
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
          count++;
        }
      }

      await onRefreshUsers();
      setToastMessage(`Leveis, vocações e ranks sincronizados com sucesso para ${count} personagem(ns) via API TibiaData!`);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err) {
      console.error(err);
      setToastMessage('Erro ao sincronizar dados da API TibiaData.');
    } finally {
      setSyncingLevels(false);
    }
  };

  // Edit User Modal
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editCharName, setEditCharName] = useState('');
  const [editRank, setEditRank] = useState<PriorityRank>('Member');
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  // Guild API diagnostic state
  const [guildDiagnostics, setGuildDiagnostics] = useState<
    Array<{ guildName: string; total: number; status: 'online' | 'offline' | 'checking'; error?: string }>
  >(DEFAULT_GUILDS.map(g => ({ guildName: g.name, total: 0, status: 'checking' })));

  const loadEmails = async () => {
    setLoadingEmails(true);
    try {
      const list = await getAllowedEmails();
      setAllowedEmails(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEmails(false);
    }
  };



  const checkGuilds = async () => {
    const results = await Promise.all(
      DEFAULT_GUILDS.map(async g => {
        try {
          const members = await fetchGuildMembers(g.name);
          return { guildName: g.name, total: members.length, status: 'online' as const };
        } catch (err) {
          return {
            guildName: g.name,
            total: 0,
            status: 'offline' as const,
            error: err instanceof Error ? err.message : 'Falha na conexão',
          };
        }
      })
    );
    setGuildDiagnostics(results);
  };

  useEffect(() => {
    loadEmails();
    checkGuilds();
  }, []);

  // Online status helper: consider current user session online
  const isOnlineHelper = (u: UserProfile) => {
    if (currentUser && u.uid === currentUser.uid) return true;
    return isUserOnline(u);
  };

  // Online & total counts grouped by rank
  const rankStats = useMemo(() => {
    const stats: Record<string, { total: number; online: number }> = {
      all: { total: usersList.length, online: 0 },
    };

    PRIORITY_RANKS.forEach(r => {
      stats[r] = { total: 0, online: 0 };
    });

    usersList.forEach(u => {
      const online = isOnlineHelper(u);
      if (online) {
        stats.all.online += 1;
      }
      if (stats[u.rank]) {
        stats[u.rank].total += 1;
        if (online) {
          stats[u.rank].online += 1;
        }
      }
    });

    return stats;
  }, [usersList, currentUser]);

  // Filtered users according to selected rank, online toggle, and search query
  const filteredUsers = useMemo(() => {
    return usersList
      .filter(u => {
        const online = isOnlineHelper(u);
        if (filterOnlineOnly && !online) return false;
        if (selectedRank !== 'all' && u.rank !== selectedRank) return false;

        if (hiddenPlayerUids.includes(u.uid)) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = u.charName.toLowerCase().includes(q);
          const matchGuild = u.guildName.toLowerCase().includes(q);
          const matchVoc = (u.vocation || '').toLowerCase().includes(q);
          const matchEmail = u.email.toLowerCase().includes(q);
          if (!matchName && !matchGuild && !matchVoc && !matchEmail) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const idxA = PRIORITY_RANKS.indexOf(a.rank);
        const idxB = PRIORITY_RANKS.indexOf(b.rank);
        const rankIndexA = idxA === -1 ? 999 : idxA;
        const rankIndexB = idxB === -1 ? 999 : idxB;
        if (rankIndexA !== rankIndexB) return rankIndexA - rankIndexB;

        const aOnline = isOnlineHelper(a);
        const bOnline = isOnlineHelper(b);
        if (aOnline !== bOnline) return aOnline ? -1 : 1;

        return a.charName.localeCompare(b.charName);
      });
  }, [usersList, selectedRank, filterOnlineOnly, hiddenPlayerUids, searchQuery, currentUser]);

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    try {
      await addAllowedEmail(
        newEmail.trim(),
        newRole,
        currentUser?.email || 'admin',
        newNote.trim() || undefined
      );
      setNewEmail('');
      setNewNote('');
      setToastMessage('E-mail autorizado com sucesso!');
      await loadEmails();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setToastMessage('Falha ao adicionar e-mail.');
    }
  };

  const handleRemoveEmail = async (email: string) => {
    try {
      await removeAllowedEmail(email);
      await loadEmails();
      setToastMessage(`Autorização para ${email} removida.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setToastMessage('Erro ao remover e-mail.');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const openEditModal = (u: UserProfile) => {
    setEditingUser(u);
    setEditCharName(u.charName);
    setEditRank(u.rank);
    setEditIsAdmin(u.isAdmin);
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingUser(true);

    try {
      await updateUserProfile(editingUser.uid, {
        charName: editCharName.trim(),
        rank: editRank,
        isAdmin: editingUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ? true : editIsAdmin,
      });

      await onRefreshUsers();
      setEditingUser(null);
      setToastMessage(`Vínculo de ${editCharName} atualizado com sucesso!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setToastMessage('Erro ao salvar edição do membro.');
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setSavingUser(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="flex items-center justify-between gap-2 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-bold">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 cursor-pointer text-xs font-bold px-2 py-0.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Admin Panel Header & Sub-Tabs */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 sm:gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/25 shrink-0">
              <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                  Painel Administrativo Major
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 tabular-nums">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {rankStats.all.online} Online
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Filtre por rank e atribua respawns em tempo real.
              </p>
            </div>
          </div>

          {/* Sub-tabs navigation */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
              <button
                onClick={() => setActiveSubTab('assign')}
                className={`flex items-center justify-center sm:justify-start gap-1.5 px-3 sm:px-4 min-h-[40px] py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeSubTab === 'assign'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Lista e presença de membros da guilda"
              >
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span>Membros</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold tabular-nums ${
                  activeSubTab === 'assign' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                }`}>
                  {rankStats.all.online}
                </span>
              </button>

            <button
              onClick={() => setActiveSubTab('emails')}
              className={`flex items-center justify-center sm:justify-start gap-1.5 px-3 sm:px-4 min-h-[40px] py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeSubTab === 'emails'
                  ? 'bg-white text-blue-600 dark:bg-slate-900 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>E-mails ({allowedEmails.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveSubTab('apis');
                if (!guildHighscoresData) loadGuildHighscores();
              }}
              className={`flex items-center justify-center sm:justify-start gap-1.5 px-3 sm:px-4 min-h-[40px] py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeSubTab === 'apis'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span>APIs & XP</span>
            </button>

            <button
              onClick={() => setActiveSubTab('released')}
              className={`flex items-center justify-center sm:justify-start gap-1.5 px-3 sm:px-4 min-h-[40px] py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeSubTab === 'released'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span>Liberados ({releasedRespawnsList.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('backup')}
              className={`col-span-2 sm:col-span-1 flex items-center justify-center sm:justify-start gap-1.5 px-3 sm:px-4 min-h-[40px] py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeSubTab === 'backup'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Backup e restauração da configuração dos respawns especiais"
            >
              <Archive className="h-3.5 w-3.5 shrink-0" />
              <span>Backup Especiais</span>
            </button>
          </div>

          {/* Action Button: + Cadastrar Respawn */}
          <button
            type="button"
            onClick={() => {
              setAssignUser(null);
              setIsAssignModalOpen(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 min-h-[44px] sm:min-h-[40px] py-2.5 sm:py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-md shadow-blue-500/25 transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]"
            title="Abrir modal para cadastrar respawns"
          >
            <Target className="h-4 w-4 shrink-0" />
            <span>+ Cadastrar Respawn</span>
          </button>
        </div>
      </div>
    </div>

      {/* ======================================================== */}
      {/* SUB-TAB 1: DEDICATED RANK FILTER & RESPAWN ALLOCATION     */}
      {/* ======================================================== */}
      {activeSubTab === 'assign' && (
        <div className="space-y-5">
          {/* Rank Filter Control Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors space-y-3.5 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Filtro por Rank & Presença Online
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Filtre pelo rank desejado e escolha entre os jogadores online no app.
                </p>
              </div>

              {/* Online Only Toggle */}
              <div className="grid grid-cols-2 sm:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setFilterOnlineOnly(true)}
                  className={`flex items-center justify-center gap-1.5 px-3 min-h-[38px] py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filterOnlineOnly
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse shrink-0" />
                  <span>Online ({rankStats.all.online})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterOnlineOnly(false)}
                  className={`flex items-center justify-center px-3 min-h-[38px] py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    !filterOnlineOnly
                      ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Todos ({usersList.length})
                </button>
              </div>
            </div>

            {/* Rank Selection Chips */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Selecione o Rank de Prioridade:
              </label>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap -mx-1 px-1 pb-1">
                {/* 'All' chip */}
                <button
                  type="button"
                  onClick={() => setSelectedRank('all')}
                  className={`flex items-center gap-2 px-3.5 min-h-[40px] py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedRank === 'all'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shadow-sm ring-1 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span>Todos os Ranks</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 font-extrabold text-slate-700 dark:text-slate-200 tabular-nums">
                    {filterOnlineOnly ? rankStats.all.online : rankStats.all.total}
                  </span>
                </button>

                {/* Priority Ranks chips */}
                {PRIORITY_RANKS.map(rank => {
                  const stat = rankStats[rank] || { total: 0, online: 0 };
                  const isSelected = selectedRank === rank;
                  const rankMeta = RANK_METADATA[rank];

                  return (
                    <button
                      key={rank}
                      type="button"
                      onClick={() => setSelectedRank(rank)}
                      className={`flex items-center gap-2 px-3 min-h-[40px] py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shadow-sm ring-1 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold border ${rankMeta.badgeClass}`}
                      >
                        {rank}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-extrabold tabular-nums">
                        {stat.online > 0 && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                        <span className={stat.online > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                          {stat.online}
                        </span>
                        <span className="text-slate-400 font-normal">/ {stat.total}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick search input & stats notice */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pt-1 sm:pt-2">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filtrar por char, vocação ou guilda..."
                  className="w-full min-h-[42px] sm:min-h-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 pl-9 text-sm sm:text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-3.5 sm:w-3.5 text-slate-400" />
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                Mostrando <strong className="text-slate-900 dark:text-white font-bold">{filteredUsers.length}</strong> jogador(es)
                {filterOnlineOnly && ' online no aplicativo'}
                {selectedRank !== 'all' && ` do rank ${selectedRank}`}.
              </div>
            </div>
          </div>

          {/* Characters Grid / Roster for Quick Assignment */}
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Jogadores Aptos para Escalação
                </h4>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Toque em <strong>Atribuir Respawn</strong> para alocar dia e horário
              </span>
            </div>

            {hiddenPlayerUids.length > 0 && (
              <div className="p-3.5 bg-blue-50/90 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/60 space-y-2.5 text-xs text-blue-800 dark:text-blue-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>
                    Você ocultou <strong>{hiddenPlayerUids.length}</strong> jogador(es). Clique em um nome abaixo para voltar apenas ele:
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {hiddenPlayerUids.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setHiddenPlayerUids(prev => prev.slice(0, -1))}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                      >
                        Desfazer último
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setHiddenPlayerUids([])}
                      className="font-bold underline hover:text-blue-900 dark:hover:text-blue-200 cursor-pointer"
                    >
                      Exibir todos
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {hiddenPlayerUids.map(uid => {
                    const hiddenUser = usersList.find(u => u.uid === uid);
                    if (!hiddenUser) return null;
                    return (
                      <button
                        key={uid}
                        type="button"
                        onClick={() => setHiddenPlayerUids(prev => prev.filter(id => id !== uid))}
                        title={`Exibir apenas ${hiddenUser.charName} novamente`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-[11px] font-bold text-slate-800 dark:text-slate-200 hover:border-blue-400 hover:bg-blue-100/70 dark:hover:bg-blue-900/50 transition-all cursor-pointer shadow-2xs"
                      >
                        <Eye className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>{hiddenUser.charName}</span>
                        <X className="h-3 w-3 text-slate-400 hover:text-blue-600 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredUsers.length === 0 ? (
              <div className="p-10 text-center">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                  <WifiOff className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Nenhum jogador encontrado com os filtros atuais
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  {filterOnlineOnly
                    ? 'Nenhum membro deste rank está online no aplicativo agora. Desative o filtro "Apenas Online" para visualizar todos.'
                    : 'Tente alterar os termos da busca ou selecionar outro rank de prioridade.'}
                </p>
                {filterOnlineOnly && (
                  <button
                    type="button"
                    onClick={() => setFilterOnlineOnly(false)}
                    className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all cursor-pointer"
                  >
                    Exibir Todos os Membros (Online e Offline)
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredUsers.map(user => {
                  const online = isOnlineHelper(user);
                  const userBookings = reservations.filter(r => r.userUid === user.uid);
                  const rankMeta = RANK_METADATA[user.rank];

                  return (
                    <div
                      key={user.uid}
                      className="p-3.5 sm:p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4"
                    >
                      {/* Left: Player identity & presence */}
                      <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
                        <div className="relative mt-0.5 shrink-0">
                          <span
                            className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-sm border shadow-xs ${
                              rankMeta?.badgeClass || 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {user.charName.slice(0, 2).toUpperCase()}
                          </span>
                          <span
                            className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                              online
                                ? 'bg-emerald-500 shadow-xs shadow-emerald-500 animate-pulse'
                                : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                            title={online ? 'Online no app agora' : 'Offline'}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white break-words">
                              {user.charName}
                            </h4>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                                rankMeta?.badgeClass || 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {user.rank}
                            </span>
                            {online ? (
                              <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.2 rounded-full">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Online
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                Offline
                              </span>
                            )}
                            {user.isAdmin && (
                              <span className="text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded">
                                Admin
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span>Guild: <strong className="text-slate-700 dark:text-slate-300">{user.guildName}</strong></span>
                            <span>•</span>
                            <span className="tabular-nums">Lv {user.level} {user.vocation}</span>
                            <span className="hidden sm:inline">•</span>
                            <span className="text-slate-400 font-mono text-[11px] break-all sm:break-normal w-full sm:w-auto">{user.email}</span>
                          </div>

                          {/* Current reservations list */}
                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Reserva(s):
                            </span>
                            {userBookings.length === 0 ? (
                              <span className="text-[11px] text-slate-400 italic">
                                Nenhum respawn marcado
                              </span>
                            ) : (
                              userBookings.map(b => (
                                <span
                                  key={b.id}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60"
                                >
                                  <span className="uppercase font-extrabold">
                                    {b.day === 'friday' ? 'SEX' : b.day === 'saturday' ? 'SÁB' : 'DOM'}
                                  </span>
                                  <span>{b.respawnName}</span>
                                  <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">({b.timeSlot})</span>
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        await deleteReservation(b.id);
                                        setToastMessage(`Marcação de ${b.respawnName} (${b.timeSlot}) excluída.`);
                                        setTimeout(() => setToastMessage(null), 4000);
                                      } catch (err) {
                                        console.error(err);
                                      }
                                    }}
                                    className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                                    title="Excluir esta marcação imediatamente"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Action buttons */}
                      <div className="w-full md:w-auto grid grid-cols-2 sm:flex items-center gap-2 md:self-center shrink-0 pt-1 md:pt-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(user)}
                          className="flex items-center justify-center gap-1.5 px-3 min-h-[42px] py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                          title="Editar rank ou nome do personagem"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setHiddenPlayerUids(prev => 
                              prev.includes(user.uid) ? prev : [...prev, user.uid]
                            );
                          }}
                          className="flex items-center justify-center gap-1.5 px-3 min-h-[42px] py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                          title="Ocultar jogador da lista após marcar os respawns"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                          <span>Ocultar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAssignUser(user);
                            setIsAssignModalOpen(true);
                          }}
                          className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-4 min-h-[42px] py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all cursor-pointer whitespace-nowrap"
                        >
                          <Target className="h-4 w-4" />
                          <span>Atribuir Respawn</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}



      {/* ======================================================== */}
      {/* SUB-TAB 3: ALLOWED EMAILS                                */}
      {/* ======================================================== */}
      {activeSubTab === 'emails' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5 sm:mb-3">
              Autorizar Novo E-mail de Membro
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3.5 sm:mb-4">
              Apenas e-mails cadastrados aqui conseguem fazer login no aplicativo e vincular seus personagens do Tibia.
            </p>

            <form onSubmit={handleAddEmail} className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="exemplo@gmail.com"
                required
                className="flex-1 min-h-[44px] sm:min-h-0 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm sm:text-xs text-slate-900 dark:text-white"
              />

              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value as 'admin' | 'member')}
                className="min-h-[44px] sm:min-h-0 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm sm:text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="member">Membro Regular</option>
                <option value="admin">Administrador</option>
              </select>

              <input
                type="text"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Nota (Ex: Líder Missclick)"
                className="min-h-[44px] sm:min-h-0 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm sm:text-xs text-slate-900 dark:text-white"
              />

              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 min-h-[44px] sm:min-h-0 py-2.5 sm:py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="h-4 w-4" />
                <span>Autorizar</span>
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              E-mails Autorizados Atualmente ({allowedEmails.length})
            </h3>

            {/* Mobile Card List */}
            <div className="md:hidden space-y-2.5">
              {allowedEmails.map(item => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-start justify-between gap-2.5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white break-all">
                      {item.email}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.role === 'admin'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                        }`}
                      >
                        {item.role === 'admin' ? 'Administrador' : 'Membro'}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        por {item.addedBy}
                      </span>
                      <span className="text-slate-400 tabular-nums">
                        • {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveEmail(item.email)}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                    title="Remover autorização"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {allowedEmails.length === 0 && !loadingEmails && (
                <div className="p-6 text-center text-xs text-slate-400">
                  Nenhum e-mail adicional autorizado no momento.
                </div>
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="p-3">E-mail</th>
                    <th className="p-3">Função</th>
                    <th className="p-3">Autorizado Por</th>
                    <th className="p-3">Data</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {allowedEmails.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-slate-900 dark:text-white">
                        {item.email}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.role === 'admin'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          }`}
                        >
                          {item.role === 'admin' ? 'Administrador' : 'Membro'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">{item.addedBy}</td>
                      <td className="p-3 text-slate-400 tabular-nums">
                        {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleRemoveEmail(item.email)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Remover autorização"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {allowedEmails.length === 0 && !loadingEmails && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        Nenhum e-mail adicional autorizado no momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB: APIS & MAINTENANCE                              */}
      {/* ======================================================== */}
      {activeSubTab === 'apis' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Excel Backup Box for Admins */}
          <div className="rounded-2xl border border-emerald-200/90 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-500/25 shrink-0">
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Salvar Backup da Escala em Excel (.xls)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                    Baixe e garanta a segurança das informações de marcações de respawns em uma planilha Excel completa.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsExcelBackupOpen(true)}
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 min-h-[44px] py-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Salvar em Excel</span>
              </button>
            </div>
          </div>

          {/* Master Reset Box */}
          <div className="rounded-2xl border border-rose-200/90 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-500/25 shrink-0">
                  <RotateCcw className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Reiniciar Escala & Liberar Todos os Respawns
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                    Ideal para o início de novos finais de semana. Você pode zerar a grade inteira ou apenas o dia que desejar.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setResetModalDay('friday');
                  setIsResetModalOpen(true);
                }}
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 min-h-[44px] py-3 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-md shadow-rose-500/20 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reiniciar Respawns</span>
              </button>
            </div>
          </div>

          {/* Custom Respawns / Manual Hunts Management Card */}
          <div className="rounded-2xl border border-slate-200/95 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Cadastrar Novos Locais de Respawn
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Adicione novos locais de hunts ou respawns na grade de horários da guilda.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddHunt} className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <input
                type="text"
                value={newHuntName}
                onChange={e => setNewHuntName(e.target.value)}
                placeholder="Nome do Respawn (Ex: Deeper Banuta, Nagas...)"
                required
                className="flex-1 min-h-[44px] sm:min-h-0 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm sm:text-xs text-slate-900 dark:text-white"
              />

              <select
                value={newHuntType}
                onChange={e => setNewHuntType(e.target.value as 'normal' | '3h')}
                className="min-h-[44px] sm:min-h-0 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm sm:text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="normal">Normal (2h)</option>
                <option value="3h">Especial (3h)</option>
              </select>

              <button
                type="submit"
                disabled={addingHunt}
                className="inline-flex items-center justify-center gap-1.5 px-5 min-h-[44px] sm:min-h-0 py-2.5 sm:py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {addingHunt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>Adicionar Nova Hunt</span>
              </button>
            </form>

            {/* List of custom hunts */}
            {customRespawns && customRespawns.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Hunts Personalizadas Cadastradas ({customRespawns.length}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {customRespawns.map(hunt => (
                    <div
                      key={hunt.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-xs"
                    >
                      <div>
                        <strong className="text-slate-900 dark:text-white block">{hunt.name}</strong>
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                          {hunt.type === '3h' ? 'Especial 3h' : 'Normal (2h)'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteHunt(hunt.id, hunt.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Remover hunt"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Breakdown by Day Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {DAYS_CONFIG.map(day => {
              const dayBookings = reservations.filter(r => r.day === day.key);
              return (
                <div
                  key={day.key}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {day.label}
                        </h4>
                      </div>
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                        {dayBookings.length} ocupado(s)
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                      {dayBookings.length === 0
                        ? 'Todos os horários deste dia estão 100% livres.'
                        : `Existem ${dayBookings.length} reservas registradas para ${day.label}.`}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setResetModalDay(day.key);
                      setIsResetModalOpen(true);
                    }}
                    disabled={dayBookings.length === 0}
                    className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-900/60 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Liberar Respawns de {day.label}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* TibiaData Sync Section */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Sincronização de Leveis e Vocações (API TibiaData)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Atualize instantaneamente o level e a vocação de todos os personagens cadastrados consultando a API oficial do Tibia.
              </p>
            </div>
            <button
              onClick={handleSyncAllLevels}
              disabled={syncingLevels}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 min-h-[44px] py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {syncingLevels ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span>Sincronizar Leveis Agora</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {guildDiagnostics.map(diag => (
              <div
                key={diag.guildName}
                className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold">
                      {diag.guildName[0]}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Guilda {diag.guildName}
                      </h4>
                      <span className="text-[10px] text-slate-400">TibiaData API v4</span>
                    </div>
                  </div>

                  <span
                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      diag.status === 'online'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : diag.status === 'checking'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        diag.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    {diag.status === 'online' ? 'Conectado' : diag.status === 'checking' ? 'Testando...' : 'Erro'}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="shrink-0">Endpoint:</span>
                    <a
                      href={`https://api.tibiadata.com/v4/guild/${diag.guildName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate max-w-[200px] sm:max-w-none"
                    >
                      <span className="truncate">api.tibiadata.com/v4/guild/{diag.guildName}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Membros Ativos Carregados:</span>
                    <strong className="text-slate-900 dark:text-white font-bold tabular-nums">{diag.total} membros</strong>
                  </div>
                </div>

                <button
                  onClick={checkGuilds}
                  className="mt-4 w-full min-h-[42px] flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Atualizar Dados da Guilda
                </button>
              </div>
            ))}
          </div>


      {/* Guild Highscores Summary Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shrink-0">
                <Zap className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Missclick
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Dados oficiais de experiência dos jogadores obtidos diretamente da API.
                </p>
              </div>
            </div>

              <button
                type="button"
                onClick={() => loadGuildHighscores(true)}
                disabled={loadingGuildHs}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 min-h-[44px] sm:min-h-0 py-2.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {loadingGuildHs ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span>Atualizar Experiência dos Jogadores</span>
              </button>
            </div>

            {guildHsError && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{guildHsError}</span>
              </div>
            )}

            {loadingGuildHs ? (
              <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span>Carregando experiência dos jogadores da guilda...</span>
              </div>
            ) : guildHighscoresData ? (
              (() => {
                const players = Array.isArray(guildHighscoresData)
                  ? guildHighscoresData
                  : (guildHighscoresData.members || guildHighscoresData.players || guildHighscoresData.highscores || []);

                return (
                  <div className="space-y-3">
                    {guildHighscoresData.xpDate && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 px-1">
                        <span>Data de referência (XP Ontem): <strong className="text-slate-700 dark:text-slate-200">{guildHighscoresData.xpDate}</strong></span>
                        <span className="tabular-nums">
                          {players.length} jogadores carregados
                        </span>
                      </div>
                    )}

                    {/* Mobile XP Cards */}
                    <div className="md:hidden space-y-2">
                      {players.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">
                          Nenhum jogador retornado pela API.
                        </div>
                      ) : (
                        players.map((p: any, idx: number) => {
                          const xpVal = p.yesterdayExp ?? p.expYesterday ?? 0;
                          return (
                            <div
                              key={idx}
                              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-2.5"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {p.name || p.charName || `Jogador #${idx + 1}`}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                  Lv {p.level || p.value || 'N/D'} • <span className="text-blue-600 dark:text-blue-400 font-semibold">{p.vocation || 'N/D'}</span>
                                </p>
                              </div>
                              <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400 shrink-0 tabular-nums">
                                {xpVal > 0 ? `${xpVal.toLocaleString('pt-BR')} XP` : (p.formattedXp || '0 XP')}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                            <th className="py-2.5 px-3">Jogador</th>
                            <th className="py-2.5 px-3">Nível</th>
                            <th className="py-2.5 px-3">Vocação</th>
                            <th className="py-2.5 px-3 text-right">Experiência (Ontem)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                          {players.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-slate-400 font-sans">
                                <pre className="p-3 text-[11px] text-left overflow-auto max-h-60 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                  {JSON.stringify(guildHighscoresData, null, 2)}
                                </pre>
                              </td>
                            </tr>
                          ) : (
                            players.map((p: any, idx: number) => {
                              const xpVal = p.yesterdayExp ?? p.expYesterday ?? 0;
                              return (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-sans">{p.name || p.charName || `Jogador #${idx+1}`}</td>
                                  <td className="py-2.5 px-3 tabular-nums">{p.level || p.value || 'N/D'}</td>
                                  <td className="py-2.5 px-3 text-blue-600 dark:text-blue-400 font-sans">{p.vocation || 'N/D'}</td>
                                  <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-black tabular-nums">
                                    {xpVal > 0 ? `${xpVal.toLocaleString('pt-BR')} XP` : (p.formattedXp || '0 XP')}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                Clique em "Atualizar Experiência dos Jogadores" para carregar os dados da API.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB: RELEASED RESPAWNS LIST                          */}
      {/* ======================================================== */}
      {activeSubTab === 'released' && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Lista de Jogadores que Liberaram Respawns
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Histórico completo de horários liberados pelos membros para alocação antecipada.
              </p>
            </div>
            <span className="self-start sm:self-auto px-3 py-1 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold whitespace-nowrap tabular-nums">
              {releasedRespawnsList.length} Liberação(ões)
            </span>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2.5">
            {releasedRespawnsList.map(item => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                    {item.charName}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-[10px] font-extrabold uppercase text-blue-700 dark:text-blue-300 shrink-0">
                    {item.day === 'friday' ? 'Sexta' : item.day === 'saturday' ? 'Sábado' : 'Domingo'}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {item.respawnName}
                </p>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {item.timeSlot}
                  </span>
                  <span className="text-slate-400 font-mono text-[10px] tabular-nums">
                    {new Date(item.releasedAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            ))}
            {releasedRespawnsList.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                Nenhum respawn foi liberado pelos jogadores até o momento.
              </div>
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                  <th className="p-3">Jogador / Personagem</th>
                  <th className="p-3">Dia</th>
                  <th className="p-3">Respawn</th>
                  <th className="p-3">Horário</th>
                  <th className="p-3 text-right">Data / Hora da Liberação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {releasedRespawnsList.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-black text-slate-900 dark:text-white">
                      {item.charName}
                    </td>
                    <td className="p-3 font-bold uppercase text-blue-600 dark:text-blue-400">
                      {item.day === 'friday' ? 'Sexta-feira' : item.day === 'saturday' ? 'Sábado' : 'Domingo'}
                    </td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                      {item.respawnName}
                    </td>
                    <td className="p-3 font-mono text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {item.timeSlot}
                    </td>
                    <td className="p-3 text-right text-slate-400 font-mono text-[11px] tabular-nums">
                      {new Date(item.releasedAt).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
                {releasedRespawnsList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400 italic">
                      Nenhum respawn foi liberado pelos jogadores até o momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB: BACKUP & RESTAURAÇÃO DOS RESPAWNS ESPECIAIS     */}
      {/* ======================================================== */}
      {activeSubTab === 'backup' && (
        <SpecialBackupPanel
          reservations={reservations}
          customRespawns={customRespawns}
          onToast={msg => {
            setToastMessage(msg);
            setTimeout(() => setToastMessage(null), 5000);
          }}
        />
      )}


      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white p-5 sm:p-6 pb-safe shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom duration-200">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Editar Vínculo do Membro
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 break-all">
              E-mail: <strong className="text-slate-800 dark:text-white">{editingUser.email}</strong>
            </p>

            <form onSubmit={handleSaveUserEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Nome do Personagem (Tibia)
                </label>
                <input
                  type="text"
                  value={editCharName}
                  onChange={e => setEditCharName(e.target.value)}
                  required
                  className="w-full min-h-[44px] sm:min-h-0 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 sm:py-2 text-sm sm:text-xs text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Rank de Prioridade
                </label>
                <select
                  value={editRank}
                  onChange={e => setEditRank(e.target.value as PriorityRank)}
                  className="w-full min-h-[44px] sm:min-h-0 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 sm:py-2 text-sm sm:text-xs font-semibold text-slate-900 dark:text-white"
                >
                  {PRIORITY_RANKS.map(r => (
                    <option key={r} value={r}>
                      {r} - {RANK_METADATA[r].description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2.5 pt-1 min-h-[36px]">
                <input
                  type="checkbox"
                  id="isAdminCheckbox"
                  checked={editIsAdmin}
                  onChange={e => setEditIsAdmin(e.target.checked)}
                  className="h-5 w-5 sm:h-4 sm:w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isAdminCheckbox" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Acesso Total de Administrador ao Major
                </label>
              </div>

              <div className="pt-3 flex flex-col-reverse sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="w-full sm:w-auto px-4 min-h-[44px] sm:min-h-0 py-2.5 sm:py-2 rounded-xl border text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="w-full sm:w-auto px-5 min-h-[44px] sm:min-h-0 py-2.5 sm:py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {savingUser ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Respawn Assignment Modal */}
      {isAssignModalOpen && (
        <AdminAssignModal
          isOpen={isAssignModalOpen}
          targetUser={assignUser}
          usersList={usersList}
          reservations={reservations}
          customRespawns={customRespawns}
          onClose={() => {
            setIsAssignModalOpen(false);
            setAssignUser(null);
          }}
          onSuccess={msg => {
            setToastMessage(msg);
            setTimeout(() => setToastMessage(null), 6000);
          }}
        />
      )}

      {/* Admin Reset Schedule Modal */}
      {isResetModalOpen && (
        <ResetScheduleModal
          currentDay={resetModalDay}
          reservations={reservations}
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          onSuccess={count => {
            setToastMessage(
              `Operação realizada com sucesso! ${count} respawn(s) foram liberados e a grade está atualizada em tempo real.`
            );
            setTimeout(() => setToastMessage(null), 6000);
          }}
        />
      )}

      {/* Admin Excel Backup Export Modal */}
      {isExcelBackupOpen && (
        <ExportModal
          reservations={reservations}
          onClose={() => setIsExcelBackupOpen(false)}
        />
      )}
    </div>
  );
};
