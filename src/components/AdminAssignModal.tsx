import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, Reservation, HuntDay, SlotType } from '../types';
import {
  DAYS_CONFIG,
  NORMAL_RESPAWNS,
  NORMAL_TIME_SLOTS,
  THREE_HOUR_RESPAWNS,
  THREE_HOUR_TIME_SLOTS,
  RANK_METADATA,
} from '../constants/guildData';
import { setReservation, deleteReservation, isUserOnline } from '../services/firestoreService';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Check,
  Trash2,
  AlertCircle,
  Loader2,
  Users,
  FileText,
  Sparkles,
  Shield,
} from 'lucide-react';

interface AdminAssignModalProps {
  isOpen: boolean;
  targetUser: UserProfile | null;
  reservations: Reservation[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const AdminAssignModal: React.FC<AdminAssignModalProps> = ({
  isOpen,
  targetUser,
  reservations,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !targetUser) return null;

  const [selectedDay, setSelectedDay] = useState<HuntDay>('friday');
  const [slotType, setSlotType] = useState<SlotType>('normal');
  const [selectedRespawn, setSelectedRespawn] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeRespawns = slotType === 'normal' ? NORMAL_RESPAWNS : THREE_HOUR_RESPAWNS;
  const activeTimeSlots = slotType === 'normal' ? NORMAL_TIME_SLOTS : THREE_HOUR_TIME_SLOTS;

  // Set initial selected respawn and time slot
  useEffect(() => {
    if (!activeRespawns.includes(selectedRespawn)) {
      setSelectedRespawn(activeRespawns[0] || '');
    }
    if (!activeTimeSlots.includes(selectedTimeSlot)) {
      setSelectedTimeSlot(activeTimeSlots[0] || '');
    }
  }, [slotType, activeRespawns, activeTimeSlots]);

  // Existing reservations belonging to this target user
  const userReservations = useMemo(() => {
    return reservations.filter(r => r.userUid === targetUser.uid);
  }, [reservations, targetUser.uid]);

  // Check slot occupancy in real time
  const getSlotOccupant = (day: HuntDay, type: SlotType, respawn: string, time: string) => {
    return reservations.find(
      r => r.day === day && r.slotType === type && r.respawnName === respawn && r.timeSlot === time
    );
  };

  const currentSlotOccupant = useMemo(() => {
    if (!selectedRespawn || !selectedTimeSlot) return null;
    return getSlotOccupant(selectedDay, slotType, selectedRespawn, selectedTimeSlot);
  }, [selectedDay, slotType, selectedRespawn, selectedTimeSlot, reservations]);

  const online = isUserOnline(targetUser);
  const rankMeta = RANK_METADATA[targetUser.rank];

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRespawn || !selectedTimeSlot) {
      setError('Selecione o respawn e o horário desejado.');
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
      const reservationId = `${selectedDay}_${selectedRespawn.replace(/[^a-zA-Z0-9]/g, '-')}_${selectedTimeSlot.replace(/[^a-zA-Z0-9]/g, '-')}`;

      const newReservation: Reservation = {
        id: reservationId,
        day: selectedDay,
        slotType,
        timeSlot: selectedTimeSlot,
        respawnName: selectedRespawn,
        charName: targetUser.charName,
        userUid: targetUser.uid,
        userRank: targetUser.rank,
        partyMembers: '',
        notes: notes.trim() || '',
        reservedAt: new Date().toISOString(),
      };

      await setReservation(newReservation);
      onSuccess(`Respawn ${selectedRespawn} (${selectedTimeSlot}) atribuído com sucesso a ${targetUser.charName}!`);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Erro ao salvar a reserva. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReservation = async (resId: string, respawnTitle: string) => {
    if (!window.confirm(`Tem certeza que deseja desmarcar e liberar o respawn ${respawnTitle}?`)) return;
    setDeletingId(resId);
    try {
      await deleteReservation(resId);
      onSuccess(`Horário de ${respawnTitle} liberado com sucesso.`);
    } catch (err) {
      console.error(err);
      setError('Falha ao liberar horário.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/25">
              <Shield className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Atribuir Respawn para {targetUser.charName}
                </h3>
                {online ? (
                  <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online no App
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    Offline
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Guilda: <strong className="text-slate-700 dark:text-slate-300">{targetUser.guildName}</strong> • Lv {targetUser.level} • {targetUser.vocation}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Target User Info Card */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-black border ${
                  rankMeta?.badgeClass || 'bg-slate-100 text-slate-700'
                }`}
              >
                {targetUser.rank}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Prioridade de escalação da guilda
              </span>
            </div>

            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {userReservations.length === 0
                ? 'Sem horários marcados'
                : `${userReservations.length} horário(s) já reservado(s)`}
            </span>
          </div>

          {/* Current user reservations list */}
          {userReservations.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 p-3.5 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Horários Atuais de {targetUser.charName}:
              </p>
              <div className="space-y-1.5">
                {userReservations.map(res => (
                  <div
                    key={res.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                        {res.day === 'friday' ? 'SEX' : res.day === 'saturday' ? 'SÁB' : 'DOM'}
                      </span>
                      <strong className="text-slate-900 dark:text-white font-bold">
                        {res.respawnName}
                      </strong>
                      <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {res.timeSlot}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCancelReservation(res.id, res.respawnName)}
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
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleAssign} className="space-y-4">
            {/* 1. Day Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                1. Escolha o Dia da Hunt
              </label>
              <div className="grid grid-cols-3 gap-2">
                {DAYS_CONFIG.map(day => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => setSelectedDay(day.key)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      selectedDay === day.key
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div>{day.label}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">{day.shortLabel}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Slot Type */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                2. Categoria do Respawn
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSlotType('normal')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                    slotType === 'normal'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-xs'
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
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Respawns Especiais (3h)
                </button>
              </div>
            </div>

            {/* 3. Respawn Picker */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                3. Selecione o Respawn (Ordem Alfabética)
              </label>
              <select
                value={selectedRespawn}
                onChange={e => setSelectedRespawn(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {activeRespawns.map(resp => (
                  <option key={resp} value={resp}>
                    {resp}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Time Slot Picker with Occupancy Indicator */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                4. Horário Desejado
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {activeTimeSlots.map(time => {
                  const occ = getSlotOccupant(selectedDay, slotType, selectedRespawn, time);
                  const isSelected = selectedTimeSlot === time;
                  const isOccupiedByTarget = occ && occ.userUid === targetUser.uid;

                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setSelectedTimeSlot(time)}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
                          : occ
                          ? 'border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/40 text-slate-500'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="text-[11px] font-bold font-mono">{time}</div>
                      <div className="mt-1 flex items-center justify-between text-[10px]">
                        {occ ? (
                          <span className={`font-semibold ${isOccupiedByTarget ? 'text-blue-600 dark:text-blue-400' : 'text-rose-500'}`}>
                            {isOccupiedByTarget ? 'Deste char' : 'Ocupado'}
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
            </div>

            {/* Occupancy Warning if slot is already occupied */}
            {currentSlotOccupant && currentSlotOccupant.userUid !== targetUser.uid && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-200">
                <span className="font-bold">Aviso de Sobrescrita:</span> Este horário já está reservado por outro membro ({currentSlotOccupant.charName || 'Jogador'}). Como administrador, salvar esta atribuição irá substituir a reserva existente para {targetUser.charName}.
              </div>
            )}

            {/* Observações */}
            <div className="pt-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Observações (Opcional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: Escala de Double XP / Boss..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Confirmar Atribuição</span>
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
