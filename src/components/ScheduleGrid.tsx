import React, { useState, useRef, useEffect } from 'react';
import { HuntDay, SlotType, Reservation, UserProfile, CustomRespawn } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  DAYS_CONFIG,
  NORMAL_RESPAWNS,
  NORMAL_TIME_SLOTS,
  THREE_HOUR_RESPAWNS,
  THREE_HOUR_TIME_SLOTS,
  PLANILHADOS_RESPAWNS,
  PLANILHADOS_SLOTS_MAP,
  PLANILHADOS_COLOR_MAP,
  getPlanilhadoAllTimeSlots,
  parseStartTime,
  parseDayStartTime,
  parseSlotRange,
  RANK_METADATA,
  getCanonicalPlayerName,
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
  Lock,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

const normalizeRespawnName = (n: string): string =>
  (n || '')
    .replace(/^[A-Z0-9]+\s*—\s*/i, '') // remove prefixos tipo AB1 —, B4 —, G1 —
    .replace(/[()]/g, '')            // remove parênteses
    .replace(/\bcore\b/gi, '')       // Darklight Core -> Darklight
    .replace(/\bpolls\b/gi, 'pools') // Sparkling Polls -> Sparkling Pools
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const isSpecialRespawn = (respawnName: string): boolean => {
  const norm = normalizeRespawnName(respawnName);
  return PLANILHADOS_RESPAWNS.some(p => normalizeRespawnName(p) === norm);
};

const doesReservationMatchSlot = (r: Reservation, targetRespawn: string, targetTime: string, isSpecial: boolean): boolean => {
  // 1. Respawn match
  const rNorm = normalizeRespawnName(r.respawnName);
  const targetNorm = normalizeRespawnName(targetRespawn);
  if (rNorm !== targetNorm && !rNorm.includes(targetNorm) && !targetNorm.includes(rNorm)) {
    return false;
  }

  // 2. Exact string match (ignoring dashes / spaces / casing)
  const normSlot = (s: string) => (s || '').replace(/[\s–\-—]/g, '').toLowerCase();
  if (normSlot(r.timeSlot) === normSlot(targetTime)) return true;
  if (r.exactTime && normSlot(r.exactTime) === normSlot(targetTime)) return true;

  // 3. Notes match (e.g. "Horário Planilhado: 18:00 – 20:00")
  if (r.notes) {
    const notesMatch = r.notes.match(/(\d{1,2}:\d{2})\s*(?:–|-|às|as|\s)\s*(\d{1,2}:\d{2})/i);
    if (notesMatch) {
      const notesSlot = `${notesMatch[1]}h – ${notesMatch[2]}h`;
      if (normSlot(notesSlot) === normSlot(targetTime)) return true;
    }
  }

  // 4. Minute Range Overlap for Specials
  // If targetTime overlaps significantly with the reservation's actual hunting time
  const targetRange = parseSlotRange(targetTime);
  const resTime = r.exactTime || (r.notes && r.notes.match(/Horário Planilhado:\s*([^\s(]+(?:\s*[–\-]\s*[^\s(]+)?)/i)?.[1]) || r.timeSlot;
  const resRange = parseSlotRange(resTime);

  if (targetRange.start > 0 && resRange.start > 0) {
    // Exact start and end
    if (targetRange.start === resRange.start && targetRange.end === resRange.end) {
      return true;
    }
    // Check overlap
    const overlapStart = Math.max(targetRange.start, resRange.start);
    const overlapEnd = Math.min(targetRange.end, resRange.end);
    if (overlapEnd - overlapStart >= 20) {
      return true;
    }
  }

  return false;
};

interface ScheduleGridProps {
  reservations: Reservation[];
  usersList: UserProfile[];
  customRespawns?: CustomRespawn[];
  initialDay?: HuntDay;
  initialSearch?: string;
}

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({
  reservations,
  usersList,
  customRespawns = [],
  initialDay,
  initialSearch,
}) => {
  const { currentUser, isAdmin, userProfile } = useAuth();
  const isLeader = userProfile?.rank === 'Leader';
  const canBookRespawn = isAdmin || isLeader;

  // Privacy helper: only admins and the slot owner can view names and private reservation details
  const checkIsOwner = (res?: Reservation | null): boolean => {
    if (!res || !currentUser) return false;
    if (res.userUid === currentUser.uid) return true;
    if (userProfile?.charName && res.charName) {
      const myName = userProfile.charName.trim().toLowerCase();
      const resName = res.charName.trim().toLowerCase();
      const canonicalResName = getCanonicalPlayerName(res.charName).toLowerCase();
      return resName === myName || canonicalResName === myName;
    }
    return false;
  };

  // Visibility Rule:
  // Admins and the slot owner can always view who is in the respawn.
  // Regular members can ONLY view who is in the respawn if visibility was liberated:
  // - Via the "Dê visibilidade" button (sharedWith includes current user or 'all')
  // - Via party member assignment (partyMemberUids includes current user)
  // - Via public reservation visibility flag (isPublicVisibility === true)
  const checkCanSeeDetails = (res?: Reservation | null): boolean => {
    if (!res) return false;
    if (isAdmin) return true;
    if (!currentUser) return false;
    if (checkIsOwner(res)) return true;

    // 1. If reservation explicitly has public visibility turned on
    if (res.isPublicVisibility === true) return true;

    // 2. If current user is in party members
    if (res.partyMemberUids && res.partyMemberUids.includes(currentUser.uid)) {
      return true;
    }

    // 3. If owner liberated visibility via "Dê visibilidade" button in userProfile.sharedWith
    const canonicalResChar = getCanonicalPlayerName(res.charName).toLowerCase();
    const owner = usersList.find(
      u =>
        u.uid === res.userUid ||
        (res.charName &&
          u.charName &&
          (u.charName.trim().toLowerCase() === res.charName.trim().toLowerCase() ||
            u.charName.trim().toLowerCase() === canonicalResChar))
    );

    if (owner && owner.sharedWith && owner.sharedWith.length > 0) {
      if (owner.sharedWith.includes('all') || owner.sharedWith.includes(currentUser.uid)) {
        return true;
      }
    }

    return false;
  };

  const [selectedDay, setSelectedDay] = useState<HuntDay>(initialDay || 'friday');
  const [slotType, setSlotType] = useState<SlotType>('normal');
  const [searchTerm, setSearchTerm] = useState(initialSearch || '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'free' | 'reserved'>('all');

  useEffect(() => {
    if (initialDay) setSelectedDay(initialDay);
  }, [initialDay]);

  useEffect(() => {
    if (initialSearch !== undefined) setSearchTerm(initialSearch);
  }, [initialSearch]);

  // View modes: 'matrix' (full table), 'cards' (mobile/respawn cards), 'by-time' (timeline slot picker)
  const [viewMode, setViewMode] = useState<'matrix' | 'cards' | 'by-time'>(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'matrix';
  });

  // Selected time slot for 'by-time' mode
  const [activeSlotFilter, setActiveSlotFilter] = useState<string>('06:00h – 09:00h');

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

  const customNormal = customRespawns.filter(c => c.type === 'normal').map(c => c.name);
  const custom3h = customRespawns.filter(c => c.type === '3h').map(c => c.name);

  const activeRespawns = slotType === 'normal'
    ? Array.from(new Set([...NORMAL_RESPAWNS, ...customNormal])).sort((a, b) => a.localeCompare(b))
    : slotType === '3h'
    ? Array.from(new Set([...THREE_HOUR_RESPAWNS, ...custom3h])).sort((a, b) => a.localeCompare(b))
    : PLANILHADOS_RESPAWNS;

  const activeTimeSlots = slotType === 'normal'
    ? NORMAL_TIME_SLOTS
    : slotType === '3h'
    ? THREE_HOUR_TIME_SLOTS
    : Array.from(new Set(PLANILHADOS_RESPAWNS.flatMap(getPlanilhadoAllTimeSlots))).sort((a, b) => parseDayStartTime(a) - parseDayStartTime(b));

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

  // Helper to find reservation with smart cross-matching
  const getReservation = (day: HuntDay, type: SlotType, respawn: string, time: string) => {
    const isSpecial = type === 'planilhados' || isSpecialRespawn(respawn);

    return reservations.find(r => {
      if (r.day !== day) return false;

      // For special respawns, match regardless of legacy slotType ('planilhados', '3h', 'normal')
      if (isSpecial) {
        return doesReservationMatchSlot(r, respawn, time, true);
      }

      // For regular slots, must match slotType
      if (r.slotType !== type) return false;
      return doesReservationMatchSlot(r, respawn, time, false);
    });
  };

  // Dedicated helper to get clean, deduplicated time slots for special respawns without phantom free slots
  const getDeduplicatedPlanilhadoSlots = (respawnName: string, day: HuntDay): string[] => {
    const baseSlots = getPlanilhadoAllTimeSlots(respawnName);
    const extraSlots = reservations
      .filter(r => {
        if (r.day !== day) return false;
        if (!doesReservationMatchSlot(r, respawnName, r.timeSlot, true)) return false;
        // Do not inject r.timeSlot if one of the baseSlots already matches this reservation!
        const alreadyMatched = baseSlots.some(b => doesReservationMatchSlot(r, respawnName, b, true));
        return !alreadyMatched;
      })
      .map(r => r.timeSlot);

    const candidates = Array.from(new Set([...baseSlots, ...extraSlots]))
      .filter(Boolean)
      .sort((a, b) => parseDayStartTime(a) - parseDayStartTime(b));

    const seenResIds = new Set<string>();
    const result: string[] = [];

    for (const s of candidates) {
      const res = getReservation(day, 'planilhados', respawnName, s);
      if (res) {
        if (seenResIds.has(res.id)) {
          continue;
        }
        seenResIds.add(res.id);
        result.push(s);
      } else {
        // Defensive check: verify if this supposedly "free" slot overlaps with ANY occupied reservation in this respawn on this day
        const sRange = parseSlotRange(s);
        const overlapsOccupied = reservations.some(r => {
          if (r.day !== day) return false;
          if (!doesReservationMatchSlot(r, respawnName, r.timeSlot, true)) return false;
          const rTime = r.exactTime || (r.notes && r.notes.match(/Horário Planilhado:\s*([^\s(]+(?:\s*[–\-]\s*[^\s(]+)?)/i)?.[1]) || r.timeSlot;
          const rRange = parseSlotRange(rTime);
          if (sRange.start > 0 && rRange.start > 0) {
            const oStart = Math.max(sRange.start, rRange.start);
            const oEnd = Math.min(sRange.end, rRange.end);
            return (oEnd - oStart) >= 20;
          }
          return false;
        });

        if (overlapsOccupied) {
          // Skip showing this slot as free since the respawn is occupied during this time window!
          continue;
        }

        result.push(s);
      }
    }

    return result;
  };

  const handleCellClick = (respawn: string, time: string) => {
    const existing = getReservation(selectedDay, slotType, respawn, time);
    const isOwner = checkIsOwner(existing);

    if (!canBookRespawn && !existing) {
      return;
    }
    if (!canBookRespawn && existing && !isOwner && !isAdmin) {
      return;
    }

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

            {/* Category Switcher & Admin Reset Button */}
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
                onClick={() => setSlotType('planilhados')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                  slotType === 'planilhados'
                    ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:border-purple-500 dark:text-purple-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>Especiais ({PLANILHADOS_RESPAWNS.length})</span>
              </button>

              {THREE_HOUR_RESPAWNS.length > 0 && (
                <button
                  onClick={() => setSlotType('3h')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    slotType === '3h'
                      ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:border-purple-500 dark:text-purple-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span>Outros 3h ({THREE_HOUR_RESPAWNS.length})</span>
                </button>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  title="Reiniciar agenda de respawns (Apenas Admin)"
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-900/60 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Reiniciar Agenda</span>
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
                placeholder="Buscar respawn (ex: AB1, Crypt, Jaded)..."
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
                  title="Modo Cartões (Organizado por local)"
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
                  title="Modo Por Horário (Timeline rápida)"
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
                  title="Modo Tabela Resumo"
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



      {/* VIEW MODE 1: RESPONSIVE CARDS */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredRespawns.map(respawn => {
            const respawnTimeSlots = slotType === 'planilhados'
              ? getDeduplicatedPlanilhadoSlots(respawn, selectedDay)
              : activeTimeSlots;

            const colorMeta = slotType === 'planilhados' ? PLANILHADOS_COLOR_MAP[respawn] : null;

            const bookedSlots = respawnTimeSlots.filter(
              t => !!getReservation(selectedDay, slotType, respawn, t)
            );
            const freeCount = respawnTimeSlots.length - bookedSlots.length;

            return (
              <div
                key={respawn}
                className={`w-full rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900 transition-all hover:shadow-md flex flex-col justify-between ${
                  colorMeta ? colorMeta.borderClass : 'border-slate-200/90 dark:border-slate-800'
                }`}
              >
                {/* Card Title & Info */}
                <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight break-words">
                      {respawn}
                    </h3>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-1">
                      {slotType === 'planilhados'
                        ? `${respawnTimeSlots.length} Horários no dia`
                        : slotType === '3h'
                        ? 'Respawn Especial 3h'
                        : 'Respawn Normal'}
                    </span>
                  </div>
                </div>

                {/* Vertical Timeline List of Slots */}
                <div className="mt-3 space-y-1.5">
                  {respawnTimeSlots.map(time => {
                    const res = getReservation(selectedDay, slotType, respawn, time);
                    if (statusFilter === 'free' && res) return null;
                    if (statusFilter === 'reserved' && !res) return null;

                    const isOwner = checkIsOwner(res);
                    const canSeeDetails = checkCanSeeDetails(res);

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
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                          res
                            ? isOwner
                              ? 'bg-blue-50/90 text-blue-950 border border-blue-400 dark:bg-blue-950/70 dark:text-blue-100 dark:border-blue-600 shadow-2xs ring-1 ring-blue-300 dark:ring-blue-800'
                              : isAdmin
                              ? 'bg-blue-50/80 text-blue-950 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-100 dark:border-blue-800/80 shadow-2xs'
                              : 'bg-slate-100/90 text-slate-800 border border-slate-200 dark:bg-slate-800/70 dark:text-slate-200 dark:border-slate-700/80 shadow-2xs'
                            : 'bg-emerald-50/70 border border-emerald-200/90 text-emerald-900 hover:border-emerald-400 hover:bg-emerald-100/80 dark:bg-emerald-950/30 dark:border-emerald-800/80 dark:text-emerald-200 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Clock className={`h-3.5 w-3.5 shrink-0 ${res ? 'text-slate-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
                          <span className="text-xs font-mono font-bold">
                            {time}
                          </span>
                        </div>

                        {res ? (
                          canSeeDetails ? (
                            <div className="flex flex-col items-end min-w-0 ml-2 text-right">
                              <div className="flex items-center justify-end gap-1.5 w-full">
                                <span className="truncate text-xs font-extrabold text-blue-800 dark:text-blue-200">
                                  {res.charName} {isOwner && !isAdmin && '(Você)'}
                                </span>
                                {res.userRank && (
                                  <span
                                    className={`text-[8px] font-black px-1 rounded uppercase shrink-0 ${
                                      RANK_METADATA[res.userRank]?.badgeClass || ''
                                    }`}
                                  >
                                    {res.userRank}
                                  </span>
                                )}
                              </div>
                              {res.notes && (
                                <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 truncate max-w-full block leading-tight mt-0.5">
                                  📌 {res.notes.replace('Horário Planilhado: ', '')}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Lock className="h-3 w-3 text-slate-400 shrink-0" />
                              Ocupado
                            </span>
                          )
                        ) : (
                          <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 shrink-0 bg-white/90 dark:bg-slate-900/90 px-2 py-0.5 rounded-md border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs">
                            <Plus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            LIVRE
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

      {/* VIEW MODE 2: BY TIME SLOT */}
      {viewMode === 'by-time' && (
        <div className="w-full rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
          {/* Slot selector pill bar */}
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
              Selecione o Horário Desejado ({activeTimeSlots.length} disponíveis):
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
              const respawnSlots = slotType === 'planilhados' ? getPlanilhadoAllTimeSlots(respawn) : activeTimeSlots;
              if (slotType === 'planilhados' && !respawnSlots.includes(activeSlotFilter)) {
                return null;
              }
              const res = getReservation(selectedDay, slotType, respawn, activeSlotFilter);
              if (statusFilter === 'free' && res) return null;
              if (statusFilter === 'reserved' && !res) return null;

              const isOwner = checkIsOwner(res);
              const canSeeDetails = checkCanSeeDetails(res);
              const colorMeta = slotType === 'planilhados' ? PLANILHADOS_COLOR_MAP[respawn] : null;

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
                      : 'border-emerald-200/90 bg-emerald-50/60 hover:border-emerald-400 dark:border-emerald-800/80 dark:bg-emerald-950/30'
                  }`}
                >
                  <div className="min-w-0">
                    <strong className="text-slate-900 dark:text-white truncate text-xs block">
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
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                        Horário Disponível
                      </span>
                    )}
                  </div>

                  {res ? (
                    canSeeDetails ? (
                      <div className="text-right shrink-0 min-w-0 max-w-[55%]">
                        <span className="font-bold text-blue-700 dark:text-blue-300 block text-xs truncate">
                          {res.charName} {isOwner && !isAdmin && '(Você)'}
                        </span>
                        {res.notes && (
                          <span className="text-[9.5px] font-bold text-amber-800 dark:text-amber-300 block truncate leading-tight">
                            📌 {res.notes.replace('Horário Planilhado: ', '')}
                          </span>
                        )}
                        {res.userRank && (
                          <span
                            className={`inline-block px-1.5 py-0.2 mt-0.5 rounded text-[9px] font-extrabold border ${
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
                  ) : (
                    <span className="shrink-0 px-2.5 py-1 rounded-lg bg-white/90 text-emerald-700 dark:bg-slate-900/90 dark:text-emerald-400 font-extrabold text-[10px] flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                      <Plus className="h-3 w-3 text-emerald-600" />
                      LIVRE
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 3: FULL MATRIX TABLE OR DEDICATED PLANILHADOS SUMMARY TABLE */}
      {viewMode === 'matrix' && (
        <div className="w-full max-w-full rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors overflow-hidden">
          {slotType === 'planilhados' ? (
            /* DEDICATED PLANILHADOS CLEAN TABLE VIEW WITH ALL FREE & OCCUPIED SLOTS */
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/95 dark:bg-slate-800/95">
                    <th className="p-3.5 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 w-1/4">
                      Respawn Especial
                    </th>
                    <th className="p-3.5 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Todos os Horários do Dia (Ocupados e Livres - Clique para reservar/gerenciar)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredRespawns.map(respawn => {
                    const respawnTimeSlots = getDeduplicatedPlanilhadoSlots(respawn, selectedDay);

                    return (
                      <tr key={respawn} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Respawn name & badge */}
                        <td className="p-3.5 align-top">
                          <span className="text-xs font-black text-slate-900 dark:text-white block">
                            {respawn}
                          </span>
                          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 block">
                            {respawnTimeSlots.length} Horários no Dia
                          </span>
                        </td>

                        {/* List of ALL Time Slots with Player/Free Status */}
                        <td className="p-3.5 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            {respawnTimeSlots.map(time => {
                              const res = getReservation(selectedDay, 'planilhados', respawn, time);
                              if (statusFilter === 'free' && res) return null;
                              if (statusFilter === 'reserved' && !res) return null;

                              const isOwner = checkIsOwner(res);
                              const canSeeDetails = checkCanSeeDetails(res);

                              return (
                                <button
                                  key={time}
                                  onClick={() => handleCellClick(respawn, time)}
                                  className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                                    res
                                      ? isOwner
                                        ? 'bg-blue-100/80 border-blue-400 text-blue-950 dark:bg-blue-950/80 dark:border-blue-600 dark:text-blue-100 shadow-2xs'
                                        : 'bg-blue-50/90 border-blue-200 text-blue-950 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-100 shadow-2xs'
                                      : 'bg-emerald-50/80 border-emerald-300 text-emerald-950 hover:border-emerald-500 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200 shadow-2xs'
                                  }`}
                                >
                                  <span className={`font-mono font-bold px-2 py-0.5 rounded border text-[11px] ${
                                    res ? 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-700' : 'bg-white/90 dark:bg-slate-900/90 border-emerald-200 dark:border-emerald-800'
                                  }`}>
                                    {time}
                                  </span>

                                  {res ? (
                                    canSeeDetails ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-blue-900 dark:text-blue-200">
                                          {res.charName}
                                        </span>
                                        {res.userRank && (
                                          <span className={`text-[8px] font-black px-1 rounded ${RANK_METADATA[res.userRank]?.badgeClass || ''}`}>
                                            {res.userRank[0]}
                                          </span>
                                        )}
                                        {res.notes && (
                                          <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                                            ({res.notes.replace('Horário Planilhado: ', '')})
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1 text-[11px]">
                                        <Lock className="h-3 w-3 text-slate-400" />
                                        Ocupado
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-emerald-700 dark:text-emerald-400 font-extrabold flex items-center gap-0.5 text-[11px]">
                                      <Plus className="h-3 w-3 text-emerald-600" />
                                      LIVRE
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* STANDARD GRID FOR NORMAL & 3H RESPAWNS */
            <>
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

              {/* Table Container scrollable inside card with sticky top headers and left column */}
              <div
                ref={tableScrollRef}
                className="w-full max-w-full max-h-[72vh] overflow-auto touch-pan-x touch-pan-y scroll-smooth relative"
              >
                <table className="w-full text-left border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/95 dark:bg-slate-800/95">
                      {/* Sticky Top-Left Corner (Respawn Column Header) */}
                      <th className="sticky top-0 left-0 z-40 min-w-[180px] sm:min-w-[210px] max-w-[230px] p-3 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border-r border-b border-slate-200 dark:border-slate-700 shadow-[2px_2px_4px_-1px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-between">
                          <span>Respawn</span>
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 lowercase">
                            {filteredRespawns.length} locais
                          </span>
                        </div>
                      </th>
                      {activeTimeSlots.map(time => (
                        <th
                          key={time}
                          className="sticky top-0 z-30 min-w-[105px] sm:min-w-[115px] p-2.5 text-center text-[11px] font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap bg-slate-100/95 dark:bg-slate-800/95 border-b border-slate-200 dark:border-slate-700 backdrop-blur-sm"
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
                        {/* Respawn Name Column (Sticky left) */}
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

                          const isOwner = checkIsOwner(res);
                          const canSeeDetails = checkCanSeeDetails(res);

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
                                          className={`text-[8px] font-black px-1 rounded shrink-0 ${
                                            RANK_METADATA[res.userRank]?.badgeClass || ''
                                          }`}
                                        >
                                          {res.userRank[0]}
                                        </span>
                                      )}
                                    </div>
                                    {res.notes ? (
                                      <p className="truncate text-[8.5px] font-bold text-blue-800 dark:text-blue-200 mt-0.5" title={res.notes}>
                                        📌 {res.notes.replace('Horário Planilhado: ', '')}
                                      </p>
                                    ) : res.partyMembers ? (
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
            </>
          )}
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
          hidePartySharing={true}
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
          }}
        />
      )}
    </div>
  );
};
