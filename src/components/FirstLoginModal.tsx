import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { findCharacterInSupportedGuilds, mapTibiaRankToPriority } from '../services/tibiaDataService';
import { saveUserProfile } from '../services/firestoreService';
import { DEFAULT_GUILDS, RANK_METADATA, SUPER_ADMIN_EMAIL } from '../constants/guildData';
import { TibiaGuildMember, PriorityRank } from '../types';
import { Shield, CheckCircle2, AlertCircle, Search, Loader2, Sparkles, UserCheck } from 'lucide-react';

export const FirstLoginModal: React.FC = () => {
  const { currentUser, refreshProfile, signOut } = useAuth();
  const [selectedGuild, setSelectedGuild] = useState<string>('Missclick');
  const [charName, setCharName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedMember, setVerifiedMember] = useState<{
    member: TibiaGuildMember;
    guildName: string;
    rank: PriorityRank;
  } | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const isSuperAdmin = currentUser?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  const handleVerifyCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!charName.trim()) {
      setError('Por favor, informe o nome do seu personagem.');
      return;
    }

    setLoading(true);
    setError(null);
    setVerifiedMember(null);

    try {
      const result = await findCharacterInSupportedGuilds(charName.trim(), selectedGuild);
      if (result.found && result.member && result.guildName) {
        setVerifiedMember({
          member: result.member,
          guildName: result.guildName,
          rank: result.suggestedRank || 'Member',
        });
      } else {
        setError(
          `Personagem "${charName}" não foi encontrado nos membros de ${selectedGuild} nem na guilda parceira. Verifique a ortografia ou se o char foi convidado recentemente.`
        );
      }
    } catch (err) {
      console.error(err);
      setError('Falha ao comunicar com a API da guilda (TibiaData). Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLink = async () => {
    if (!currentUser || !verifiedMember) return;
    setSubmitting(true);
    setError(null);

    try {
      await saveUserProfile({
        uid: currentUser.uid,
        email: currentUser.email || '',
        charName: verifiedMember.member.name,
        guildName: verifiedMember.guildName,
        rank: verifiedMember.rank,
        vocation: verifiedMember.member.vocation || 'Unknown',
        level: Number(verifiedMember.member.level) || 0,
        isAdmin: isSuperAdmin,
        createdAt: new Date().toISOString(),
      });

      await refreshProfile();
    } catch (err) {
      console.error('Erro ao salvar vínculo:', err);
      setError('Erro ao salvar os dados no servidor. Verifique suas permissões.');
      setSubmitting(false);
    }
  };

  // Quick fallback bypass for Super Admin in development / tests if char not in guild
  const handleAdminSelfAssign = async () => {
    if (!currentUser || !isSuperAdmin) return;
    setSubmitting(true);
    try {
      await saveUserProfile({
        uid: currentUser.uid,
        email: currentUser.email || '',
        charName: charName.trim() || 'Guild Master',
        guildName: selectedGuild,
        rank: 'Leader',
        vocation: 'Elite Knight',
        level: 1000,
        isAdmin: true,
        createdAt: new Date().toISOString(),
      });
      await refreshProfile();
    } catch (err) {
      setError('Falha ao criar perfil de Leader.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white p-5 sm:p-6 pb-safe shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all animate-in slide-in-from-bottom duration-200">
        {/* Header decoration */}
        <div className="hidden sm:block absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-400" />
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />

        <div className="flex items-center gap-3 mb-4 sm:mb-5">
          <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">
              Vincular Personagem da Guild
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 break-all">
              Conectado como <span className="font-semibold text-blue-600 dark:text-blue-400">{currentUser?.email}</span>
            </p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-4 sm:mb-5 leading-relaxed">
          Para ter acesso às reservas de respawns e sorteios do <strong className="text-blue-600 dark:text-blue-400">Major</strong>, informe o nome exato do seu personagem para validação automática nas APIs oficiais de <strong>Missclick</strong> e <strong>Caxambu</strong>.
        </p>

        {/* Guild Selection & Input */}
        <form onSubmit={handleVerifyCharacter} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Guilda Principal
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DEFAULT_GUILDS.map(g => (
                <button
                  type="button"
                  key={g.name}
                  onClick={() => setSelectedGuild(g.name)}
                  className={`min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                    selectedGuild === g.name
                      ? 'border-blue-600 bg-blue-50/70 text-blue-700 dark:bg-blue-950/40 dark:border-blue-500 dark:text-blue-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Nome do Personagem (Tibia)
            </label>
            <div className="relative">
              <input
                type="text"
                value={charName}
                onChange={e => setCharName(e.target.value)}
                placeholder="Ex: Major Striker, Lord Missclick..."
                disabled={loading || submitting}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 pr-10 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || submitting || !charName.trim()}
            className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Validando na API TibiaData...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Verificar na Guilda
              </>
            )}
          </button>
        </form>

        {/* Error message */}
        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-rose-50 p-3.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Não foi possível validar</p>
              <p className="mt-0.5">{error}</p>
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={handleAdminSelfAssign}
                  className="mt-2 text-xs font-bold text-rose-800 underline dark:text-rose-200 hover:opacity-80"
                >
                  [Bypass Admin]: Forçar vínculo de Leader para este e-mail
                </button>
              )}
            </div>
          </div>
        )}

        {/* Verified Character Result */}
        {verifiedMember && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm mb-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Personagem Encontrado e Validado!
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Personagem:</span>
                <strong className="text-sm font-semibold text-slate-900 dark:text-white">
                  {verifiedMember.member.name}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Guilda:</span>
                <strong className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {verifiedMember.guildName}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Vocação & Level:</span>
                <span className="font-medium">{verifiedMember.member.vocation} (Lv {verifiedMember.member.level})</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Rank de Prioridade:</span>
                <span
                  className={`inline-block px-2 py-0.5 mt-0.5 rounded-md font-bold border text-[11px] ${
                    RANK_METADATA[verifiedMember.rank].badgeClass
                  }`}
                >
                  {verifiedMember.rank}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmLink}
              disabled={submitting}
              className="mt-4 w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition-all cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando vínculo...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" />
                  Confirmar e Entrar no Major
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={signOut}
            className="py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            Sair desta conta Google
          </button>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Validação Segura • TibiaData v4
          </span>
        </div>
      </div>
    </div>
  );
};
