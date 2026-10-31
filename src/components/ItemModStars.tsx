import React from 'react';
import { getItemModClass, getItemModStars } from '../utils/gameData';

interface ItemModStarsProps {
  modClass?: number | null;
  item?: { modificationClass?: number } | null;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showBadge?: boolean;
}

export const ItemModStars: React.FC<ItemModStarsProps> = ({
  modClass,
  item,
  className = '',
  size = 'sm',
  showBadge = false
}) => {
  const cls =
    modClass !== undefined && modClass !== null
      ? Math.max(0, Math.min(10, Math.floor(Number(modClass))))
      : getItemModClass(item);

  if (cls <= 0) return null;

  const stars = getItemModStars(cls);
  const sizeClasses = {
    xs: 'text-[8px] leading-none',
    sm: 'text-[10px] leading-none',
    md: 'text-xs leading-none',
    lg: 'text-sm leading-none'
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1 select-none align-middle ${className}`}
      title={`Алтарь модификации: ${cls}/10 звёзд (+${cls * 5}% к характеристикам)`}
    >
      <span className={`text-amber-400 font-black tracking-tight drop-shadow-[0_0_5px_rgba(250,204,21,0.7)] ${sizeClasses}`}>
        {stars}
      </span>
      {showBadge && (
        <span className="rounded bg-fuchsia-950/90 border border-fuchsia-400/80 px-1 py-[0.5px] text-[7.5px] font-black text-fuchsia-200 shadow-[0_0_6px_rgba(217,70,239,0.5)]">
          М{cls}
        </span>
      )}
    </span>
  );
};
