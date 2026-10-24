import React, { useEffect, useState } from 'react';
import mummySpriteUrl from '../assets/sprites/mummy.svg';
import { ensureTransparentCharacterDataUrl } from '../utils/imageUpload';

interface CharacterAvatarProps {
  avatar?: string;
  className?: string;
  style?: React.CSSProperties;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'auto';
  alt?: string;
}

export const MUMMY_SPRITE_URL = mummySpriteUrl;

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
export function getAvatarAssetUrl(avatar?: string | null, nick?: string | null): string | null {
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
  alt = 'Character Sprite'
}) => {
  const rawAssetUrl = getAvatarAssetUrl(avatar, nick);
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
      ? 'w-4 h-4 max-w-[16px] max-h-[16px]'
      : size === 'sm'
      ? 'w-[22px] h-[22px] max-w-[22px] max-h-[22px]'
      : size === 'md'
      ? 'w-7 h-7 max-w-[28px] max-h-[28px]'
      : size === 'lg'
      ? 'w-9 h-9 max-w-[36px] max-h-[36px]'
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
          filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.85))',
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
