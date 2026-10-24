import React, { useEffect, useState, useMemo } from 'react';
import { HeroState, PyramidCell, PlayerPosition, DamagePopup, RareBossTimerState } from '../types/game';
import { EXP_TABLE, MAX_LEVEL, getPyramidTierForLevel } from '../utils/gameData';
import { fetchInitialPlayers, subscribeToPlayersRealtime, RealtimePlayer, isPlayerOnlineByHeartbeat } from '../utils/supabase';
import { getPlayerClan } from '../utils/clanStorage';
import CharacterAvatar from './CharacterAvatar';

interface PyramidScreenProps {
  hero: HeroState;
  pyramidTier: number;
  pyramidMap: PyramidCell[][];
  playerPos: PlayerPosition;
  lastMoveTime: number;
  moveDelay: number;
  respawnTimeLeft: number;
  activeSack: { row: number; col: number; gold: number; crystals?: number; rareBossId?: string } | null;
  damagePopups: DamagePopup[];
  rareBossTimers: RareBossTimerState[];
  realtimePlayers?: any[];
  currentUser?: string;
  unreadMailCount?: number;
  onPickUpSack: (row: number, col: number) => void;
  onBlockClick: (row: number, col: number) => void;
  onExitToCity: () => void;
  onUsePotion: (type: 'hp' | 'en' | 'exp') => void;
  onOpenCharModal: () => void;
}

export const PyramidScreen: React.FC<PyramidScreenProps> = ({
  hero,
  pyramidTier,
  pyramidMap,
  playerPos,
  lastMoveTime,
  moveDelay,
  respawnTimeLeft,
  activeSack,
  rareBossTimers = [],
  realtimePlayers = [],
  currentUser = '',
  unreadMailCount = 0,
  onPickUpSack,
  onBlockClick,
  onExitToCity,
  onUsePotion,
  onOpenCharModal
}) => {
  const [dbPyramidPlayers, setDbPyramidPlayers] = useState<RealtimePlayer[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Real-time query & subscription to Supabase `players` table for all players in the pyramid (both online and offline)
  useEffect(() => {
    let mounted = true;

    const loadPyramidPlayersFromDb = async () => {
      try {
        const players = await fetchInitialPlayers();
        if (mounted && Array.isArray(players)) {
          setDbPyramidPlayers(
            players.filter((p) => p.location === 'pyramid' && (p.hp ?? 100) > 0)
          );
        }
      } catch (e) {
        // ignore transient network errors
      }
    };

    loadPyramidPlayersFromDb();

    const pollTimer = setInterval(loadPyramidPlayersFromDb, 1200);

    const { unsubscribe } = subscribeToPlayersRealtime({
      onInsert: (player) => {
        if (!mounted) return;
        setDbPyramidPlayers((prev) => {
          const rest = prev.filter((p) => p.nick.toLowerCase() !== player.nick.toLowerCase());
          return player.location === 'pyramid' && (player.hp ?? 100) > 0
            ? [player, ...rest]
            : rest;
        });
      },
      onUpdate: (player) => {
        if (!mounted) return;
        setDbPyramidPlayers((prev) => {
          const rest = prev.filter((p) => p.nick.toLowerCase() !== player.nick.toLowerCase());
          return player.location === 'pyramid' && (player.hp ?? 100) > 0
            ? [player, ...rest]
            : rest;
        });
      },
      onDelete: (oldRecord) => {
        if (!mounted) return;
        const deletedNick = String(oldRecord?.nick || oldRecord?.name || '').trim().toLowerCase();
        if (deletedNick) {
          setDbPyramidPlayers((prev) => prev.filter((p) => p.nick.toLowerCase() !== deletedNick));
        }
      },
      onStatusChange: () => {}
    });

    return () => {
      mounted = false;
      clearInterval(pollTimer);
      unsubscribe();
    };
  }, []);

  // Merge freshly fetched Supabase players with prop realtimePlayers, keeping all other living players in this pyramid tier (both online AND offline)
  const activeOtherPlayers = useMemo(() => {
    const mergedMap = new Map<string, any>();
    const myCleanNick = String(currentUser || '').trim().toLowerCase();

    const addCandidate = (p: any) => {
      if (!p) return;
      const nick = String(p.nick || p.name || p['имя'] || '').trim();
      if (!nick) return;
      const lower = nick.toLowerCase();
      if (myCleanNick && lower === myCleanNick) return;

      const loc = String(p.location || 'pyramid').toLowerCase();
      if (loc !== 'pyramid' && loc !== 'пирамида') return;

      const hpVal = Number(p.hp ?? 100);
      if (hpVal <= 0) return;

      const playerLvl = Math.max(1, Number(p.lvl ?? p.level ?? 1));
      const tier = getPyramidTierForLevel(playerLvl);
      if (tier !== Number(pyramidTier)) return;

      const rawR = Number(p.row ?? p['ряд'] ?? 9);
      const rawC = Number(p.col ?? p['ц'] ?? 0);
      const maxR = Math.max(0, (pyramidMap?.length || 10) - 1);
      const clampedR = Math.max(0, Math.min(maxR, Number.isFinite(rawR) ? rawR : 9));
      const maxC = Math.max(0, (pyramidMap?.[clampedR]?.length || clampedR + 1) - 1);
      const clampedC = Math.max(0, Math.min(maxC, Number.isFinite(rawC) ? rawC : 0));

      const rawLastSeen = Number(p.lastSeen ?? p.last_seen ?? 0);
      const isOnline =
        rawLastSeen > 0
          ? isPlayerOnlineByHeartbeat(p.isOnline ?? p.is_online, rawLastSeen)
          : false;

      mergedMap.set(lower, {
        ...p,
        nick,
        lvl: playerLvl,
        hp: hpVal,
        maxHp: Number(p.maxHp ?? p.max_hp ?? 100),
        avatar: p.avatar || (p.role === 'admin' || Number(p.is_admin) === 1 || Number(p.isAdmin) === 1 ? '👑' : '🥷'),
        pyramidTier: tier,
        row: clampedR,
        col: clampedC,
        isOnline
      });
    };

    if (Array.isArray(realtimePlayers)) {
      realtimePlayers.forEach(addCandidate);
    }
    if (Array.isArray(dbPyramidPlayers)) {
      dbPyramidPlayers.forEach(addCandidate);
    }

    return Array.from(mergedMap.values());
  }, [dbPyramidPlayers, realtimePlayers, currentUser, pyramidTier, pyramidMap]);

  const safeHeroMaxHp = Math.max(10, Number(hero.maxHp) || 100);
  const rawHp = Number(hero.hp);
  const safeHeroHp = Number.isFinite(rawHp) && rawHp > 0 ? Math.min(rawHp, safeHeroMaxHp) : safeHeroMaxHp;
  const hpPercent = Math.max(0, Math.min(100, (safeHeroHp / safeHeroMaxHp) * 100));
  const safeHeroMaxEn = Math.max(50, Number(hero.maxEnergy) || 100);
  const rawEn = Number(hero.energy);
  const safeHeroEn = Number.isFinite(rawEn) && rawEn >= 0 ? Math.min(rawEn, safeHeroMaxEn) : safeHeroMaxEn;
  const enPercent = Math.max(0, Math.min(100, (safeHeroEn / safeHeroMaxEn) * 100));
  const nextExp = hero.level >= MAX_LEVEL ? 0 : EXP_TABLE[hero.level] || 1000;
  const expPercent = nextExp > 0 ? Math.min(100, (hero.exp / nextExp) * 100) : 100;

  const timeRemaining = Math.max(0, moveDelay - (Date.now() - lastMoveTime));
  const canMove = timeRemaining === 0;

  const tierTitle =
    pyramidTier === 1
      ? '🏛️ Пирамида 1: Усыпальница Хеопса (1–5 ур.)'
      : pyramidTier === 2
      ? '🏛️ Пирамида 2: Храм Анубиса (6–10 ур.)'
      : '🏛️ Пирамида 3: Чертог Ра (11–20 ур.)';

  const formatTimerSec = (ms: number) => {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    if (hours > 0) {
      return `${hours}ч ${pad(mins)}м ${pad(secs)}с`;
    }
    return mins > 0 ? `${pad(mins)}м ${pad(secs)}с` : `${pad(secs)}с`;
  };

  return (
    <div
      className="relative flex flex-[64] min-h-0 flex-col overflow-hidden border-b-2 border-amber-600/60 bg-[#160e07]"
      style={{
        backgroundImage: `
          radial-gradient(ellipse at 50% 32%, rgba(217, 138, 43, 0.26) 0%, rgba(110, 64, 24, 0.42) 48%, rgba(16, 10, 5, 0.96) 100%),
          repeating-linear-gradient(0deg, rgba(245, 180, 75, 0.08) 0px, rgba(245, 180, 75, 0.08) 1px, transparent 1px, transparent 26px),
          repeating-linear-gradient(90deg, rgba(245, 180, 75, 0.07) 0px, rgba(245, 180, 75, 0.07) 1px, transparent 1px, transparent 38px),
          repeating-linear-gradient(135deg, rgba(0, 0, 0, 0.22) 0px, rgba(0, 0, 0, 0.22) 2px, transparent 2px, transparent 9px)
        `
      }}
    >
      {/* Ancient Egyptian Temple Ornamental Background Layer (Hieroglyphs, Columns & Torch Glow) */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Top Egyptian Frieze Border */}
        <div
          className="h-1.5 w-full opacity-40"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, #f59e0b 0px, #f59e0b 6px, #78350f 6px, #78350f 12px, #fbbf24 12px, #fbbf24 15px, #451a03 15px, #451a03 20px)'
          }}
        />
        {/* Left & Right Carved Hieroglyphic Pillars */}
        <div className="absolute left-1.5 top-24 bottom-4 flex flex-col justify-around text-[11px] leading-none text-amber-500/15 select-none font-serif">
          <span>𓂀</span>
          <span>𓋹</span>
          <span>𓆣</span>
          <span>𓇳</span>
          <span>𓊽</span>
          <span>𓅃</span>
        </div>
        <div className="absolute right-1.5 top-24 bottom-4 flex flex-col justify-around text-[11px] leading-none text-amber-500/15 select-none font-serif">
          <span>𓅃</span>
          <span>𓊽</span>
          <span>𓇳</span>
          <span>𓆣</span>
          <span>𓋹</span>
          <span>𓂀</span>
        </div>
        {/* Subtle Pyramid Inner Sanctuary Glow */}
        <div
          className="absolute inset-x-6 bottom-1 top-14 opacity-25"
          style={{
            background:
              'conic-gradient(from 180deg at 50% 8%, rgba(251, 191, 36, 0.28) 0deg, transparent 55deg, transparent 305deg, rgba(251, 191, 36, 0.28) 360deg)'
          }}
        />
      </div>

      {/* Top HUD Section — compact, no clipping, no scroll needed */}
      <div className="relative z-20 flex items-start justify-between gap-1.5 px-2 pt-1.5 pb-1 bg-gradient-to-b from-black/85 via-black/50 to-transparent shrink-0">
        {/* Left: Player Stats Panel */}
        <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/45 bg-slate-950/95 px-1.5 py-1 shadow-md">
          <div
            onClick={onOpenCharModal}
            className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-amber-400 bg-slate-800 text-sm shrink-0 p-0.5 overflow-hidden"
            title="Открыть Персонажа и Почту"
          >
            <CharacterAvatar avatar={hero.avatar} nick={currentUser} className="w-full h-full object-contain" />
            {Boolean(hero.isPremium && hero.premiumUntil && hero.premiumUntil > Date.now()) && (
              <span className="absolute -top-1.5 -left-1.5 text-[8px] animate-bounce">👑</span>
            )}
            {(unreadMailCount > 0 || Number(hero.statPoints || 0) > 0) && (
              <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-600 px-0.5 text-[7px] font-black text-white ring-1 ring-black animate-pulse shadow-[0_0_8px_#ef4444]">
                {unreadMailCount + Math.max(0, Number(hero.statPoints || 0))}
              </span>
            )}
          </div>

          <div className="flex w-24 flex-col gap-0.5">
            {/* Nickname & Level */}
            <div className="flex items-center justify-between text-[7.5px] font-extrabold leading-none">
              <span className="truncate text-amber-300 max-w-[60px]">
                {Boolean(hero.isPremium && hero.premiumUntil && hero.premiumUntil > Date.now())
                  ? '👑 '
                  : ''}
                {currentUser || 'Игрок'}
              </span>
              <span className="text-purple-300">
                {Boolean(hero.isPremium && hero.premiumUntil && hero.premiumUntil > Date.now())
                  ? '👑 '
                  : ''}
                Ур.{hero.level}
              </span>
            </div>

            {/* HP */}
            <div className="relative h-2 w-full overflow-hidden rounded bg-slate-800 border border-slate-700">
              <div className="h-full bg-red-600 transition-all" style={{ width: `${hpPercent}%` }} />
              <div className="absolute inset-0 flex items-center justify-center text-[6px] font-bold text-white drop-shadow tabular-nums">
                ❤️ {hero.hp}/{hero.maxHp}
              </div>
            </div>

            {/* Energy */}
            <div className="relative h-2 w-full overflow-hidden rounded bg-slate-800 border border-slate-700">
              <div className="h-full bg-sky-600 transition-all" style={{ width: `${enPercent}%` }} />
              <div className="absolute inset-0 flex items-center justify-center text-[6px] font-bold text-white drop-shadow tabular-nums">
                ⚡ {hero.energy}/{hero.maxEnergy}
              </div>
            </div>

            {/* EXP */}
            <div className="relative h-1.5 w-full overflow-hidden rounded bg-slate-800 border border-slate-700">
              <div className="h-full bg-purple-600 transition-all" style={{ width: `${expPercent}%` }} />
              <div className="absolute inset-0 flex items-center justify-center text-[5px] font-bold text-white drop-shadow tabular-nums">
                EXP {hero.exp}/{nextExp}
              </div>
            </div>
          </div>

          <div className="ml-0.5 flex flex-col items-end text-[8px] font-bold border-l border-slate-800 pl-1.5 tabular-nums leading-tight">
            <span className="text-amber-400">🪙 {hero.gold}</span>
            <span className="text-cyan-400">💎 {hero.crystals}</span>
          </div>
        </div>

        {/* Right: Tier Title, Step Cooldown, Mob Respawn & Smooth Rare Boss Timers */}
        <div className="flex flex-col items-end gap-0.5 min-w-0">
          <div className="rounded bg-slate-950/90 border border-amber-500/40 px-1.5 py-0.5 text-[7px] font-bold text-amber-300 text-right max-w-[175px] truncate shadow">
            {tierTitle}
          </div>

          <div className="flex items-center gap-1">
            <div
              className={`rounded bg-slate-950/90 border border-slate-700 px-1.5 py-0.5 text-[7px] font-bold tabular-nums shadow ${
                canMove ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {canMove ? '✅ Шаг готов' : `⏳ ${(timeRemaining / 1000).toFixed(1)}с`}
            </div>
            <div
              className="rounded bg-slate-950/90 border border-slate-700 px-1.5 py-0.5 text-[7px] text-slate-300 tabular-nums shadow"
              title="Таймер спавна обычных монстров на пустых клетках (каждую минуту)"
            >
              🔄 <span className="font-bold text-amber-300">{respawnTimeLeft}с</span>
            </div>
          </div>

          {/* Smooth Rare / Boss Queue Timers & Active Temporary Bonuses */}
          <div className="rounded border border-amber-500/30 bg-slate-950/95 px-1.5 py-0.5 text-[7px] text-slate-200 flex flex-col items-end gap-0.5 shadow min-w-[125px]">
            {rareBossTimers.map((boss) => (
              <div key={boss.id} className="flex items-center justify-between gap-1.5 w-full leading-tight">
                <span className="text-amber-400 font-bold">
                  💎 Кристалл:
                </span>
                {boss.isAliveOnMap ? (
                  <span className="font-extrabold text-emerald-400">НА КАРТЕ!</span>
                ) : boss.isFrozenWaitingForCell ? (
                  <span
                    className="font-extrabold text-sky-300 animate-pulse"
                    title="Таймер заморожен! Освободите пустую клетку (убейте моба и отойдите), чтобы босс появился."
                  >
                    ❄️ Ждет клетку
                  </span>
                ) : (
                  <span className="font-mono font-bold text-amber-100 tabular-nums">
                    {formatTimerSec(boss.remainingMs)}
                  </span>
                )}
              </div>
            ))}

            {/* Temporary Bonuses Section right under Crystal timer */}
            {(() => {
              const expElixirRemMs = Math.max(0, Number(hero.expElixirUntil || 0) - nowMs);
              const isExpElixirActive = expElixirRemMs > 0;
              const vipRemMs =
                hero.isPremium && hero.premiumUntil
                  ? Math.max(0, Number(hero.premiumUntil) - nowMs)
                  : 0;
              const isVipBonusActive = vipRemMs > 0;
              const killerRemMs = Math.max(0, Number(hero.killerLicenseUntil || 0) - nowMs);
              const isKillerActive = killerRemMs > 0;

              return (
                <>
                  <div className="flex items-center justify-between gap-1.5 w-full leading-tight border-t border-slate-800/90 pt-0.5">
                    <span className="text-red-300 font-bold" title="Лицензия киллера (разрешает убивать игроков в Пирамиде)">
                      🗡️ Киллер:
                    </span>
                    {isKillerActive ? (
                      <span className="font-mono font-extrabold text-emerald-400 tabular-nums">
                        {formatTimerSec(killerRemMs)}
                      </span>
                    ) : (
                      <span className="text-slate-500 font-semibold">
                        {Number(hero.killerLicenses || 0) > 0
                          ? `В запасе (${hero.killerLicenses}шт)`
                          : 'Нет (10💎)'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1.5 w-full leading-tight">
                    <span className="text-purple-300 font-bold">
                      ✨ Опыт +25%:
                    </span>
                    {isExpElixirActive ? (
                      <span className="font-mono font-extrabold text-emerald-400 tabular-nums">
                        {formatTimerSec(expElixirRemMs)}
                      </span>
                    ) : (
                      <span className="text-slate-500 font-semibold">
                        {Number(hero.expPotions || 0) > 0
                          ? `Готов (${hero.expPotions}шт)`
                          : 'Нет'}
                      </span>
                    )}
                  </div>

                  {isVipBonusActive && (
                    <div className="flex items-center justify-between gap-1.5 w-full leading-tight">
                      <span className="text-yellow-300 font-bold">
                        👑 VIP (х2 опыт):
                      </span>
                      <span className="font-mono font-extrabold text-yellow-200 tabular-nums">
                        {formatTimerSec(vipRemMs)}
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Floating Vertical Square Potion Bottle Buttons in the upper-left flank of the pyramid so they don't push the grid down */}
      <div className="absolute left-2 top-[76px] z-20 flex flex-col gap-1.5">
        <button
          onClick={() => onUsePotion('hp')}
          disabled={hero.hpPotions <= 0 || hero.hp >= hero.maxHp}
          className="group relative flex h-8 w-8 flex-col items-center justify-center rounded-lg border-2 border-red-400/80 bg-gradient-to-b from-red-800/90 via-red-950 to-slate-950 shadow-[0_0_10px_rgba(239,68,68,0.35)] transition-transform active:scale-90 disabled:opacity-40 hover:border-red-300"
          title="Эликсир здоровья (+50 HP)"
        >
          <span className="text-[11px] leading-none drop-shadow">🧪</span>
          <span className="mt-0.5 text-[6px] font-black uppercase tracking-tighter text-red-200 leading-none">
            HP
          </span>
          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full border border-red-200 bg-red-600 px-0.5 text-[7px] font-black text-white shadow tabular-nums">
            {hero.hpPotions}
          </span>
        </button>

        <button
          onClick={() => onUsePotion('en')}
          disabled={hero.enPotions <= 0 || hero.energy >= hero.maxEnergy}
          className="group relative flex h-8 w-8 flex-col items-center justify-center rounded-lg border-2 border-sky-400/80 bg-gradient-to-b from-sky-800/90 via-sky-950 to-slate-950 shadow-[0_0_10px_rgba(56,189,248,0.35)] transition-transform active:scale-90 disabled:opacity-40 hover:border-sky-300"
          title="Эликсир энергии (+20 EN)"
        >
          <span className="text-[11px] leading-none drop-shadow">⚗️</span>
          <span className="mt-0.5 text-[6px] font-black uppercase tracking-tighter text-sky-200 leading-none">
            EN
          </span>
          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full border border-sky-200 bg-sky-600 px-0.5 text-[7px] font-black text-white shadow tabular-nums">
            {hero.enPotions}
          </span>
        </button>

        <button
          onClick={() => onUsePotion('exp')}
          disabled={Number(hero.expPotions || 0) <= 0}
          className={`group relative flex h-8 w-8 flex-col items-center justify-center rounded-lg border-2 bg-gradient-to-b from-purple-800/90 via-purple-950 to-slate-950 shadow-[0_0_10px_rgba(168,85,247,0.4)] transition-transform active:scale-90 disabled:opacity-40 hover:border-purple-300 ${
            hero.expElixirUntil && hero.expElixirUntil > nowMs
              ? 'border-emerald-400 ring-1 ring-emerald-400/60'
              : 'border-purple-400/80'
          }`}
          title="Ячейка Эликсира Опыта (+25% к опыту на 30 мин)"
        >
          <span className="text-[11px] leading-none drop-shadow">✨</span>
          <span className="mt-0.5 text-[6px] font-black uppercase tracking-tighter text-purple-200 leading-none">
            EXP
          </span>
          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full border border-purple-200 bg-purple-600 px-0.5 text-[7px] font-black text-white shadow tabular-nums">
            {hero.expPotions || 0}
          </span>
        </button>
      </div>

      {/* Glowing Action Button: Pick Up Gold/Crystal Sack (ONLY SHOWN WHEN DIRECTLY STANDING ON SACK) */}
      {activeSack && (
        <div className="absolute bottom-1.5 left-1/2 z-30 -translate-x-1/2 w-[85%] max-w-[260px]">
          <button
            onClick={() => onPickUpSack(activeSack.row, activeSack.col)}
            className={`w-full flex items-center justify-center gap-1.5 rounded-lg border-2 py-1 px-3 text-[11px] font-black text-slate-950 shadow-lg animate-pulse active:scale-95 ${
              (activeSack.crystals && activeSack.crystals > 0) || activeSack.rareBossId === 'crystal'
                ? 'border-cyan-300 bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-500 shadow-[0_0_15px_rgba(6,182,212,0.9)]'
                : 'border-yellow-400 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 shadow-[0_0_15px_rgba(234,179,8,0.9)]'
            }`}
          >
            <span>{(activeSack.crystals && activeSack.crystals > 0) || activeSack.rareBossId === 'crystal' ? '💎' : '💰'}</span>
            <span>
              {(activeSack.crystals && activeSack.crystals > 0) || activeSack.rareBossId === 'crystal'
                ? `ЗАБРАТЬ КРИСТАЛЛЫ (+${activeSack.crystals || 25} 💎)`
                : `ПОДОБРАТЬ МЕШОЧЕК (+${activeSack.gold || 5} 🪙)`}
            </span>
          </button>
        </div>
      )}

      {/* PYRAMID CRAWLER AREA — fits 100% of all 10 rows without vertical scrolling */}
      <div className="relative z-10 flex flex-1 min-h-0 flex-col items-center justify-between px-1.5 pt-0.5 pb-1.5 overflow-hidden">
        {/* Live coordinate radar of players on the pyramid map (both online and offline) */}
        <div className="flex flex-wrap items-center justify-center gap-1 rounded border border-amber-500/40 bg-black/80 px-2 py-0.5 text-[7.5px] text-slate-200 shadow shrink-0 max-w-full">
          <span className="font-bold text-amber-300">
            📍 Вы: [ряд {playerPos.row}, кл. {playerPos.col}]
          </span>
          {activeOtherPlayers.length > 0 ? (
            activeOtherPlayers.map((op) => (
              <span
                key={op.nick}
                className={`inline-flex items-center gap-1 rounded px-1 py-0.5 font-bold ${
                  op.isOnline
                    ? 'bg-red-950/90 border border-red-500/60 text-red-200 animate-pulse'
                    : 'bg-slate-900/95 border border-amber-500/50 text-slate-300'
                }`}
              >
                <CharacterAvatar avatar={op.avatar || '🥷'} nick={op.nick} size="xs" className="w-3.5 h-3.5 object-contain" />
                <span>{op.nick}</span>
                <span className="text-amber-300">
                  [{op.row},{op.col}]
                </span>
                {!op.isOnline && (
                  <span className="ml-0.5 rounded bg-slate-800 px-0.5 text-[6px] font-black text-amber-300">
                    ОФФ
                  </span>
                )}
              </span>
            ))
          ) : (
            <span className="text-slate-400">• На ярусе других игроков нет</span>
          )}
        </div>

        {/* 10 Rows of Pyramid Tiles — responsive sizing so all rows fit without scrolling */}
        <div className="flex flex-1 min-h-0 w-full flex-col items-center justify-evenly gap-[1px]">
          {pyramidMap.map((row, rIdx) => (
            <div key={rIdx} className="flex justify-center gap-1">
              {row.map((cell, cIdx) => {
                const isPlayer = rIdx === playerPos.row && cIdx === playerPos.col;
                const isExit = rIdx === pyramidMap.length - 1 && cIdx === 0;
                const isSpawnNextToExit = rIdx === pyramidMap.length - 1 && cIdx === 1;
                const isPortal = cell.type === 'portal' || cell.type === 'nextTier';
                const isSack = cell.type === 'sack' && !isExit && !isSpawnNextToExit;

                const otherPlayersOnCell = activeOtherPlayers.filter(
                  (p: any) => Number(p.row) === rIdx && Number(p.col) === cIdx
                );
                const otherPlayerOnCell = otherPlayersOnCell[0] || null;

                const isOtherPlayer =
                  otherPlayersOnCell.length > 0 ||
                  cell.type === 'player' ||
                  Boolean(
                    cell.playerNick &&
                      (!currentUser ||
                        cell.playerNick.toLowerCase() !== currentUser.trim().toLowerCase())
                  );

                const hasLivingPlayerOnCell = isPlayer || isOtherPlayer;

                // Monsters can never spawn or appear on a cell where a player stands, on Exit [9,0], or on the empty Spawn cell next to Exit [9,1]
                const isMob =
                  cell.type === 'mob' &&
                  !hasLivingPlayerOnCell &&
                  !isExit &&
                  !isSpawnNextToExit;

                const enemyNick =
                  otherPlayerOnCell?.nick ||
                  otherPlayerOnCell?.name ||
                  cell.playerNick ||
                  'Соперник';
                const enemyLvl = otherPlayerOnCell?.lvl || cell.playerLvl || 1;
                const enemyAvatar = otherPlayerOnCell?.avatar || cell.playerAvatar || '🥷';
                const enemyHp = otherPlayerOnCell?.hp ?? cell.playerHp ?? 100;
                const enemyMaxHp = otherPlayerOnCell?.maxHp ?? cell.playerMaxHp ?? 100;
                const enemyIsOnline =
                  otherPlayerOnCell !== null
                    ? Boolean(otherPlayerOnCell.isOnline)
                    : Boolean(cell.playerIsOnline ?? true);

                // Distance check: can click if row diff <= 1 and col diff <= 1
                const isAdjacent =
                  Math.abs(rIdx - playerPos.row) <= 1 && Math.abs(cIdx - playerPos.col) <= 1;

                let blockBg =
                  'bg-gradient-to-br from-[#c29663] via-[#966b3d] to-[#634221] border-[#d6ab77]/60 border-b-[#2b1a0a] shadow-[inset_0_1px_1px_rgba(255,235,190,0.25)]';

                if (isExit) {
                  blockBg =
                    'bg-gradient-to-br from-emerald-600 to-green-800 border-2 border-emerald-300 border-b-emerald-950 shadow-[0_0_10px_rgba(16,185,129,0.85)] animate-pulse';
                } else if (isPlayer && isOtherPlayer) {
                  blockBg =
                    'bg-gradient-to-br from-[#c98b52] via-[#9e5431] to-[#5e2214] border-2 border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.95)]';
                } else if (isPlayer) {
                  blockBg =
                    'bg-gradient-to-br from-[#d9ad78] via-[#ab7d49] to-[#6e4a23] border-2 border-amber-300 border-b-amber-500 shadow-[0_0_10px_rgba(250,204,21,0.9),inset_0_0_6px_rgba(254,240,138,0.35)]';
                } else if (isOtherPlayer) {
                  blockBg = enemyIsOnline
                    ? 'bg-gradient-to-br from-[#a85544] via-[#7c3528] to-[#4a1a12] border-2 border-red-500 border-b-red-950 shadow-[0_0_8px_rgba(239,68,68,0.85)]'
                    : 'bg-gradient-to-br from-[#8c6244] via-[#634128] to-[#3d2412] border-2 border-amber-500/80 border-b-red-950 shadow-[0_0_6px_rgba(245,158,11,0.6)]';
                } else if (isPortal) {
                  blockBg =
                    'bg-gradient-to-br from-purple-600 to-indigo-900 border-purple-400 border-b-purple-950 shadow-[0_0_8px_#a855f7] animate-pulse';
                } else if (isSack) {
                  const isCrystal = cell.rareBossId === 'crystal' || (cell.sackCrystals && cell.sackCrystals > 0);
                  blockBg = isCrystal
                    ? 'bg-gradient-to-br from-cyan-700 via-sky-800 to-blue-950 border-2 border-cyan-400 border-b-cyan-950 shadow-[0_0_10px_rgba(6,182,212,0.85)] animate-pulse'
                    : 'bg-gradient-to-br from-yellow-700 to-amber-900 border-yellow-400 border-b-amber-950 shadow-[0_0_6px_rgba(245,158,11,0.5)]';
                }

                return (
                  <button
                    key={`${rIdx}-${cIdx}`}
                    onClick={() => (isExit && isAdjacent ? onExitToCity() : onBlockClick(rIdx, cIdx))}
                    disabled={!isAdjacent && !isPlayer}
                    className={`relative flex h-[25px] w-[25px] sm:h-[27px] sm:w-[27px] flex-col items-center justify-center overflow-hidden rounded border border-b-2 text-[10px] font-bold transition-transform active:scale-90 ${blockBg} ${
                      !isAdjacent && !isPlayer ? 'opacity-85' : 'hover:scale-105'
                    }`}
                  >
                    {/* LAYER 1 (z-10): Background environment / chests / monsters */}
                    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
                      {isExit ? (
                        <div
                          className="flex flex-col items-center leading-none"
                          title="Выход в главный город (левый нижний угол пирамиды)"
                        >
                          <span className="text-[10px] leading-none">🏃‍♂️</span>
                          <span className="text-[5px] font-black uppercase text-emerald-100 drop-shadow leading-none">
                            Выход
                          </span>
                        </div>
                      ) : isPortal ? (
                        <span
                          className={`text-xs ${
                            hasLivingPlayerOnCell ? 'opacity-40 scale-75 translate-x-1.5 -translate-y-1' : ''
                          }`}
                          title={
                            pyramidTier === 1
                              ? 'Портал во 2-ю Пирамиду (требуется 6 ур.)'
                              : pyramidTier === 2
                              ? 'Портал в 3-ю Пирамиду (требуется 11 ур.)'
                              : 'Триумф! Все 3 пирамиды покорены'
                          }
                        >
                          🌀
                        </span>
                      ) : isSack ? (
                        <div
                          className={`flex flex-col items-center leading-none ${
                            hasLivingPlayerOnCell
                              ? 'absolute bottom-0 right-0 opacity-85 scale-75'
                              : ''
                          }`}
                          title={
                            cell.rareBossId === 'crystal' || (cell.sackCrystals && cell.sackCrystals > 0)
                              ? '💎 Тайник Кристаллов (+25 💎) — наступите, чтобы забрать'
                              : 'Мешочек с золотом (наступите чтобы открыть)'
                          }
                        >
                          <span className="text-[11px] leading-none">
                            {cell.rareBossId === 'crystal' || (cell.sackCrystals && cell.sackCrystals > 0)
                              ? '💎'
                              : '💰'}
                          </span>
                        </div>
                      ) : isMob && cell.mobMaxHp ? (
                        <>
                          {/* Mob HP Bar */}
                          <div className="absolute top-0.5 h-[3px] w-[82%] rounded-full bg-red-950 overflow-hidden">
                            <div
                              className="h-full bg-red-500"
                              style={{
                                width: `${Math.max(0, (cell.mobHp! / cell.mobMaxHp!) * 100)}%`
                              }}
                            />
                          </div>
                          <span
                            className="text-[11px] leading-none mt-0.5"
                            title={`${cell.mobName || 'Монстр'} (${cell.mobLvl} ур.)`}
                          >
                            {cell.icon || '🦂'}
                          </span>
                          <span className="absolute bottom-0 text-[5.5px] font-extrabold text-amber-100 drop-shadow leading-none">
                            L{cell.mobLvl}
                          </span>
                        </>
                      ) : !hasLivingPlayerOnCell ? (
                        <span className="text-[7px] text-amber-200/35">•</span>
                      ) : null}
                    </div>

                    {/* LAYER 2 (z-20): Foreground living player avatars ALWAYS rendered cleanly above background objects */}
                    {hasLivingPlayerOnCell && (
                      <div className="relative z-20 flex h-full w-full flex-col items-center justify-center">
                        {isPlayer && isOtherPlayer ? (
                          <div
                            className="flex flex-col items-center justify-center leading-none w-full h-full"
                            title={`Вы и игрок ${enemyNick} (${enemyLvl} ур., ${
                              enemyIsOnline ? 'Онлайн' : 'Оффлайн'
                            }) на одной клетке [${rIdx},${cIdx}]! Нажмите для атаки!`}
                          >
                            {/* Enemy mini HP bar */}
                            <div className="absolute top-0.5 z-30 h-[3px] w-[85%] rounded-full bg-red-950 overflow-hidden">
                              <div
                                className="h-full bg-red-500"
                                style={{
                                  width: `${Math.max(0, (enemyHp / Math.max(1, enemyMaxHp)) * 100)}%`
                                }}
                              />
                            </div>
                            {!enemyIsOnline && (
                              <span className="absolute top-1 right-0 z-30 rounded bg-slate-950/90 border border-amber-400 px-0.5 text-[4px] font-black text-amber-300">
                                ОФФ
                              </span>
                            )}
                            <div className="flex items-center justify-center gap-0.5 mt-0.5 text-[9px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)] max-w-full">
                              <CharacterAvatar avatar={hero.avatar} nick={currentUser} size="xs" className="object-contain" />
                              <CharacterAvatar avatar={enemyAvatar} nick={enemyNick} size="xs" className="object-contain" />
                            </div>
                          </div>
                        ) : isPlayer ? (
                          <div
                            className="relative flex items-center justify-center w-full h-full"
                            title={`Вы (${hero.level} ур.) • ${Math.round(hero.hp)}/${hero.maxHp} HP${getPlayerClan(currentUser) ? ` • Клан [${getPlayerClan(currentUser)?.tag}] ${getPlayerClan(currentUser)?.name}` : ''} [ряд ${rIdx}, кл. ${cIdx}]`}
                          >
                            {/* Player mini HP bar */}
                            <div className="absolute top-0.5 z-30 h-[2.5px] w-[80%] rounded-full bg-slate-900/90 overflow-hidden border border-emerald-600/50">
                              <div
                                className="h-full bg-emerald-500 transition-all duration-200"
                                style={{
                                  width: `${Math.min(100, Math.max(0, (hero.hp / Math.max(1, hero.maxHp)) * 100))}%`
                                }}
                              />
                            </div>
                            {/* Тень под ногами воина на камне пирамиды */}
                            <span className="pointer-events-none absolute bottom-0.5 h-1.5 w-4 rounded-full bg-black/50 blur-[0.5px]" />
                            <CharacterAvatar
                              avatar={hero.avatar}
                              nick={currentUser}
                              size="sm"
                              className="relative z-10 object-contain"
                            />
                          </div>
                        ) : (
                          <div
                            className="relative flex flex-col items-center justify-center leading-none w-full h-full"
                            title={`⚔️ Игрок ${getPlayerClan(enemyNick) ? `[${getPlayerClan(enemyNick)?.tag}] ` : ''}${enemyNick} (${enemyLvl} ур., ${
                              enemyIsOnline ? 'В сети' : 'ОФФЛАЙН'
                            }) [ряд ${rIdx}, кл. ${cIdx}] — Нажмите для PvP атаки!`}
                          >
                            {/* Player mini HP bar */}
                            <div className="absolute top-0.5 z-30 h-[3px] w-[80%] rounded-full bg-red-950 overflow-hidden">
                              <div
                                className="h-full bg-red-500"
                                style={{
                                  width: `${Math.max(0, (enemyHp / Math.max(1, enemyMaxHp)) * 100)}%`
                                }}
                              />
                            </div>
                            {/* Online / Offline status badge */}
                            {enemyIsOnline ? (
                              <span className="absolute top-1 right-0.5 z-30 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-1 ring-black" />
                            ) : (
                              <span className="absolute top-1 right-0 z-30 rounded bg-slate-950/95 border border-amber-400/80 px-0.5 text-[4px] font-black leading-tight text-amber-300">
                                ОФФ
                              </span>
                            )}
                            <span className="pointer-events-none absolute bottom-1 h-1 w-3.5 rounded-full bg-black/50" />
                            <div
                              className={`relative z-10 flex items-center justify-center mt-0.5 ${
                                !enemyIsOnline ? 'opacity-90' : ''
                              }`}
                            >
                              <CharacterAvatar avatar={enemyAvatar} nick={enemyNick} size="xs" className="object-contain" />
                            </div>
                            {otherPlayersOnCell.length > 1 && (
                              <span className="absolute -top-1 -right-1 z-30 rounded-full bg-red-600 px-0.5 text-[4.5px] font-black text-white">
                                +{otherPlayersOnCell.length - 1}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
