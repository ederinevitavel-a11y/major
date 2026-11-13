import React from 'react';
import { useAuth } from '../context/AuthContext';
import { RANK_METADATA } from '../constants/guildData';
import { MainTab } from '../types';
import {
  CalendarDays,
  Users,
  Moon,
  Sun,
  LogOut,
  Share2,
  SlidersHorizontal,
  Zap,
  Swords,
} from 'lucide-react';

interface HeaderProps {
  currentTab: MainTab;
  setCurrentTab: (tab: MainTab) => void;
  onOpenExport: () => void;
  releasedCount?: number;
  lfgCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  onOpenExport,
  releasedCount = 0,
  lfgCount = 0,
}) => {
  const { userProfile, signOut, darkMode, toggleDarkMode, isAdmin } = useAuth();

  const rankMeta = userProfile ? RANK_METADATA[userProfile.rank] : null;

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 transition-colors">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4">
            {/* Logo & Branding */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-md shadow-blue-500/20 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                <img
                  src="https://i.imgur.com/qOkoaTJ.png"
                  alt="Major"
                  className="h-full w-full object-contain p-0.5"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                    Major
                  </span>
                  <span className="rounded-md bg-blue-50 px-1.5 sm:px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shrink-0">
                    Missclick
                  </span>
                </div>
                {/* Mobile char badge subtitle / Desktop Inferno de Double */}
                {userProfile ? (
                  <p className="sm:hidden text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-[165px]">
                    {userProfile.charName} • Lv {userProfile.level}
                  </p>
                ) : null}
                <p className="hidden sm:block text-[11px] font-black text-red-600 dark:text-red-500 tracking-wide uppercase">
                  Inferno de Double
                </p>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <button
                onClick={() => setCurrentTab('schedule')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative whitespace-nowrap shrink-0 ${
                  currentTab === 'schedule'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                    : 'text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50/70 dark:bg-blue-950/25 border border-blue-200/60 dark:border-blue-900/40'
                }`}
              >
                <CalendarDays className={`h-4 w-4 ${currentTab === 'schedule' ? 'text-white' : 'text-blue-500 dark:text-blue-400'}`} />
                <span>Agenda</span>
              </button>

              <button
                onClick={() => setCurrentTab('lfg')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative whitespace-nowrap shrink-0 ${
                  currentTab === 'lfg'
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md shadow-amber-500/25'
                    : 'text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/60 dark:border-amber-900/40'
                }`}
              >
                <Swords className={`h-4 w-4 ${currentTab === 'lfg' ? 'text-white' : 'text-amber-500 dark:text-amber-400'}`} />
                <span>Quero Hunt!</span>
                {lfgCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                    currentTab === 'lfg' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'
                  } animate-pulse`}>
                    {lfgCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setCurrentTab('released')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative whitespace-nowrap shrink-0 ${
                  currentTab === 'released'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25'
                    : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200/60 dark:border-emerald-900/40'
                }`}
              >
                <Zap className={`h-4 w-4 ${currentTab === 'released' ? 'text-white' : 'text-emerald-500 dark:text-emerald-400'}`} />
                <span>Respaws Liberados</span>
                {releasedCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                    currentTab === 'released' ? 'bg-white text-emerald-600' : 'bg-emerald-500 text-white'
                  } animate-pulse`}>
                    {releasedCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setCurrentTab('my-schedule')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative whitespace-nowrap shrink-0 ${
                  currentTab === 'my-schedule'
                    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25'
                    : 'text-violet-700 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 bg-violet-50/70 dark:bg-violet-950/25 border border-violet-200/60 dark:border-violet-900/40'
                }`}
              >
                <SlidersHorizontal className={`h-4 w-4 ${currentTab === 'my-schedule' ? 'text-white' : 'text-violet-500 dark:text-violet-400'}`} />
                <span>Meus Controles</span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => setCurrentTab('members')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative whitespace-nowrap shrink-0 ${
                    currentTab === 'members'
                      ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-500/25'
                      : 'text-rose-700 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 bg-rose-50/70 dark:bg-rose-950/25 border border-rose-200/60 dark:border-rose-900/40'
                  }`}
                >
                  <Users className={`h-4 w-4 ${currentTab === 'members' ? 'text-white' : 'text-rose-500 dark:text-rose-400'}`} />
                  <span>Admin</span>
                </button>
              )}
            </nav>

            {/* Right actions: Export, Dark Mode, Profile badge, SignOut */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <button
                onClick={onOpenExport}
                title="Exportar Escala para WhatsApp / Discord"
                aria-label="Exportar Escala"
                className="flex min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-blue-500 shadow-sm transition-all cursor-pointer"
              >
                <Share2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="hidden sm:inline">Exportar</span>
              </button>

              <button
                onClick={toggleDarkMode}
                title={darkMode ? 'Mudar para modo claro' : 'Mudar para modo noturno'}
                aria-label={darkMode ? 'Mudar para modo claro' : 'Mudar para modo noturno'}
                className="flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white shadow-sm transition-all cursor-pointer"
              >
                {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
              </button>

              {userProfile && (
                <div className="flex items-center gap-2 pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
                  <div className="text-right hidden sm:block">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {userProfile.charName}
                      </span>
                      {rankMeta && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${rankMeta.badgeClass}`}
                        >
                          {userProfile.rank}
                        </span>
                      )}
                      {isAdmin && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {userProfile.guildName} • Lv {userProfile.level}
                    </span>
                  </div>

                  <button
                    onClick={signOut}
                    title="Sair da conta"
                    aria-label="Sair da conta"
                    className="flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Fixed Thumb-Zone Bottom Tab Bar (Mobile Only) */}
      <nav
        aria-label="Navegação Principal"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/90 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 pb-safe shadow-[0_-4px_20px_-4px_rgba(15,23,42,0.08)]"
      >
        <div className={`grid ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'} h-16 items-center px-1`}>
          {/* 1. Agenda */}
          <button
            type="button"
            onClick={() => setCurrentTab('schedule')}
            className={`relative flex flex-col items-center justify-center h-full min-h-[44px] rounded-xl transition-colors cursor-pointer ${
              currentTab === 'schedule'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {currentTab === 'schedule' && (
              <span className="absolute top-1 h-1 w-6 rounded-full bg-blue-600 dark:bg-blue-400" />
            )}
            <CalendarDays className="h-5 w-5" />
            <span className="text-[10px] font-bold tracking-tight mt-1 whitespace-nowrap">Agenda</span>
          </button>

          {/* 2. Quero Hunt! */}
          <button
            type="button"
            onClick={() => setCurrentTab('lfg')}
            className={`relative flex flex-col items-center justify-center h-full min-h-[44px] rounded-xl transition-colors cursor-pointer ${
              currentTab === 'lfg'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {currentTab === 'lfg' && (
              <span className="absolute top-1 h-1 w-6 rounded-full bg-amber-500" />
            )}
            <div className="relative">
              <Swords className="h-5 w-5" />
              {lfgCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center tabular-nums">
                  {lfgCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold tracking-tight mt-1 whitespace-nowrap">Quero Hunt</span>
          </button>

          {/* 3. Liberados */}
          <button
            type="button"
            onClick={() => setCurrentTab('released')}
            className={`relative flex flex-col items-center justify-center h-full min-h-[44px] rounded-xl transition-colors cursor-pointer ${
              currentTab === 'released'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {currentTab === 'released' && (
              <span className="absolute top-1 h-1 w-6 rounded-full bg-emerald-500" />
            )}
            <div className="relative">
              <Zap className="h-5 w-5" />
              {releasedCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center tabular-nums">
                  {releasedCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold tracking-tight mt-1 whitespace-nowrap">Liberados</span>
          </button>

          {/* 4. Meus Controles */}
          <button
            type="button"
            onClick={() => setCurrentTab('my-schedule')}
            className={`relative flex flex-col items-center justify-center h-full min-h-[44px] rounded-xl transition-colors cursor-pointer ${
              currentTab === 'my-schedule'
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {currentTab === 'my-schedule' && (
              <span className="absolute top-1 h-1 w-6 rounded-full bg-violet-600 dark:bg-violet-400" />
            )}
            <SlidersHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-bold tracking-tight mt-1 whitespace-nowrap">Controles</span>
          </button>

          {/* 5. Admin */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setCurrentTab('members')}
              className={`relative flex flex-col items-center justify-center h-full min-h-[44px] rounded-xl transition-colors cursor-pointer ${
                currentTab === 'members'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {currentTab === 'members' && (
                <span className="absolute top-1 h-1 w-6 rounded-full bg-rose-600 dark:bg-rose-400" />
              )}
              <Users className="h-5 w-5" />
              <span className="text-[10px] font-bold tracking-tight mt-1 whitespace-nowrap">Admin</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
};
