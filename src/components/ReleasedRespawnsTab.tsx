import React, { useState, useMemo } from 'react';
import { ReleasedRespawn, UserProfile, HuntDay, Reservation } from '../types';
import {
  Zap,
  Clock,
  MapPin,
  Calendar,
  Search,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Check,
  UserCheck,
} from 'lucide-react';
import { DAYS_CONFIG, RANK_METADATA } from '../constants/guildData';
import { useAuth } from '../context/AuthContext';
import { claimReleasedRespawn } from '../services/firestoreService';

interface ReleasedRespawnsTabProps {
  releasedList: ReleasedRespawn[];
  usersList: UserProfile[];
  onNavigateToSchedule: (day?: HuntDay, respawnName?: string) => void;
}

export const ReleasedRespawnsTab: React.FC<ReleasedRespawnsTabProps> = ({
  releasedList,
  usersList,
  onNavigateToSchedule,
}) => {
  const { userProfile, currentUser } = useAuth();
  const [selectedDayFilter, setSelectedDayFilter] = useState<'all' | HuntDay>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Direct Claim Modal state
  const [claimingItem, setClaimingItem] = useState<ReleasedRespawn | null>(null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [claimToast, setClaimToast] = useState<string | null>(null);

  // Map users for fast lookup of rank, vocation, guild
  const userMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    usersList.forEach(u => {
      if (u.uid) map.set(u.uid, u);
      if (u.charName) map.set(u.charName.toLowerCase(), u);
    });
    return map;
  }, [usersList]);

  // Filtered list
  const filteredList = useMemo(() => {
    return releasedList.filter(item => {
      // Day filter
      if (selectedDayFilter !== 'all' && item.day !== selectedDayFilter) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.respawnName.toLowerCase().includes(q);
        const matchesSlot = item.timeSlot.toLowerCase().includes(q);
        const matchesChar = item.charName.toLowerCase().includes(q);
        return matchesName || matchesSlot || matchesChar;
      }
      return true;
    });
  }, [releasedList, selectedDayFilter, searchQuery]);

  // Statistics
  const fridayCount = releasedList.filter(r => r.day === 'friday').length;
  const saturdayCount = releasedList.filter(r => r.day === 'saturday').length;
  const sundayCount = releasedList.filter(r => r.day === 'sunday').length;

  const handleConfirmClaim = async () => {
    if (!claimingItem || !userProfile) return;
    setIsSubmittingClaim(true);

    try {
      const reservationId =
        claimingItem.claimReservationId ||
        `${claimingItem.day}_${claimingItem.respawnName.replace(/[^a-zA-Z0-9]/g, '-')}_${claimingItem.timeSlot.replace(/[^a-zA-Z0-9]/g, '-')}`;

      const newReservation: Reservation = {
        id: reservationId,
        day: claimingItem.day,
        slotType: claimingItem.slotType || 'normal',
        timeSlot: claimingItem.timeSlot,
        respawnName: claimingItem.respawnName,
        charName: userProfile.charName,
        userUid: userProfile.uid,
        userRank: userProfile.rank,
        partyMembers: '',
        notes: `Aceito via Respaws Liberados (Anteriormente de ${claimingItem.charName})`,
        reservedAt: new Date().toISOString(),
        releasedRespawnId: claimingItem.id,
      };

      // Atomically claim the slot (creates reservation + details and removes released_respawn)
      await claimReleasedRespawn(claimingItem, newReservation);

      setClaimToast(`Respawn "${claimingItem.respawnName}" (${claimingItem.timeSlot}) reservado com sucesso! Agora é seu na aba Respaws.`);
      setTimeout(() => setClaimToast(null), 4500);
      setClaimingItem(null);
    } catch (err) {
      console.error('Erro ao aceitar respawn liberado:', err);
      setClaimToast('Ocorreu um erro ao aceitar este respawn. Tente novamente.');
      setTimeout(() => setClaimToast(null), 4500);
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {claimToast && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 shadow-md animate-in fade-in duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-bold">{claimToast}</span>
        </div>
      )}

      {/* Hero / Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-blue-900/40">
        <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
        <div className="absolute right-20 top-0 h-40 w-40 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              <span>Golpe!</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Respaws Liberados na Double
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
              🐟 O <strong className="text-amber-300">RP</strong> foi dar banho no peixe, 🥋 o <strong className="text-purple-300">MS</strong> foi levar a vovó no judô, 🎉 o <strong className="text-emerald-300">ED</strong> arrumou uma festinha de última hora, 🧘 o <strong className="text-cyan-300">Monk</strong> não tem no servidor, ⚽ o <strong className="text-blue-300">EK</strong> foi jogar bola! 🚨 <strong className="text-rose-300 font-black">Golpe! Respaws disponíveis devido a Golpe!</strong> ⚡ Qualquer membro da guild pode dar <strong className="text-white underline decoration-emerald-400">Aceite no Respawn</strong> instantaneamente, garantindo o horário e ocupando a vaga na aba de Respaws!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigateToSchedule()}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs sm:text-sm backdrop-blur-sm border border-white/15 transition-all cursor-pointer"
            >
              <span>Ver Grid de Respaws</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick KPI stats strip */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Liberados
            </span>
            <div className="text-2xl font-black text-white mt-1 flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-400" />
              <span>{releasedList.length}</span>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider block">
              Sexta-feira
            </span>
            <div className="text-2xl font-black text-white mt-1">
              {fridayCount}
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block">
              Sábado
            </span>
            <div className="text-2xl font-black text-white mt-1">
              {saturdayCount}
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block">
              Domingo
            </span>
            <div className="text-2xl font-black text-white mt-1">
              {sundayCount}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3 sm:space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Day selection pills */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setSelectedDayFilter('all')}
              className={`min-h-[40px] sm:min-h-[34px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedDayFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              Todos ({releasedList.length})
            </button>
            {DAYS_CONFIG.map(day => {
              const count = releasedList.filter(r => r.day === day.key).length;
              const isSelected = selectedDayFilter === day.key;
              return (
                <button
                  key={day.key}
                  onClick={() => setSelectedDayFilter(day.key as HuntDay)}
                  className={`min-h-[40px] sm:min-h-[34px] flex items-center justify-center sm:justify-start gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span className="sm:hidden">{day.shortLabel}</span>
                  <span className="hidden sm:inline">{day.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search box */}
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar respawn, char ou horário..."
              className="w-full min-h-[42px] sm:min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 py-2 pl-9 pr-3 text-sm sm:text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content / Cards List */}
      {filteredList.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="h-16 w-16 rounded-3xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
            <Zap className="h-8 w-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {searchQuery || selectedDayFilter !== 'all'
                ? 'Nenhum respawn encontrado com os filtros aplicados'
                : 'Nenhum respawn foi liberado até o momento'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {searchQuery || selectedDayFilter !== 'all'
                ? 'Tente remover os filtros ou buscar por outro termo.'
                : 'Assim que um jogador liberar um horário reservado no painel "Meus Controles", ele aparecerá aqui instantaneamente para que qualquer membro dê o aceite!'}
            </p>
          </div>
          {(searchQuery || selectedDayFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedDayFilter('all');
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map(item => {
            const user = userMap.get(item.userUid) || userMap.get(item.charName.toLowerCase());
            const rankMeta = user ? RANK_METADATA[user.rank] : null;

            const dayConfig = DAYS_CONFIG.find(d => d.key === item.day);
            const dayLabel = dayConfig?.label || (item.day === 'friday' ? 'Sexta-feira' : item.day === 'saturday' ? 'Sábado' : 'Domingo');

            return (
              <div
                key={item.id}
                className="group relative bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-md hover:shadow-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all flex flex-col justify-between gap-4"
              >
                {/* Card Top: Badges */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black font-mono border ${
                      item.day === 'friday'
                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                        : item.day === 'saturday'
                        ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                    }`}>
                      <Calendar className="h-3 w-3" />
                      <span>{dayLabel}</span>
                    </span>

                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(item.releasedAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Respawn Name & Time */}
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="truncate">{item.respawnName}</span>
                    </h3>

                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">
                      <Clock className="h-3.5 w-3.5 text-emerald-500" />
                      <span>{item.timeSlot}</span>
                      <span className="text-[10px] text-slate-400 font-sans font-normal">
                        ({item.slotType === '3h' ? '3h Especial' : '2h20m Normal'})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Who Released & Action CTA */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Liberado por:</span>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-slate-900 dark:text-white font-black">
                        {item.charName}
                      </strong>
                      {rankMeta && (
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-black border ${rankMeta.badgeClass}`}>
                          {user?.rank}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setClaimingItem(item)}
                      className="flex-1 min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                    >
                      <Zap className="h-4 w-4" />
                      <span>Aceitar Respawn</span>
                    </button>

                    <button
                      onClick={() => onNavigateToSchedule(item.day, item.respawnName)}
                      title="Ver localização no Grid"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmacao de Aceite do Respawn */}
      {claimingItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5 pb-safe">
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
                <UserCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Confirmar Aceite de Respawn
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Assumir este horário na escala da guild
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 shrink-0">Respawn:</span>
                <strong className="text-slate-900 dark:text-white font-black text-right truncate">{claimingItem.respawnName}</strong>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 shrink-0">Horário:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{claimingItem.timeSlot}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 shrink-0">Dia:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {claimingItem.day === 'friday' ? 'Sexta-feira' : claimingItem.day === 'saturday' ? 'Sábado' : 'Domingo'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-700/60 pt-2">
                <span className="text-slate-400 shrink-0">Seu Personagem:</span>
                <strong className="text-blue-600 dark:text-blue-400 font-black truncate">{userProfile?.charName}</strong>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Ao dar o aceite, esta reserva passará imediatamente para o seu personagem <strong className="text-slate-900 dark:text-white">{userProfile?.charName}</strong> e o horário ficará <strong className="text-emerald-600 dark:text-emerald-400">ocupado</strong> na Agenda geral.
            </p>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmittingClaim}
                onClick={() => setClaimingItem(null)}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmittingClaim}
                onClick={handleConfirmClaim}
                className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSubmittingClaim ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Confirmando...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Confirmar Aceite</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

