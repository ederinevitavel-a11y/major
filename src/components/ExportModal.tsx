import React, { useState } from 'react';
import { Reservation, HuntDay, SlotType } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  DAYS_CONFIG,
  NORMAL_RESPAWNS,
  NORMAL_TIME_SLOTS,
  THREE_HOUR_RESPAWNS,
  THREE_HOUR_TIME_SLOTS,
} from '../constants/guildData';
import { Share2, Copy, Check, X, Shield, Lock } from 'lucide-react';

interface ExportModalProps {
  reservations: Reservation[];
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  reservations,
  onClose,
}) => {
  const { isAdmin, currentUser } = useAuth();
  const [selectedDay, setSelectedDay] = useState<HuntDay | 'all'>('friday');
  const [copied, setCopied] = useState(false);

  const formatSlotLine = (s: Reservation) => {
    const isOwner = Boolean(currentUser && s.userUid === currentUser.uid);
    if (isAdmin) {
      return `  ⏰ ${s.timeSlot}: ${s.charName} [${s.userRank}]${s.partyMembers ? ` (Party: ${s.partyMembers})` : ''}\n`;
    }
    if (isOwner) {
      return `  ⏰ ${s.timeSlot}: ${s.charName} (Você)${s.partyMembers ? ` (Party: ${s.partyMembers})` : ''}\n`;
    }
    return `  ⏰ ${s.timeSlot}: [Ocupado]\n`;
  };

  const generateExportText = () => {
    let output = `🏰 *ESCALA DE RESPAWNS - MAJOR GUILD* 🏰\n`;
    output += `📅 Atualizado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n`;
    if (!isAdmin) {
      output += `🔒 Modo Protegido: Nomes de terceiros ocultados por privacidade\n`;
    }
    output += `-------------------------------------------\n\n`;

    const daysToExport = selectedDay === 'all' ? (['friday', 'saturday', 'sunday'] as HuntDay[]) : [selectedDay];

    daysToExport.forEach(day => {
      const dayConfig = DAYS_CONFIG.find(d => d.key === day);
      output += `📅 *${dayConfig?.label.toUpperCase()}*\n\n`;

      // 1. Respawns Especiais 3h
      const day3h = reservations.filter(r => r.day === day && r.slotType === '3h');
      if (day3h.length > 0) {
        output += `⚡ *RESPAWNS ESPECIAIS (3H):*\n`;
        THREE_HOUR_RESPAWNS.forEach(respawn => {
          const bookedSlots = day3h.filter(r => r.respawnName === respawn);
          if (bookedSlots.length > 0) {
            output += `📍 *${respawn}*:\n`;
            bookedSlots.forEach(s => {
              output += formatSlotLine(s);
            });
          }
        });
        output += `\n`;
      }

      // 2. Respawns Normais
      const dayNormal = reservations.filter(r => r.day === day && r.slotType === 'normal');
      output += `🛡️ *RESPAWNS NORMAIS:*\n`;
      NORMAL_RESPAWNS.forEach(respawn => {
        const bookedSlots = dayNormal.filter(r => r.respawnName === respawn);
        if (bookedSlots.length > 0) {
          output += `📍 *${respawn}*:\n`;
          bookedSlots.forEach(s => {
            output += formatSlotLine(s);
          });
        }
      });

      output += `\n===========================================\n\n`;
    });

    output += `🔗 Acesse o painel Major para gerenciar suas reservas!`;
    return output;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generateExportText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Share2 className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Exportar Escala de Respawns
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Formato pronto para compartilhar no WhatsApp e Discord da guild.
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

        {/* Day selection and privacy status */}
        <div className="my-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Filtrar dia:</span>
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                onClick={() => setSelectedDay('friday')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedDay === 'friday' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Sexta
              </button>
              <button
                onClick={() => setSelectedDay('saturday')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedDay === 'saturday' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Sábado
              </button>
              <button
                onClick={() => setSelectedDay('sunday')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedDay === 'sunday' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Domingo
              </button>
              <button
                onClick={() => setSelectedDay('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedDay === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Fim de Semana
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isAdmin ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold text-[11px] border border-blue-200 dark:border-blue-800">
                <Shield className="h-3 w-3" />
                Exportação Completa (Admin)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-medium text-[11px] border border-slate-200 dark:border-slate-700">
                <Lock className="h-3 w-3" />
                Protegido: Nomes de terceiros anônimos
              </span>
            )}
          </div>
        </div>

        {/* Text Preview area */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap select-all">
          {generateExportText()}
        </div>

        {/* Action bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Formatação em Markdown compatível com WhatsApp & Discord
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Fechar
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar Texto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
