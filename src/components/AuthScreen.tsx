import React, { useState, useEffect, useCallback } from 'react';
import bgImage from '../assets/images/pyramid_city_1792151896034.jpg';
import { fetchAllPlayersFromDatabase } from '../utils/supabase';

interface AuthScreenProps {
  onLogin: (nick: string, password: string) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };
  onRegister: (nick: string, email: string, password: string) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, onRegister }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [nick, setNick] = useState<string>('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dbPlayers, setDbPlayers] = useState<any[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(true);

  const loadDbPlayers = useCallback(async () => {
    setIsLoadingDb(true);
    try {
      const rows = await fetchAllPlayersFromDatabase();
      // Убираем дубликаты по имени (оставляем самые свежие записи)
      const uniqueMap = new Map<string, any>();
      for (const r of rows) {
        const rowName = String(r.name || r.nick || r['имя'] || '').trim();
        if (rowName && !uniqueMap.has(rowName.toLowerCase())) {
          uniqueMap.set(rowName.toLowerCase(), r);
        }
      }
      setDbPlayers(Array.from(uniqueMap.values()));
    } catch (e) {
      console.warn('Ошибка загрузки списка персонажей из Supabase:', e);
    } finally {
      setIsLoadingDb(false);
    }
  }, []);

  useEffect(() => {
    loadDbPlayers();
  }, [loadDbPlayers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    const cleanNick = nick.trim();
    const cleanPass = password.trim();
    const cleanEmail = email.trim();

    if (!cleanNick || !cleanPass) {
      setErrorMsg('Пожалуйста, введите никнейм и пароль!');
      return;
    }

    setIsSubmitting(true);
    try {
      if (tab === 'login') {
        const res = await onLogin(cleanNick, cleanPass);
        if (!res.success) {
          setErrorMsg(res.error || 'Ошибка входа!');
        }
      } else {
        const finalEmail = cleanEmail || `${cleanNick.toLowerCase()}@pyramida.game`;
        const res = await onRegister(cleanNick, finalEmail, cleanPass);
        if (!res.success) {
          setErrorMsg(res.error || 'Ошибка регистрации!');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center bg-[#0b0d10] font-sans text-white select-none bg-cover bg-center p-4"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#170928]/85 via-[#240d33]/80 to-[#0e0716]/90 backdrop-blur-sm pointer-events-none" />

      <div className="relative z-10 flex w-full max-w-[380px] flex-col rounded-xl border-2 border-orange-500/80 bg-[#180d24]/95 p-6 shadow-[0_0_35px_rgba(249,115,22,0.35)]">
        {/* Header */}
        <div className="text-center space-y-1 mb-4">
          <div className="text-2xl font-black text-orange-400 tracking-wider drop-shadow-[0_0_8px_rgba(249,115,22,0.7)]">🎃 ПИРАМИДА: ВОЙНЫ 🎃</div>
          <div className="text-[10px] text-amber-200/80">Легендарная ММО RPG • Праздник Хеллоуин 🦇</div>
          <div className="text-[9px] text-orange-300/70 font-mono">Версия 1.0.60 • Обновление: 24.10.2026</div>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-lg bg-slate-900 border border-slate-700 p-1 mb-4">
          <button
            type="button"
            onClick={() => { setTab('login'); setErrorMsg(null); }}
            className={`flex-1 rounded-md py-2 text-xs font-bold transition-all ${
              tab === 'login'
                ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🔑 Вход
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setErrorMsg(null); }}
            className={`flex-1 rounded-md py-2 text-xs font-bold transition-all ${
              tab === 'register'
                ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🛡️ Регистрация
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-950/80 p-2.5 text-center text-xs font-bold text-red-200">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[10px] font-bold text-slate-300 mb-1">Никнейм</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs">👤</span>
              <input
                type="text"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder="Введите никнейм..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pl-8 text-xs text-amber-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
                maxLength={20}
              />
            </div>
          </div>

          {tab === 'register' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-300 mb-1">Email (необязательно)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs">✉️</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pl-8 text-xs text-amber-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-300 mb-1">Пароль</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs">🔑</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pl-8 text-xs text-amber-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-[0_0_15px_rgba(234,179,8,0.6)] hover:brightness-110 active:scale-95 transition-all mt-2 disabled:opacity-60"
          >
            {isSubmitting
              ? '⏳ Связь с базой Supabase...'
              : tab === 'login'
              ? '🚀 Войти в игру'
              : '✨ Зарегистрировать в БД'}
          </button>
        </form>

      </div>
    </div>
  );
};
