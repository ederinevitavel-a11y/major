import React, { useState, useRef, useEffect } from 'react';
import { HuntDay, SlotType, Reservation, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  DAYS_CONFIG,
  NORMAL_RESPAWNS,
  NORMAL_TIME_SLOTS,
  THREE_HOUR_RESPAWNS,
  THREE_HOUR_TIME_SLOTS,
  RANK_METADATA,
} from '../constants/guildData';
import { ReservationModal } from './ReservationModal';
import { ResetScheduleModal } from './ResetScheduleModal';
import {
  Search,
  LayoutGrid,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Smartphone,
  CalendarClock,
  User,
  Users,
  Lock,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

interface ScheduleGridProps {
  reservations: Reservation[];
  usersList: UserProfile[];
}

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({
  reservations,
  usersList,
}) => {
  const { currentUser, isAdmin, userProfile } = useAuth();
  const isLeader = userProfile?.rank === 'Leader';
  const canBookRespawn = isAdmin || isLeader;

  const [selectedDay, setSelectedDay] = useState<HuntDay>('friday');
  const [slotType, setSlotType] = useState<SlotType>('normal');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'free' | 'reserved'>('all');

  // View modes: 'matrix' (full table), 'cards' (mobile respawn cards), 'by-time' (timeline slot picker)
  const [viewMode, setViewMode] = useState<'matrix' | 'cards' | 'by-time'>(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'matrix';
  });

  // Selected time slot for 'by-time' mode
  const [activeSlotFilter, setActiveSlotFilter] = useState<string>('08:00h – 10:20h');

  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [modalData, setModalData] = useState<{
    isOpen: boolean;
    day: HuntDay;
    slotType: SlotType;
    respawnName: string;
    timeSlot: string;
    existingReservation?: Reservation;
  } | null>(null);

  // Admin Reset Modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetSuccessToast, setResetSuccessToast] = useState<string | null>(null);

  const activeRespawns = slotType === 'normal' ? NORMAL_RESPAWNS : THREE_HOUR_RESPAWNS;
  const activeTimeSlots = slotType === 'normal' ? NORMAL_TIME_SLOTS : THREE_HOUR_TIME_SLOTS;

  // Make sure activeSlotFilter is valid when slotType toggles
  useEffect(() => {
    if (!activeTimeSlots.includes(activeSlotFilter)) {
      setActiveSlotFilter(activeTimeSlots[0] || '');
    }
  }, [slotType, activeTimeSlots, activeSlotFilter]);

  // Filter respawns by search
  const filteredRespawns = activeRespawns.filter(respawn =>
    respawn.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to find reservation
  const getReservation = (day: HuntDay, type: SlotType, respawn: string, time: string) => {
    return reservations.find(
      r =>
        r.day === day &&
        r.slotType === type &&
        r.respawnName === respawn &&
        r.timeSlot === time
    );
  };

  const handleCellClick = (respawn: string, time: string) => {
    const existing = getReservation(selectedDay, slotType, respawn, time);
    setModalData({
      isOpen: true,
      day: selectedDay,
      slotType,
      respawnName: respawn,
      timeSlot: time,
      existingReservation: existing,
    });
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (tableScrollRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      tableScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full max-w-full space-y-4">
      {/* Top Filter Card */}
      <div className="w-full max-w-full rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col gap-3.5">
          {/* Day selection and Respawn category toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Day Selector */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto w-full sm:w-auto">
              {DAYS_CONFIG.map(d => (
                <button
                  key={d.key}
                  onClick={() => setSelectedDay(d.key)}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    selectedDay === d.key
                      ? 'bg-[#2160FF] text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{d.label}</span>
                </button>
              ))}
            </div>

            {/* Normal vs 3h Switcher & Admin Reset Button */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              <button
                onClick={() => setSlotType('normal')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  slotType === 'normal'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:border-blue-500 dark:text-blue-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Normais ({NORMAL_RESPAWNS.length})</span>
              </button>

              <button
                onClick={() => setSlotType('3h')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  slotType === '3h'
                    ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:border-purple-500 dark:text-purple-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>Especiais 3h ({THREE_HOUR_RESPAWNS.length})</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  title="Reiniciar e liberar respawns (Apenas Admin)"
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-900/60 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Liberar Respawns</span>
                </button>
              )}
            </div>
          </div>

          {/* Search, Filter Status, and View Mode Switcher */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 max-w-full md:max-w-xs">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar respawn (ex: Crypt, Rotten)..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 pl-8 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Quick Status and View Mode */}
            <div className="flex flex-wrap items-center justify-between md:justify-end gap-2">
              {/* Status filter */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    statusFilter === 'all'
                      ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setStatusFilter('free')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    statusFilter === 'free'
                      ? 'bg-white text-emerald-700 dark:bg-slate-900 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Livres
                </button>
                <button
                  onClick={() => setStatusFilter('reserved')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    statusFilter === 'reserved'
                      ? 'bg-white text-blue-700 dark:bg-slate-900 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Ocupados
                </button>
              </div>

              {/* View Switcher: Matrix vs Cards vs By-Time */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setViewMode('cards')}
                  title="Modo Cartões (Otimizado para Celular)"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-white text-blue-600 dark:bg-slate-900 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Cartões</span>
                </button>

                <button
                  onClick={() => setViewMode('by-time')}
                  title="Modo Por Horário (Rápido e direto)"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'by-time'
                      ? 'bg-white text-blue-600 dark:bg-slate-900 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Por Horário</span>
                </button>

                <button
                  onClick={() => setViewMode('matrix')}
                  title="Modo Tabela Geral (Desktop)"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'matrix'
                      ? 'bg-white text-blue-600 dark:bg-slate-900 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Tabela</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Respawns Success Toast */}
      {resetSuccessToast && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">{resetSuccessToast}</span>
          </div>
          <button
            onClick={() => setResetSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 cursor-pointer text-xs font-bold px-2 py-0.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Member Privacy & Booking Authority Notice */}
      {!isAdmin && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              <strong>Privacidade Ativa:</strong> Horários reservados por outros membros são identificados apenas como <strong>Ocupado</strong>.
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isLeader ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700 text-[11px] font-bold">
                ⭐ Patente Leader: Você pode escolher respawns
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[11px] font-medium">
                🔒 Apenas Líderes e Admin reservam respawns
              </span>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 1: COMPACT RESPONSIVE CARDS (Ideal para Celular e Tablet) */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredRespawns.map(respawn => {
            // Count booked and free slots for this respawn
            const bookedSlots = activeTimeSlots.filter(
              t => !!getReservation(selectedDay, slotType, respawn, t)
            );
            const freeCount = activeTimeSlots.length - bookedSlots.length;

            return (
              <div
                key={respawn}
                className="w-full rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-md flex flex-col justify-between"
              >
                {/* Card Title & Info */}
                <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight break-words">
                      {respawn}
                    </h3>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-0.5">
                      {slotType === '3h' ? 'Respawn Especial 3h' : 'Respawn Normal'}
                    </span>
                  </div>

                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      freeCount === 0
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        : freeCount === activeTimeSlots.length
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    }`}
                  >
                    {freeCount} livres / {bookedSlots.length} ocupados
                  </span>
                </div>

                {/* Grid of Interactive Time Pills */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {activeTimeSlots.map(time => {
                    const res = getReservation(selectedDay, slotType, respawn, time);
                    if (statusFilter === 'free' && res) return null;
                    if (statusFilter === 'reserved' && !res) return null;

                    const isOwner = Boolean(res && currentUser && res.userUid === currentUser.uid);
                    const canSeeDetails = isAdmin || isOwner;

                    return (
                      <button
                        key={time}
                        onClick={() => handleCellClick(respawn, time)}
                        title={
                          res
                            ? canSeeDetails
                              ? isOwner && !isAdmin
                                ? `Sua reserva (${res.charName})`
                                : `Reservado por ${res.charName}`
                              : 'Horário ocupado por outro membro'
                            : canBookRespawn
                            ? 'Disponível - Clique para reservar'
                            : 'Disponível (Apenas Líderes e Administradores podem reservar)'
                        }
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                          res
                            ? isOwner
                              ? 'bg-blue-50 text-blue-950 border border-blue-400 dark:bg-blue-950/70 dark:text-blue-100 dark:border-blue-600 shadow-2xs ring-1 ring-blue-300 dark:ring-blue-800'
                              : isAdmin
                              ? 'bg-blue-50 text-blue-950 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-100 dark:border-blue-800/80 shadow-2xs'
                              : 'bg-slate-100/90 text-slate-700 border border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700/80 shadow-2xs'
                            : canBookRespawn
                            ? 'bg-slate-50/70 border border-dashed border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 dark:bg-slate-800/40 dark:border-slate-700/80 dark:text-slate-300 dark:hover:border-blue-600'
                            : 'bg-slate-50/40 border border-dashed border-slate-200 text-slate-400 hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50/20 dark:bg-slate-800/20 dark:border-slate-800 dark:text-slate-500'
                        }`}
                      >
                        <span className="text-[11px] font-mono shrink-0">
                          {time.replace(/h/g, '')}
                        </span>

                        {res ? (
                          canSeeDetails ? (
                            <div className="flex items-center gap-1 min-w-0 ml-1">
                              <span className="truncate text-[11px] font-bold text-blue-600 dark:text-blue-300">
                                {res.charName} {isOwner && !isAdmin && '(Você)'}
                              </span>
                              {res.userRank && (
                                <span
                                  className={`text-[8px] font-black px-1 rounded uppercase ${
                                    RANK_METADATA[res.userRank]?.badgeClass || ''
                                  }`}
                                >
                                  {res.userRank[0]}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Lock className="h-3 w-3 text-slate-400 shrink-0" />
                              Ocupado
                            </span>
                          )
                        ) : canBookRespawn ? (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                            <Plus className="h-2.5 w-2.5" />
                            Livre
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-0.5">
                            <Lock className="h-2.5 w-2.5 opacity-50" />
                            Livre
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: BY TIME SLOT (Rápido e direto em qualquer dispositivo) */}
      {viewMode === 'by-time' && (
        <div className="w-full rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
          {/* Slot selector pill bar */}
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
              Selecione o Horário Desejado:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5">
              {activeTimeSlots.map(time => (
                <button
                  key={time}
                  onClick={() => setActiveSlotFilter(time)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    activeSlotFilter === time
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>

          {/* List of respawns for this chosen slot */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredRespawns.map(respawn => {
              const res = getReservation(selectedDay, slotType, respawn, activeSlotFilter);
              if (statusFilter === 'free' && res) return null;
              if (statusFilter === 'reserved' && !res) return null;

              const isOwner = Boolean(res && currentUser && res.userUid === currentUser.uid);
              const canSeeDetails = isAdmin || isOwner;

              return (
                <div
                  key={respawn}
                  onClick={() => handleCellClick(respawn, activeSlotFilter)}
                  title={
                    res
                      ? canSeeDetails
                        ? isOwner && !isAdmin
                          ? `Sua reserva (${res.charName})`
                          : `Reservado por ${res.charName}`
                        : 'Horário ocupado por outro membro'
                      : canBookRespawn
                      ? 'Disponível - Clique para reservar'
                      : 'Disponível (Apenas Líderes e Administradores podem reservar)'
                  }
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                    res
                      ? isOwner
                        ? 'border-blue-400 bg-blue-50/90 dark:border-blue-600 dark:bg-blue-950/60 ring-1 ring-blue-300 dark:ring-blue-800'
                        : isAdmin
                        ? 'border-blue-200 bg-blue-50/80 dark:border-blue-900/60 dark:bg-blue-950/40'
                        : 'border-slate-200 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-800/50'
                      : canBookRespawn
                      ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-blue-400 hover:shadow-2xs'
                      : 'border-slate-200/80 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-800/20 hover:border-amber-400'
                  }`}
                >
                  <div className="min-w-0">
                    <strong className="text-slate-900 dark:text-white block truncate text-xs">
                      {respawn}
                    </strong>
                    {res ? (
                      canSeeDetails && res.partyMembers ? (
                        <span className="text-[10px] text-blue-700/80 dark:text-blue-300/80 truncate block">
                          Party: {res.partyMembers}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {isOwner && !isAdmin ? 'Sua reserva agendada' : 'Horário reservado'}
                        </span>
                      )
                    ) : (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {slotType === '3h' ? 'Especial 3h' : 'Normal'}
                      </span>
                    )}
                  </div>

                  {res ? (
                    canSeeDetails ? (
                      <div className="text-right shrink-0">
                        <span className="font-bold text-blue-600 dark:text-blue-300 block text-xs">
                          {res.charName} {isOwner && !isAdmin && '(Você)'}
                        </span>
                        {res.userRank && (
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold border ${
                              RANK_METADATA[res.userRank]?.badgeClass || ''
                            }`}
                          >
                            {res.userRank}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-bold text-[10px] flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                        <Lock className="h-2.5 w-2.5 text-slate-400" />
                        Ocupado
                      </span>
                    )
                  ) : canBookRespawn ? (
                    <span className="shrink-0 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-[10px] flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                      <Plus className="h-3 w-3" />
                      Reservar
                    </span>
                  ) : (
                    <span className="shrink-0 px-2 py-1 rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 font-medium text-[10px] flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                      <Lock className="h-2.5 w-2.5 opacity-60" />
                      Livre
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 3: FULL MATRIX TABLE (Desktop & Tablet com rolagem contida) */}
      {viewMode === 'matrix' && (
        <div className="w-full max-w-full rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors overflow-hidden">
          {/* Scroll Navigation Header bar inside the card */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/40">
            <span className="font-medium text-xs">
              Exibindo <strong>{activeTimeSlots.length} horários</strong> • Navegue pelas setas ou arraste horizontalmente:
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleScroll('left')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs transition-all cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Anteriores</span>
              </button>
              <button
                type="button"
                onClick={() => handleScroll('right')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs transition-all cursor-pointer"
              >
                <span className="hidden sm:inline">Próximos</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Table Container strictly scrollable inside the card */}
          <div
            ref={tableScrollRef}
            className="w-full max-w-full overflow-x-auto touch-pan-x scroll-smooth"
          >
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/70">
                  {/* Sticky Respawn Column Header */}
                  <th className="sticky left-0 z-30 min-w-[180px] sm:min-w-[210px] max-w-[230px] p-3 text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center justify-between">
                      <span>Respawn</span>
                      <span className="text-[10px] font-semibold text-slate-400 lowercase">
                        {filteredRespawns.length} locais
                      </span>
                    </div>
                  </th>
                  {activeTimeSlots.map(time => (
                    <th
                      key={time}
                      className="min-w-[105px] sm:min-w-[115px] p-2.5 text-center text-[11px] font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap bg-slate-50/60 dark:bg-slate-800/40"
                    >
                      <div className="inline-block px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs text-[10px] font-mono">
                        {time}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredRespawns.map(respawn => (
                  <tr
                    key={respawn}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    {/* Respawn Name Column (Sticky left, wrapping without cutting off) */}
                    <td className="sticky left-0 z-20 min-w-[180px] sm:min-w-[210px] max-w-[230px] p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                      <span className="text-xs font-bold text-slate-900 dark:text-white block leading-snug break-words">
                        {respawn}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 block">
                        {slotType === '3h' ? 'Especial 3h' : 'Normal'}
                      </span>
                    </td>

                    {/* Time Slots Columns */}
                    {activeTimeSlots.map(time => {
                      const res = getReservation(selectedDay, slotType, respawn, time);

                      if (statusFilter === 'free' && res) {
                        return (
                          <td key={time} className="p-1.5 text-center">
                            <span className="text-[11px] text-slate-300 dark:text-slate-700">-</span>
                          </td>
                        );
                      }
                      if (statusFilter === 'reserved' && !res) {
                        return (
                          <td key={time} className="p-1.5 text-center">
                            <span className="text-[11px] text-slate-300 dark:text-slate-700">-</span>
                          </td>
                        );
                      }

                      const isOwner = Boolean(res && currentUser && res.userUid === currentUser.uid);
                      const canSeeDetails = isAdmin || isOwner;

                      return (
                        <td key={time} className="p-1.5 text-center align-middle">
                          {res ? (
                            canSeeDetails ? (
                              <button
                                onClick={() => handleCellClick(respawn, time)}
                                title={
                                  isOwner && !isAdmin
                                    ? `Sua reserva (${res.charName}) - Clique para editar ou liberar`
                                    : `Reservado por ${res.charName} (${res.userRank})`
                                }
                                className={`w-full text-left p-1.5 rounded-lg border transition-all cursor-pointer group shadow-2xs ${
                                  isOwner
                                    ? 'border-blue-400 bg-blue-100/70 hover:border-blue-500 dark:border-blue-500 dark:bg-blue-950/80 ring-1 ring-blue-400/40'
                                    : 'border-blue-200 dark:border-blue-900/60 bg-blue-50/90 dark:bg-blue-950/50 hover:border-blue-400 dark:hover:border-blue-700'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="truncate text-[11px] font-bold text-blue-900 dark:text-blue-200 group-hover:underline">
                                    {res.charName}
                                  </span>
                                  {res.userRank && (
                                    <span
                                      className={`text-[8px] font-black px-1 rounded ${
                                        RANK_METADATA[res.userRank]?.badgeClass || ''
                                      }`}
                                    >
                                      {res.userRank[0]}
                                    </span>
                                  )}
                                </div>
                                {res.partyMembers ? (
                                  <p className="truncate text-[9px] text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                                    {res.partyMembers}
                                  </p>
                                ) : isOwner ? (
                                  <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5 block truncate">
                                    Sua reserva
                                  </span>
                                ) : null}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleCellClick(respawn, time)}
                                title="Horário ocupado por outro membro"
                                className="w-full text-center p-1.5 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-800/60 shadow-2xs cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/60 transition-colors"
                              >
                                <div className="flex items-center justify-center gap-1 text-slate-500 dark:text-slate-400 py-0.5">
                                  <Lock className="h-3 w-3 opacity-70 shrink-0" />
                                  <span className="text-[10px] font-bold">Ocupado</span>
                                </div>
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => handleCellClick(respawn, time)}
                              title={
                                canBookRespawn
                                  ? 'Disponível - Clique para reservar'
                                  : 'Disponível (Apenas Líderes e Administradores podem reservar)'
                              }
                              className={`w-full py-1.5 px-1 rounded-lg border border-dashed text-[10px] transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                                canBookRespawn
                                  ? 'border-slate-200 dark:border-slate-800 font-semibold text-slate-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/40 dark:hover:border-blue-600 dark:hover:text-blue-400 dark:hover:bg-blue-950/20'
                                  : 'border-slate-200/60 dark:border-slate-800/60 font-medium text-slate-400/80 hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50/20 dark:hover:border-amber-600 dark:hover:text-amber-400'
                              }`}
                            >
                              {canBookRespawn ? (
                                <>
                                  <Plus className="h-2.5 w-2.5 opacity-60" />
                                  <span>Livre</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="h-2.5 w-2.5 opacity-40" />
                                  <span>Livre</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reservation details modal */}
      {modalData?.isOpen && (
        <ReservationModal
          day={modalData.day}
          slotType={modalData.slotType}
          respawnName={modalData.respawnName}
          timeSlot={modalData.timeSlot}
          existingReservation={modalData.existingReservation}
          usersList={usersList}
          onClose={() => setModalData(null)}
        />
      )}

      {/* Admin Reset Schedule Modal */}
      {isResetModalOpen && (
        <ResetScheduleModal
          currentDay={selectedDay}
          reservations={reservations}
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          onSuccess={count => {
            setResetSuccessToast(
              `Operação concluída! ${count} respawn(s) foram liberados e agora estão disponíveis para todos os membros.`
            );
            setTimeout(() => setResetSuccessToast(null), 6000);
          }}
        />
      )}
    </div>
  );
};
