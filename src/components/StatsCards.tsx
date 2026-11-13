import React from 'react';
import { Reservation, UserProfile } from '../types';
import { NORMAL_RESPAWNS, NORMAL_TIME_SLOTS, THREE_HOUR_RESPAWNS, THREE_HOUR_TIME_SLOTS } from '../constants/guildData';
import { Flame, Clock, Users, CheckCircle2 } from 'lucide-react';

interface StatsCardsProps {
  reservations: Reservation[];
  users: UserProfile[];
  isAdmin?: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  reservations,
  users,
  isAdmin = false,
}) => {
  const totalNormalSlots = 3 * NORMAL_RESPAWNS.length * NORMAL_TIME_SLOTS.length;
  const total3hSlots = 3 * THREE_HOUR_RESPAWNS.length * THREE_HOUR_TIME_SLOTS.length;
  const totalAvailableSlots = totalNormalSlots + total3hSlots;

  const totalBooked = reservations.length;
  const freeSlots = Math.max(0, totalAvailableSlots - totalBooked);
  const occupancyPercentage = Math.min(100, Math.round((totalBooked / Math.max(1, totalAvailableSlots)) * 100));

  const respawnCounts: Record<string, number> = {};
  reservations.forEach(r => {
    respawnCounts[r.respawnName] = (respawnCounts[r.respawnName] || 0) + 1;
  });
  const topRespawn = Object.entries(respawnCounts).sort((a, b) => b[1] - a[1])[0];

  const uniqueHunters = new Set(reservations.map(r => r.userUid || r.charName)).size;
  const memberCountDisplay = isAdmin ? users.length : uniqueHunters;
  const memberCountLabel = isAdmin ? 'vinculados' : 'Jogadores';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      {/* Total Bookings */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-md min-w-0">
        <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
            Ocupação do Fds
          </span>
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {totalBooked}
          </span>
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
            reservados
          </span>
        </div>
        <div className="mt-2.5 sm:mt-3">
          <div className="h-1.5 sm:h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-[#2160FF] transition-all duration-500"
              style={{ width: `${Math.max(4, occupancyPercentage)}%` }}
            />
          </div>
          <span className="mt-1 sm:mt-1.5 block text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
            {occupancyPercentage}% ocupada
          </span>
        </div>
      </div>

      {/* Top Respawn */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-md min-w-0">
        <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
            Mais Disputado
          </span>
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
            <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="truncate text-sm sm:text-lg font-bold text-slate-900 dark:text-white" title={topRespawn ? topRespawn[0] : 'Nenhum ainda'}>
            {topRespawn ? topRespawn[0] : 'Nenhum ainda'}
          </span>
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums truncate">
            {topRespawn ? `${topRespawn[1]} horários preenchidos` : 'Aguardando reservas'}
          </span>
        </div>
        <div className="mt-2 sm:mt-3 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-purple-600 dark:text-purple-400 font-semibold truncate">
          <span>Unhallowed • Rotten • Gloom</span>
        </div>
      </div>

      {/* Active Members - Privacy Preserving */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-md min-w-0">
        <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
            {isAdmin ? 'Cadastrados' : 'Na Escala'}
          </span>
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {memberCountDisplay}
          </span>
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
            {memberCountLabel}
          </span>
        </div>
        <div className="mt-2 sm:mt-3 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
          Validados via API
        </div>
      </div>

      {/* Free Slots KPI */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-md min-w-0">
        <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
            Disponíveis
          </span>
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {freeSlots}
          </span>
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
            slots livres
          </span>
        </div>
        <div className="mt-2 sm:mt-3 text-[10px] sm:text-[11px] text-amber-600 dark:text-amber-400 font-semibold truncate">
          {NORMAL_RESPAWNS.length} normais • {THREE_HOUR_RESPAWNS.length} de 3h
        </div>
      </div>
    </div>
  );
};
