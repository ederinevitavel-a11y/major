import React, { useState } from 'react';
import { Reservation, HuntDay, SlotType, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { setReservation, deleteReservation } from '../services/firestoreService';
import { RANK_METADATA } from '../constants/guildData';
import {
  X,
  Clock,
  MapPin,
  User,
  FileText,
  Trash2,
  Check,
  Loader2,
  Lock,
} from 'lucide-react';

interface ReservationModalProps {
  day: HuntDay;
  slotType: SlotType;
  respawnName: string;
  timeSlot: string;
  existingReservation?: Reservation;
  usersList: UserProfile[];
  onClose: () => void;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  day,
  slotType,
  respawnName,
  timeSlot,
  existingReservation,
  usersList,
  onClose,
}) => {
  const { userProfile, isAdmin, currentUser } = useAuth();
  const [notes, setNotes] = useState(existingReservation?.notes || '');
  const [selectedUserUid, setSelectedUserUid] = useState(
    existingReservation?.userUid || userProfile?.uid || ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = Boolean(existingReservation && currentUser && existingReservation.userUid === currentUser.uid);
  const isLeader = userProfile?.rank === 'Leader';
  const canBookRespawn = isAdmin || isLeader;
  const canModify = isAdmin || isOwner;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!existingReservation && !canBookRespawn) {
      setError('Apenas administradores e jogadores definidos como Leader possuem permissão para escolher respawns.');
      setSubmitting(false);
      return;
    }

    // Anti-phishing / PII protection: block emails from being saved in public reservation fields
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    if (emailPattern.test(notes)) {
      setError('Por segurança e proteção contra spam, não é permitido inserir endereços de e-mail nas observações.');
      setSubmitting(false);
      return;
    }

    try {
      let reservingUser: UserProfile | null = null;

      if (isAdmin) {
        if (!selectedUserUid) {
          setError('Selecione um personagem para atribuir este respawn.');
          setSubmitting(false);
          return;
        }
        reservingUser = usersList.find(u => u.uid === selectedUserUid) || (selectedUserUid === userProfile?.uid ? userProfile : null);
        if (!reservingUser) {
          throw new Error('Usuário selecionado inválido.');
        }
      } else {
        reservingUser = userProfile;
      }

      if (!reservingUser) {
        throw new Error('Usuário inválido para a reserva.');
      }

      const reservationId = `${day}_${respawnName.replace(/[^a-zA-Z0-9]/g, '-')}_${timeSlot.replace(/[^a-zA-Z0-9]/g, '-')}`;

      const newReservation: Reservation = {
        id: reservationId,
        day,
        slotType,
        timeSlot,
        respawnName,
        charName: reservingUser.charName,
        userUid: reservingUser.uid,
        userRank: reservingUser.rank,
        partyMembers: '',
        notes: notes.trim() || '',
        reservedAt: existingReservation?.reservedAt || new Date().toISOString(),
      };

      await setReservation(newReservation);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Erro ao salvar a reserva. Verifique suas permissões.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingReservation) return;
    if (!window.confirm('Tem certeza que deseja cancelar e liberar este respawn?')) return;

    setSubmitting(true);
    try {
      await deleteReservation(existingReservation.id);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Falha ao cancelar reserva.');
      setSubmitting(false);
    }
  };

  const dayNames: Record<HuntDay, string> = {
    friday: 'Sexta-feira',
    saturday: 'Sábado',
    sunday: 'Domingo',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all scrollbar-thin">
        {/* Top bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {!existingReservation
                  ? isAdmin
                    ? 'Marcação de Respawn (Admin)'
                    : canBookRespawn
                    ? 'Reservar Respawn da Guild'
                    : 'Reserva Restrita (Apenas Líderes)'
                  : canModify
                  ? isOwner && !isAdmin
                    ? 'Sua Reserva de Respawn'
                    : 'Gerenciar Reserva (Admin)'
                  : 'Horário Ocupado'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {dayNames[day]} • {slotType === '3h' ? 'Escala Especial 3h' : 'Escala Normal'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Slot Overview Badge */}
        <div className="my-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
              Respawn
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {respawnName}
            </span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
              Horário
            </span>
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 justify-end">
              <Clock className="h-3.5 w-3.5" />
              {timeSlot}
            </span>
          </div>
        </div>

        {/* Existing booking info: Only visible if admin or reservation owner */}
        {existingReservation && canModify && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isOwner && !isAdmin ? 'Reservado por você:' : 'Reservado por:'}
                </span>
                <strong className="text-sm font-bold text-slate-900 dark:text-white">
                  {existingReservation.charName}
                </strong>
              </div>
              {existingReservation.userRank && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                    RANK_METADATA[existingReservation.userRank]?.badgeClass || ''
                  }`}
                >
                  {existingReservation.userRank}
                </span>
              )}
            </div>
            {existingReservation.notes && (
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                <strong>Obs:</strong> {existingReservation.notes}
              </div>
            )}
          </div>
        )}

        {/* Existing booking privacy banner: For regular members who do not own the slot */}
        {existingReservation && !canModify && (
          <div className="my-4 rounded-2xl border border-slate-200 bg-slate-50/90 p-5 dark:border-slate-800 dark:bg-slate-800/40 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300 mb-3 shadow-2xs">
              <Lock className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Horário Ocupado
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
              Este respawn já foi reservado por outro membro da guild. Por segurança e privacidade dos jogadores, a identidade de quem reservou fica restrita à administração.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/70 dark:bg-slate-700/60 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <Clock className="h-3 w-3 text-slate-500" />
              <span>Por favor, selecione outro horário vago</span>
            </div>
          </div>
        )}

        {/* Restriction banner: When slot is empty but user is neither Admin nor Leader */}
        {!existingReservation && !canBookRespawn && (
          <div className="my-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/40 dark:bg-amber-950/20 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 mb-3 shadow-2xs">
              <Lock className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
              Reserva Exclusiva para Líderes
            </h4>
            <p className="text-xs text-amber-900/90 dark:text-amber-300/90 mt-2 max-w-sm mx-auto leading-relaxed">
              Neste sistema, apenas membros definidos com a patente <strong>Leader</strong> ou <strong>Administradores</strong> possuem permissão para escolher e alocar respawns.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100/80 dark:bg-amber-900/40 text-[11px] font-semibold text-amber-950 dark:text-amber-200 text-left">
              <Clock className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <span>O respawn para os demais jogadores será marcado pelo Administrador.</span>
            </div>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                Entendi, Fechar
              </button>
            </div>
          </div>
        )}

        {/* Form: Only visible if authorized to reserve or authorized to modify existing */}
        {((!existingReservation && canBookRespawn) || (existingReservation && canModify)) && (
          <form onSubmit={handleSave} className="space-y-4">
            {!existingReservation && isLeader && !isAdmin && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-300">
                <span className="font-bold">⭐ Patente Leader:</span>
                <span>Você está reservando este respawn para sua equipe com permissão de liderança.</span>
              </div>
            )}

            {/* Character Selection for Admin */}
            {isAdmin ? (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Personagem para Reserva
                </label>
                <select
                  value={selectedUserUid}
                  onChange={e => setSelectedUserUid(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {usersList
                    .slice()
                    .sort((a, b) => a.charName.localeCompare(b.charName))
                    .map(u => (
                      <option key={u.uid} value={u.uid}>
                        {u.charName} ({u.guildName}) • {u.rank}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              userProfile && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-slate-500 dark:text-slate-400">Reservando com:</span>
                    <strong className="text-slate-900 dark:text-white font-bold">{userProfile.charName}</strong>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                      RANK_METADATA[userProfile.rank]?.badgeClass || ''
                    }`}
                  >
                    {userProfile.rank}
                  </span>
                </div>
              )
            )}

            {/* Observações / Metas (Party removed as requested) */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Observações / Metas
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: Teste de hunt duo, questline, ou foco em loot..."
                  maxLength={180}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <FileText className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                {error}
              </div>
            )}

            <div className="pt-3 flex items-center justify-between gap-3">
              {existingReservation && canModify && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/30 text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Liberar Slot
                </button>
              )}

              <div className="flex-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  {existingReservation ? 'Salvar Alterações' : 'Confirmar Reserva'}
                </button>
              </div>
            </div>
          </form>
        )}

        {existingReservation && !canModify && (
          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
