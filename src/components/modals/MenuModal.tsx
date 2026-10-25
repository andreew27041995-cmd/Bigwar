import React from 'react';
import { HeroState } from '../../types/game';

interface MenuModalProps {
  hero: HeroState;
  unreadMailCount?: number;
  onClose: () => void;
  onOpenStats: () => void;
  onOpenTradeProtocol: () => void;
  onOpenFriends: () => void;
  onOpenDirectTransfer: () => void;
  onOpenMail?: () => void;
}

export const MenuModal: React.FC<MenuModalProps> = ({
  hero,
  unreadMailCount = 0,
  onClose,
  onOpenStats,
  onOpenTradeProtocol,
  onOpenFriends,
  onOpenDirectTransfer,
  onOpenMail
}) => {
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-slate-950/95 p-3 text-white">
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <span className="text-xs font-bold text-purple-400">☰ Меню</span>
        <button onClick={onClose} className="text-base font-bold text-red-400 hover:text-red-300">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pt-3 space-y-2">
        {onOpenMail && (
          <button
            onClick={onOpenMail}
            className="relative w-full rounded-md border border-sky-500/80 bg-slate-800 p-3 text-left text-xs font-bold text-sky-300 shadow active:scale-95"
          >
            📩 Почта
            {unreadMailCount > 0 && (
              <span className="absolute top-2 right-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow animate-bounce">
                {unreadMailCount}
              </span>
            )}
          </button>
        )}

        <button
          onClick={onOpenStats}
          className="relative w-full rounded-md border border-amber-500/80 bg-slate-800 p-3 text-left text-xs font-bold text-amber-300 shadow active:scale-95"
        >
          ⭐ Статы
          {hero.statPoints > 0 && (
            <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow">
              {hero.statPoints}
            </span>
          )}
        </button>

        <button
          onClick={onOpenTradeProtocol}
          className="w-full rounded-md border border-emerald-500/80 bg-slate-800 p-3 text-left text-xs font-bold text-emerald-300 shadow active:scale-95"
        >
          📜 Протокол сделок
        </button>

        <button
          onClick={onOpenFriends}
          className="w-full rounded-md border border-teal-500/80 bg-slate-800 p-3 text-left text-xs font-bold text-teal-300 shadow active:scale-95"
        >
          👥 Друзья
        </button>

        <button
          onClick={onOpenDirectTransfer}
          className="w-full rounded-md border border-orange-500/80 bg-slate-800 p-3 text-left text-xs font-bold text-orange-300 shadow active:scale-95"
        >
          🤝 Прямая передача
        </button>
      </div>
    </div>
  );
};

