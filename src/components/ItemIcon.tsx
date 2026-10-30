import React, { useEffect, useState } from 'react';
import { ItemSlot } from '../types/game';
import { resolveEgyptianEquipmentIcon } from '../utils/egyptianEquipment';
import { ELIXIR_EN_IMG, ELIXIR_HP_IMG, ELIXIR_EXP_IMG } from '../utils/elixirAssets';

export function resolveElixirDataUrl(iconOrName?: string | null): string | null {
  if (!iconOrName) return null;
  const s = iconOrName.toLowerCase();
  if (s.includes('elixir_hp') || s.includes('эликсир жизни') || s.includes('эликсир здоровья') || s.includes('зелье hp')) {
    return ELIXIR_HP_IMG;
  }
  if (s.includes('elixir_en') || s.includes('эликсир энергии') || s.includes('зелье en')) {
    return ELIXIR_EN_IMG;
  }
  if (s.includes('elixir_exp') || s.includes('эликсир опыта')) {
    return ELIXIR_EXP_IMG;
  }
  return null;
}

export function normalizeItemIconValue(icon?: string | null, fallback = '⚔️'): string {
  if (!icon || typeof icon !== 'string') return fallback;
  const trimmed = icon.trim();
  if (!trimmed) return fallback;
  // Restore standard icon for Abyssal Flame Sword (20 lvl) if legacy broken path is present
  if (trimmed.includes('flame_sword')) {
    return '⚔️';
  }
  const elixirImg = resolveElixirDataUrl(trimmed);
  if (elixirImg) {
    return elixirImg;
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
  const elixirImg = resolveElixirDataUrl(icon);
  if (elixirImg) return elixirImg;
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

const SHOP_EQUIPMENT_ASSET_BY_NAME: Record<string, string> = {
  'перчатки искателя сокровищ': '/assets/gloves/gloves_lvl2.png',
  'кожаные наручи каравана': '/assets/gloves/gloves_lvl4.png',
  'бронзовые наручи казначея': '/assets/gloves/gloves_lvl5.png',
  'позолоченные рукавицы жреца': '/assets/gloves/gloves_lvl8.png',
  'золотые перчатки скарабея': '/assets/gloves/gloves_lvl10.png',
  'перчатки золотого сфинкса': '/assets/gloves/gloves_lvl15.png',
  'божественные наручи богатства ра': '/assets/gloves/gloves_lvl20.png',
  'кожаные сандалии странника': '/assets/boots/boots_lvl2.png',
  'сапоги песчаного ветра': '/assets/boots/boots_lvl4.png',
  'бронзовые ботфорты гробницы': '/assets/boots/boots_lvl5.png',
  'сапоги тени шакала': '/assets/boots/boots_lvl8.png',
  'крылатые сапоги миража': '/assets/boots/boots_lvl10.png',
  'золотые ботфорты сокола хора': '/assets/boots/boots_lvl15.png',
  'божественные сапоги света ра': '/assets/boots/boots_lvl20.png',
  'льняной доспех кочевника': '/assets/armor/armor_lvl2.png',
  'кожаный панцирь оазиса': '/assets/armor/armor_lvl4.png',
  'бронзовая кираса стража': '/assets/armor/armor_lvl5.png',
  'чешуйчатый доспех собека': '/assets/armor/armor_lvl8.png',
  'золотые латы жреца': '/assets/armor/armor_lvl10.png',
  'мифриловый панцирь сфинкса': '/assets/armor/armor_lvl15.png',
  'божественные доспехи вечности ра': '/assets/armor/armor_lvl20.png'
};

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
  const [triedAltRoot, setTriedAltRoot] = useState(false);
  const elixirOverride = resolveElixirDataUrl(icon) || resolveElixirDataUrl(name);
  const namedAssetOverride =
    !elixirOverride && name ? SHOP_EQUIPMENT_ASSET_BY_NAME[name.trim().toLowerCase()] || null : null;
  const rawNormalized =
    elixirOverride ||
    (namedAssetOverride && (!icon || icon === '👢' || icon === '👟' || icon === '🥾' || icon === '🛡️' || icon === '🧤')
      ? namedAssetOverride
      : normalizeItemIconValue(icon, fallback));
  const effectiveAlt = name || alt;
  const egyptianResolved = elixirOverride ? null : resolveEgyptianEquipmentIcon(rawNormalized, effectiveAlt, slot);
  const normalized = egyptianResolved || rawNormalized;

  useEffect(() => {
    setImgError(false);
    setTriedAltRoot(false);
  }, [normalized]);

  if (!imgError && isImageIconPath(normalized)) {
    let src = resolveItemIconSrc(normalized);
    if (triedAltRoot && src.startsWith('/Bigwar/')) {
      src = src.replace(/^\/Bigwar\//, '/');
    }
    const isEgyptianGeneratedSvg = Boolean(egyptianResolved && egyptianResolved.startsWith('data:image/svg+xml'));
    const isTransparentCutoutPng =
      Boolean(elixirOverride) ||
      normalized.includes('/assets/armor/') ||
      normalized.includes('assets/armor/') ||
      normalized.includes('/assets/boots/') ||
      normalized.includes('assets/boots/') ||
      normalized.includes('/assets/gloves/') ||
      normalized.includes('assets/gloves/') ||
      normalized.includes('/assets/swords/') ||
      normalized.includes('assets/swords/') ||
      normalized.includes('/assets/elixirs/') ||
      normalized.includes('assets/elixirs/');
    const isCustomUploadedOrUrl =
      !isEgyptianGeneratedSvg &&
      !isTransparentCutoutPng &&
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
        onError={() => {
          if (!triedAltRoot && src.startsWith('/Bigwar/')) {
            setTriedAltRoot(true);
          } else {
            setImgError(true);
          }
        }}
      />
    );
  }

  return <span className={className}>{isImageIconPath(normalized) ? fallback : normalized}</span>;
};



