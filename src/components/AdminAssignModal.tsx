import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, Reservation, HuntDay, SlotType, CustomRespawn } from '../types';
import {
  DAYS_CONFIG,
  NORMAL_RESPAWNS,
  NORMAL_TIME_SLOTS,
  THREE_HOUR_RESPAWNS,
  THREE_HOUR_TIME_SLOTS,
  PLANILHADOS_RESPAWNS,
  PLANILHADOS_SLOTS_MAP,
  PLANILHADOS_SLOTS_BY_DAY,
  RANK_METADATA,
} from '../constants/guildData';
import { setReservation, deleteReservation, isUserOnline } from '../services/firestoreService';
import {
  X,
  MapPin,
  Check,
  Trash2,
  AlertCircle,
  Loader2,
  Users,
  Shield,
  Search,
  UserCheck,
} from 'lucide-react';

interface AdminAssignModalProps {
  isOpen: boolean;
  targetUser?: UserProfile | null;
  usersList: UserProfile[];
  reservations: Reservation[];
  customRespawns?: CustomRespawn[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const AdminAssignModal: React.FC<AdminAssignModalProps> = ({
  isOpen,
  targetUser,
  usersList = [],
  reservations = [],
  customRespawns = [],
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  // Selected User state
  const [selectedUserUid, setSelectedUserUid] = useState<string>(
    targetUser?.uid || usersList[0]?.uid || ''
  );
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  // When targetUser changes, keep in sync
  useEffect(() => {
    if (targetUser?.uid) {
      setSelectedUserUid(targetUser.uid);
    } else if (!selectedUserUid && usersList.length > 0) {
      setSelectedUserUid(usersList[0].uid);
    }
  }, [targetUser, usersList]);

  const activeUser = useMemo(() => {
    return usersList.find(u => u.uid === selectedUserUid) || targetUser || null;
  }, [usersList, selectedUserUid, targetUser]);

  const filteredUsers = useMemo(() => {
    if (!playerSearchQuery.trim()) return usersList;
    const q = playerSearchQuery.toLowerCase();
    return usersList.filter(
      u =>
        u.charName.toLowerCase().includes(q) ||
        (u.guildName && u.guildName.toLowerCase().includes(q)) ||
        (u.vocation && u.vocation.toLowerCase().includes(q)) ||
        u.rank.toLowerCase().includes(q)
    );
  }, [usersList, playerSearchQuery]);

  const [selectedDay, setSelectedDay] = useState<HuntDay>('friday');
  const [slotType, setSlotType] = useState<SlotType>('normal');
  const [selectedRespawn, setSelectedRespawn] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [customTimeInput, setCustomTimeInput] = useState<string>('');
  const [useCustomTime, setUseCustomTime] = useState<boolean>(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Build respawn lists including custom hunts
  const normalRespawnsList = useMemo(() => {
    const customNormal = customRespawns.filter(c => c.type === 'normal').map(c => c.name);
    return Array.from(new Set([...NORMAL_RESPAWNS, ...customNormal])).sort((a, b) => a.localeCompare(b));
  }, [customRespawns]);

  const specialRespawnsList = useMemo(() => {
    const custom3h = customRespawns.filter(c => c.type === '3h').map(c => c.name);
    return Array.from(new Set([...PLANILHADOS_RESPAWNS, ...THREE_HOUR_RESPAWNS, ...custom3h])).sort((a, b) => a.localeCompare(b));
  }, [customRespawns]);

  const activeRespawns = slotType === 'normal' ? normalRespawnsList : specialRespawnsList;

  // Build time slots list
  const activeTimeSlots = useMemo(() => {
    if (slotType === 'normal') {
      return NORMAL_TIME_SLOTS;
    }
    // Check if respawn has specific pre-configured slots in PLANILHADOS_SLOTS_BY_DAY or PLANILHADOS_SLOTS_MAP
    const preconfigured =
      PLANILHADOS_SLOTS_BY_DAY[selectedRespawn]?.[selectedDay] ||
      PLANILHADOS_SLOTS_MAP[selectedRespawn];
    if (preconfigured && preconfigured.length > 0) {
      return preconfigured;
    }
    return THREE_HOUR_TIME_SLOTS.length > 0 ? THREE_HOUR_TIME_SLOTS : NORMAL_TIME_SLOTS;
  }, [slotType, selectedRespawn, selectedDay]);

  // Set initial selected respawn and time slot when switching slot type or list
  useEffect(() => {
    if (!activeRespawns.includes(selectedRespawn)) {
      setSelectedRespawn(activeRespawns[0] || '');
    }
  }, [slotType, activeRespawns]);

  useEffect(() => {
    if (!activeTimeSlots.includes(selectedTimeSlot)) {
      setSelectedTimeSlot(activeTimeSlots[0] || '');
    }
  }, [activeTimeSlots]);

  // Existing reservations belonging to this target user
  const userReservations = useMemo(() => {
    if (!activeUser) return [];
    return reservations.filter(r => r.userUid === activeUser.uid);
  }, [reservations, activeUser]);

  // Check slot occupancy in real time
  const getSlotOccupant = (day: HuntDay, type: SlotType, respawn: string, time: string) => {
    return reservations.find(
      r => r.day === day && r.respawnName.toLowerCase() === respawn.toLowerCase() && r.timeSlot === time
    );
  };

  const finalTimeSlot = useCustomTime && customTimeInput.trim() ? customTimeInput.trim() : selectedTimeSlot;

  const currentSlotOccupant = useMemo(() => {
    if (!selectedRespawn || !finalTimeSlot) return null;
    return getSlotOccupant(selectedDay, slotType, selectedRespawn, finalTimeSlot);
  }, [selectedDay, slotType, selectedRespawn, finalTimeSlot, reservations]);

  const isOnline = activeUser ? isUserOnline(activeUser) : false;
  const rankMeta = activeUser ? RANK_METADATA[activeUser.rank] : null;

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser) {
      setError('Selecione um jogador para atribuir o respawn.');
      return;
    }

    if (!selectedRespawn) {
      setError('Selecione o local de respawn.');
      return;
    }

    if (!finalTimeSlot) {
      setError('Selecione ou digite o horário desejado.');
      return;
    }

    // Anti-phishing / PII check
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    if (emailPattern.test(notes)) {
      setError('Por segurança, não insira endereços de e-mail nas observações.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const reservationId = `${selectedDay}_${selectedRespawn.replace(/[^a-zA-Z0-9]/g, '-')}_${finalTimeSlot.replace(/[^a-zA-Z0-9]/g, '-')}`;

      const newReservation: Reservation = {
        id: reservationId,
        day: selectedDay,
        slotType: slotType === 'normal' ? 'normal' : 'planilhados',
        timeSlot: finalTimeSlot,
        respawnName: selectedRespawn,
        charName: activeUser.charName,
        userUid: activeUser.uid,
        userRank: activeUser.rank,
        partyMembers: '',
        notes: notes.trim() || '',
        reservedAt: new Date().toISOString(),
      };

      await setReservation(newReservation);
      onSuccess(`Respawn ${selectedRespawn} (${finalTimeSlot}) cadastrado com sucesso para ${activeUser.charName}!`);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Erro ao salvar a reserva. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReservation = async (resId: string, respawnTitle: string) => {
    setDeletingId(resId);
    try {
      await deleteReservation(resId);
      onSuccess(`Horário de ${respawnTitle} liberado com sucesso.`);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error(err);
      setError('Falha ao liberar horário.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-0 sm:my-6 animate-in slide-in-from-bottom duration-200 pb-safe">
        {/* Modal Header */}
        <div className="pt-3 sm:pt-5 px-4 sm:px-5 pb-3.5 sm:pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/80 via-white to-slate-50 dark:from-slate-800/80 dark:via-slate-900 dark:to-slate-800/50 shrink-0">
          <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 shrink-0">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                    Cadastrar & Atribuir Respawn
                  </h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Major
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {activeUser
                    ? `Alocando para ${activeUser.charName} (Lv ${activeUser.level} • ${activeUser.vocation})`
                    : 'Escolha um jogador e atribua o respawn'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 flex-1 overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Player Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                1. Membro da Guilda / Jogador
              </label>
              {activeUser && (
                <div className="flex items-center gap-2">
                  {isOnline ? (
                    <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Online
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                      Offline
                    </span>
                  )}
                  {rankMeta && (
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${rankMeta.badgeClass}`}>
                      {activeUser.rank}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Quick search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={playerSearchQuery}
                onChange={e => setPlayerSearchQuery(e.target.value)}
                placeholder="Filtrar membro por nome, vocação ou rank..."
                className="w-full min-h-[44px] sm:min-h-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 pl-9 pr-3.5 py-2 text-sm sm:text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Player dropdown */}
            <select
              value={selectedUserUid}
              onChange={e => setSelectedUserUid(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm sm:text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {filteredUsers.map(user => {
                const online = isUserOnline(user);
                return (
                  <option key={user.uid} value={user.uid}>
                    {user.charName} — Lv {user.level} {user.vocation} [{user.rank}] {online ? '(Online)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Current user reservations list */}
          {activeUser && userReservations.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3.5 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Horários Atuais de {activeUser.charName} ({userReservations.length}):
              </p>
              <div className="space-y-1.5">
                {userReservations.map(res => (
                  <div
                    key={res.id}
                    className="flex items-center justify-between gap-2 p-2.5 sm:p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-xs"
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shrink-0">
                        {res.day === 'friday' ? 'SEX' : res.day === 'saturday' ? 'SÁB' : 'DOM'}
                      </span>
                      <strong className="text-slate-900 dark:text-white font-bold truncate">
                        {res.respawnName}
                      </strong>
                      <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] tabular-nums">
                        {res.timeSlot}
                      </span>
                    </div>

                    {confirmDeleteId === res.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-rose-600 font-bold hidden sm:inline">Confirmar?</span>
                        <button
                          type="button"
                          onClick={() => handleCancelReservation(res.id, res.respawnName)}
                          disabled={deletingId === res.id}
                          className="px-2.5 py-1.5 sm:py-0.5 rounded bg-rose-600 text-white text-[11px] sm:text-[10px] font-bold hover:bg-rose-700"
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px]"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(res.id)}
                        disabled={deletingId === res.id}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
                        title="Liberar este horário"
                      >
                        {deletingId === res.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleAssign} className="space-y-4">
            {/* 2. Day Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                2. Escolha o Dia da Hunt
              </label>
              <div className="grid grid-cols-3 gap-2">
                {DAYS_CONFIG.map(day => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => setSelectedDay(day.key)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      selectedDay === day.key
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div>{day.label}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">{day.shortLabel}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Slot Type */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                3. Categoria do Respawn
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSlotType('normal')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                    slotType === 'normal'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-blue-500'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Respawns Normais (2h)
                </button>
                <button
                  type="button"
                  onClick={() => setSlotType('3h')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                    slotType === '3h'
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shadow-xs ring-1 ring-purple-500'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Respawns Especiais / Planilhados
                </button>
              </div>
            </div>

            {/* 4. Respawn Picker */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                4. Selecione o Respawn ({activeRespawns.length} disponíveis)
              </label>
              <select
                value={selectedRespawn}
                onChange={e => setSelectedRespawn(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm sm:text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {activeRespawns.map(resp => (
                  <option key={resp} value={resp}>
                    {resp}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Time Slot Picker with Occupancy Indicator */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  5. Horário Desejado
                </label>
                <button
                  type="button"
                  onClick={() => setUseCustomTime(!useCustomTime)}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {useCustomTime ? 'Voltar para Pré-definidos' : '+ Horário Personalizado'}
                </button>
              </div>

              {useCustomTime ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={customTimeInput}
                    onChange={e => setCustomTimeInput(e.target.value)}
                    placeholder="Ex: 20:40h – 23:00h ou 14:00h – 16:00h"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm sm:text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Digite o intervalo no formato HH:MMh – HH:MMh.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {activeTimeSlots.map(time => {
                    const occ = getSlotOccupant(selectedDay, slotType, selectedRespawn, time);
                    const isSelected = selectedTimeSlot === time;
                    const isOccupiedByTarget = activeUser && occ && occ.userUid === activeUser.uid;

                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setSelectedTimeSlot(time)}
                        className={`min-h-[50px] p-2.5 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.99] ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
                            : occ
                            ? 'border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/40 text-slate-500'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="text-[11px] font-bold font-mono tabular-nums">{time}</div>
                        <div className="mt-1 flex items-center justify-between text-[10px] truncate">
                          {occ ? (
                            <span className={`font-semibold truncate ${isOccupiedByTarget ? 'text-blue-600 dark:text-blue-400' : 'text-rose-500'}`}>
                              {isOccupiedByTarget ? 'Deste char' : `${occ.charName || 'Ocupado'}`}
                            </span>
                          ) : (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              ● Livre
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Occupancy Warning if slot is already occupied */}
            {currentSlotOccupant && activeUser && currentSlotOccupant.userUid !== activeUser.uid && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-200">
                <span className="font-bold">Aviso de Sobrescrita:</span> Este horário já está reservado por <strong>{currentSlotOccupant.charName || 'outro membro'}</strong>. Ao salvar, a vaga será reatribuída para <strong>{activeUser.charName}</strong>.
              </div>
            )}

            {/* Observações */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Observações / Informações de PT (Opcional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: Escala de Double XP / Party com ED e MS..."
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm sm:text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={submitting || !activeUser}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Confirmar Cadastro de Respawn</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
