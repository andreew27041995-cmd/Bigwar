import React, { useState, useEffect, useCallback } from 'react';
import bgImage from '../assets/images/pyramid_city_1792151896034.jpg';
import {
  fetchAllPlayersFromDatabase,
  findPlayerBySocialProviderInSupabase,
  getSupabaseClient
} from '../utils/supabase';

export interface SocialAuthPayload {
  provider: 'google' | 'facebook' | 'telegram';
  providerId: string;
  email?: string;
  nick?: string;
  password?: string;
  telegramUsername?: string;
  oauthAvatar?: string;
}

interface AuthScreenProps {
  onLogin: (nick: string, password: string) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };
  onRegister: (nick: string, email: string, password: string) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };
  onSocialAuth?: (payload: SocialAuthPayload) => Promise<{
    success: boolean;
    needsNickname?: boolean;
    error?: string;
  }>;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, onRegister, onSocialAuth }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [nick, setNick] = useState<string>('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setDbPlayers] = useState<any[]>([]);
  const [, setIsLoadingDb] = useState(true);

  // Social Auth Modal state (Google / Facebook / Telegram)
  const [activeSocialProvider, setActiveSocialProvider] = useState<'google' | 'facebook' | 'telegram' | null>(null);
  const [socialIdentifier, setSocialIdentifier] = useState('');
  const [socialNick, setSocialNick] = useState('');
  const [socialPass, setSocialPass] = useState('');
  const [socialStep, setSocialStep] = useState<'chooser' | 'identify' | 'create_char'>('chooser');
  const [savedGoogleEmails, setSavedGoogleEmails] = useState<string[]>([]);
  const [savedFacebookAccounts, setSavedFacebookAccounts] = useState<string[]>([]);
  const [fbPasswordInput, setFbPasswordInput] = useState('');
  const [oauthRedirecting, setOauthRedirecting] = useState(false);
  const [detectedTgUser, setDetectedTgUser] = useState<{
    id: string;
    username?: string;
    firstName?: string;
    photoUrl?: string;
  } | null>(null);

  const loadSavedSocialAccounts = useCallback((rows?: any[]) => {
    try {
      const gList = new Set<string>();
      const fbList = new Set<string>();

      const lastGoogle = localStorage.getItem('pyramida_social_id_google');
      if (lastGoogle && lastGoogle.includes('@')) gList.add(lastGoogle.trim().toLowerCase());

      const storedGoogleArr = JSON.parse(localStorage.getItem('pyramida_saved_google_emails') || '[]');
      if (Array.isArray(storedGoogleArr)) {
        storedGoogleArr.forEach((em) => {
          if (typeof em === 'string' && em.includes('@')) gList.add(em.trim().toLowerCase());
        });
      }

      const lastFb = localStorage.getItem('pyramida_social_id_facebook');
      if (lastFb) fbList.add(lastFb.trim().toLowerCase());

      const storedFbArr = JSON.parse(localStorage.getItem('pyramida_saved_facebook_accounts') || '[]');
      if (Array.isArray(storedFbArr)) {
        storedFbArr.forEach((acc) => {
          if (typeof acc === 'string' && acc.trim()) fbList.add(acc.trim().toLowerCase());
        });
      }

      if (Array.isArray(rows)) {
        rows.forEach((r) => {
          const rEmail = String(r.real_email || r.email || '').trim().toLowerCase();
          const prov = String(r.auth_provider || '').trim().toLowerCase();
          if (rEmail && rEmail.endsWith('@gmail.com')) {
            gList.add(rEmail);
          } else if (prov === 'google' && rEmail && rEmail.includes('@') && !rEmail.endsWith('@pyramida.game')) {
            gList.add(rEmail);
          }
          if (prov === 'facebook' && rEmail && !rEmail.endsWith('@pyramida.game')) {
            fbList.add(rEmail);
          }
        });
      }

      setSavedGoogleEmails(Array.from(gList).slice(0, 6));
      setSavedFacebookAccounts(Array.from(fbList).slice(0, 6));
    } catch {
      // ignore storage errors
    }
  }, []);

  const rememberSocialAccount = (provider: 'google' | 'facebook' | 'telegram', idOrEmail: string) => {
    try {
      const clean = idOrEmail.trim().toLowerCase();
      if (!clean) return;
      localStorage.setItem(`pyramida_social_id_${provider}`, clean);
      if (provider === 'google') {
        const next = Array.from(new Set([clean, ...savedGoogleEmails])).slice(0, 6);
        setSavedGoogleEmails(next);
        localStorage.setItem('pyramida_saved_google_emails', JSON.stringify(next));
      } else if (provider === 'facebook') {
        const next = Array.from(new Set([clean, ...savedFacebookAccounts])).slice(0, 6);
        setSavedFacebookAccounts(next);
        localStorage.setItem('pyramida_saved_facebook_accounts', JSON.stringify(next));
      }
    } catch {
      // ignore
    }
  };

  const loadDbPlayers = useCallback(async () => {
    setIsLoadingDb(true);
    try {
      const rows = await fetchAllPlayersFromDatabase();
      const uniqueMap = new Map<string, any>();
      for (const r of rows) {
        const rowName = String(r.name || r.nick || r['имя'] || '').trim();
        if (rowName && !uniqueMap.has(rowName.toLowerCase())) {
          uniqueMap.set(rowName.toLowerCase(), r);
        }
      }
      const uniqueRows = Array.from(uniqueMap.values());
      setDbPlayers(uniqueRows);
      loadSavedSocialAccounts(uniqueRows);
    } catch (e) {
      console.warn('Ошибка загрузки списка персонажей из Supabase:', e);
      loadSavedSocialAccounts();
    } finally {
      setIsLoadingDb(false);
    }
  }, [loadSavedSocialAccounts]);

  useEffect(() => {
    loadDbPlayers();
    // Автоопределение Telegram Mini App (если открыто внутри Telegram)
    try {
      const tg = (window as any)?.Telegram?.WebApp;
      const tgUser = tg?.initDataUnsafe?.user;
      if (tgUser && tgUser.id) {
        setDetectedTgUser({
          id: String(tgUser.id),
          username: tgUser.username ? String(tgUser.username) : undefined,
          firstName: tgUser.first_name ? String(tgUser.first_name) : undefined,
          photoUrl: tgUser.photo_url ? String(tgUser.photo_url) : undefined
        });
      }
    } catch {
      // ignore outside Telegram
    }
  }, [loadDbPlayers]);

  // Process an authenticated Supabase OAuth user (from redirect or popup)
  const processOAuthUserSession = useCallback(
    async (sessionUser: any) => {
      if (!sessionUser || !onSocialAuth) return;
      const rawProv = String(sessionUser.app_metadata?.provider || 'google').toLowerCase();
      const provider: 'google' | 'facebook' | 'telegram' =
        rawProv === 'facebook' ? 'facebook' : 'google';
      const providerId = String(sessionUser.id || sessionUser.email || '').trim();
      const userEmail = String(sessionUser.email || '').trim().toLowerCase();
      if (!providerId) return;

      if (userEmail) {
        rememberSocialAccount(provider, userEmail);
      }

      // If running inside an OAuth popup window, send session to opener and close popup
      if (typeof window !== 'undefined' && window.opener && window.opener !== window) {
        try {
          window.opener.postMessage(
            {
              type: 'PYRAMIDA_OAUTH_SESSION',
              user: sessionUser
            },
            '*'
          );
          window.close();
          return;
        } catch {
          // continue in current window if postMessage fails
        }
      }

      const existing = await findPlayerBySocialProviderInSupabase(provider, providerId, userEmail);
      if (existing) {
        setIsSubmitting(true);
        await onSocialAuth({
          provider,
          providerId,
          email: userEmail
        });
        setIsSubmitting(false);
      } else {
        setActiveSocialProvider(provider);
        setSocialIdentifier(userEmail || providerId);
        const suggestedNick = (
          sessionUser.user_metadata?.full_name ||
          sessionUser.user_metadata?.name ||
          (userEmail ? userEmail.split('@')[0] : '') ||
          ''
        )
          .replace(/[^a-zA-Zа-яА-ЯёЁ0-9_-]/g, '')
          .slice(0, 16);
        setSocialNick(suggestedNick || `Hero_${Math.floor(100 + Math.random() * 899)}`);
        setSocialStep('create_char');
        setInfoMsg(
          provider === 'google'
            ? `✅ Выбран Google Email: ${userEmail || providerId}. Придумайте никнейм персонажа для привязки!`
            : `✅ Аккаунт Facebook (${userEmail || providerId}) подтверждён и готов к привязке! Выберите имя персонажа:`
        );
      }
    },
    [onSocialAuth]
  );

  // Check if returning from Supabase OAuth redirect or receiving popup postMessage
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !onSocialAuth) return;

    client.auth
      .getSession()
      .then(async ({ data }) => {
        const sessionUser = data?.session?.user;
        if (sessionUser) {
          await processOAuthUserSession(sessionUser);
        }
      })
      .catch(() => {});

    const { data: authSub } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        processOAuthUserSession(session.user);
      }
    });

    const handlePopupMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PYRAMIDA_OAUTH_SESSION' && event.data.user) {
        setOauthRedirecting(false);
        processOAuthUserSession(event.data.user);
      }
    };
    window.addEventListener('message', handlePopupMessage);

    return () => {
      authSub?.subscription?.unsubscribe();
      window.removeEventListener('message', handlePopupMessage);
    };
  }, [onSocialAuth, processOAuthUserSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);
    setInfoMsg(null);

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

  // Select an email/account from Google Account Chooser or Facebook Binding screen
  const handleSelectSocialAccount = async (
    provider: 'google' | 'facebook' | 'telegram',
    rawEmailOrId: string
  ) => {
    if (!onSocialAuth || isSubmitting) return;
    setErrorMsg(null);
    setInfoMsg(null);

    let cleanId = rawEmailOrId.trim();
    if (!cleanId) {
      setErrorMsg(
        provider === 'google'
          ? 'Выберите или введите ваш Google Email (например, name@gmail.com)!'
          : provider === 'facebook'
          ? 'Введите ваш Email или номер телефона Facebook для привязки!'
          : 'Введите ваш Telegram @username или ID!'
      );
      return;
    }

    if (provider === 'google' && !cleanId.includes('@')) {
      cleanId = `${cleanId}@gmail.com`;
    }

    const normalizedProviderId =
      provider === 'telegram' ? cleanId.replace(/^@/, '').toLowerCase() : cleanId.toLowerCase();
    const resolvedEmail =
      cleanId.includes('@') && provider !== 'telegram'
        ? cleanId.toLowerCase()
        : `${normalizedProviderId.replace(/[^a-z0-9_]/gi, '')}@${provider}.pyramida.game`;

    rememberSocialAccount(provider, cleanId);
    setSocialIdentifier(cleanId);

    setIsSubmitting(true);
    try {
      const existing = await findPlayerBySocialProviderInSupabase(
        provider,
        normalizedProviderId,
        resolvedEmail
      );
      if (existing) {
        const res = await onSocialAuth({
          provider,
          providerId: normalizedProviderId,
          email: resolvedEmail,
          telegramUsername: provider === 'telegram' ? cleanId.replace(/^@/, '') : undefined
        });
        if (!res.success) {
          setErrorMsg(res.error || 'Ошибка входа через привязанный аккаунт.');
        }
        return;
      }

      // Not registered yet -> automatically transition to character creation & binding step
      const suggested = cleanId.includes('@')
        ? cleanId.split('@')[0].replace(/^@/, '')
        : cleanId.replace(/^@/, '');
      setSocialNick(suggested.replace(/[^a-zA-Zа-яА-ЯёЁ0-9_-]/g, '').slice(0, 18) || 'PharaohHero');
      setSocialStep('create_char');
      setInfoMsg(
        provider === 'google'
          ? `✅ Выбран аккаунт Google (${resolvedEmail}). Введите никнейм нового персонажа для завершения регистрации:`
          : provider === 'facebook'
          ? `✅ Аккаунт Facebook (${cleanId}) готов к привязке! Введите никнейм вашего персонажа в игре:`
          : `✅ Аккаунт Telegram (${cleanId}) готов к привязке! Выберите имя вашего персонажа:`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Attempt external Supabase OAuth popup/redirect (Google account chooser / Facebook login)
  const triggerExternalOAuthWindow = async (provider: 'google' | 'facebook') => {
    const client = getSupabaseClient();
    if (!client) return false;
    try {
      setOauthRedirecting(true);
      const { data, error } = await client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true,
          queryParams:
            provider === 'google'
              ? { prompt: 'select_account', access_type: 'offline' }
              : { auth_type: 'rerequest', scope: 'email,public_profile' }
        }
      });
      if (error || !data?.url) {
        setOauthRedirecting(false);
        return false;
      }

      // Check if provider is enabled in Supabase Auth settings before navigating away
      try {
        const settingsRes = await fetch(
          `${(client as any).supabaseUrl || 'https://lgbxbwzqckdnviygsghu.supabase.co'}/auth/v1/settings`,
          {
            headers: {
              apikey:
                (client as any).supabaseKey ||
                'sb_publishable_lGMAAuZELw2gPDZeuEx0VQ_DgPK7szm'
            }
          }
        );
        if (settingsRes.ok) {
          const settingsJson = await settingsRes.json();
          const isProviderEnabled = Boolean(settingsJson?.external?.[provider]);
          if (!isProviderEnabled) {
            setOauthRedirecting(false);
            return false;
          }
        }
      } catch {
        // ignore check error
      }

      const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
      if (isInIframe) {
        const width = 520;
        const height = 640;
        const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
        const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
        window.open(
          data.url,
          `pyramida_${provider}_oauth`,
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
        );
        setTimeout(() => setOauthRedirecting(false), 1500);
      } else {
        window.location.assign(data.url);
      }
      return true;
    } catch {
      setOauthRedirecting(false);
      return false;
    }
  };

  const handleOpenSocialProvider = async (provider: 'google' | 'facebook' | 'telegram') => {
    setErrorMsg(null);
    setInfoMsg(null);

    // If Telegram Mini App user is automatically detected, check DB immediately!
    if (provider === 'telegram' && detectedTgUser && onSocialAuth) {
      setIsSubmitting(true);
      try {
        const existing = await findPlayerBySocialProviderInSupabase(
          'telegram',
          detectedTgUser.id,
          `${detectedTgUser.id}@telegram.pyramida.game`
        );
        if (existing) {
          const res = await onSocialAuth({
            provider: 'telegram',
            providerId: detectedTgUser.id,
            telegramUsername: detectedTgUser.username
          });
          if (res.success) return;
        }
        // Otherwise open character creation step with pre-filled Telegram profile
        setActiveSocialProvider('telegram');
        setSocialIdentifier(detectedTgUser.username ? `@${detectedTgUser.username}` : detectedTgUser.id);
        setSocialNick((detectedTgUser.username || detectedTgUser.firstName || `Hero_${detectedTgUser.id.slice(-4)}`).slice(0, 18));
        setSocialPass('');
        setSocialStep('create_char');
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    // Automatically open the Google Account Chooser or Facebook Account Binding screen
    const savedId = localStorage.getItem(`pyramida_social_id_${provider}`) || '';
    setActiveSocialProvider(provider);
    setSocialIdentifier(savedId);
    setSocialNick('');
    setSocialPass('');
    setFbPasswordInput('');
    setSocialStep(provider === 'telegram' ? 'identify' : 'chooser');

    // Also attempt real OAuth redirect/popup if enabled in Supabase project
    if (provider === 'google' || provider === 'facebook') {
      triggerExternalOAuthWindow(provider);
    }
  };

  const handleSocialContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSocialProvider || !onSocialAuth || isSubmitting) return;
    setErrorMsg(null);

    if (socialStep === 'chooser' || socialStep === 'identify') {
      await handleSelectSocialAccount(activeSocialProvider, socialIdentifier);
      return;
    }

    const cleanId = socialIdentifier.trim();
    const normalizedProviderId =
      activeSocialProvider === 'telegram'
        ? cleanId.replace(/^@/, '').toLowerCase()
        : cleanId.toLowerCase();
    const resolvedEmail =
      cleanId.includes('@') && activeSocialProvider !== 'telegram'
        ? cleanId.toLowerCase()
        : `${normalizedProviderId.replace(/[^a-z0-9_]/gi, '')}@${activeSocialProvider}.pyramida.game`;

    rememberSocialAccount(activeSocialProvider, cleanId);

    // Step 2: Register new character linked to this Google / Facebook / Telegram account
    const cleanCharNick = socialNick.trim();
    if (!cleanCharNick || cleanCharNick.length < 2) {
      setErrorMsg('Введите имя персонажа (минимум 2 символа)!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onSocialAuth({
        provider: activeSocialProvider,
        providerId:
          detectedTgUser && activeSocialProvider === 'telegram'
            ? detectedTgUser.id
            : normalizedProviderId,
        email: resolvedEmail,
        nick: cleanCharNick,
        password: socialPass.trim() || `${activeSocialProvider}_${normalizedProviderId}`,
        telegramUsername:
          activeSocialProvider === 'telegram'
            ? detectedTgUser?.username || cleanId.replace(/^@/, '')
            : undefined
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Ошибка создания персонажа!');
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

      <div className="relative z-10 flex w-full max-w-[395px] flex-col rounded-xl border-2 border-orange-500/80 bg-[#180d24]/95 p-5 shadow-[0_0_35px_rgba(249,115,22,0.35)]">
        {/* Header */}
        <div className="text-center space-y-1 mb-3.5">
          <div className="text-2xl font-black text-orange-400 tracking-wider drop-shadow-[0_0_8px_rgba(249,115,22,0.7)]">
            🎃 ПИРАМИДА: ВОЙНЫ 🎃
          </div>
          <div className="text-[10px] text-amber-200/80">Легендарная ММО RPG • Праздник Хеллоуин 🦇</div>
          <div className="text-[9px] text-orange-300/70 font-mono">Версия 1.0.98 • Обновление: 28.10.2026</div>
        </div>

        {/* ==================== GOOGLE ACCOUNT CHOOSER VIEW ==================== */}
        {activeSocialProvider === 'google' && (
          <div className="rounded-2xl border border-slate-200 bg-white text-slate-900 p-4 shadow-2xl space-y-3 animate-fadeIn">
            {/* Google Top Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-base font-black text-red-600">
                  G
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-700 leading-tight">
                    Вход с аккаунтом Google
                  </div>
                  <div className="text-[9px] text-slate-500">
                    accounts.google.com • Привязка к «Пирамида: Войны»
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveSocialProvider(null);
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className="rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                ✕ Назад
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-center text-[11px] font-bold text-red-700">
                {errorMsg}
              </div>
            )}

            {infoMsg && (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-center text-[10.5px] font-bold text-emerald-800">
                {infoMsg}
              </div>
            )}

            {socialStep === 'chooser' || socialStep === 'identify' ? (
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-sm font-black text-slate-900">Выберите аккаунт Google</div>
                  <div className="text-[10.5px] text-slate-600 mt-0.5">
                    для перехода в приложение <strong className="text-orange-600">«Пирамида: Войны»</strong>
                  </div>
                </div>

                {/* Saved / Detected Google Accounts List for 1-Click Selection */}
                {savedGoogleEmails.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                      Доступные аккаунты Google на устройстве:
                    </div>
                    <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                      {savedGoogleEmails.map((gEmail) => {
                        const initial = gEmail.charAt(0).toUpperCase();
                        return (
                          <button
                            key={gEmail}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleSelectSocialAccount('google', gEmail)}
                            className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-blue-50/80 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-black text-white shadow">
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-xs font-bold text-slate-900">
                                  {gEmail.split('@')[0]}
                                </div>
                                <div className="truncate text-[10px] text-slate-600">{gEmail}</div>
                              </div>
                            </div>
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700 shrink-0">
                              Выбрать →
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Enter / Choose any Google Email */}
                <form onSubmit={handleSocialContinue} className="space-y-2.5 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      {savedGoogleEmails.length > 0
                        ? 'Или укажите другой адрес электронной почты Google:'
                        : 'Введите или выберите ваш адрес Gmail для регистрации / входа:'}
                    </label>
                    <input
                      type="email"
                      value={socialIdentifier}
                      onChange={(e) => setSocialIdentifier(e.target.value)}
                      placeholder="yourname@gmail.com"
                      autoFocus
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] py-2.5 text-xs font-bold text-white shadow transition-all active:scale-98 cursor-pointer disabled:opacity-60"
                  >
                    {isSubmitting
                      ? '⏳ Проверка аккаунта Google...'
                      : 'Продолжить с выбранным Email →'}
                  </button>
                </form>

                <div className="pt-1 border-t border-slate-200 text-[9.5px] text-slate-500 text-center leading-snug">
                  Аккаунт Google будет автоматически привязан к вашему персонажу в базе данных Supabase для быстрого входа с любого устройства.
                </div>
              </div>
            ) : (
              /* Step 2: Google Email selected -> Bind to new Character Nickname */
              <form onSubmit={handleSocialContinue} className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-xs font-black text-white">
                      {socialIdentifier.charAt(0).toUpperCase() || 'G'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] font-bold uppercase text-blue-700">
                        Выбранный Google Email:
                      </div>
                      <div className="truncate text-xs font-black text-slate-900">
                        {socialIdentifier.includes('@') ? socialIdentifier : `${socialIdentifier}@gmail.com`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSocialStep('chooser');
                      setInfoMsg(null);
                    }}
                    className="text-[9.5px] font-bold text-blue-700 underline hover:text-blue-900 shrink-0 ml-2 cursor-pointer"
                  >
                    Сменить
                  </button>
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-800 mb-1">
                    👤 Имя вашего нового персонажа в игре
                  </label>
                  <input
                    type="text"
                    value={socialNick}
                    onChange={(e) => setSocialNick(e.target.value)}
                    placeholder="Придумайте никнейм героя..."
                    maxLength={20}
                    autoFocus
                    className="w-full rounded-lg border-2 border-blue-500 bg-white px-3 py-2 text-xs font-bold text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    🔑 Пароль персонажа (необязательно, для прямого входа по нику)
                  </label>
                  <input
                    type="password"
                    value={socialPass}
                    onChange={(e) => setSocialPass(e.target.value)}
                    placeholder="Пароль (по желанию)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting
                    ? '⏳ Привязка Google и создание героя...'
                    : '✨ Привязать Google и создать персонажа'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ==================== FACEBOOK ACCOUNT LOGIN & BINDING VIEW ==================== */}
        {activeSocialProvider === 'facebook' && (
          <div className="rounded-2xl border border-blue-500/60 bg-[#f0f2f5] text-slate-900 p-4 shadow-2xl space-y-3 animate-fadeIn">
            {/* Facebook Top Bar */}
            <div className="flex items-center justify-between border-b border-slate-300 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1877F2] text-base font-black text-white shadow">
                  f
                </div>
                <div>
                  <div className="text-xs font-black text-[#1877F2] leading-tight">
                    Facebook • Авторизация
                  </div>
                  <div className="text-[9px] text-slate-500">
                    facebook.com • Привязка аккаунта к «Пирамида: Войны»
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveSocialProvider(null);
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕ Назад
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-center text-[11px] font-bold text-red-700">
                {errorMsg}
              </div>
            )}

            {infoMsg && (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-center text-[10.5px] font-bold text-emerald-800">
                {infoMsg}
              </div>
            )}

            {socialStep === 'chooser' || socialStep === 'identify' ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-white p-3 border border-slate-200 shadow-sm space-y-2.5">
                  <div className="text-center">
                    <div className="text-xs font-black text-slate-900">
                      Войдите в Facebook для привязки персонажа
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Приложение <strong className="text-[#1877F2]">«Пирамида: Войны»</strong> получит доступ к вашему профилю и Email для сохранения прогресса.
                    </div>
                  </div>

                  {/* Saved Facebook accounts on device */}
                  {savedFacebookAccounts.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[9px] font-bold uppercase text-slate-500">
                        Привязанные аккаунты Facebook:
                      </div>
                      <div className="space-y-1">
                        {savedFacebookAccounts.map((fbAcc) => (
                          <button
                            key={fbAcc}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleSelectSocialAccount('facebook', fbAcc)}
                            className="flex w-full items-center justify-between rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-left hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1877F2] text-xs font-black text-white">
                                f
                              </span>
                              <span className="truncate text-xs font-bold text-slate-800">
                                {fbAcc}
                              </span>
                            </div>
                            <span className="rounded bg-[#1877F2] px-2 py-0.5 text-[9px] font-bold text-white shrink-0">
                              Продолжить →
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSocialContinue} className="space-y-2 pt-1">
                    <div>
                      <input
                        type="text"
                        value={socialIdentifier}
                        onChange={(e) => setSocialIdentifier(e.target.value)}
                        placeholder="Электронный адрес или номер телефона Facebook"
                        autoFocus
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-[#1877F2] focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="password"
                        value={fbPasswordInput}
                        onChange={(e) => setFbPasswordInput(e.target.value)}
                        placeholder="Пароль Facebook"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-[#1877F2] focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full rounded-lg bg-[#1877F2] hover:bg-[#166fe5] py-2.5 text-xs font-black text-white shadow transition-all active:scale-98 cursor-pointer disabled:opacity-60"
                    >
                      {isSubmitting
                        ? '⏳ Подключение к Facebook...'
                        : 'Войти через Facebook и привязать'}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              /* Step 2: Facebook Account verified -> Bind to Character Nickname */
              <form
                onSubmit={handleSocialContinue}
                className="rounded-xl bg-white p-3 border border-slate-200 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1877F2] text-xs font-black text-white">
                      f
                    </span>
                    <div className="min-w-0">
                      <div className="text-[9px] font-bold uppercase text-[#1877F2]">
                        Аккаунт Facebook привязан:
                      </div>
                      <div className="truncate text-xs font-black text-slate-900">
                        {socialIdentifier}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSocialStep('chooser');
                      setInfoMsg(null);
                    }}
                    className="text-[9.5px] font-bold text-[#1877F2] underline shrink-0 ml-2 cursor-pointer"
                  >
                    Сменить
                  </button>
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-800 mb-1">
                    👤 Имя вашего персонажа в игре
                  </label>
                  <input
                    type="text"
                    value={socialNick}
                    onChange={(e) => setSocialNick(e.target.value)}
                    placeholder="Придумайте никнейм героя..."
                    maxLength={20}
                    autoFocus
                    className="w-full rounded-lg border-2 border-[#1877F2] bg-white px-3 py-2 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    🔑 Резервный пароль персонажа (по желанию)
                  </label>
                  <input
                    type="password"
                    value={socialPass}
                    onChange={(e) => setSocialPass(e.target.value)}
                    placeholder="Пароль для входа с других устройств"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-[#1877F2] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-[#42b72a] hover:bg-[#36a420] py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting
                    ? '⏳ Привязка Facebook в Supabase...'
                    : '✨ Привязать Facebook и начать игру'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ==================== TELEGRAM SOCIAL AUTH VIEW ==================== */}
        {activeSocialProvider === 'telegram' && (
          <div className="space-y-3 rounded-xl border border-sky-400/60 bg-slate-950/90 p-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">✈️</span>
                <div>
                  <div className="text-xs font-black text-sky-300">Telegram Аккаунт</div>
                  <div className="text-[9px] text-slate-400">
                    {socialStep === 'create_char'
                      ? 'Привязка Telegram и создание персонажа'
                      : 'Вход или регистрация через Telegram'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveSocialProvider(null);
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-400 hover:text-white"
              >
                ✕ Назад
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-red-500/50 bg-red-950/80 p-2 text-center text-[11px] font-bold text-red-200">
                {errorMsg}
              </div>
            )}

            {infoMsg && (
              <div className="rounded-lg border border-emerald-500/50 bg-emerald-950/70 p-2 text-center text-[10.5px] font-bold text-emerald-200">
                {infoMsg}
              </div>
            )}

            <form onSubmit={handleSocialContinue} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-300 mb-1">
                  Ваш Telegram @username или ID
                </label>
                <input
                  type="text"
                  value={socialIdentifier}
                  onChange={(e) => {
                    setSocialIdentifier(e.target.value);
                    if (socialStep === 'create_char') setSocialStep('identify');
                  }}
                  placeholder="@username или ID"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-amber-200 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                />
              </div>

              {socialStep === 'create_char' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-300 mb-1">
                      👤 Имя вашего персонажа в игре
                    </label>
                    <input
                      type="text"
                      value={socialNick}
                      onChange={(e) => setSocialNick(e.target.value)}
                      placeholder="Придумайте никнейм героя..."
                      maxLength={20}
                      className="w-full rounded-lg border border-amber-500/70 bg-slate-900 px-3 py-2 text-xs font-bold text-amber-200 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">
                      🔑 Резервный пароль (необязательно)
                    </label>
                    <input
                      type="password"
                      value={socialPass}
                      onChange={(e) => setSocialPass(e.target.value)}
                      placeholder="Пароль (по желанию)"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-amber-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-gradient-to-r from-sky-500 to-cyan-600 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-60"
              >
                {isSubmitting
                  ? '⏳ Проверка в базе Supabase...'
                  : socialStep === 'create_char'
                  ? '✨ Создать персонажа и войти'
                  : '🚀 Продолжить'}
              </button>
            </form>
          </div>
        )}

        {/* ==================== STANDARD LOGIN / REGISTER VIEW ==================== */}
        {!activeSocialProvider && (
          <>
            {/* Tab Switcher */}
            <div className="flex rounded-lg bg-slate-900 border border-slate-700 p-1 mb-3.5">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
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
                onClick={() => {
                  setTab('register');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`flex-1 rounded-md py-2 text-xs font-bold transition-all ${
                  tab === 'register'
                    ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🛡️ Обычная регистрация
              </button>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div className="mb-3 rounded-lg border border-red-500/50 bg-red-950/80 p-2.5 text-center text-xs font-bold text-red-200">
                {errorMsg}
              </div>
            )}

            {/* Standard Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-300 mb-1">Никнейм персонажа</label>
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
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">Email (для сохранения в БД)</label>
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
                className="w-full rounded-lg bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-[0_0_15px_rgba(234,179,8,0.6)] hover:brightness-110 active:scale-95 transition-all mt-1 disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting
                  ? '⏳ Связь с базой Supabase...'
                  : tab === 'login'
                  ? '🚀 Войти в игру'
                  : '✨ Зарегистрировать персонажа'}
              </button>
            </form>

            {/* Social Registration / Login Divider */}
            <div className="my-3.5 flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-800" />
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                Авторизация и привязка аккаунта
              </span>
              <div className="h-px flex-1 bg-slate-800" />
            </div>

            {/* Social Auth Buttons: Google, Facebook, Telegram */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isSubmitting || oauthRedirecting}
                onClick={() => handleOpenSocialProvider('google')}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-red-500/50 bg-gradient-to-b from-slate-900 to-slate-950 py-2 px-2 text-xs font-extrabold text-white shadow hover:border-red-400 hover:bg-slate-900 active:scale-95 transition-all cursor-pointer"
                title="Перейти к выбору Google аккаунта (Email) для регистрации или входа"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black text-red-600 shadow">
                  G
                </span>
                <span className="text-[10px] text-slate-200">Google</span>
                <span className="text-[7.5px] text-amber-300/80 leading-none">Выбор Email</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting || oauthRedirecting}
                onClick={() => handleOpenSocialProvider('facebook')}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-blue-500/50 bg-gradient-to-b from-slate-900 to-slate-950 py-2 px-2 text-xs font-extrabold text-white shadow hover:border-blue-400 hover:bg-slate-900 active:scale-95 transition-all cursor-pointer"
                title="Перейти в Facebook для авторизации и привязки персонажа"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1877F2] text-sm font-black text-white shadow">
                  f
                </span>
                <span className="text-[10px] text-slate-200">Facebook</span>
                <span className="text-[7.5px] text-blue-300/80 leading-none">Привязка FB</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting || oauthRedirecting}
                onClick={() => handleOpenSocialProvider('telegram')}
                className="relative flex flex-col items-center justify-center gap-1 rounded-xl border border-sky-400/50 bg-gradient-to-b from-slate-900 to-slate-950 py-2 px-2 text-xs font-extrabold text-white shadow hover:border-sky-300 hover:bg-slate-900 active:scale-95 transition-all cursor-pointer"
                title="Вход или регистрация через Telegram"
              >
                {detectedTgUser && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950 animate-pulse" />
                )}
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#229ED9] text-xs font-black text-white shadow">
                  ✈️
                </span>
                <span className="text-[10px] text-sky-200">Telegram</span>
                <span className="text-[7.5px] text-sky-300/80 leading-none">Mini App</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

