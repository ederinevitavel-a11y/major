import React from 'react';
import { useAuth } from '../context/AuthContext';
import { RANK_METADATA } from '../constants/guildData';
import {
  CalendarDays,
  Users,
  Moon,
  Sun,
  LogOut,
  Share2,
} from 'lucide-react';

interface HeaderProps {
  currentTab: 'schedule' | 'my-schedule' | 'members' | 'settings';
  setCurrentTab: (tab: 'schedule' | 'my-schedule' | 'members' | 'settings') => void;
  onOpenExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  onOpenExport,
}) => {
  const { userProfile, signOut, darkMode, toggleDarkMode, isAdmin } = useAuth();

  const rankMeta = userProfile ? RANK_METADATA[userProfile.rank] : null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 transition-colors">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl overflow-hidden shadow-md shadow-blue-500/20 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
              <img
                src="https://i.imgur.com/qOkoaTJ.png"
                alt="Major"
                className="h-full w-full object-contain p-0.5"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Major
                </span>
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  Missclick
                </span>
              </div>
              <p className="hidden sm:block text-[11px] font-black text-red-600 dark:text-red-500 tracking-wide uppercase">
                Inferno de Double
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <button
              onClick={() => setCurrentTab('schedule')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentTab === 'schedule'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Grade de Respawns
            </button>

            <button
              onClick={() => setCurrentTab('my-schedule')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentTab === 'my-schedule'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              Meus Agendamentos
            </button>

            {isAdmin && userProfile?.rank !== 'Leader' && (
              <button
                onClick={() => setCurrentTab('members')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  currentTab === 'members'
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <Users className="h-4 w-4" />
                Painel Admin & Ranks
              </button>
            )}
          </nav>

          {/* Right actions: Export, Dark Mode, Profile badge, SignOut */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onOpenExport}
              title="Exportar Escala para WhatsApp / Discord"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-blue-500 shadow-sm transition-all cursor-pointer"
            >
              <Share2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Exportar</span>
            </button>

            <button
              onClick={toggleDarkMode}
              title={darkMode ? 'Mudar para modo claro' : 'Mudar para modo noturno'}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white shadow-sm transition-all cursor-pointer"
            >
              {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>

            {userProfile && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
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
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {userProfile.guildName} • Lv {userProfile.level}
                  </span>
                </div>

                <button
                  onClick={signOut}
                  title="Sair da conta"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setCurrentTab('schedule')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg ${
              currentTab === 'schedule'
                ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Grade
          </button>
          <button
            onClick={() => setCurrentTab('my-schedule')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg ${
              currentTab === 'my-schedule'
                ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Meus Horários
          </button>
          {isAdmin && (
            <button
              onClick={() => setCurrentTab('members')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg ${
                currentTab === 'members'
                  ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Membros & Acesso
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
