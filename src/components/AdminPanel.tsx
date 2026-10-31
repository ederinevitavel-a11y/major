import React, { useState, useEffect, useMemo } from 'react';
import { AllowedEmail, PriorityRank, UserProfile, Reservation, HuntDay, DoubleXpSettings, DoubleXpRecord } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  getAllowedEmails,
  addAllowedEmail,
  removeAllowedEmail,
  updateUserProfile,
  isUserOnline,
  getDoubleXpSettings,
  saveDoubleXpSettings,
  getAllDoubleXpRecords,
  saveDoubleXpRecord,
} from '../services/firestoreService';
import { fetchGuildMembers, fetchCharacter, mapTibiaRankToPriority } from '../services/tibiaDataService';
import { PRIORITY_RANKS, RANK_METADATA, DEFAULT_GUILDS, SUPER_ADMIN_EMAIL, DAYS_CONFIG } from '../constants/guildData';
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
} from 'lucide-react';

interface AdminPanelProps {
  usersList: UserProfile[];
  reservations: Reservation[];
  onRefreshUsers: () => Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  usersList,
  reservations,
  onRefreshUsers,
}) => {
  const { currentUser } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'assign' | 'members' | 'emails' | 'schedule' | 'guilds' | 'double-xp'>('assign');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetModalDay, setResetModalDay] = useState<HuntDay>('friday');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dedicated Rank Filter State
  const [selectedRank, setSelectedRank] = useState<'all' | PriorityRank>('all');
  const [filterOnlineOnly, setFilterOnlineOnly] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Assign Respawn Modal State
  const [assignUser, setAssignUser] = useState<UserProfile | null>(null);

  // Allowed Emails State
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member');
  const [newNote, setNewNote] = useState('');
  const [loadingEmails, setLoadingEmails] = useState(false);

  // Double XP State
  const [doubleStartDate, setDoubleStartDate] = useState('');
  const [doubleEndDate, setDoubleEndDate] = useState('');
  const [doubleRecordsList, setDoubleRecordsList] = useState<DoubleXpRecord[]>([]);
  const [savingDoubleSettings, setSavingDoubleSettings] = useState(false);
  const [capturingXp, setCapturingXp] = useState(false);
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

  const loadDoubleData = async () => {
    try {
      const settings = await getDoubleXpSettings();
      if (settings) {
        setDoubleStartDate(settings.startDate || '');
        setDoubleEndDate(settings.endDate || '');
      }
      const records = await getAllDoubleXpRecords();
      setDoubleRecordsList(records);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDoubleSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDoubleSettings(true);
    try {
      await saveDoubleXpSettings({
        startDate: doubleStartDate,
        endDate: doubleEndDate,
      });
      setToastMessage('Período da Double XP salvo com sucesso!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setToastMessage('Falha ao salvar período da Double XP.');
    } finally {
      setSavingDoubleSettings(false);
    }
  };

  const handleCaptureAllXp = async () => {
    setCapturingXp(true);
    try {
      let updatedCount = 0;
      for (const u of usersList) {
        if (!u.charName) continue;
        const charInfo = await fetchCharacter(u.charName);
        if (charInfo) {
          const currentTotal = charInfo.experience;
          const existing = doubleRecordsList.find(r => r.uid === u.uid);
          const perDay = Math.floor(currentTotal / 3);
          const record: DoubleXpRecord = {
            uid: u.uid,
            charName: u.charName,
            startExp: existing?.startExp ?? currentTotal,
            fridayExp: existing?.fridayExp ?? perDay,
            saturdayExp: existing?.saturdayExp ?? perDay,
            sundayExp: existing?.sundayExp ?? (currentTotal - perDay * 2),
            totalExp: currentTotal,
            lastCapturedAt: new Date().toISOString(),
          };
          await saveDoubleXpRecord(record);
          updatedCount++;
        }
      }
      await loadDoubleData();
      setToastMessage(`Experiência capturada com sucesso para ${updatedCount} personagem(ns)!`);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err) {
      console.error(err);
      setToastMessage('Erro ao capturar experiência dos jogadores.');
    } finally {
      setCapturingXp(false);
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
    loadDoubleData();
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
        const aOnline = isOnlineHelper(a);
        const bOnline = isOnlineHelper(b);
        if (aOnline !== bOnline) return aOnline ? -1 : 1;
        const rankIndexA = PRIORITY_RANKS.indexOf(a.rank);
        const rankIndexB = PRIORITY_RANKS.indexOf(b.rank);
        if (rankIndexA !== rankIndexB) return rankIndexA - rankIndexB;
        return a.charName.localeCompare(b.charName);
      });
  }, [usersList, selectedRank, filterOnlineOnly, searchQuery, currentUser]);

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
    if (!window.confirm(`Remover autorização para ${email}?`)) return;
    try {
      await removeAllowedEmail(email);
      await loadEmails();
    } catch (err) {
      console.error(err);
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
      alert('Erro ao salvar edição do membro.');
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
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/25 shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Painel Administrativo Major
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {rankStats.all.online} Online no App
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Filtre por rank e atribua respawns para os membros conectados em tempo real.
              </p>
            </div>
          </div>

          {/* Sub-tabs navigation */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl overflow-x-auto">
            <button
              onClick={() => setActiveSubTab('assign')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeSubTab === 'assign'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Target className="h-3.5 w-3.5" />
              <span>Atribuir por Rank</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeSubTab === 'assign' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}>
                {rankStats.all.online} online
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('members')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeSubTab === 'members'
                  ? 'bg-white text-blue-600 dark:bg-slate-900 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Vínculos ({usersList.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('emails')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeSubTab === 'emails'
                  ? 'bg-white text-blue-600 dark:bg-slate-900 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>E-mails ({allowedEmails.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('schedule')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeSubTab === 'schedule'
                  ? 'bg-white text-rose-600 dark:bg-slate-900 dark:text-rose-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Zerar Respawns</span>
            </button>

            <button
              onClick={() => setActiveSubTab('guilds')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeSubTab === 'guilds'
                  ? 'bg-white text-blue-600 dark:bg-slate-900 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>APIs Guildas</span>
            </button>

            <button
              onClick={() => setActiveSubTab('double-xp')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeSubTab === 'double-xp'
                  ? 'bg-white text-blue-600 dark:bg-slate-900 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Double XP</span>
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
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Filtro por Rank & Presença Online
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Conforme a regra do Major, apenas o admin e líderes marcam respawns. Filtre pelo rank desejado e escolha entre os jogadores online no app.
                </p>
              </div>

              {/* Online Only Toggle */}
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setFilterOnlineOnly(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterOnlineOnly
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                  <span>Apenas Online ({rankStats.all.online})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterOnlineOnly(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
              <div className="flex items-center gap-2 flex-wrap">
                {/* 'All' chip */}
                <button
                  type="button"
                  onClick={() => setSelectedRank('all')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    selectedRank === 'all'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shadow-sm ring-1 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span>Todos os Ranks</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 font-extrabold text-slate-700 dark:text-slate-200">
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
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
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
                      <span className="flex items-center gap-1 text-[11px] font-extrabold">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filtrar por char, vocação ou guilda..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 pl-9 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Mostrando <strong className="text-slate-900 dark:text-white font-bold">{filteredUsers.length}</strong> jogador(es)
                {filterOnlineOnly && ' online no aplicativo'}
                {selectedRank !== 'all' && ` do rank ${selectedRank}`}.
              </div>
            </div>
          </div>

          {/* Characters Grid / Roster for Quick Assignment */}
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Jogadores Aptos para Escalação Imediata
                </h4>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Clique em <strong>Atribuir Respawn</strong> para alocar dia e horário
              </span>
            </div>

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
                      className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Left: Player identity & presence */}
                      <div className="flex items-start gap-3.5">
                        <div className="relative mt-0.5">
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

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">
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
                                Online no App
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

                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span>Guild: <strong className="text-slate-700 dark:text-slate-300">{user.guildName}</strong></span>
                            <span>•</span>
                            <span>Lv {user.level} {user.vocation}</span>
                            <span>•</span>
                            <span className="text-slate-400 font-mono text-[11px]">{user.email}</span>
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
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60"
                                >
                                  <span className="uppercase font-extrabold">
                                    {b.day === 'friday' ? 'SEX' : b.day === 'saturday' ? 'SÁB' : 'DOM'}
                                  </span>
                                  <span>{b.respawnName}</span>
                                  <span className="font-mono text-slate-500 dark:text-slate-400">({b.timeSlot})</span>
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Action button */}
                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => setAssignUser(user)}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
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
      {/* SUB-TAB 2: MEMBERS & VINCULOS MANAGEMENT                 */}
      {/* ======================================================== */}
      {activeSubTab === 'members' && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Vínculos de Personagens Registrados
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Altere ranks, corrija nomes de char ou conceda privilégios de liderança.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar membro ou rank..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 pl-8 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px]">
                  <th className="p-3">Personagem</th>
                  <th className="p-3">E-mail Google</th>
                  <th className="p-3">Guilda</th>
                  <th className="p-3">Rank de Prioridade</th>
                  <th className="p-3">Level / Vocação</th>
                  <th className="p-3">Admin</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredUsers.map(u => {
                  const online = isOnlineHelper(u);
                  return (
                    <tr key={u.uid} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              online
                                ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50 animate-pulse'
                                : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                            title={online ? 'Online no aplicativo agora' : 'Offline no momento'}
                          />
                          <strong className="text-slate-900 dark:text-white block font-bold">
                            {u.charName}
                          </strong>
                          {online && (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-1.5 py-0.2 rounded-full">
                              Online
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {u.email}
                        {u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && (
                          <span className="ml-1 text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded">
                            Major
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-blue-600 dark:text-blue-400">
                        {u.guildName}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                            RANK_METADATA[u.rank]?.badgeClass || ''
                          }`}
                        >
                          {u.rank}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        Lv {u.level} • {u.vocation}
                      </td>
                      <td className="p-3">
                        {u.isAdmin ? (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                            Sim
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Não</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setAssignUser(u)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                            title="Atribuir respawn diretamente"
                          >
                            <Target className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-bold">Atribuir</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="inline-flex items-center gap-1 p-1 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                            title="Editar vínculo"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-semibold">Editar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 3: ALLOWED EMAILS                                */}
      {/* ======================================================== */}
      {activeSubTab === 'emails' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              Autorizar Novo E-mail de Membro
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Apenas e-mails cadastrados aqui conseguem fazer login no aplicativo e vincular seus personagens do Tibia.
            </p>

            <form onSubmit={handleAddEmail} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="exemplo@gmail.com"
                required
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs text-slate-900 dark:text-white"
              />

              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value as 'admin' | 'member')}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="member">Membro Regular</option>
                <option value="admin">Administrador</option>
              </select>

              <input
                type="text"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Nota (Ex: Líder Missclick)"
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
              />

              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="h-4 w-4" />
                <span>Autorizar</span>
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              E-mails Autorizados Atualmente ({allowedEmails.length})
            </h3>
            <div className="overflow-x-auto">
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
                      <td className="p-3 text-slate-400">
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
      {/* SUB-TAB 4: GUILD APIS DIAGNOSTICS                        */}
      {/* ======================================================== */}
      {activeSubTab === 'guilds' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Sincronização de Leveis e Vocações (API TibiaData)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Atualize instantaneamente o level e a vocação de todos os personagens cadastrados consultando a API oficial do Tibia.
              </p>
            </div>
            <button
              onClick={handleSyncAllLevels}
              disabled={syncingLevels}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {syncingLevels ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span>Sincronizar Leveis de Todos Agora</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {guildDiagnostics.map(diag => (
            <div
              key={diag.guildName}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors"
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
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Endpoint Oficial:</span>
                  <a
                    href={`https://api.tibiadata.com/v4/guild/${diag.guildName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    api.tibiadata.com/v4/guild/{diag.guildName}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Membros Ativos Carregados:</span>
                  <strong className="text-slate-900 dark:text-white font-bold">{diag.total} membros</strong>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Tempo de Cache Local:</span>
                  <span>15 minutos (resiliência a rate limit)</span>
                </div>
              </div>

              <button
                onClick={checkGuilds}
                className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar Dados da Guilda
              </button>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 5: GESTÃO & MASTER RESET DE RESPAWNS             */}
      {/* ======================================================== */}
      {activeSubTab === 'schedule' && (
        <div className="space-y-6">
          {/* Master Reset Box */}
          <div className="rounded-2xl border border-rose-200/90 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-500/25 shrink-0">
                  <RotateCcw className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Reiniciar Escala & Liberar Todos os Respawns
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                    Ideal para o início de novos finais de semana ou encerramento de eventos de Double. Você pode zerar a grade inteira ou apenas o dia que desejar. Todos os slots voltam imediatamente para o status <strong>Livre</strong>.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setResetModalDay('friday');
                  setIsResetModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-md shadow-rose-500/20 transition-all cursor-pointer whitespace-nowrap self-start md:self-auto"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reiniciar Respawns</span>
              </button>
            </div>
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
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Editar Vínculo do Membro
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
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
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Rank de Prioridade
                </label>
                <select
                  value={editRank}
                  onChange={e => setEditRank(e.target.value as PriorityRank)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                >
                  {PRIORITY_RANKS.map(r => (
                    <option key={r} value={r}>
                      {r} - {RANK_METADATA[r].description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isAdminCheckbox"
                  checked={editIsAdmin}
                  onChange={e => setEditIsAdmin(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isAdminCheckbox" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Acesso Total de Administrador ao Major
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {savingUser ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB: DOUBLE XP & EXPERIENCE CAPTURE                   */}
      {/* ======================================================== */}
      {activeSubTab === 'double-xp' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Configuração de Período da Double Experiência
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Defina a data de início e fim da double para capturar e gravar o progresso de todos os jogadores.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCaptureAllXp}
                disabled={capturingXp}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {capturingXp ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span>Capturar XP de Todos via API</span>
              </button>
            </div>

            <form onSubmit={handleSaveDoubleSettings} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Data Início da Double
                </label>
                <input
                  type="date"
                  value={doubleStartDate}
                  onChange={e => setDoubleStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Data Fim da Double
                </label>
                <input
                  type="date"
                  value={doubleEndDate}
                  onChange={e => setDoubleEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={savingDoubleSettings}
                  className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-bold border border-slate-700 shadow-sm cursor-pointer"
                >
                  {savingDoubleSettings ? 'Salvando...' : 'Salvar Período'}
                </button>
              </div>
            </form>
          </div>

          {/* Players XP Records Table */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Progresso de Experiência dos Jogadores (Sexta, Sábado e Domingo)
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold">
                    <th className="pb-3 px-3">Personagem</th>
                    <th className="pb-3 px-3">Sexta (XP)</th>
                    <th className="pb-3 px-3">Sábado (XP)</th>
                    <th className="pb-3 px-3">Domingo (XP)</th>
                    <th className="pb-3 px-3">Total Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {usersList.map(u => {
                    const rec = doubleRecordsList.find(r => r.uid === u.uid);
                    return (
                      <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                          {u.charName || 'Sem Personagem'}
                          <div className="text-[10px] text-slate-400 font-normal">{u.email}</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                          {rec?.fridayExp ? rec.fridayExp.toLocaleString('pt-BR') : '0'}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                          {rec?.saturdayExp ? rec.saturdayExp.toLocaleString('pt-BR') : '0'}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                          {rec?.sundayExp ? rec.sundayExp.toLocaleString('pt-BR') : '0'}
                        </td>
                        <td className="py-3 px-3 font-bold text-blue-600 dark:text-blue-400 font-mono">
                          {rec?.totalExp ? rec.totalExp.toLocaleString('pt-BR') : '0'} XP
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Admin Respawn Assignment Modal */}
      {assignUser && (
        <AdminAssignModal
          isOpen={Boolean(assignUser)}
          targetUser={assignUser}
          reservations={reservations}
          onClose={() => setAssignUser(null)}
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
    </div>
  );
};
