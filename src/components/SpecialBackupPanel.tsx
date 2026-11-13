import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Reservation,
  CustomRespawn,
  SpecialRespawnsBackup,
  HuntDay,
} from '../types';
import { useAuth } from '../context/AuthContext';
import {
  PLANILHADOS_RESPAWNS,
  PLANILHADOS_SLOTS_MAP,
  PLANILHADOS_SLOTS_BY_DAY,
  DAYS_CONFIG,
  RANK_METADATA,
} from '../constants/guildData';
import { DEFAULT_FIXED_SCHEDULE } from '../constants/defaultSchedule';
import {
  isSpecialReservation,
  saveSpecialRespawnsBackup,
  subscribeToSpecialRespawnsBackups,
  deleteSpecialRespawnsBackup,
  restoreSpecialRespawnsBackup,
} from '../services/firestoreService';
import {
  Archive,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  Eye,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Calendar,
  Shield,
  Plus,
  FileJson,
  FileSpreadsheet,
  Sparkles,
} from 'lucide-react';

interface SpecialBackupPanelProps {
  reservations: Reservation[];
  customRespawns?: CustomRespawn[];
  onToast: (message: string) => void;
}

export const SpecialBackupPanel: React.FC<SpecialBackupPanelProps> = ({
  reservations,
  customRespawns = [],
  onToast,
}) => {
  const { currentUser } = useAuth();
  const [backups, setBackups] = useState<SpecialRespawnsBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [backupName, setBackupName] = useState('');
  const [savingBackup, setSavingBackup] = useState(false);

  // Restore confirmation state (either a cloud backup or imported JSON or default template)
  const [pendingRestore, setPendingRestore] = useState<{
    title: string;
    subtitle: string;
    reservations: Reservation[];
    customSpecialRespawns?: CustomRespawn[];
  } | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Preview modal state
  const [previewBackup, setPreviewBackup] = useState<SpecialRespawnsBackup | null>(null);
  const [previewDayFilter, setPreviewDayFilter] = useState<HuntDay | 'all'>('all');

  // Inline delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Import error
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = subscribeToSpecialRespawnsBackups(
      list => {
        setBackups(list);
        setLoadingBackups(false);
      },
      err => {
        console.warn('Backup subscription notice:', err);
        setLoadingBackups(false);
      }
    );
    return () => unsub();
  }, []);

  // All live special reservations currently active in the system
  const currentSpecialReservations = useMemo(() => {
    return reservations
      .filter(r => isSpecialReservation(r))
      .sort((a, b) => {
        const dayOrder: Record<HuntDay, number> = { friday: 0, saturday: 1, sunday: 2 };
        if (dayOrder[a.day] !== dayOrder[b.day]) return dayOrder[a.day] - dayOrder[b.day];
        return a.respawnName.localeCompare(b.respawnName);
      });
  }, [reservations]);

  const customSpecialRespawns = useMemo(
    () => customRespawns.filter(c => c.type === '3h'),
    [customRespawns]
  );

  const buildCurrentSnapshotPayload = (customLabel?: string): Omit<SpecialRespawnsBackup, 'id'> => {
    const now = new Date();
    const defaultLabel = `Backup Especiais — ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    return {
      name: customLabel?.trim() || defaultLabel,
      createdAt: now.toISOString(),
      createdBy: currentUser?.email || 'admin',
      specialCount: currentSpecialReservations.length,
      respawnsCount: PLANILHADOS_RESPAWNS.length + customSpecialRespawns.length,
      reservations: currentSpecialReservations,
      slotsConfig: {
        baseSlotsMap: PLANILHADOS_SLOTS_MAP,
        slotsByDay: PLANILHADOS_SLOTS_BY_DAY,
        customSpecialRespawns,
      },
    };
  };

  const handleSaveCloudBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBackup(true);
    setImportError(null);
    try {
      const payload = buildCurrentSnapshotPayload(backupName);
      await saveSpecialRespawnsBackup(payload);
      setBackupName('');
      onToast(
        `Backup "${payload.name}" salvo na nuvem com ${payload.specialCount} reserva(s) especiais!`
      );
    } catch (err) {
      console.error(err);
      setImportError('Erro ao salvar backup na nuvem. Verifique sua conexão e permissões.');
    } finally {
      setSavingBackup(false);
    }
  };

  const handleDownloadJson = (backupData: Omit<SpecialRespawnsBackup, 'id'> & { id?: string }) => {
    try {
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateTag = new Date(backupData.createdAt || Date.now()).toISOString().split('T')[0];
      link.href = url;
      link.download = `Backup_Respawns_Especiais_Major_${dateTag}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onToast('Arquivo JSON de backup baixado com sucesso!');
    } catch (err) {
      console.error(err);
      setImportError('Falha ao gerar arquivo JSON para download.');
    }
  };

  const handleDownloadExcel = (backupData: Omit<SpecialRespawnsBackup, 'id'> & { id?: string }) => {
    try {
      const escapeHtml = (val: string) => {
        const raw = String(val || '');
        const safe = /^([=+@\t\r]|-[a-zA-Z0-9(=+])/.test(raw) ? `'${raw}` : raw;
        return safe
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      };

      const createdStr = new Date(backupData.createdAt || Date.now()).toLocaleString('pt-BR');
      const dayOrder: Record<HuntDay, number> = { friday: 0, saturday: 1, sunday: 2 };
      const sortedReservations = [...(backupData.reservations || [])].sort((a, b) => {
        const dDiff = (dayOrder[a.day] ?? 9) - (dayOrder[b.day] ?? 9);
        if (dDiff !== 0) return dDiff;
        const rDiff = (a.respawnName || '').localeCompare(b.respawnName || '');
        if (rDiff !== 0) return rDiff;
        return (a.timeSlot || '').localeCompare(b.timeSlot || '');
      });

      const baseSlotsMap = backupData.slotsConfig?.baseSlotsMap || PLANILHADOS_SLOTS_MAP;
      const slotsByDay = backupData.slotsConfig?.slotsByDay || PLANILHADOS_SLOTS_BY_DAY;
      const customSpecials = backupData.slotsConfig?.customSpecialRespawns || [];
      const allSpecialNames = Array.from(
        new Set([...PLANILHADOS_RESPAWNS, ...Object.keys(baseSlotsMap), ...customSpecials.map(c => c.name)])
      ).sort((a, b) => a.localeCompare(b));

      let html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8"/>
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Backup Respawns Especiais</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            body { font-family: Arial, sans-serif; color: #0F172A; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            th { background-color: #1E293B; color: #FFFFFF; font-weight: bold; padding: 8px 10px; border: 1px solid #94A3B8; text-align: left; font-size: 12px; }
            td { padding: 7px 10px; border: 1px solid #CBD5E1; text-align: left; font-size: 12px; }
            .section-title { font-size: 14px; font-weight: bold; color: #1E3A8A; margin: 14px 0 6px 0; }
            .friday { background-color: #EFF6FF; }
            .saturday { background-color: #FEF3C7; }
            .sunday { background-color: #ECFDF5; }
          </style>
        </head>
        <body>
          <h2>BACKUP DA CONFIGURAÇÃO DOS RESPAWNS ESPECIAIS — MAJOR GUILD</h2>
          <p><b>Nome do Backup:</b> ${escapeHtml(backupData.name)}</p>
          <p><b>Data do Snapshot:</b> ${escapeHtml(createdStr)}</p>
          <p><b>Gerado por:</b> ${escapeHtml(backupData.createdBy || currentUser?.email || 'Admin')}</p>
          <p><b>Total:</b> ${backupData.respawnsCount} locais especiais &bull; ${sortedReservations.length} reservas especiais</p>

          <div class="section-title">1. Reservas Especiais Salvas (Sexta, Sábado e Domingo)</div>
          <table>
            <thead>
              <tr>
                <th>Dia</th>
                <th>Respawn Especial</th>
                <th>Horário</th>
                <th>Personagem (Jogador)</th>
                <th>Rank</th>
                <th>Observações / Horário Planilhado</th>
                <th>Membros da Party</th>
                <th>Visibilidade Pública</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (sortedReservations.length === 0) {
        html += `
          <tr>
            <td colspan="8">Nenhuma reserva especial registrada neste backup.</td>
          </tr>
        `;
      } else {
        sortedReservations.forEach(r => {
          const dayLabel = formatDayLabel(r.day);
          const rowClass = r.day === 'friday' ? 'friday' : r.day === 'saturday' ? 'saturday' : 'sunday';
          html += `
            <tr class="${rowClass}">
              <td><b>${escapeHtml(dayLabel)}</b></td>
              <td><b>${escapeHtml(r.respawnName)}</b></td>
              <td><b>${escapeHtml(r.timeSlot)}</b></td>
              <td style="color: #047857; font-weight: bold;">${escapeHtml(r.charName || '-')}</td>
              <td>${escapeHtml(r.userRank || 'Member')}</td>
              <td>${escapeHtml(r.notes || (r.exactTime ? `Horário Planilhado: ${r.exactTime}` : '-'))}</td>
              <td>${escapeHtml(r.partyMembers || '-')}</td>
              <td>${r.isPublicVisibility ? 'Sim' : 'Restrita'}</td>
            </tr>
          `;
        });
      }

      html += `
            </tbody>
          </table>

          <div class="section-title">2. Grade de Horários Especiais Configurados por Local e Dia</div>
          <table>
            <thead>
              <tr>
                <th>Respawn Especial</th>
                <th>Horários Padrão</th>
                <th>Sexta-feira</th>
                <th>Sábado</th>
                <th>Domingo</th>
              </tr>
            </thead>
            <tbody>
      `;

      allSpecialNames.forEach(name => {
        const baseList = baseSlotsMap[name] || [];
        const daySpecific = slotsByDay[name];
        const friList = daySpecific?.friday || baseList;
        const satList = daySpecific?.saturday || baseList;
        const sunList = daySpecific?.sunday || baseList;
        html += `
          <tr>
            <td><b>${escapeHtml(name)}</b></td>
            <td>${escapeHtml(baseList.join(' | ') || 'Padrão (2h20m / 3h)')}</td>
            <td>${escapeHtml(friList.join(' | ') || '-')}</td>
            <td>${escapeHtml(satList.join(' | ') || '-')}</td>
            <td>${escapeHtml(sunList.join(' | ') || '-')}</td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateTag = new Date(backupData.createdAt || Date.now()).toISOString().split('T')[0];
      link.href = url;
      link.download = `Backup_Respawns_Especiais_Major_${dateTag}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onToast('Planilha Excel (.xls) dos respawns especiais baixada com sucesso!');
    } catch (err) {
      console.error(err);
      setImportError('Falha ao gerar arquivo Excel (.xls) para download.');
    }
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (!parsed || !Array.isArray(parsed.reservations)) {
          setImportError('Arquivo JSON inválido: lista de reservas especiais não encontrada.');
          return;
        }
        const valid = parsed.reservations.filter(
          (r: any) => r && typeof r.day === 'string' && typeof r.respawnName === 'string' && typeof r.timeSlot === 'string'
        );
        if (valid.length === 0) {
          setImportError('O arquivo JSON não contém reservas especiais válidas.');
          return;
        }
        setPendingRestore({
          title: parsed.name || file.name,
          subtitle: `Arquivo JSON importado (${valid.length} reserva(s) especiais)`,
          reservations: valid,
          customSpecialRespawns: parsed.slotsConfig?.customSpecialRespawns,
        });
      } catch {
        setImportError('Não foi possível ler o arquivo. Certifique-se de enviar um JSON válido exportado pelo Major.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    setRestoring(true);
    setImportError(null);
    try {
      const count = await restoreSpecialRespawnsBackup(
        pendingRestore.reservations,
        pendingRestore.customSpecialRespawns
      );
      setPendingRestore(null);
      onToast(
        `Restauração concluída! ${count} reserva(s) de respawns especiais foram restauradas em tempo real.`
      );
    } catch (err) {
      console.error(err);
      setImportError('Erro ao restaurar backup dos respawns especiais. Tente novamente.');
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteBackup = async (backup: SpecialRespawnsBackup) => {
    setDeletingId(backup.id);
    try {
      await deleteSpecialRespawnsBackup(backup.id);
      setConfirmDeleteId(null);
      onToast(`Backup "${backup.name}" excluído.`);
    } catch (err) {
      console.error(err);
      setImportError('Erro ao excluir backup.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDayLabel = (day: HuntDay) => {
    return DAYS_CONFIG.find(d => d.key === day)?.label || day;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header & Live Special Configuration Summary */}
      <div className="rounded-2xl border border-indigo-200/90 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-indigo-100 dark:border-indigo-900/40">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25 shrink-0">
              <Archive className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  Backup da Configuração dos Respawns Especiais
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  <Shield className="h-3 w-3" />
                  Acesso Admin
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Salve cópias de segurança na nuvem ou em arquivo JSON com todas as configurações de horários especiais, jogadores vinculados, notas e escalas de Sexta, Sábado e Domingo. Você pode restaurar qualquer ponto salvo sem afetar os respawns normais (2h20m).
              </p>
            </div>
          </div>

          {/* Live Counters */}
          <div className="grid grid-cols-3 sm:flex items-center gap-2 shrink-0">
            <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center sm:text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Locais</span>
              <strong className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                {PLANILHADOS_RESPAWNS.length + customSpecialRespawns.length}
              </strong>
            </div>
            <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center sm:text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Reservas</span>
              <strong className="text-sm font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                {currentSpecialReservations.length}
              </strong>
            </div>
            <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center sm:text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Backups</span>
              <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {backups.length}
              </strong>
            </div>
          </div>
        </div>

        {/* Create Cloud Backup Form + Offline JSON Actions */}
        <form onSubmit={handleSaveCloudBackup} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={backupName}
              onChange={e => setBackupName(e.target.value)}
              maxLength={100}
              placeholder="Nome opcional do backup (ex: Escala Especial Fechada - Double XP)..."
              className="flex-1 min-h-[44px] sm:min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm sm:text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={savingBackup}
              className="inline-flex items-center justify-center gap-2 px-5 min-h-[44px] sm:min-h-[40px] py-2.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/25 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {savingBackup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span>Salvar Backup na Nuvem</span>
            </button>
          </div>

          {/* Secondary Utility Actions */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleDownloadExcel(buildCurrentSnapshotPayload(backupName))}
              className="inline-flex items-center justify-center gap-2 px-4 min-h-[42px] sm:min-h-[36px] py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Baixar Configuração Atual (Excel .xls)</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadJson(buildCurrentSnapshotPayload(backupName))}
              className="inline-flex items-center justify-center gap-2 px-4 min-h-[42px] sm:min-h-[36px] py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-xs font-bold transition-all cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Baixar Atual (.JSON)</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportJsonFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-4 min-h-[42px] sm:min-h-[36px] py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Importar e Restaurar de Arquivo (.JSON)</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setPendingRestore({
                  title: 'Padrão Oficial da Planilha',
                  subtitle: `Restaura os ${DEFAULT_FIXED_SCHEDULE.length} horários planilhados oficiais salvos no código do sistema`,
                  reservations: DEFAULT_FIXED_SCHEDULE.map(item => ({
                    ...item,
                    partyMemberUids: [],
                  })),
                })
              }
              className="inline-flex items-center justify-center gap-2 px-4 min-h-[42px] sm:min-h-[36px] py-2 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs font-bold transition-all cursor-pointer sm:ml-auto"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Restaurar Padrão da Planilha</span>
            </button>
          </div>
        </form>

        {importError && (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-xs font-semibold text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{importError}</span>
          </div>
        )}
      </div>

      {/* Saved Cloud Backups History */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileJson className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Backups Salvos na Nuvem ({backups.length})</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Snapshots armazenados com segurança no banco de dados (acessível apenas por Administradores).
            </p>
          </div>
        </div>

        {loadingBackups ? (
          <div className="py-10 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            <span>Carregando backups salvos...</span>
          </div>
        ) : backups.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
            <Archive className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Nenhum backup salvo na nuvem ainda
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Clique em <strong>Salvar Backup na Nuvem</strong> acima para registrar uma cópia exata da configuração atual dos respawns especiais.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map(backup => {
              const isConfirmingDelete = confirmDeleteId === backup.id;
              const isDeleting = deletingId === backup.id;
              return (
                <div
                  key={backup.id}
                  className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 transition-all hover:border-indigo-200 dark:hover:border-indigo-800/60"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-slate-900 dark:text-white break-words">
                        {backup.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 tabular-nums">
                        {backup.specialCount} reservas • {backup.respawnsCount} locais
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="h-3 w-3" />
                        {new Date(backup.createdAt).toLocaleString('pt-BR')}
                      </span>
                      <span className="truncate">
                        Criado por: <strong className="text-slate-700 dark:text-slate-200">{backup.createdBy}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 sm:flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewDayFilter('all');
                        setPreviewBackup(backup);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] sm:min-h-[34px] py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Visualizar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadExcel(backup)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] sm:min-h-[34px] py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span>Excel .xls</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadJson(backup)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] sm:min-h-[34px] py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Baixar .JSON</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPendingRestore({
                          title: backup.name,
                          subtitle: `Backup de ${new Date(backup.createdAt).toLocaleString('pt-BR')} (${backup.specialCount} reserva(s) especiais)`,
                          reservations: backup.reservations || [],
                          customSpecialRespawns: backup.slotsConfig?.customSpecialRespawns,
                        })
                      }
                      className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 px-3.5 min-h-[40px] sm:min-h-[34px] py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm shadow-indigo-500/20 transition-all cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Restaurar</span>
                    </button>

                    {isConfirmingDelete ? (
                      <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDeleteBackup(backup)}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 min-h-[40px] sm:min-h-[34px] py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                        >
                          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          <span>Confirmar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 min-h-[40px] sm:min-h-[34px] py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(backup.id)}
                        className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] sm:min-h-[34px] py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors cursor-pointer"
                        title="Excluir backup"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sm:hidden">Excluir</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Backup Modal */}
      {previewBackup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-3xl max-h-[90dvh] rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            <div className="mx-auto mt-3 mb-1 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                  {previewBackup.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  Salvo em {new Date(previewBackup.createdAt).toLocaleString('pt-BR')} • {previewBackup.specialCount} reserva(s) especiais
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewBackup(null)}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Day Filter */}
            <div className="px-4 sm:px-5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPreviewDayFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                  previewDayFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Todos os Dias ({previewBackup.reservations.length})
              </button>
              {DAYS_CONFIG.map(d => {
                const count = previewBackup.reservations.filter(r => r.day === d.key).length;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setPreviewDayFilter(d.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      previewDayFilter === d.key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {d.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Reservations List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2">
              {previewBackup.reservations
                .filter(r => previewDayFilter === 'all' || r.day === previewDayFilter)
                .map((r, idx) => (
                  <div
                    key={`${r.id}_${idx}`}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-[10px] font-extrabold uppercase">
                          <Calendar className="h-2.5 w-2.5" />
                          {formatDayLabel(r.day)}
                        </span>
                        <strong className="text-slate-900 dark:text-white">{r.respawnName}</strong>
                      </div>
                      {r.notes && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold truncate">
                          {r.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 tabular-nums">
                        {r.timeSlot}
                      </span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">
                        {r.charName || 'Reservado'}
                      </span>
                      {r.userRank && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold border ${
                            RANK_METADATA[r.userRank]?.badgeClass || ''
                          }`}
                        >
                          {r.userRank}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 pb-safe flex flex-col-reverse sm:flex-row justify-end gap-2 bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setPreviewBackup(null)}
                className="px-4 min-h-[42px] sm:min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => handleDownloadExcel(previewBackup)}
                className="inline-flex items-center justify-center gap-1.5 px-4 min-h-[42px] sm:min-h-[36px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-500/20 cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Baixar Excel (.xls)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const b = previewBackup;
                  setPreviewBackup(null);
                  setPendingRestore({
                    title: b.name,
                    subtitle: `Backup de ${new Date(b.createdAt).toLocaleString('pt-BR')} (${b.specialCount} reserva(s) especiais)`,
                    reservations: b.reservations || [],
                    customSpecialRespawns: b.slotsConfig?.customSpecialRespawns,
                  });
                }}
                className="inline-flex items-center justify-center gap-1.5 px-5 min-h-[42px] sm:min-h-[36px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restaurar Este Backup</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {pendingRestore && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 pb-safe shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="mx-auto h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  Confirmar Restauração dos Especiais
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {pendingRestore.title}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-1.5 leading-relaxed">
              <p className="font-bold">{pendingRestore.subtitle}</p>
              <p>
                As marcações atuais apenas dos <strong>Respawns Especiais</strong> serão substituídas por esta configuração. Os respawns <strong>Normais (2h20m)</strong> não serão modificados.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={restoring}
                onClick={() => setPendingRestore(null)}
                className="w-full sm:w-auto px-4 min-h-[44px] sm:min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={restoring}
                onClick={handleConfirmRestore}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 min-h-[44px] sm:min-h-[38px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
              >
                {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                <span>{restoring ? 'Restaurando...' : 'Sim, Restaurar Agora'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
