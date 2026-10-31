import React, { useState, useEffect } from 'react';
import { Reservation, UserProfile, DoubleXpRecord, DoubleXpSettings } from '../types';
import { Calendar, Clock, MapPin, User, Shield, Sparkles, CheckCircle2, TrendingUp, Award, Zap } from 'lucide-react';
import { DAYS_CONFIG } from '../constants/guildData';
import { getDoubleXpRecord, getDoubleXpSettings } from '../services/firestoreService';

interface MyReservationsProps {
  reservations: Reservation[];
  userProfile: UserProfile | null;
}

export const MyReservations: React.FC<MyReservationsProps> = ({ reservations, userProfile }) => {
  const [selectedDay, setSelectedDay] = useState<string>('friday');
  const [doubleRecord, setDoubleRecord] = useState<DoubleXpRecord | null>(null);
  const [doubleSettings, setDoubleSettings] = useState<DoubleXpSettings | null>(null);

  useEffect(() => {
    if (userProfile?.uid) {
      getDoubleXpRecord(userProfile.uid).then(setDoubleRecord).catch(() => {});
    }
    getDoubleXpSettings().then(setDoubleSettings).catch(() => {});
  }, [userProfile?.uid]);

  // Filter reservations made specifically by this user (by charName or userUid)
  const myCharName = userProfile?.charName?.trim().toLowerCase() || '';
  const myUserId = userProfile?.uid || '';

  const myReservations = reservations.filter(res => {
    const resChar = res.charName?.trim().toLowerCase() || '';
    const resUserId = res.userUid || '';

    return (
      (myCharName && resChar === myCharName) ||
      (myUserId && resUserId === myUserId)
    );
  });

  const filteredByDay = myReservations.filter(res => res.day === selectedDay);

  const formatExp = (exp: number) => {
    if (!exp || isNaN(exp)) return '0 XP';
    if (exp >= 1_000_000) {
      return `${(exp / 1_000_000).toFixed(2)} kk (${exp.toLocaleString('pt-BR')} XP)`;
    }
    return `${exp.toLocaleString('pt-BR')} XP`;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner - Standard Application Formatting */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Suas Escolhas
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Aqui você visualiza exclusivamente os horários e respawns confirmados no seu personagem <strong className="text-slate-900 dark:text-white font-bold">{userProfile?.charName || 'Seu Personagem'}</strong> para sexta, sábado e domingo.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/80 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total de Agendamentos</div>
              <div className="text-xl font-black text-slate-900 dark:text-white">{myReservations.length} Respawns</div>
            </div>
          </div>
        </div>
      </div>

      {/* Double XP Experience Summary Card */}
      <div className="rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-white dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-900 p-6 sm:p-8 shadow-md dark:border-blue-900/50">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-blue-100 dark:border-blue-950/60">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 font-bold">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  Experiência Feita na Double XP
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                  Sexta, Sábado e Domingo
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {doubleSettings?.startDate && doubleSettings?.endDate
                  ? `Período da Double: ${doubleSettings.startDate} até ${doubleSettings.endDate}`
                  : 'Acompanhamento de XP realizado nos três dias de evento.'}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 px-5 py-3 rounded-2xl border border-blue-200 dark:border-blue-900 shadow-sm flex items-center gap-3">
            <Award className="h-7 w-7 text-amber-500 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Total Acumulado (3 Dias)</div>
              <div className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400">
                {formatExp(doubleRecord?.totalExp || 0)}
              </div>
            </div>
          </div>
        </div>

        {/* 3 Days Breakdown Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/80 dark:bg-slate-800/80 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/40 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Sexta-feira</div>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
                {formatExp(doubleRecord?.fridayExp || 0)}
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
              SEX
            </div>
          </div>

          <div className="bg-white/80 dark:bg-slate-800/80 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/40 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Sábado</div>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
                {formatExp(doubleRecord?.saturdayExp || 0)}
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
              SÁB
            </div>
          </div>

          <div className="bg-white/80 dark:bg-slate-800/80 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/40 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Domingo</div>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
                {formatExp(doubleRecord?.sundayExp || 0)}
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
              DOM
            </div>
          </div>
        </div>
      </div>

      {/* Day Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        {DAYS_CONFIG.map(day => {
          const count = myReservations.filter(r => r.day === day.key).length;
          const isSelected = selectedDay === day.key;

          return (
            <button
              key={day.key}
              onClick={() => setSelectedDay(day.key)}
              className={`flex-1 min-w-[120px] flex items-center justify-between px-4 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#2160FF] text-white shadow-lg shadow-blue-500/30'
                  : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>{day.label}</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                isSelected
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Reservations List for Selected Day */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white capitalize">
                {DAYS_CONFIG.find(d => d.key === selectedDay)?.label} - Respawns Marcados
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {filteredByDay.length === 0 ? 'Nenhum respawn agendado para este dia.' : `${filteredByDay.length} horário(s) confirmado(s).`}
              </p>
            </div>
          </div>
        </div>

        {filteredByDay.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="h-16 w-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Nenhum respawn marcado para este dia
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Você ainda não possui horários reservados neste dia. Vá na aba <span className="font-bold text-blue-600">Grade de Respawns</span> para reservar seus horários.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredByDay.map((res, index) => (
              <div
                key={res.id || `reservation-${index}-${res.day}-${res.timeSlot}`}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-xs font-black">
                      <Clock className="h-3.5 w-3.5" />
                      {res.timeSlot}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Confirmado
                    </span>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Local / Respawn</div>
                    <div className="text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                      <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                      <span>{res.respawnName}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-semibold">{res.charName}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {res.id}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
