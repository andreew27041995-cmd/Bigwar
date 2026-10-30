import React, { useState, useEffect } from 'react';
import { LeaderboardEntry } from '../../types/game';
import { fetchAllPlayersFromDatabase, isPlayerOnlineByHeartbeat } from '../../utils/supabase';
import { getPyramidTierForLevel } from '../../utils/gameData';
import CharacterAvatar from '../CharacterAvatar';

interface LeaderboardModalProps {
  currentUser: string | null;
  onClose: () => void;
  onInspectPlayer: (nick: string) => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  currentUser,
  onClose,
  onInspectPlayer
}) => {
  const [tab, setTab] = useState<'mobs' | 'gold'>('mobs');
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(Date.now());

  const loadLeaderboardData = async () => {
    setLoading(true);
    try {
      const players = await fetchAllPlayersFromDatabase();
      const mapped: LeaderboardEntry[] = players
        .map((p) => {
          const rawMobs = Number(p.mobs_killed ?? p.mob_kills ?? p.mobsKilled ?? 0);
          const rawGold = Number(
            p.total_gold_collected ?? p.totalGoldCollected ?? p.gold ?? 0
          );
          const rawLvl = Math.max(1, Number(p.lvl ?? p.level ?? 1));
          const nick = String(p.name || p.nick || '').trim();
          const isPrem = Boolean(
            p.is_premium ||
            (p.premium_until && Number(p.premium_until) > Date.now()) ||
            (p.vip_until && Number(p.vip_until) > Date.now())
          );
          const isOnline = isPlayerOnlineByHeartbeat(
            p._rawIsOnlineInDb ?? p.is_online ?? p.isOnline,
            p.last_seen ?? p.lastSeen
          );
          const adminLvl = Number(p.admin_level ?? p.is_admin ?? 0);
          const roleVal: 'admin' | 'mod' | 'regular' =
            adminLvl === 2 || p.role === 'mod'
              ? 'mod'
              : adminLvl === 1 || p.role === 'admin' || ['redblack', 'redbyl', 'admin'].includes(nick.toLowerCase())
              ? 'admin'
              : 'regular';
          return {
            id: String(p.id || nick),
            nick,
            lvl: rawLvl,
            avatar: p.avatar || '🧙‍♂️',
            isPremium: isPrem,
            role: roleVal,
            is_admin: adminLvl,
            mobsKilled: rawMobs,
            totalGoldCollected: rawGold,
            pvpKills: Number(p.pvp_kills ?? p.pvpKills ?? 0),
            location: p.location || 'city',
            isOnline
          };
        })
        .filter((e) => e.nick && !e.nick.startsWith('__') && e.nick !== '__GLOBAL_MAIL__');

      // Deduplicate by lowercase nickname, keeping the best stats for ranking
      const dedup = new Map<string, LeaderboardEntry>();
      mapped.forEach((item) => {
        const key = item.nick.toLowerCase();
        const existing = dedup.get(key);
        if (!existing) {
          dedup.set(key, item);
        } else {
          dedup.set(key, {
            ...existing,
            ...item,
            lvl: Math.max(existing.lvl, item.lvl),
            mobsKilled: Math.max(existing.mobsKilled, item.mobsKilled),
            totalGoldCollected: Math.max(existing.totalGoldCollected, item.totalGoldCollected),
            pvpKills: Math.max(existing.pvpKills || 0, item.pvpKills || 0),
            isPremium: existing.isPremium || item.isPremium,
            isOnline: existing.isOnline || item.isOnline
          });
        }
      });

      setEntries(Array.from(dedup.values()));
      setLastRefreshedAt(Date.now());
    } catch (err) {
      console.warn('[Leaderboard] Error loading players:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboardData();
    const interval = setInterval(() => {
      loadLeaderboardData();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const sortedList = [...entries].sort((a, b) => {
    if (tab === 'mobs') {
      if (b.mobsKilled !== a.mobsKilled) return b.mobsKilled - a.mobsKilled;
      return b.lvl - a.lvl;
    } else {
      if (b.totalGoldCollected !== a.totalGoldCollected) {
        return b.totalGoldCollected - a.totalGoldCollected;
      }
      return b.lvl - a.lvl;
    }
  });

  const myNickLower = String(currentUser || '').trim().toLowerCase();
  const myRankIndex = sortedList.findIndex(
    (e) => e.nick.toLowerCase() === myNickLower
  );
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;
  const myEntry = myRankIndex >= 0 ? sortedList[myRankIndex] : null;

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: '🥇', label: '1 МЕСТО', color: 'text-amber-300 bg-amber-950/80 border-amber-400' };
    if (rank === 2) return { icon: '🥈', label: '2 МЕСТО', color: 'text-slate-200 bg-slate-800 border-slate-400' };
    if (rank === 3) return { icon: '🥉', label: '3 МЕСТО', color: 'text-amber-600 bg-amber-950/50 border-amber-700' };
    return { icon: `#${rank}`, label: `${rank}`, color: 'text-slate-400 bg-slate-900 border-slate-700' };
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-slate-950/95 p-3 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold text-amber-400">🏆 Рейтинг Игроков</span>
          <button
            onClick={loadLeaderboardData}
            disabled={loading}
            className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[8px] font-bold text-slate-300 hover:border-amber-400 active:scale-95"
            title="Обновить таблицу рейтинга"
          >
            <span className={loading ? 'animate-spin' : ''}>🔄</span>
            <span>Обновить</span>
          </button>
        </div>
        <button onClick={onClose} className="text-base font-bold text-red-400 hover:text-red-300">
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-2.5 flex gap-1.5 border-b border-slate-800 pb-2">
        <button
          onClick={() => setTab('mobs')}
          className={`flex-1 rounded-lg py-2 text-[10px] font-extrabold transition-all flex items-center justify-center gap-1.5 ${
            tab === 'mobs'
              ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]'
              : 'border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <span>💀</span>
          <span>Убито монстров</span>
        </button>

        <button
          onClick={() => setTab('gold')}
          className={`flex-1 rounded-lg py-2 text-[10px] font-extrabold transition-all flex items-center justify-center gap-1.5 ${
            tab === 'gold'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
              : 'border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <span>🪙</span>
          <span>Собрано золота</span>
        </button>
      </div>

      {/* Current User Rank Strip (if found) */}
      {myEntry && myRank && (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-amber-400/70 bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 px-3 py-1.5 text-[9.5px]">
          <div className="flex items-center gap-2">
            <span className="font-black text-amber-300">Ваше место: #{myRank}</span>
            <span className="text-slate-400">({currentUser})</span>
          </div>
          <div className="font-extrabold">
            {tab === 'mobs' ? (
              <span className="text-red-300">💀 {myEntry.mobsKilled} монстров</span>
            ) : (
              <span className="text-amber-300">🪙 {myEntry.totalGoldCollected.toLocaleString()} золота</span>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard Player List */}
      <div className="flex-1 overflow-y-auto pt-2 space-y-1.5">
        {loading && entries.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400 text-xs">
            <span className="text-2xl animate-spin">⏳</span>
            <span>Загрузка актуального рейтинга из базы данных...</span>
          </div>
        ) : sortedList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/50 p-6 text-center text-xs text-slate-400">
            В рейтинге пока нет записей.
          </div>
        ) : (
          sortedList.map((player, idx) => {
            const rank = idx + 1;
            const badge = getRankBadge(rank);
            const isMe = player.nick.toLowerCase() === myNickLower;

            return (
              <div
                key={player.nick + idx}
                className={`flex items-center justify-between rounded-lg border p-2 transition-all ${
                  isMe
                    ? 'border-amber-400/90 bg-amber-950/40 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                    : rank === 1
                    ? 'border-amber-500/60 bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-950'
                    : rank <= 3
                    ? 'border-slate-700 bg-slate-900/90'
                    : 'border-slate-800 bg-slate-950/80'
                }`}
              >
                {/* Left: Rank & Avatar & Nick */}
                <div className="flex items-center gap-2 min-w-0">
                  {/* Rank badge */}
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-black shadow ${badge.color}`}
                  >
                    {badge.icon}
                  </div>

                  {/* Avatar */}
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-base p-0.5 overflow-hidden">
                    <CharacterAvatar avatar={player.avatar} nick={player.nick} className="w-full h-full object-contain" />
                    {player.isPremium && (
                      <span className="absolute -top-1 -right-1 text-[8px] animate-bounce">
                        👑
                      </span>
                    )}
                  </div>

                  {/* Nick & Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 leading-tight">
                      {player.isPremium && <span title="Премиум VIP">👑</span>}
                      {player.role === 'admin' && (
                        <span className="rounded bg-red-500/20 border border-red-500/50 px-1 py-[0.5px] text-[6.5px] font-black text-red-400">
                          [Админ]
                        </span>
                      )}
                      {player.role === 'mod' && (
                        <span className="rounded bg-emerald-500/20 border border-emerald-500/50 px-1 py-[0.5px] text-[6.5px] font-black text-emerald-400">
                          [Мод]
                        </span>
                      )}
                      <span
                        className={`truncate text-[10.5px] font-black ${
                          player.role === 'admin'
                            ? 'text-red-500'
                            : player.role === 'mod'
                            ? 'text-emerald-400'
                            : isMe
                            ? 'text-amber-300'
                            : 'text-slate-100'
                        }`}
                      >
                        {player.nick}
                      </span>
                      {isMe && (
                        <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[7px] font-extrabold text-amber-300">
                          ВЫ
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[8.5px] text-slate-400">
                      <span className="text-purple-300 font-bold">Ур.{player.lvl}</span>
                      <span className="rounded bg-amber-500/20 border border-amber-500/40 px-1 py-[0.5px] text-[7.5px] font-black text-amber-300">
                        🔺П{getPyramidTierForLevel(player.lvl)}
                      </span>
                      <span>•</span>
                      <span className={player.isOnline ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                        {player.isOnline ? '🟢 Онлайн' : '⚪ Оффлайн'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Score & Inspect Button */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    {tab === 'mobs' ? (
                      <div>
                        <div className="text-[11px] font-black text-red-400 tabular-nums">
                          💀 {player.mobsKilled}
                        </div>
                        <div className="text-[7.5px] text-slate-500">монстров</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-[11px] font-black text-amber-400 tabular-nums">
                          🪙 {player.totalGoldCollected.toLocaleString()}
                        </div>
                        <div className="text-[7.5px] text-slate-500">золота</div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => onInspectPlayer(player.nick)}
                    className="rounded bg-slate-800 border border-slate-700 px-2 py-1 text-[8.5px] font-bold text-sky-300 hover:border-sky-400 hover:bg-slate-700 active:scale-95"
                    title="Посмотреть профиль игрока"
                  >
                    Инфо
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2 text-[8px] text-slate-400">
        <span>Участников в рейтинге: <strong className="text-slate-200">{sortedList.length}</strong></span>
        <span>Обновлено: <strong className="text-amber-300">{new Date(lastRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong></span>
      </div>
    </div>
  );
};
