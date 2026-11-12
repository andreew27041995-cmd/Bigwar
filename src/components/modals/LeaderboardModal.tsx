import React, { useState, useEffect } from 'react';
import { HeroState, LeaderboardEntry } from '../../types/game';
import { fetchAllPlayersFromDatabase, isPlayerOnlineByHeartbeat } from '../../utils/supabase';
import { getPyramidTierForLevel } from '../../utils/gameData';
import {
  getCurrentFishingWeekId,
  formatFishingWeekCountdown,
  getFishingWeeklyReward
} from '../../utils/fishingConfig';
import { FishingRankMedal } from '../FishingRankMedal';
import CharacterAvatar from '../CharacterAvatar';

interface LeaderboardModalProps {
  currentUser: string | null;
  currentHero?: HeroState;
  initialTab?: 'fishing' | 'mobs' | 'gold';
  onClose: () => void;
  onInspectPlayer: (nick: string) => void;
}

function computeAnglerWeightMetrics(fState: any, curWeekId: string): {
  totalFish: number;
  weeklyFish: number;
  weeklyWeightKg: number;
  maxTrophyWeightKg: number;
  totalWeightKg: number;
} {
  if (!fState || typeof fState !== 'object') {
    return {
      totalFish: 0,
      weeklyFish: 0,
      weeklyWeightKg: 0,
      maxTrophyWeightKg: 0,
      totalWeightKg: 0
    };
  }

  const rawTotalFish = Math.max(0, Number(fState.totalFishCaught || 0));
  const isCurrentWeek = fState.fishingWeekId === curWeekId;
  const rawWeeklyFish =
    isCurrentWeek && typeof fState.weeklyFishCaught === 'number'
      ? Math.max(0, Number(fState.weeklyFishCaught))
      : rawTotalFish;

  // Calculate collection-based weight & record trophy weight
  let collectionEstimatedWeightKg = 0;
  let collectionMaxWeightKg = 0;
  let collectionFishCount = 0;
  if (fState.collection && typeof fState.collection === 'object') {
    for (const rec of Object.values(fState.collection) as any[]) {
      if (rec && typeof rec === 'object') {
        const cnt = Math.max(0, Number(rec.count || 0));
        const maxW = Math.max(0, Number(rec.maxWeightKg || 0));
        collectionFishCount += cnt;
        if (maxW > collectionMaxWeightKg) {
          collectionMaxWeightKg = maxW;
        }
        if (cnt > 0 && maxW > 0) {
          collectionEstimatedWeightKg += cnt === 1 ? maxW : maxW + (cnt - 1) * maxW * 0.72;
        }
      }
    }
  }

  // Also check keepnet fish
  let keepnetWeightKg = 0;
  let keepnetMaxWeightKg = 0;
  if (Array.isArray(fState.keepnetFish)) {
    for (const kf of fState.keepnetFish) {
      const w = Math.max(0, Number(kf?.weightKg || 0));
      keepnetWeightKg += w;
      if (w > keepnetMaxWeightKg) keepnetMaxWeightKg = w;
    }
  }

  const effectiveTotalFish = Math.max(rawTotalFish, collectionFishCount);
  const effectiveWeeklyFish = Math.max(rawWeeklyFish, isCurrentWeek ? 0 : effectiveTotalFish);

  const explicitTotalWeight = Math.max(0, Number(fState.totalFishWeightKg || 0));
  const explicitWeeklyWeight =
    isCurrentWeek && typeof fState.weeklyFishWeightKg === 'number'
      ? Math.max(0, Number(fState.weeklyFishWeightKg))
      : explicitTotalWeight;

  const fallbackTotalWeight =
    collectionEstimatedWeightKg > 0
      ? collectionEstimatedWeightKg
      : keepnetWeightKg > 0
      ? keepnetWeightKg
      : effectiveTotalFish * 1.85;

  const totalWeightKg = Number(Math.max(explicitTotalWeight, fallbackTotalWeight).toFixed(2));

  let weeklyWeightKg = explicitWeeklyWeight;
  if (weeklyWeightKg <= 0 && effectiveWeeklyFish > 0) {
    if (effectiveTotalFish > 0 && totalWeightKg > 0) {
      const avgWeight = totalWeightKg / effectiveTotalFish;
      weeklyWeightKg = Number((effectiveWeeklyFish * avgWeight).toFixed(2));
    } else {
      weeklyWeightKg = Number((effectiveWeeklyFish * 1.85).toFixed(2));
    }
  }

  const maxTrophyWeightKg = Number(
    Math.max(
      Number(fState.weeklyMaxFishWeightKg || 0),
      collectionMaxWeightKg,
      keepnetMaxWeightKg,
      weeklyWeightKg > 0 && effectiveWeeklyFish > 0
        ? Math.min(weeklyWeightKg, (weeklyWeightKg / effectiveWeeklyFish) * 1.35)
        : 0
    ).toFixed(2)
  );

  return {
    totalFish: effectiveTotalFish,
    weeklyFish: effectiveWeeklyFish,
    weeklyWeightKg,
    maxTrophyWeightKg,
    totalWeightKg
  };
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  currentUser,
  currentHero,
  initialTab = 'fishing',
  onClose,
  onInspectPlayer
}) => {
  const [tab, setTab] = useState<'fishing' | 'mobs' | 'gold'>(initialTab);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(Date.now());
  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const loadLeaderboardData = async () => {
    setLoading(true);
    try {
      const players = await fetchAllPlayersFromDatabase();
      const curWeekId = getCurrentFishingWeekId();
      const mapped: LeaderboardEntry[] = players
        .map((p) => {
          const rawMobs = Number(p.mobs_killed ?? p.mob_kills ?? p.mobsKilled ?? 0);
          const rawGold = Number(
            p.total_gold_collected ?? p.totalGoldCollected ?? p.gold ?? 0
          );
          const fState = p.fishing_state || p.fishingState || {};
          const fMetrics = computeAnglerWeightMetrics(fState, curWeekId);

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
            fishCaught: fMetrics.totalFish,
            weeklyFishCaught: fMetrics.weeklyFish,
            weeklyFishWeightKg: fMetrics.weeklyWeightKg,
            weeklyMaxFishWeightKg: fMetrics.maxTrophyWeightKg,
            totalFishWeightKg: fMetrics.totalWeightKg,
            pvpKills: Number(p.pvp_kills ?? p.pvpKills ?? 0),
            location: p.location || 'city',
            isOnline
          };
        })
        .filter((e) => e.nick && !e.nick.startsWith('__') && e.nick !== '__GLOBAL_MAIL__');

      // Ensure local hero's latest fishing stats & weight are reflected immediately
      if (currentUser && currentHero) {
        const myClean = currentUser.trim();
        const myMetrics = computeAnglerWeightMetrics(currentHero.fishingState, curWeekId);
        mapped.push({
          id: myClean,
          nick: myClean,
          lvl: Math.max(1, Number(currentHero.level || 1)),
          avatar: currentHero.avatar || '🧙‍♂️',
          isPremium: Boolean(
            currentHero.isPremium && currentHero.premiumUntil && currentHero.premiumUntil > Date.now()
          ),
          role: 'regular',
          mobsKilled: Math.max(0, Number(currentHero.mobsKilled || 0)),
          totalGoldCollected: Math.max(
            0,
            Number(currentHero.totalGoldCollected || currentHero.gold || 0)
          ),
          fishCaught: myMetrics.totalFish,
          weeklyFishCaught: myMetrics.weeklyFish,
          weeklyFishWeightKg: myMetrics.weeklyWeightKg,
          weeklyMaxFishWeightKg: myMetrics.maxTrophyWeightKg,
          totalFishWeightKg: myMetrics.totalWeightKg,
          pvpKills: Math.max(0, Number(currentHero.pvpKills || 0)),
          location: 'city',
          isOnline: true
        });
      }

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
            role:
              existing.role === 'admin' || item.role === 'admin'
                ? 'admin'
                : existing.role === 'mod' || item.role === 'mod'
                ? 'mod'
                : 'regular',
            lvl: Math.max(existing.lvl, item.lvl),
            mobsKilled: Math.max(existing.mobsKilled, item.mobsKilled),
            totalGoldCollected: Math.max(existing.totalGoldCollected, item.totalGoldCollected),
            fishCaught: Math.max(existing.fishCaught || 0, item.fishCaught || 0),
            weeklyFishCaught: Math.max(existing.weeklyFishCaught || 0, item.weeklyFishCaught || 0),
            weeklyFishWeightKg: Math.max(
              existing.weeklyFishWeightKg || 0,
              item.weeklyFishWeightKg || 0
            ),
            weeklyMaxFishWeightKg: Math.max(
              existing.weeklyMaxFishWeightKg || 0,
              item.weeklyMaxFishWeightKg || 0
            ),
            totalFishWeightKg: Math.max(
              existing.totalFishWeightKg || 0,
              item.totalFishWeightKg || 0
            ),
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

  const getPlayerFishCount = (e: LeaderboardEntry) =>
    Math.max(Number(e.weeklyFishCaught ?? 0), Number(e.fishCaught ?? 0));

  const getPlayerFishWeightKg = (e: LeaderboardEntry) => {
    const w = Math.max(Number(e.weeklyFishWeightKg ?? 0), Number(e.totalFishWeightKg ?? 0));
    if (w > 0) return Number(w.toFixed(2));
    const count = getPlayerFishCount(e);
    return count > 0 ? Number((count * 1.85).toFixed(2)) : 0;
  };

  const formatWeightKg = (kg: number) =>
    kg.toLocaleString('ru-RU', { minimumFractionDigits: kg % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });

  const sortedList = [...entries].sort((a, b) => {
    if (tab === 'mobs') {
      if (b.mobsKilled !== a.mobsKilled) return b.mobsKilled - a.mobsKilled;
      return b.lvl - a.lvl;
    } else if (tab === 'gold') {
      if (b.totalGoldCollected !== a.totalGoldCollected) {
        return b.totalGoldCollected - a.totalGoldCollected;
      }
      return b.lvl - a.lvl;
    } else {
      // Sort Weekly Nile Anglers by total weight of caught fish (kg) descending!
      const bWeight = getPlayerFishWeightKg(b);
      const aWeight = getPlayerFishWeightKg(a);
      if (bWeight !== aWeight) return bWeight - aWeight;
      const bMaxTrophy = Number(b.weeklyMaxFishWeightKg || 0);
      const aMaxTrophy = Number(a.weeklyMaxFishWeightKg || 0);
      if (bMaxTrophy !== aMaxTrophy) return bMaxTrophy - aMaxTrophy;
      const bFish = getPlayerFishCount(b);
      const aFish = getPlayerFishCount(a);
      if (bFish !== aFish) return bFish - aFish;
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
          <span className="text-sm font-extrabold text-amber-400">
            {tab === 'fishing' ? '🎣 Лучшие рыболовы Нила' : '🏆 Рейтинг Игроков'}
          </span>
          <button
            onClick={loadLeaderboardData}
            disabled={loading}
            className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[8px] font-bold text-slate-300 hover:border-amber-400 active:scale-95 cursor-pointer"
            title="Обновить таблицу рейтинга"
          >
            <span className={loading ? 'animate-spin' : ''}>🔄</span>
            <span>Обновить</span>
          </button>
        </div>
        <button onClick={onClose} className="text-base font-bold text-red-400 hover:text-red-300 cursor-pointer">
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-2.5 flex gap-1.5 border-b border-slate-800 pb-2">
        <button
          onClick={() => setTab('fishing')}
          className={`flex-1 rounded-lg py-2 text-[9.5px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            tab === 'fishing'
              ? 'bg-gradient-to-r from-sky-600 to-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(14,165,233,0.5)]'
              : 'border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <span>🎣</span>
          <span>Рыболовы Нила (кг)</span>
        </button>

        <button
          onClick={() => setTab('mobs')}
          className={`flex-1 rounded-lg py-2 text-[9.5px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer ${
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
          className={`flex-1 rounded-lg py-2 text-[9.5px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            tab === 'gold'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
              : 'border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <span>🪙</span>
          <span>Собрано золота</span>
        </button>
      </div>

      {/* Weekly Fishing Tournament Prize Banner */}
      {tab === 'fishing' && (
        <div className="mt-2 rounded-xl border border-sky-500/50 bg-gradient-to-r from-sky-950/90 via-slate-900 to-indigo-950/90 p-2.5 shadow-[0_0_15px_rgba(14,165,233,0.2)]">
          <div className="flex flex-wrap items-center justify-between gap-1 border-b border-sky-500/30 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">⚖️</span>
              <span className="text-[10.5px] font-black uppercase tracking-wide text-sky-300">
                Еженедельный Рейтинг Рыболовов Нила (по весу улова)
              </span>
            </div>
            <span className="rounded border border-amber-400/60 bg-amber-950/80 px-2 py-0.5 text-[8.5px] font-black text-amber-300">
              ⏳ До выдачи призов: {formatFishingWeekCountdown(nowMs)}
            </span>
          </div>

          <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[8.5px]">
            <div className="rounded-lg border border-amber-400/70 bg-amber-950/60 px-2 py-1 flex flex-col justify-between shadow-[0_0_8px_rgba(250,204,21,0.25)]">
              <span className="font-black text-yellow-300">🥇 1 МЕСТО</span>
              <span className="font-extrabold text-white">500 💎 кристаллов</span>
              <span className="text-[7.5px] text-amber-200">+ Золотая Рыба-Медаль</span>
            </div>
            <div className="rounded-lg border border-slate-300/70 bg-slate-800/80 px-2 py-1 flex flex-col justify-between shadow-[0_0_8px_rgba(226,232,240,0.2)]">
              <span className="font-black text-slate-100">🥈 2 МЕСТО</span>
              <span className="font-extrabold text-white">250 💎 кристаллов</span>
              <span className="text-[7.5px] text-slate-300">+ Серебряная Рыба-Медаль</span>
            </div>
            <div className="rounded-lg border border-orange-400/70 bg-orange-950/60 px-2 py-1 flex flex-col justify-between shadow-[0_0_8px_rgba(249,115,22,0.2)]">
              <span className="font-black text-orange-300">🥉 3 МЕСТО</span>
              <span className="font-extrabold text-white">100 💎 кристаллов</span>
              <span className="text-[7.5px] text-orange-200">+ Бронзовая Рыба-Медаль</span>
            </div>
            <div className="rounded-lg border border-yellow-600/50 bg-slate-900/90 px-2 py-1 flex flex-col justify-between">
              <span className="font-black text-amber-400">🏅 4–10 МЕСТО</span>
              <span className="font-extrabold text-yellow-300">по 500 🪙 золота</span>
              <span className="text-[7.5px] text-slate-400">На счёт + письмо на почту</span>
            </div>
          </div>

          <div className="mt-1.5 text-[8px] text-sky-200/85 leading-snug">
            ⚖️ Рыболовы сортируются по <strong>общему весу пойманной за неделю рыбы (в кг)</strong>. Ловите крупных хищников в Глубоком каньоне и во время Холодных течений!
          </div>
        </div>
      )}

      {/* Current User Rank Strip (if found) */}
      {myEntry && myRank && (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-amber-400/70 bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 px-3 py-1.5 text-[9.5px]">
          <div className="flex items-center gap-2">
            <span className="font-black text-amber-300">Ваше место: #{myRank}</span>
            <span className="text-slate-400">({currentUser})</span>
            {tab === 'fishing' && (myRank === 1 || myRank === 2 || myRank === 3) && (
              <FishingRankMedal rank={myRank} size="sm" showDetails={false} />
            )}
          </div>
          <div className="font-extrabold flex items-center gap-2">
            {tab === 'mobs' ? (
              <span className="text-red-300">💀 {myEntry.mobsKilled} монстров</span>
            ) : tab === 'gold' ? (
              <span className="text-amber-300">🪙 {myEntry.totalGoldCollected.toLocaleString()} золота</span>
            ) : (
              <>
                <span className="text-cyan-300">
                  ⚖️ {formatWeightKg(getPlayerFishWeightKg(myEntry))} кг
                </span>
                <span className="text-slate-400 text-[8.5px]">
                  ({getPlayerFishCount(myEntry)} шт.)
                </span>
                {getFishingWeeklyReward(myRank) && getPlayerFishWeightKg(myEntry) > 0 && (
                  <span className="rounded border border-emerald-400/60 bg-emerald-950/80 px-1.5 py-0.5 text-[8px] font-black text-emerald-300">
                    Приз: {getFishingWeeklyReward(myRank)!.shortLabel}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard Player List */}
      <div className="flex-1 overflow-y-auto pt-2 space-y-1.5">
        {loading && entries.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400 text-xs">
            <span className="text-2xl animate-spin">⏳</span>
            <span>Загрузка актуального рейтинга рыболовов Нила...</span>
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
            const fishCount = getPlayerFishCount(player);
            const fishWeightKg = getPlayerFishWeightKg(player);
            const maxTrophyKg = Number(player.weeklyMaxFishWeightKg || 0);
            const fishingWeeklyReward =
              tab === 'fishing' && fishWeightKg > 0 ? getFishingWeeklyReward(rank) : null;

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

                  {/* Avatar with transparent background */}
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-500/40 bg-transparent text-base p-0.5 overflow-visible">
                    <CharacterAvatar avatar={player.avatar} nick={player.nick} className="w-full h-full object-contain" />
                    {player.isPremium && (
                      <span className="absolute -top-1.5 -right-1 text-[8px] animate-bounce">
                        👑
                      </span>
                    )}
                  </div>

                  {/* Nick & Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 leading-tight flex-wrap">
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
                      {/* Glowing Fish-shaped Medal ONLY for 1st, 2nd, and 3rd place on Fishing tab */}
                      {tab === 'fishing' && fishWeightKg > 0 && (rank === 1 || rank === 2 || rank === 3) && (
                        <FishingRankMedal rank={rank} fishCaught={fishCount} size="sm" showDetails={false} />
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[8.5px] text-slate-400 flex-wrap">
                      <span className="text-purple-300 font-bold">Ур.{player.lvl}</span>
                      <span className="rounded bg-amber-500/20 border border-amber-500/40 px-1 py-[0.5px] text-[7.5px] font-black text-amber-300">
                        🔺П{getPyramidTierForLevel(player.lvl)}
                      </span>
                      <span>•</span>
                      <span className={player.isOnline ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                        {player.isOnline ? '🟢 Онлайн' : '⚪ Оффлайн'}
                      </span>
                      {tab === 'fishing' && maxTrophyKg > 0 && (
                        <span className="rounded border border-cyan-500/40 bg-cyan-950/60 px-1 py-[0.5px] text-[7.5px] font-bold text-cyan-200">
                          🏆 трофей: {formatWeightKg(maxTrophyKg)} кг
                        </span>
                      )}
                      {fishingWeeklyReward && (
                        <span
                          className={`rounded border px-1 py-[0.5px] text-[7.5px] font-black ${
                            rank === 1
                              ? 'border-amber-400 bg-amber-950/90 text-yellow-300'
                              : rank === 2
                              ? 'border-slate-300 bg-slate-800 text-slate-100'
                              : rank === 3
                              ? 'border-orange-400 bg-orange-950/90 text-orange-200'
                              : 'border-yellow-600/60 bg-yellow-950/60 text-amber-300'
                          }`}
                        >
                          🎁 Награда недели: {fishingWeeklyReward.shortLabel}
                        </span>
                      )}
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
                    ) : tab === 'gold' ? (
                      <div>
                        <div className="text-[11px] font-black text-amber-400 tabular-nums">
                          🪙 {player.totalGoldCollected.toLocaleString()}
                        </div>
                        <div className="text-[7.5px] text-slate-500">золота</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-[11px] font-black text-cyan-300 tabular-nums">
                          ⚖️ {formatWeightKg(fishWeightKg)} кг
                        </div>
                        <div className="text-[7.5px] text-slate-400 tabular-nums">
                          🐟 {fishCount.toLocaleString('ru-RU')} рыб
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => onInspectPlayer(player.nick)}
                    className="rounded bg-slate-800 border border-slate-700 px-2 py-1 text-[8.5px] font-bold text-sky-300 hover:border-sky-400 hover:bg-slate-700 active:scale-95 cursor-pointer"
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
