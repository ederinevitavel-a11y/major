import React, { useState, useEffect } from 'react';
import { LfgPost, UserProfile, HuntDay } from '../types';
import { saveLfgPost, deleteLfgPost } from '../services/firestoreService';
import {
  X,
  Swords,
  Phone,
  Clock,
  Calendar,
  Sparkles,
  Shield,
  Zap,
  Target,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface QueroHuntModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  existingPost?: LfgPost | null;
  onSuccess?: (msg: string) => void;
}

export const QueroHuntModal: React.FC<QueroHuntModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  existingPost,
  onSuccess,
}) => {
  const [charName, setCharName] = useState('');
  const [level, setLevel] = useState<number>(0);
  const [vocation, setVocation] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedDays, setSelectedDays] = useState<HuntDay[]>(['friday', 'saturday', 'sunday']);
  const [timeSlots, setTimeSlots] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingPost) {
      setCharName(existingPost.charName || '');
      setLevel(existingPost.level || 0);
      setVocation(existingPost.vocation || '');
      setPhone(existingPost.phone || '');
      setSelectedDays(existingPost.days && existingPost.days.length > 0 ? existingPost.days : ['friday', 'saturday', 'sunday']);
      setTimeSlots(existingPost.timeSlots || '');
      setNotes(existingPost.notes || '');
    } else if (userProfile) {
      setCharName(userProfile.charName || '');
      setLevel(userProfile.level || 0);
      setVocation(userProfile.vocation || 'Elite Knight');
      setPhone('');
      setSelectedDays(['friday', 'saturday', 'sunday']);
      setTimeSlots('Tarde e Noite');
      setNotes('');
    }
    setError(null);
  }, [existingPost, userProfile, isOpen]);

  if (!isOpen) return null;

  const toggleDay = (day: HuntDay) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length === 1) return; // Keep at least one
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handlePhoneChange = (val: string) => {
    // Basic phone formatting
    const digits = val.replace(/\D/g, '');
    let formatted = val;
    if (digits.length <= 11) {
      if (digits.length <= 2) {
        formatted = digits ? `(${digits}` : '';
      } else if (digits.length <= 6) {
        formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      } else if (digits.length <= 10) {
        formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      } else {
        formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
      }
    }
    setPhone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    if (!charName.trim()) {
      setError('Informe o nome do personagem.');
      return;
    }
    if (!level || level <= 0) {
      setError('Informe um level válido.');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 8) {
      setError('Informe um número de telefone/WhatsApp válido com DDD.');
      return;
    }
    if (selectedDays.length === 0) {
      setError('Selecione ao menos um dia disponível.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const postId = existingPost ? existingPost.id : userProfile.uid;

      const postData: LfgPost = {
        id: postId,
        userUid: userProfile.uid,
        charName: charName.trim(),
        level: Number(level),
        vocation: vocation.trim() || userProfile.vocation || 'Elite Knight',
        phone: phone.trim(),
        days: selectedDays,
        timeSlots: timeSlots.trim() || 'Horário flexível',
        notes: notes.trim(),
        rank: userProfile.rank,
        createdAt: existingPost?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveLfgPost(postData);
      if (onSuccess) {
        onSuccess(existingPost ? 'Seu anúncio no Quero Hunt! foi atualizado!' : 'Disponibilidade cadastrada com sucesso no Quero Hunt!');
      }
      onClose();
    } catch (err: unknown) {
      console.error('Erro ao salvar anúncio Quero Hunt:', err);
      setError('Erro ao salvar anúncio. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingPost && !userProfile) return;
    const postId = existingPost ? existingPost.id : userProfile!.uid;

    setDeleting(true);
    setError(null);

    try {
      await deleteLfgPost(postId);
      if (onSuccess) {
        onSuccess('Anúncio removido do Quero Hunt!.');
      }
      onClose();
    } catch (err) {
      console.error('Erro ao remover anúncio:', err);
      setError('Erro ao remover anúncio. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  const quickTimes = [
    'Manhã (06h às 12h)',
    'Tarde (12h às 18h)',
    'Noite (18h às 00h)',
    'Madrugada (00h às 06h)',
    'O dia todo (Rush)',
    'Flexível',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-0 sm:my-6 animate-in slide-in-from-bottom duration-200 pb-safe">
        {/* Top Header Banner */}
        <div className="relative pt-3 sm:pt-6 px-4 sm:px-6 pb-4 sm:pb-6 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white shrink-0">
          <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-white/40 sm:hidden" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-md shrink-0">
                <Swords className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] sm:text-xs uppercase font-black tracking-widest text-amber-200 truncate">
                    Major • Inferno de Double
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight truncate">
                  {existingPost ? 'Editar Disponibilidade' : 'Anunciar no Quero Hunt!'}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 h-9 w-9 sm:h-8 sm:w-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Char Name & Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Nome do Personagem *
              </label>
              <input
                type="text"
                value={charName}
                onChange={e => setCharName(e.target.value)}
                placeholder="Ex: Eder"
                required
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm sm:text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Level *
              </label>
              <input
                type="number"
                value={level || ''}
                onChange={e => setLevel(Number(e.target.value))}
                placeholder="Ex: 550"
                min={1}
                required
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm sm:text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Vocation & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Vocação *
              </label>
              <select
                value={vocation}
                onChange={e => setVocation(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm sm:text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="Elite Knight">🛡️ Elite Knight (EK)</option>
                <option value="Elder Druid">🌿 Elder Druid (ED)</option>
                <option value="Master Sorcerer">⚡ Master Sorcerer (MS)</option>
                <option value="Royal Paladin">🏹 Royal Paladin (RP)</option>
                <option value="Exalted Monk">🧘 Exalted Monk (EM)</option>
                <option value="Knight">🛡️ Knight</option>
                <option value="Druid">🌿 Druid</option>
                <option value="Sorcerer">⚡ Sorcerer</option>
                <option value="Paladin">🏹 Paladin</option>
                <option value="Monk">🧘 Monk</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                WhatsApp / Telefone *
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  placeholder="(11) 99999-9999"
                  required
                  className="w-full min-h-[44px] pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm sm:text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                />
                <Phone className="h-4 w-4 text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Days available */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
              Dias Disponíveis para Caçar *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'friday' as HuntDay, label: 'Sexta-feira', short: 'SEX' },
                { key: 'saturday' as HuntDay, label: 'Sábado', short: 'SÁB' },
                { key: 'sunday' as HuntDay, label: 'Domingo', short: 'DOM' },
              ].map(d => {
                const isSelected = selectedDays.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    className={`min-h-[44px] p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:border-rose-500 dark:text-rose-300 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>{d.short}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slots & Quick Chips */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              Horários de Disponibilidade *
            </label>
            <input
              type="text"
              value={timeSlots}
              onChange={e => setTimeSlots(e.target.value)}
              placeholder="Ex: Tarde e Noite (14:00h às 22:00h)"
              required
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm sm:text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickTimes.map(qt => (
                <button
                  key={qt}
                  type="button"
                  onClick={() => {
                    if (timeSlots.includes(qt)) return;
                    setTimeSlots(prev => prev ? `${prev}, ${qt}` : qt);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] sm:text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer whitespace-nowrap"
                >
                  + {qt}
                </button>
              ))}
            </div>
          </div>

          {/* Notes / Desired respawns */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              Observação / Preferência de Respawns (Opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Procuro ED para duo ou x4 completo. Foco em rushar XP na Putrefactory / Jaded."
              maxLength={160}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm sm:text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
            {existingPost ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span>Excluir Anúncio</span>
              </button>
            ) : (
              <div className="hidden sm:block" />
            )}

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || deleting}
                className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white text-xs font-black shadow-lg shadow-red-500/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Swords className="h-4 w-4" />
                    <span>{existingPost ? 'Salvar Alterações' : 'Publicar no Quero Hunt!'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
