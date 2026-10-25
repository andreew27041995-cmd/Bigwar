import React, { useState } from 'react';
import { FriendEntry, HeroState } from '../../types/game';
import { RealtimePlayer, isPlayerOnlineByHeartbeat } from '../../utils/supabase';
import { getPyramidTierForLevel, formatLastSeen } from '../../utils/gameData';

interface FriendsModalProps {
  hero: HeroState;
  friends: FriendEntry[];
  realtimePlayers?: RealtimePlayer[];
  onClose: () => void;
  onAddFriend: (nick: string) => void;
  onOpenTransferModal: (friendNick: string) => void;
  onInspect: (friendNick: string) => void;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({
  hero,
  friends,
  realtimePlayers = [],
  onClose,
  onAddFriend,
  onOpenTransferModal,
  onInspect
}) => {
  const [newNick, setNewNick] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNick.trim()) return;
    onAddFriend(newNick.trim());
    setNewNick('');
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-slate-950/95 p-3 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <span className="text-xs font-bold text-teal-400">👥 Список Друзей ({friends.length})</span>
        <button onClick={onClose} className="text-base font-bold text-red-400 hover:text-red-300">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pt-3 space-y-3">
        {/* Add Friend Input */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newNick}
            onChange={(e) => setNewNick(e.target.value)}
            placeholder="Ник нового друга..."
            className="flex-1 rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-white outline-none focus:border-teal-400"
          />
          <button
            type="submit"
            className="rounded bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-500"
          >
            + Добавить
          </button>
        </form>

        {/* Friends list */}
        <div className="space-y-2">
          {friends.map((f) => {
            const liveFriend = realtimePlayers.find(
              (p) => p.nick.trim().toLowerCase() === f.nick.trim().toLowerCase()
            );
            const effectiveLvl = liveFriend ? Math.max(1, Number(liveFriend.lvl) || 1) : f.lvl;
            const effectiveOnline = liveFriend
              ? isPlayerOnlineByHeartbeat(liveFriend.isOnline, liveFriend.lastSeen)
              : false;
            const pyramidNum = getPyramidTierForLevel(effectiveLvl);

            return (
            <div
              key={f.nick}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/90 p-2.5"
            >
              <div
                className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                onClick={() => onInspect(f.nick)}
              >
                <div className="relative flex h-8 w-8 items-center justify-center rounded bg-slate-800 text-lg">
                  {liveFriend?.avatar || f.avatar}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-slate-900 ${
                      effectiveOnline ? 'bg-emerald-400' : 'bg-slate-500'
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 hover:text-teal-300">
                    <span>{f.nick}</span>
                    <span className="rounded border border-amber-500/40 bg-amber-950/60 px-1 py-0.2 text-[8px] font-extrabold text-amber-300">
                      🔺П{pyramidNum}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400">
                    Уровень {effectiveLvl} • {effectiveOnline ? '🟢 Онлайн' : formatLastSeen(liveFriend?.last_seen || liveFriend?.lastSeen || f.lastSeen)}
                  </div>
                </div>
              </div>

              <div className="flex gap-1.5">
                <button
                  onClick={() => onInspect(f.nick)}
                  className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[9px] font-semibold text-slate-300 hover:text-white"
                >
                  Инфо
                </button>
                <button
                  onClick={() => onOpenTransferModal(f.nick)}
                  disabled={hero.gold <= 0}
                  className="rounded bg-amber-600 px-2.5 py-1 text-[9px] font-bold text-white hover:bg-amber-500 active:scale-95 disabled:opacity-30"
                  title="Отправить золото с комментарием"
                >
                  🪙 Перевод
                </button>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
