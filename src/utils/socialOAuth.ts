import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  Auth
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

export interface SavedSocialAccount {
  provider: 'google' | 'facebook';
  providerId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  boundNick?: string;
  lastUsedAt: number;
}

export interface SocialOAuthResult {
  status: 'authenticated' | 'redirecting' | 'external_window_opened' | 'cancelled' | 'error';
  provider: 'google' | 'facebook';
  email?: string;
  providerId?: string;
  displayName?: string;
  avatarUrl?: string;
  popupWindow?: Window | null;
  errorMessage?: string;
}

const SAVED_ACCOUNTS_KEY = 'pyramida_saved_social_accounts_v1';

let firebaseAuthInstance: Auth | null = null;
let googleProviderInstance: GoogleAuthProvider | null = null;
let facebookProviderInstance: FacebookAuthProvider | null = null;

const supabaseExternalProviders = {
  checked: false,
  google: false,
  facebook: false
};

export function initFirebaseAuth(): {
  auth: Auth | null;
  googleProvider: GoogleAuthProvider | null;
  facebookProvider: FacebookAuthProvider | null;
} {
  try {
    if (!firebaseAuthInstance) {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      firebaseAuthInstance = getAuth(app);
    }
    if (!googleProviderInstance) {
      googleProviderInstance = new GoogleAuthProvider();
      googleProviderInstance.addScope('email');
      googleProviderInstance.addScope('profile');
      googleProviderInstance.setCustomParameters({
        prompt: 'select_account'
      });
    }
    if (!facebookProviderInstance) {
      facebookProviderInstance = new FacebookAuthProvider();
      facebookProviderInstance.addScope('email');
      facebookProviderInstance.addScope('public_profile');
      facebookProviderInstance.setCustomParameters({
        display: 'popup'
      });
    }
    return {
      auth: firebaseAuthInstance,
      googleProvider: googleProviderInstance,
      facebookProvider: facebookProviderInstance
    };
  } catch (err) {
    console.warn('[SocialOAuth] Firebase Auth init warning:', err);
    return { auth: null, googleProvider: null, facebookProvider: null };
  }
}

export function isFirebaseAuthorizedHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = (window.location.hostname || '').toLowerCase();
  return (
    host.endsWith('.run.app') ||
    host.endsWith('.firebaseapp.com') ||
    host.endsWith('.web.app') ||
    host === 'localhost' ||
    host === '127.0.0.1'
  );
}

export async function prefetchSupabaseOAuthSettings(): Promise<{ google: boolean; facebook: boolean }> {
  if (supabaseExternalProviders.checked) {
    return {
      google: supabaseExternalProviders.google,
      facebook: supabaseExternalProviders.facebook
    };
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY
      }
    });
    if (res.ok) {
      const data = await res.json();
      supabaseExternalProviders.google = Boolean(data?.external?.google);
      supabaseExternalProviders.facebook = Boolean(data?.external?.facebook);
      supabaseExternalProviders.checked = true;
    }
  } catch {
    // ignore network errors
  }
  return {
    google: supabaseExternalProviders.google,
    facebook: supabaseExternalProviders.facebook
  };
}

export function getSavedSocialAccounts(provider?: 'google' | 'facebook'): SavedSocialAccount[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    const list: SavedSocialAccount[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    const filtered = provider ? list.filter((a) => a && a.provider === provider) : list;
    return filtered.sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
  } catch {
    return [];
  }
}

export function saveSocialAccountToDevice(account: Omit<SavedSocialAccount, 'lastUsedAt'>): void {
  try {
    const existing = getSavedSocialAccounts();
    const cleanEmail = (account.email || '').trim().toLowerCase();
    const cleanId = (account.providerId || cleanEmail).trim().toLowerCase();
    if (!cleanEmail && !cleanId) return;

    const updated: SavedSocialAccount = {
      ...account,
      email: cleanEmail || `${cleanId}@${account.provider}.com`,
      providerId: cleanId || cleanEmail,
      lastUsedAt: Date.now()
    };

    const nextList = [
      updated,
      ...existing.filter(
        (item) =>
          !(
            item.provider === account.provider &&
            (item.email.toLowerCase() === updated.email || item.providerId.toLowerCase() === updated.providerId)
          )
      )
    ].slice(0, 10);

    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(nextList));
    localStorage.setItem(`pyramida_social_id_${account.provider}`, updated.email);
  } catch {
    // ignore storage errors
  }
}

export async function checkFirebaseRedirectResult(): Promise<SocialOAuthResult | null> {
  if (!isFirebaseAuthorizedHost()) return null;
  const { auth } = initFirebaseAuth();
  if (!auth) return null;
  try {
    const res = await getRedirectResult(auth);
    if (res && res.user) {
      const providerData = res.user.providerData?.[0];
      const rawProv = String(providerData?.providerId || res.providerId || 'google.com').toLowerCase();
      const provider: 'google' | 'facebook' = rawProv.includes('facebook') ? 'facebook' : 'google';
      const email = res.user.email || providerData?.email || '';
      const providerId = providerData?.uid || res.user.uid || email;
      const displayName = res.user.displayName || providerData?.displayName || '';
      const avatarUrl = res.user.photoURL || providerData?.photoURL || undefined;

      if (email || providerId) {
        saveSocialAccountToDevice({
          provider,
          providerId,
          email: email || `${providerId}@${provider}.com`,
          displayName,
          avatarUrl
        });
        return {
          status: 'authenticated',
          provider,
          email: email || `${providerId}@${provider}.com`,
          providerId,
          displayName,
          avatarUrl
        };
      }
    }
  } catch (err) {
    console.warn('[SocialOAuth] getRedirectResult notice:', err);
  }
  return null;
}

export function openExternalProviderWindow(provider: 'google' | 'facebook'): Window | null {
  if (typeof window === 'undefined') return null;

  const targetUrl =
    provider === 'google'
      ? 'https://accounts.google.com/AccountChooser?continue=https%3A%2F%2Fmyaccount.google.com%2Femail&service=accountsettings'
      : 'https://www.facebook.com/login.php?next=https%3A%2F%2Fwww.facebook.com%2Fsettings%3Ftab%3Daccount';

  // Check if running inside Telegram Mini App with openLink support
  const tg = (window as any)?.Telegram?.WebApp;
  if (tg && typeof tg.openLink === 'function' && tg.initDataUnsafe?.user) {
    try {
      tg.openLink(targetUrl);
      return null;
    } catch {
      // fallback to window.open
    }
  }

  const width = 500;
  const height = 640;
  const left = Math.max(0, Math.round((window.screen.width - width) / 2));
  const top = Math.max(0, Math.round((window.screen.height - height) / 2));

  try {
    const popup = window.open(
      targetUrl,
      `${provider}_auth_window`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes`
    );
    return popup;
  } catch {
    return null;
  }
}

/**
 * Initiates Google Account Chooser or Facebook Login/Binding immediately upon user click.
 * Preserves synchronous user gesture for popup/redirect so mobile & desktop browsers do not block it.
 */
export async function startSocialOAuthFlow(provider: 'google' | 'facebook'): Promise<SocialOAuthResult> {
  if (typeof window === 'undefined') {
    return { status: 'error', provider, errorMessage: 'Window is not available' };
  }

  // 1. If Supabase OAuth provider is enabled in backend settings, redirect directly via Supabase OAuth
  const redirectUrl = `${window.location.origin}${window.location.pathname}`;
  if (
    (provider === 'google' && supabaseExternalProviders.google) ||
    (provider === 'facebook' && supabaseExternalProviders.facebook)
  ) {
    const query = provider === 'google' ? '&prompt=select_account' : '';
    const authorizeUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectUrl)}${query}`;
    window.location.assign(authorizeUrl);
    return { status: 'redirecting', provider };
  }

  // 2. If running on a Firebase-authorized host (AI Studio / Firebase Hosting / localhost) and Google is selected,
  //    use real Firebase GoogleAuthProvider popup with prompt='select_account'
  if (provider === 'google' && isFirebaseAuthorizedHost()) {
    const { auth, googleProvider } = initFirebaseAuth();
    if (auth && googleProvider) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        const providerData = user.providerData?.[0];
        const email = user.email || providerData?.email || '';
        const providerId = providerData?.uid || user.uid || email;
        const displayName = user.displayName || providerData?.displayName || '';
        const avatarUrl = user.photoURL || providerData?.photoURL || undefined;

        if (email || providerId) {
          saveSocialAccountToDevice({
            provider: 'google',
            providerId,
            email: email || `${providerId}@gmail.com`,
            displayName,
            avatarUrl
          });
          return {
            status: 'authenticated',
            provider: 'google',
            email: email || `${providerId}@gmail.com`,
            providerId,
            displayName,
            avatarUrl
          };
        }
      } catch (err: any) {
        const code = String(err?.code || '');
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
          return { status: 'cancelled', provider: 'google' };
        }
        if (code === 'auth/popup-blocked') {
          try {
            await signInWithRedirect(auth, googleProvider);
            return { status: 'redirecting', provider: 'google' };
          } catch {
            // fallback to external window below
          }
        }
        console.warn('[SocialOAuth] Firebase Google popup fallback:', code || err);
      }
    }
  }

  // 3. Open official Google Account Chooser (accounts.google.com) or Facebook Login (facebook.com)
  //    synchronously so the user immediately transitions to Google/Facebook to select/verify their account.
  const popupWindow = openExternalProviderWindow(provider);
  return {
    status: 'external_window_opened',
    provider,
    popupWindow
  };
}
