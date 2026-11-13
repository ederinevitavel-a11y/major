import React, { useState } from 'react';
import { Reservation, HuntDay, SlotType, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { setReservation, deleteReservation, updateUserProfile } from '../services/firestoreService';
import { RANK_METADATA, getCanonicalPlayerName } from '../constants/guildData';
import {
  X,
  Clock,
  MapPin,
  User,
  FileText,
  Check,
  Loader2,
  Lock,
  Users,
  Search,
  Trash2,
} from 'lucide-react';

interface ReservationModalProps {
  day: HuntDay;
  slotType: SlotType;
  respawnName: string;
  timeSlot: string;
  existingReservation?: Reservation;
  usersList: UserProfile[];
  onClose: () => void;
  hidePartySharing?: boolean;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  day,
  slotType,
  respawnName,
  timeSlot,
  existingReservation,
  usersList,
  onClose,
  hidePartySharing = false,
}) => {
  const { userProfile, isAdmin, currentUser, refreshProfile } = useAuth();
  const [notes, setNotes] = useState(existingReservation?.notes || '');
  const [selectedUserUid, setSelectedUserUid] = useState(
    existingReservation?.userUid || userProfile?.uid || ''
  );
  const [selectedPartyUids, setSelectedPartyUids] = useState<string[]>(
    existingReservation?.partyMemberUids || []
  );
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = Boolean(
    existingReservation && currentUser && (
      existingReservation.userUid === currentUser.uid ||
      (userProfile?.charName && existingReservation.charName && (
        existingReservation.charName.trim().toLowerCase() === userProfile.charName.trim().toLowerCase() ||
        getCanonicalPlayerName(existingReservation.charName).toLowerCase() === userProfile.charName.trim().toLowerCase()
      ))
    )
  );
  const isLeader = userProfile?.rank === 'Leader';
  const canBookRespawn = isAdmin || isLeader;
  const canModify = isAdmin || isOwner;

  const canSeeDetails = Boolean(
    isAdmin ||
    isOwner ||
    existingReservation?.isPublicVisibility === true ||
    (currentUser && existingReservation?.partyMemberUids?.includes(currentUser.uid)) ||
    (currentUser && usersList.some(u => 
      (u.uid === existingReservation?.userUid ||
        (existingReservation?.charName && u.charName && (
          u.charName.trim().toLowerCase() === existingReservation.charName.trim().toLowerCase() ||
          u.charName.trim().toLowerCase() === getCanonicalPlayerName(existingReservation.charName).toLowerCase()
        ))) &&
      u.sharedWith &&
      (u.sharedWith.includes('all') || u.sharedWith.includes(currentUser.uid))
    ))
  );

  const handleDelete = async () => {
    if (!existingReservation) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteReservation(existingReservation.id);
      onClose();
    } catch (err) {
      console.error('Erro ao excluir marcação:', err);
      setError('Falha ao excluir marcação. Verifique suas permissões.');
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePartyMember = (uid: string) => {
    if (selectedPartyUids.includes(uid)) {
      setSelectedPartyUids(selectedPartyUids.filter(id => id !== uid));
    } else {
      setSelectedPartyUids([...selectedPartyUids, uid]);
    }
  };

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

      const sharedUserNames = usersList
        .filter(u => selectedPartyUids.includes(u.uid))
        .map(u => u.charName)
        .join(', ');

      const newReservation: Reservation = {
        id: reservationId,
        day,
        slotType,
        timeSlot,
        respawnName,
        charName: reservingUser.charName,
        userUid: reservingUser.uid,
        userRank: reservingUser.rank,
        partyMembers: sharedUserNames,
        partyMemberUids: selectedPartyUids,
        notes: notes.trim() || '',
        reservedAt: existingReservation?.reservedAt || new Date().toISOString(),
      };

      await setReservation(newReservation);

      // Automatically ensure sharedWith includes selected party members for the owner
      if (reservingUser.uid === userProfile?.uid && selectedPartyUids.length > 0) {
        const currentShared = userProfile?.sharedWith || [];
        const newShared = Array.from(new Set([...currentShared, ...selectedPartyUids]));
        if (newShared.length !== currentShared.length) {
          await updateUserProfile(userProfile.uid, { sharedWith: newShared });
          await refreshProfile();
        }
      }

      onClose();
    } catch (err) {
      console.error(err);
      setError('Erro ao salvar a reserva. Verifique suas permissões.');
    } finally {
      setSubmitting(false);
    }
  };


  const dayNames: Record<HuntDay, string> = {
    friday: 'Sexta-feira',
    saturday: 'Sábado',
    sunday: 'Domingo',
  };

  // Other users available for hunt party
  const activeReservingUid = isAdmin ? selectedUserUid : (userProfile?.uid || '');
  const otherUsersForHunt = usersList.filter(u => u.uid !== activeReservingUid);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white p-4 sm:p-6 pb-safe shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all scrollbar-thin animate-in slide-in-from-bottom duration-200">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
        {/* Top bar */}
        <div className="flex items-center justify-between pb-3.5 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 shrink-0">
              <MapPin className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {!existingReservation
                  ? isAdmin
                    ? 'Marcação de Respawn (Admin)'
                    : 'Reservar Horário de Hunt'
                  : 'Compartilhar Horário / Party'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {dayNames[day]} • {timeSlot}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-2 sm:p-1.5 rounded-xl sm:rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Respawn title banner */}
        <div className="my-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Respawn Selecionado</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">{respawnName}</span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase">
            {slotType === '3h' ? '3 Horas' : 'Normal'}
          </span>
        </div>

        {/* Unauthorized restriction notice for regular members attempting new booking */}
        {!existingReservation && !canBookRespawn && (
          <div className="py-6 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center mx-auto">
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
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
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
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm sm:text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

            {/* Include Hunt Party Members */}
            {!hidePartySharing && (
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-blue-600" />
                    <span>Compartilhar Horário com a Party</span>
                  </span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold lowercase">
                    {selectedPartyUids.length} selecionado(s)
                  </span>
                </label>

                {/* Search input with magnifying glass */}
                <div className="relative">
                  <input
                    type="text"
                    value={partySearchQuery}
                    onChange={e => setPartySearchQuery(e.target.value)}
                    placeholder="Pesquisar jogador por nome ou vocação..."
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 pl-9 text-sm sm:text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-3.5 sm:w-3.5 text-slate-400" />
                </div>

                <div className="max-h-44 overflow-y-auto space-y-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                  {(() => {
                    const filtered = otherUsersForHunt.filter(u => {
                      if (!partySearchQuery.trim()) return true;
                      const q = partySearchQuery.toLowerCase();
                      return (
                        u.charName.toLowerCase().includes(q) ||
                        u.guildName.toLowerCase().includes(q) ||
                        (u.vocation || '').toLowerCase().includes(q)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-4 text-xs text-slate-400 italic">
                          Nenhum jogador encontrado com este termo.
                        </div>
                      );
                    }

                    return filtered
                      .slice()
                      .sort((a, b) => a.charName.localeCompare(b.charName))
                      .map(u => {
                        const isSelected = selectedPartyUids.includes(u.uid);
                        const rankMeta = RANK_METADATA[u.rank];
                        return (
                          <div
                            key={u.uid}
                            onClick={() => togglePartyMember(u.uid)}
                            className={`flex items-center justify-between min-h-[44px] p-2.5 sm:p-2 rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`flex h-6 w-6 items-center justify-center rounded-md font-bold text-[10px] border shrink-0 ${rankMeta?.badgeClass || 'bg-slate-100 text-slate-800'}`}>
                                {u.charName.slice(0, 2).toUpperCase()}
                              </span>
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {u.charName} <span className="text-[10px] text-slate-400 font-normal">({u.vocation || u.guildName})</span>
                              </span>
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="h-5 w-5 sm:h-4 sm:w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                            />
                          </div>
                        );
                      });
                  })()}
                </div>
                <p className="text-[10px] text-slate-400">
                  Jogadores selecionados verão esta hunt automaticamente em seus **Respaws da Party**.
                </p>
              </div>
            )}

            {/* Observações / Metas */}
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
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-3.5 pr-9 py-2.5 text-sm sm:text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <FileText className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                {error}
              </div>
            )}

            <div className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
              {existingReservation && (canModify || isAdmin) ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={submitting || isDeleting}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 min-h-[44px] py-2.5 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/30 text-xs font-bold transition-all cursor-pointer"
                  title="Excluir marcação de respawn"
                >
                  {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  <span>Excluir Marcação</span>
                </button>
              ) : <div className="hidden sm:block" />}

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 min-h-[44px] py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || isDeleting}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 min-h-[44px] py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
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
          <div className="py-6 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 flex items-center justify-center mx-auto">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                Horário Ocupado
              </h4>
              {canSeeDetails && existingReservation.charName ? (
                <div className="mt-3 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-950 dark:text-blue-200 text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-500 dark:text-slate-400">Jogador no Respawn:</span>
                    <span className="font-black text-blue-700 dark:text-blue-300 text-sm">{existingReservation.charName}</span>
                  </div>
                  {existingReservation.userRank && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-slate-500 dark:text-slate-400">Patente:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{existingReservation.userRank}</span>
                    </div>
                  )}
                  {existingReservation.partyMembers && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-slate-500 dark:text-slate-400">Party:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{existingReservation.partyMembers}</span>
                    </div>
                  )}
                  {existingReservation.notes && (
                    <div className="mt-2 pt-2 border-t border-blue-200/60 dark:border-blue-800/60 text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                      📌 {existingReservation.notes}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
                  Este respawn já está reservado para este horário. Os nomes dos jogadores são privados para membros comuns e apenas ficam visíveis caso o jogador faça a liberação através do <strong>botão de visibilidade</strong>.
                </p>
              )}
            </div>

            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
