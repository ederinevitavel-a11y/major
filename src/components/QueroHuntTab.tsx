import React, { useState } from 'react';
import { LfgPost, UserProfile, HuntDay } from '../types';
import { useAuth } from '../context/AuthContext';
import { RANK_METADATA } from '../constants/guildData';
import { QueroHuntModal } from './QueroHuntModal';
import { deleteLfgPost } from '../services/firestoreService';
import {
  Swords,
  Search,
  Phone,
  Clock,
  Calendar,
  MessageCircle,
  Copy,
  Check,
  Shield,
  Sparkles,
  Zap,
  Crosshair,
  User,
  Pencil,
  Trash2,
  AlertCircle,
  Flame,
  CheckCircle2,
} from 'lucide-react';

interface QueroHuntTabProps {
  posts: LfgPost[];
  userProfile: UserProfile | null;
  onNavigateToMyControls?: () => void;
}

export const QueroHuntTab: React.FC<QueroHuntTabProps> = ({
  posts,
  userProfile,
  onNavigateToMyControls,
}) => {
  const { currentUser, isAdmin } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVocation, setSelectedVocation] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<HuntDay | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<LfgPost | null>(null);

  // Check if current user already has an active post
  const myPost = posts.find(p => p.userUid === currentUser?.uid);

  // Helper to format WhatsApp phone number
  const getWhatsAppLink = (post: LfgPost) => {
    let clean = (post.phone || '').replace(/\D/g, '');
    if (!clean) return '#';

    // If 10 or 11 digits, prepend Brazil country code 55
    if (clean.length === 10 || clean.length === 11) {
      clean = `55${clean}`;
    }

    const vocShort = getVocationShort(post.vocation);
    const greeting = `Olá ${post.charName}! Vi seu anúncio no Quero Hunt! do Major (Lv ${post.level} ${vocShort}). Tem vaga na PT para a Double?`;
    return `https://wa.me/${clean}?text=${encodeURIComponent(greeting)}`;
  };

  const copyPhoneNumber = (phone: string, id: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    setToastMessage('Telefone copiado para a área de transferência!');
    setTimeout(() => {
      setCopiedId(null);
      setToastMessage(null);
    }, 2500);
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteLfgPost(postId);
      setToastMessage('Anúncio removido com sucesso.');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Erro ao excluir anúncio:', err);
    }
  };

  const getVocationShort = (voc: string): string => {
    const v = (voc || '').toLowerCase();
    if (v.includes('knight')) return 'EK';
    if (v.includes('druid')) return 'ED';
    if (v.includes('sorcerer')) return 'MS';
    if (v.includes('paladin')) return 'RP';
    return voc || 'N/D';
  };

  const getVocationMeta = (voc: string) => {
    const v = (voc || '').toLowerCase();
    if (v.includes('knight')) {
      return {
        label: 'Knight',
        short: 'EK',
        icon: Shield,
        colorClass: 'text-blue-600 dark:text-blue-400',
        badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-300 dark:border-blue-800',
        borderClass: 'border-blue-300/80 dark:border-blue-900/60',
        cardBg: 'hover:border-blue-400 dark:hover:border-blue-700',
        accentGradient: 'from-blue-600 to-indigo-600',
      };
    }
    if (v.includes('druid')) {
      return {
        label: 'Druid',
        short: 'ED',
        icon: Sparkles,
        colorClass: 'text-emerald-600 dark:text-emerald-400',
        badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        borderClass: 'border-emerald-300/80 dark:border-emerald-900/60',
        cardBg: 'hover:border-emerald-400 dark:hover:border-emerald-700',
        accentGradient: 'from-emerald-600 to-teal-600',
      };
    }
    if (v.includes('sorcerer')) {
      return {
        label: 'Sorcerer',
        short: 'MS',
        icon: Zap,
        colorClass: 'text-purple-600 dark:text-purple-400',
        badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-300 dark:border-purple-800',
        borderClass: 'border-purple-300/80 dark:border-purple-900/60',
        cardBg: 'hover:border-purple-400 dark:hover:border-purple-700',
        accentGradient: 'from-purple-600 to-pink-600',
      };
    }
    if (v.includes('paladin')) {
      return {
        label: 'Paladin',
        short: 'RP',
        icon: Crosshair,
        colorClass: 'text-amber-600 dark:text-amber-400',
        badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        borderClass: 'border-amber-300/80 dark:border-amber-900/60',
        cardBg: 'hover:border-amber-400 dark:hover:border-amber-700',
        accentGradient: 'from-amber-500 to-orange-600',
      };
    }
    return {
      label: 'Player',
      short: 'Tibia',
      icon: Swords,
      colorClass: 'text-slate-600 dark:text-slate-400',
      badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
      borderClass: 'border-slate-300 dark:border-slate-800',
      cardBg: 'hover:border-slate-400',
      accentGradient: 'from-slate-600 to-slate-800',
    };
  };

  // Filter posts
  const filteredPosts = posts.filter(post => {
    // Vocation filter
    if (selectedVocation !== 'all') {
      const v = (post.vocation || '').toLowerCase();
      if (!v.includes(selectedVocation.toLowerCase())) return false;
    }

    // Day filter
    if (selectedDay !== 'all') {
      if (!post.days || !post.days.includes(selectedDay)) return false;
    }

    // Search query (character name or level)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = post.charName.toLowerCase().includes(q);
      const matchLvl = String(post.level).includes(q);
      const matchVoc = (post.vocation || '').toLowerCase().includes(q);
      const matchNotes = (post.notes || '').toLowerCase().includes(q);
      if (!matchName && !matchLvl && !matchVoc && !matchNotes) return false;
    }

    return true;
  });

  // Vocation counts
  const countEK = posts.filter(p => (p.vocation || '').toLowerCase().includes('knight')).length;
  const countED = posts.filter(p => (p.vocation || '').toLowerCase().includes('druid')).length;
  const countMS = posts.filter(p => (p.vocation || '').toLowerCase().includes('sorcerer')).length;
  const countRP = posts.filter(p => (p.vocation || '').toLowerCase().includes('paladin')).length;

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-900 dark:text-emerald-200 shadow-md">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Banner with Actions */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-sm transition-all">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-gradient-to-br from-red-500/10 via-amber-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100/80 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 text-xs font-black uppercase tracking-wider">
              <Flame className="h-3.5 w-3.5 animate-pulse text-red-600 dark:text-red-400" />
              <span>Ultima Chance!</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Procurando PT!
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Encontre jogadores sem PT para a Double XP!
            </p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search box */}
          <div className="relative flex-1 max-w-full lg:max-w-xs">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, vocação, level..."
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          </div>

          {/* Vocation Pills Filter */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedVocation('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedVocation === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Todos ({posts.length})
            </button>

            <button
              onClick={() => setSelectedVocation('knight')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedVocation === 'knight'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>EK ({countEK})</span>
            </button>

            <button
              onClick={() => setSelectedVocation('druid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedVocation === 'druid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>ED ({countED})</span>
            </button>

            <button
              onClick={() => setSelectedVocation('sorcerer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedVocation === 'sorcerer'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>MS ({countMS})</span>
            </button>

            <button
              onClick={() => setSelectedVocation('paladin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedVocation === 'paladin'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              <Crosshair className="h-3.5 w-3.5" />
              <span>RP ({countRP})</span>
            </button>
          </div>

          {/* Day Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setSelectedDay('all')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
                selectedDay === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Qualquer Dia
            </button>
            <button
              onClick={() => setSelectedDay('friday')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
                selectedDay === 'friday'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              SEX
            </button>
            <button
              onClick={() => setSelectedDay('saturday')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
                selectedDay === 'saturday'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              SÁB
            </button>
            <button
              onClick={() => setSelectedDay('sunday')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
                selectedDay === 'sunday'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              DOM
            </button>
          </div>
        </div>
      </div>

      {/* CARDS GRID */}
      {filteredPosts.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-4 shadow-sm">
          <div className="h-16 w-16 rounded-3xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto shadow-sm">
            <Swords className="h-8 w-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Nenhum jogador na fila de PT com esses filtros
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {posts.length === 0
                ? 'Para cadastrar sua disponibilidade de horário e telefone, acesse a aba Meus Controles.'
                : 'Tente alterar os filtros de vocação ou dia acima.'}
            </p>
          </div>

          {onNavigateToMyControls && posts.length === 0 && (
            <button
              type="button"
              onClick={onNavigateToMyControls}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer border border-slate-700"
            >
              <span>Ir para Meus Controles</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {filteredPosts.map(post => {
            const vocMeta = getVocationMeta(post.vocation);
            const rankMeta = post.rank ? RANK_METADATA[post.rank] : null;
            const isOwner = currentUser?.uid === post.userUid;
            const canManage = isOwner || isAdmin;
            const VocIcon = vocMeta.icon;

            return (
              <div
                key={post.id}
                className={`relative rounded-3xl border bg-white dark:bg-slate-900 p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between gap-4 ${vocMeta.borderClass} ${vocMeta.cardBg}`}
              >
                {/* Top Row: Character Name, Level, Vocation Pill */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Vocation Avatar */}
                      <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${vocMeta.badgeBg} border`}>
                        <VocIcon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-black text-slate-900 dark:text-white truncate">
                            {post.charName}
                          </h4>
                          {isOwner && (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 shrink-0">
                              Você
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${vocMeta.badgeBg}`}>
                            {vocMeta.short} • {post.vocation}
                          </span>
                          {rankMeta && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${rankMeta.badgeClass}`}>
                              {post.rank}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Level Badge */}
                    <div className="shrink-0 text-right">
                      <div className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-900 dark:text-white font-mono shadow-2xs">
                        Lv. {post.level}
                      </div>
                    </div>
                  </div>

                  {/* Days Available Indicator */}
                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Dias Disponíveis
                      </span>
                      <div className="flex items-center gap-1">
                        {[
                          { key: 'friday' as HuntDay, label: 'SEX' },
                          { key: 'saturday' as HuntDay, label: 'SÁB' },
                          { key: 'sunday' as HuntDay, label: 'DOM' },
                        ].map(d => {
                          const hasDay = post.days && post.days.includes(d.key);
                          return (
                            <span
                              key={d.key}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black border transition-all ${
                                hasDay
                                  ? 'bg-rose-500 text-white border-rose-600 shadow-2xs'
                                  : 'bg-slate-100 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 border-slate-200/50 dark:border-slate-800/50 opacity-40'
                              }`}
                            >
                              {d.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Hours Availability */}
                    <div className="flex items-start gap-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                      <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Horários / Período</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {post.timeSlots || 'Horário flexível'}
                        </span>
                      </div>
                    </div>

                    {/* Notes / Desired hunts */}
                    {post.notes && (
                      <div className="p-2.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-950 dark:text-amber-200">
                        <span className="text-[10px] uppercase font-black text-amber-700 dark:text-amber-400 block mb-0.5">
                          🎯 Objetivo / Preferência:
                        </span>
                        <p className="font-medium italic leading-relaxed">
                          "{post.notes}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: WhatsApp Direct Action Button */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  {/* WhatsApp Direct Chat Button */}
                  <a
                    href={getWhatsAppLink(post)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-black shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    <MessageCircle className="h-4 w-4 shrink-0 fill-current" />
                    <span>Chamar no WhatsApp</span>
                  </a>

                  {/* Copy Phone button */}
                  <button
                    type="button"
                    onClick={() => copyPhoneNumber(post.phone, post.id)}
                    title={`Copiar telefone (${post.phone})`}
                    className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    {copiedId === post.id ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>

                  {/* Owner / Admin Controls */}
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPost(post);
                          setIsModalOpen(true);
                        }}
                        title="Editar anúncio"
                        className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        <Pencil className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post.id)}
                        title="Remover anúncio"
                        className="p-2.5 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <QueroHuntModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPost(null);
        }}
        userProfile={userProfile}
        existingPost={editingPost}
        onSuccess={(msg) => {
          setToastMessage(msg);
          setTimeout(() => setToastMessage(null), 3500);
        }}
      />
    </div>
  );
};
