import React, { useEffect, useState } from 'react';
import { ItemSlot } from '../types/game';
import { resolveEgyptianEquipmentIcon } from '../utils/egyptianEquipment';

export function normalizeItemIconValue(icon?: string | null, fallback = '⚔️'): string {
  if (!icon || typeof icon !== 'string') return fallback;
  const trimmed = icon.trim();
  if (!trimmed) return fallback;
  // Restore standard icon for Abyssal Flame Sword (20 lvl) if legacy broken path is present
  if (trimmed.includes('flame_sword')) {
    return '⚔️';
  }
  return trimmed;
}

export function isImageIconPath(icon?: string | null): boolean {
  const norm = normalizeItemIconValue(icon, '');
  return (
    norm.startsWith('/') ||
    norm.startsWith('assets/') ||
    norm.startsWith('http://') ||
    norm.startsWith('https://') ||
    norm.startsWith('data:image/')
  );
}

export function formatItemIconForText(icon?: string | null, fallback = '⚔️'): string {
  const norm = normalizeItemIconValue(icon, fallback);
  if (isImageIconPath(norm)) {
    return fallback;
  }
  return norm;
}

export function resolveItemIconSrc(icon: string): string {
  const norm = normalizeItemIconValue(icon, '');
  if (!norm) return '';
  if (norm.startsWith('http://') || norm.startsWith('https://') || norm.startsWith('data:image/')) {
    return norm;
  }
  const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/');
  if (norm.startsWith('/Bigwar/')) {
    return norm;
  }
  const cleanRel = norm.replace(/^\/+/, '');
  return `${baseUrl}${cleanRel}`;
}

interface ItemIconProps {
  icon?: string | null;
  name?: string;
  slot?: ItemSlot;
  alt?: string;
  fallback?: string;
  className?: string;
  imgClassName?: string;
}

export const ItemIcon: React.FC<ItemIconProps> = ({
  icon,
  name,
  slot,
  alt = 'icon',
  fallback = '⚔️',
  className = '',
  imgClassName = 'w-full h-full object-contain'
}) => {
  const [imgError, setImgError] = useState(false);
  const rawNormalized = normalizeItemIconValue(icon, fallback);
  const effectiveAlt = name || alt;
  const egyptianResolved = resolveEgyptianEquipmentIcon(rawNormalized, effectiveAlt, slot);
  const normalized = egyptianResolved || rawNormalized;

  useEffect(() => {
    setImgError(false);
  }, [normalized]);

  if (!imgError && isImageIconPath(normalized)) {
    const src = resolveItemIconSrc(normalized);
    const isEgyptianGeneratedSvg = Boolean(egyptianResolved && egyptianResolved.startsWith('data:image/svg+xml'));
    const isCustomUploadedOrUrl =
      !isEgyptianGeneratedSvg &&
      (normalized.startsWith('data:image/') ||
        normalized.startsWith('http://') ||
        normalized.startsWith('https://') ||
        imgClassName.includes('object-cover'));
    return (
      <img
        src={src}
        alt={effectiveAlt}
        style={{ objectFit: isCustomUploadedOrUrl ? 'cover' : 'contain' }}
        className={isCustomUploadedOrUrl ? 'w-full h-full object-cover rounded' : imgClassName}
        onError={() => setImgError(true)}
      />
    );
  }

  return <span className={className}>{isImageIconPath(normalized) ? fallback : normalized}</span>;
};


