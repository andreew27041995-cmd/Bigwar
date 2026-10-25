import React, { useEffect, useState } from 'react';
import mummySpriteUrl from '../assets/sprites/mummy.svg';
import { ensureTransparentCharacterDataUrl } from '../utils/imageUpload';
import { PERSONAL_SKIN_DEFAULT_SPRITE_DATA_URL } from '../utils/shopConfig';

interface CharacterAvatarProps {
  avatar?: string;
  className?: string;
  style?: React.CSSProperties;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | 'auto';
  fullBody?: boolean;
  alt?: string;
}

export const MUMMY_SPRITE_URL = mummySpriteUrl;

const DEFAULT_MAGE_FULLBODY_SVG =
  `data:image/svg+xml;utf8,` +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 120" fill="none">
      <defs>
        <radialGradient id="mageAura" cx="50%" cy="48%" r="48%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.4"/>
          <stop offset="70%" stop-color="#6366f1" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="goldTrim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fde047"/>
          <stop offset="100%" stop-color="#d97706"/>
        </linearGradient>
        <linearGradient id="robeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1e3a8a"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="58" rx="33" ry="48" fill="url(#mageAura)"/>
      <ellipse cx="40" cy="112" rx="23" ry="5" fill="#38bdf8" fill-opacity="0.3"/>
      <!-- Mystic Cape -->
      <path d="M22 36 L14 102 L66 102 L58 36 Z" fill="#172554" stroke="url(#goldTrim)" stroke-width="1.3"/>
      <!-- Hood & Crown -->
      <path d="M24 28 C24 10 56 10 56 28 L52 40 L28 40 Z" fill="url(#robeGrad)" stroke="url(#goldTrim)" stroke-width="1.8"/>
      <!-- Face & Glowing Eyes -->
      <path d="M31 20 H49 V33 C49 37 45 40 40 40 C35 40 31 37 31 33 Z" fill="#b45309" stroke="url(#goldTrim)" stroke-width="1.2"/>
      <ellipse cx="36" cy="27" rx="2.2" ry="1.3" fill="#38bdf8"/>
      <ellipse cx="44" cy="27" rx="2.2" ry="1.3" fill="#38bdf8"/>
      <!-- Egyptian Collar & Robe Torso -->
      <path d="M18 42 C26 36 54 36 62 42 L65 55 L54 57 L52 47 L51 70 L29 70 L28 47 L26 57 L15 55 Z" fill="url(#robeGrad)" stroke="url(#goldTrim)" stroke-width="1.7"/>
      <path d="M25 43 C33 50 47 50 55 43" stroke="url(#goldTrim)" stroke-width="2.4" fill="none"/>
      <!-- Glowing Staff of Ra -->
      <path d="M16 20 L16 110" stroke="url(#goldTrim)" stroke-width="2.8" stroke-linecap="round"/>
      <circle cx="16" cy="16" r="5" fill="#38bdf8" stroke="#fef08a" stroke-width="1.5"/>
      <!-- Lower Robes & Sash -->
      <rect x="28" y="68" width="24" height="5" rx="1.5" fill="url(#goldTrim)"/>
      <path d="M26 73 L54 73 L58 106 L22 106 Z" fill="url(#robeGrad)" stroke="url(#goldTrim)" stroke-width="1.5"/>
      <path d="M36 73 L44 73 L46 106 L34 106 Z" fill="url(#goldTrim)"/>
      <!-- Boots -->
      <path d="M26 106 H36 V113 H24 Z M44 106 H56 V113 H44 Z" fill="#78350f" stroke="url(#goldTrim)" stroke-width="1.2"/>
    </svg>`
  );

const ANUBIS_FULLBODY_SVG =
  `data:image/svg+xml;utf8,` +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 120" fill="none">
      <defs>
        <radialGradient id="anubisAura" cx="50%" cy="48%" r="48%">
          <stop offset="0%" stop-color="#a855f7" stop-opacity="0.45"/>
          <stop offset="70%" stop-color="#f59e0b" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="anubisGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="100%" stop-color="#b45309"/>
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="58" rx="34" ry="48" fill="url(#anubisAura)"/>
      <ellipse cx="40" cy="112" rx="24" ry="5" fill="#a855f7" fill-opacity="0.35"/>
      <!-- Jackal Ears & Head -->
      <path d="M28 24 L25 5 L34 18 Z M52 24 L55 5 L46 18 Z" fill="#1e1b4b" stroke="url(#anubisGold)" stroke-width="1.6"/>
      <path d="M27 18 H53 L50 38 H30 Z" fill="#0f172a" stroke="url(#anubisGold)" stroke-width="1.8"/>
      <ellipse cx="35" cy="26" rx="2.4" ry="1.3" fill="#facc15"/>
      <ellipse cx="45" cy="26" rx="2.4" ry="1.3" fill="#facc15"/>
      <!-- Armor Torso -->
      <path d="M16 41 C26 35 54 35 64 41 L67 56 L54 57 L52 69 L28 69 L26 57 L13 56 Z" fill="#1e1b4b" stroke="url(#anubisGold)" stroke-width="1.8"/>
      <polygon points="40,44 45,51 40,58 35,51" fill="#c084fc" stroke="#fef08a" stroke-width="1"/>
      <!-- Kilt & Legs -->
      <path d="M26 69 L54 69 L58 91 L44 91 L40 79 L36 91 L22 91 Z" fill="#3b0764" stroke="url(#anubisGold)" stroke-width="1.6"/>
      <path d="M26 91 L35 91 L34 112 L24 112 Z M45 91 L54 91 L56 112 L46 112 Z" fill="#0f172a" stroke="url(#anubisGold)" stroke-width="1.6"/>
    </svg>`
  );

/**
 * Checks whether the given avatar string explicitly represents the Mummy sprite.
 * Never overrides custom images, GIFs, SVGs, or distinct skin icons in the Collection.
 */
export function isMummyAvatar(avatar?: string | null, nick?: string | null): boolean {
  if (
    avatar &&
    (avatar.startsWith('data:image') ||
      avatar.startsWith('http://') ||
      avatar.startsWith('https://') ||
      avatar.startsWith('/') ||
      avatar.startsWith('./'))
  ) {
    return avatar.toLowerCase().includes('mummy');
  }
  if (!avatar) {
    return Boolean(nick && nick.trim().toLowerCase() === 'redblack');
  }
  const lower = avatar.trim().toLowerCase();
  return lower.includes('mummy') || lower.includes('муми') || avatar === '🧟';
}

/**
 * Normalizes avatar string, returning the resolved sprite URL if it's a sprite or custom image/GIF/SVG
 */
export function getAvatarAssetUrl(
  avatar?: string | null,
  nick?: string | null,
  fullBody = false
): string | null {
  if (
    avatar &&
    (avatar.startsWith('data:image') ||
      avatar.startsWith('http://') ||
      avatar.startsWith('https://') ||
      avatar.startsWith('/') ||
      avatar.startsWith('./'))
  ) {
    if (avatar.toLowerCase().includes('mummy')) return mummySpriteUrl;
    return avatar;
  }
  if (isMummyAvatar(avatar, nick)) {
    return mummySpriteUrl;
  }
  const trimmed = (avatar || '').trim();
  if (trimmed === '🤴') {
    return PERSONAL_SKIN_DEFAULT_SPRITE_DATA_URL;
  }
  if (fullBody) {
    if (trimmed === '👑') return PERSONAL_SKIN_DEFAULT_SPRITE_DATA_URL;
    if (trimmed === '🐺') return ANUBIS_FULLBODY_SVG;
    return DEFAULT_MAGE_FULLBODY_SVG;
  }
  return null;
}

/**
 * Universal character avatar renderer with automatic background removal for custom uploaded skins
 * and strict CSS object-fit sizing across pyramid cells, player profile, collection, and chat panel.
 */
export const CharacterAvatar: React.FC<CharacterAvatarProps & { nick?: string | null }> = ({
  avatar,
  nick,
  className = '',
  style,
  size = 'auto',
  fullBody = false,
  alt = 'Character Sprite'
}) => {
  const isFull = fullBody || size === 'full';
  const rawAssetUrl = getAvatarAssetUrl(avatar, nick, isFull);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(rawAssetUrl);

  useEffect(() => {
    let active = true;
    setResolvedUrl(rawAssetUrl);
    if (
      rawAssetUrl &&
      rawAssetUrl.startsWith('data:image/') &&
      !rawAssetUrl.startsWith('data:image/gif') &&
      !rawAssetUrl.startsWith('data:image/svg')
    ) {
      ensureTransparentCharacterDataUrl(rawAssetUrl).then((transparentUrl) => {
        if (active && transparentUrl) {
          setResolvedUrl(transparentUrl);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [rawAssetUrl]);

  // Size preset classes & strict pixel bounds so animated GIFs / custom skins never overflow Pyramid cells
  const sizeClass =
    size === 'xs'
      ? 'w-4 h-4 max-w-[16px] max-h-[16px] text-xs'
      : size === 'sm'
      ? 'w-[22px] h-[22px] max-w-[22px] max-h-[22px] text-sm'
      : size === 'md'
      ? 'w-7 h-7 max-w-[28px] max-h-[28px] text-lg'
      : size === 'lg'
      ? 'w-9 h-9 max-w-[36px] max-h-[36px] text-xl'
      : size === 'xl'
      ? 'w-[44px] h-[44px] max-w-[44px] max-h-[44px] text-[26px]'
      : size === '2xl'
      ? 'w-[52px] h-[52px] max-w-[52px] max-h-[52px] text-[30px]'
      : size === 'full'
      ? 'w-full h-full max-w-full max-h-full'
      : '';

  const fixedDimStyle: React.CSSProperties =
    size === 'xs'
      ? { width: '16px', height: '16px', minWidth: '16px', minHeight: '16px', maxWidth: '16px', maxHeight: '16px' }
      : size === 'sm'
      ? { width: '22px', height: '22px', minWidth: '22px', minHeight: '22px', maxWidth: '22px', maxHeight: '22px' }
      : size === 'md'
      ? { width: '28px', height: '28px', minWidth: '28px', minHeight: '28px', maxWidth: '28px', maxHeight: '28px' }
      : size === 'lg'
      ? { width: '36px', height: '36px', minWidth: '36px', minHeight: '36px', maxWidth: '36px', maxHeight: '36px' }
      : size === 'xl'
      ? { width: '44px', height: '44px', minWidth: '44px', minHeight: '44px', maxWidth: '44px', maxHeight: '44px' }
      : size === '2xl'
      ? { width: '52px', height: '52px', minWidth: '52px', minHeight: '52px', maxWidth: '52px', maxHeight: '52px' }
      : { maxWidth: '100%', maxHeight: '100%' };

  if (resolvedUrl) {
    return (
      <img
        src={resolvedUrl}
        alt={alt}
        className={`pointer-events-none select-none object-contain bg-transparent shrink-0 ${sizeClass} ${className}`.trim()}
        style={{
          objectFit: 'contain',
          backgroundColor: 'transparent',
          filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.85))',
          ...fixedDimStyle,
          ...style
        }}
        loading="eager"
        draggable={false}
      />
    );
  }

  // Fallback to text/emoji avatar (e.g. 🧙‍♂️, 👑, 🥷)
  return (
    <span
      className={`inline-flex items-center justify-center select-none leading-none bg-transparent ${sizeClass} ${className}`.trim()}
      style={style}
    >
      {avatar || '🧙‍♂️'}
    </span>
  );
};

export default CharacterAvatar;

