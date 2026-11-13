import React, { useState } from 'react';
import { HuntDay, Reservation } from '../types';
import { clearAllReservations } from '../services/firestoreService';
import { DAYS_CONFIG } from '../constants/guildData';
import { RotateCcw, AlertTriangle, Check, Loader2, X, Calendar, Layers } from 'lucide-react';

interface ResetScheduleModalProps {
  currentDay: HuntDay;
  reservations: Reservation[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

export const ResetScheduleModal: React.FC<ResetScheduleModalProps> = ({
  currentDay,
  reservations,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [resetScope, setResetScope] = useState<'day' | 'all'>('day');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentDayLabel = DAYS_CONFIG.find(d => d.key === currentDay)?.label || currentDay;
  const countCurrentDay = reservations.filter(r => r.day === currentDay).length;
  const countTotal = reservations.length;

  const targetCount = resetScope === 'day' ? countCurrentDay : countTotal;

  const handleConfirmReset = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const removedCount = await clearAllReservations(resetScope === 'day' ? currentDay : undefined);
      if (onSuccess) onSuccess(removedCount);
      onClose();
    } catch (err) {
      console.error('Erro ao reiniciar respawns:', err);
      setError('Falha ao reiniciar respawns. Verifique sua conexão e tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white p-5 sm:p-6 pb-safe shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom duration-200">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 shrink-0">
              <RotateCcw className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Reiniciar Respawns (Admin)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Limpeza em massa e liberação de horários
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="my-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3.5 border border-amber-200/80 dark:border-amber-900/60 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            <strong>Atenção:</strong> Esta ação cancelará as reservas selecionadas e deixará os horários imediatamente <strong>livres</strong> para todos os membros online.
          </div>
        </div>

        {/* Scope Selection */}
        <div className="space-y-2 mb-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5">
            Escolha o Escopo da Liberação:
          </span>

          {/* Option 1: Current Day Only */}
          <label
            onClick={() => setResetScope('day')}
            className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
              resetScope === 'day'
                ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 ring-1 ring-blue-400 dark:ring-blue-700'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name="resetScope"
              checked={resetScope === 'day'}
              onChange={() => setResetScope('day')}
              className="mt-0.5 text-blue-600"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Liberar apenas {currentDayLabel}
                </span>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                  {countCurrentDay} ocupado(s)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Remove apenas os respawns agendados para este dia.
              </p>
            </div>
          </label>

          {/* Option 2: Entire Weekend (All days) */}
          <label
            onClick={() => setResetScope('all')}
            className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
              resetScope === 'all'
                ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/30 text-rose-950 dark:text-rose-100 ring-1 ring-rose-400 dark:ring-rose-800'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name="resetScope"
              checked={resetScope === 'all'}
              onChange={() => setResetScope('all')}
              className="mt-0.5 text-rose-600"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                  Reiniciar Fim de Semana Inteiro
                </span>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200">
                  {countTotal} total ocupado(s)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Limpa todas as reservas de Sexta, Sábado e Domingo de uma só vez.
              </p>
            </div>
          </label>
        </div>

        {error && (
          <div className="mb-3 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmReset}
            disabled={isDeleting || targetCount === 0}
            className={`w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-md cursor-pointer ${
              resetScope === 'all'
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Liberando...</span>
              </>
            ) : (
              <>
                <RotateCcw className="h-3.5 w-3.5" />
                <span>
                  {targetCount === 0
                    ? 'Nenhum respawn para liberar'
                    : `Confirmar e Liberar (${targetCount})`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
