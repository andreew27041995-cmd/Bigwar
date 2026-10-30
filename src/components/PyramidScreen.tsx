import React, { useEffect, useState, useMemo, useRef } from 'react';
import { HeroState, PyramidCell, PlayerPosition, DamagePopup, RareBossTimerState } from '../types/game';
import { EXP_TABLE, MAX_LEVEL, getPyramidTierForLevel } from '../utils/gameData';
import { isPlayerOnlineByHeartbeat } from '../utils/supabase';
import { getPlayerClan } from '../utils/clanStorage';
import CharacterAvatar from './CharacterAvatar';
import { ItemIcon } from './ItemIcon';
import { ELIXIR_EN_IMG, ELIXIR_HP_IMG, ELIXIR_EXP_IMG } from '../utils/elixirAssets';

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
  onUsePyramidCard?: (targetTier: 1 | 2 | 3) => void;
  onEnterNextTierPortal?: () => void;
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
  onUsePyramidCard,
  onEnterNextTierPortal,
  onOpenCharModal
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const playerCellRef = useRef<HTMLButtonElement | null>(null);

  // Only tick nowMs when the player is stunned or on move cooldown to avoid re-rendering 55 3D cells every second
  useEffect(() => {
    const now = Date.now();
    const stunActive = Boolean(hero.stunUntil && hero.stunUntil > now);
    const moveCooldownActive = now - lastMoveTime < moveDelay;
    if (!stunActive && !moveCooldownActive) return;

    const t = setInterval(() => {
      const cur = Date.now();
      setNowMs(cur);
      if ((!hero.stunUntil || hero.stunUntil <= cur) && cur - lastMoveTime >= moveDelay) {
        clearInterval(t);
      }
    }, 250);
    return () => clearInterval(t);
  }, [hero.stunUntil, lastMoveTime, moveDelay]);

  // Keep player's cell in view on ultra-small screens without jumping when the full pyramid is visible
  useEffect(() => {
    if (playerCellRef.current) {
      playerCellRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [playerPos.row, playerPos.col, pyramidTier]);

  // Keep all other living players in this pyramid tier (both online AND offline) from App's realtimePlayers
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
      const tier = Math.max(
        1,
        Math.min(
          3,
          Number(p.pyramidTier ?? p.pyramid_tier ?? p['пирамидальный_уровень'] ?? getPyramidTierForLevel(playerLvl))
        )
      );
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

    return Array.from(mergedMap.values());
  }, [realtimePlayers, currentUser, pyramidTier, pyramidMap]);

  // Active roaming NPCs in this pyramid tier (from online AND offline players until their energy reaches 0)
  const activePyramidNpcs = useMemo(() => {
    const npcMap = new Map<string, any>();
    const myCleanNick = String(currentUser || '').trim().toLowerCase();
    const curTime = Date.now();

    const considerPlayerForNpc = (p: any) => {
      if (!p) return;
      const ownerNick = String(p.nick || p.name || p['имя'] || '').trim();
      if (!ownerNick) return;
      const isOwn = myCleanNick ? ownerNick.toLowerCase() === myCleanNick : false;
      const npc = isOwn
        ? hero.npcCompanion
        : (p.npc_companion || p.npcCompanion);
      if (!npc || !npc.unlocked || npc.isActive !== true) return;
      const hpVal = Number(npc.hp ?? 3000);
      if (hpVal <= 0) return;

      const rawEnergy = Number(npc.energy ?? 500);
      const lastAction = Number(npc.lastActionTime || p.last_seen || p.lastSeen || 0);
      const elapsedSteps = isOwn ? 0 : Math.floor(Math.max(0, curTime - lastAction) / 3500);
      const effectiveEnergy = isOwn ? rawEnergy : Math.max(0, rawEnergy - elapsedSteps * 3);
      if (effectiveEnergy < 3) return;

      const npcTier = Math.max(1, Math.min(3, Number(npc.tier ?? 1)));
      if (npcTier !== Number(pyramidTier)) return;

      const rawR = Number(npc.row ?? 9);
      const rawC = Number(npc.col ?? 0);
      const maxR = Math.max(1, (pyramidMap?.length || 10) - 1);
      const clampedR = Math.max(1, Math.min(maxR, Number.isFinite(rawR) ? rawR : 9));
      const maxC = Math.max(0, (pyramidMap?.[clampedR]?.length || clampedR + 1) - 1);
      const clampedC = Math.max(0, Math.min(maxC, Number.isFinite(rawC) ? rawC : 0));

      npcMap.set(ownerNick.toLowerCase(), {
        ownerNick,
        isOwn,
        name: npc.name || 'Автономный Страж',
        icon: npc.icon || '🤖',
        hp: hpVal,
        maxHp: Number(npc.maxHp ?? 3000),
        energy: effectiveEnergy,
        maxEnergy: Number(npc.maxEnergy ?? 500),
        bagGold: Number(npc.bagGold ?? 0),
        bagExp: Number(npc.bagExp ?? 0),
        tier: npcTier,
        row: clampedR,
        col: clampedC
      });
    };

    if (hero.npcCompanion?.unlocked && hero.npcCompanion.isActive) {
      considerPlayerForNpc({
        nick: currentUser || hero.nick || 'Вы',
        npc_companion: hero.npcCompanion
      });
    }
    if (Array.isArray(realtimePlayers)) {
      realtimePlayers.forEach(considerPlayerForNpc);
    }

    return Array.from(npcMap.values());
  }, [realtimePlayers, currentUser, hero.npcCompanion, pyramidTier, pyramidMap]);

  // Ambient wandering positions for NPCs so they visibly run across the stepped pyramid tiers even when offline
  const [npcWanderPositions, setNpcWanderPositions] = useState<Record<string, { row: number; col: number }>>({});

  useEffect(() => {
    if (activePyramidNpcs.length === 0) return;
    const wanderTimer = setInterval(() => {
      setNpcWanderPositions((prev) => {
        const next: Record<string, { row: number; col: number }> = {};
        activePyramidNpcs.forEach((npc) => {
          if (npc.isOwn) {
            next[npc.ownerNick.toLowerCase()] = { row: npc.row, col: npc.col };
            return;
          }
          const currentPos = prev[npc.ownerNick.toLowerCase()] || { row: npc.row, col: npc.col };
          const rowDelta = Math.random() < 0.4 ? (Math.random() < 0.5 ? -1 : 1) : 0;
          const targetR = Math.max(1, Math.min(9, currentPos.row + rowDelta));
          const targetC = Math.max(0, Math.min(targetR, Math.floor(Math.random() * (targetR + 1))));
          // NPCs do not wander onto active monster cells
          if (pyramidMap?.[targetR]?.[targetC]?.type === 'mob') {
            next[npc.ownerNick.toLowerCase()] = currentPos;
            return;
          }
          next[npc.ownerNick.toLowerCase()] = { row: targetR, col: targetC };
        });
        return next;
      });
    }, 20000);

    return () => clearInterval(wanderTimer);
  }, [activePyramidNpcs]);

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

  const isHeroStunned = Boolean(hero.stunUntil && hero.stunUntil > nowMs);
  const stunRemainingSec = isHeroStunned ? Math.ceil(((hero.stunUntil || 0) - nowMs) / 1000) : 0;
  const timeRemaining = Math.max(0, moveDelay - (Date.now() - lastMoveTime));
  const canMove = timeRemaining === 0 && !isHeroStunned;

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

  const currentCellUnderPlayer = pyramidMap[playerPos.row]?.[playerPos.col];
  const isStandingOnPortal =
    currentCellUnderPlayer?.type === 'portal' || currentCellUnderPlayer?.type === 'nextTier';
  const homeTier = Math.max(1, Math.min(3, Number(hero.homePyramidTier || 1)));
  const isVisitingForeignPyramid = Number(pyramidTier) !== homeTier;

  return (
    <div
      className="relative flex flex-[70] min-h-0 flex-col overflow-hidden border-b-2 border-[#78512a] bg-[#160b04]"
      style={{
        backgroundImage: `
          radial-gradient(ellipse at 50% 42%, rgba(235, 160, 62, 0.34) 0%, rgba(138, 72, 20, 0.38) 42%, rgba(38, 18, 6, 0.94) 76%, rgba(14, 7, 3, 1) 100%)
        `
      }}
    >
      {/* 3D Isometric Sanctuary Backdrop: Warm Temple Glow, Desert Sand Dunes, Ruined Blocks & Ornate Blue-Crystal Corner Frames */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
        {/* Background Atmospheric SVG */}
        <svg
          viewBox="0 0 420 360"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <radialGradient id="isoSunGlow" cx="50%" cy="36%" r="52%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.28" />
              <stop offset="55%" stopColor="#b45309" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#160b04" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="isoSandBase" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d49b54" stopOpacity="0.42" />
              <stop offset="45%" stopColor="#9c6428" stopOpacity="0.68" />
              <stop offset="100%" stopColor="#261306" stopOpacity="0.98" />
            </linearGradient>
            <linearGradient id="isoSandShadow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7c4a1a" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#1e0e04" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="pyrFlankLeft" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#dca968" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#7a4c1e" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="pyrFlankRight" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#915d29" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#381f0a" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="ornateMetal" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4a3b2c" />
              <stop offset="50%" stopColor="#241c14" />
              <stop offset="100%" stopColor="#0f0b07" />
            </linearGradient>
            <radialGradient id="blueGemGlow" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#e0f2fe" />
              <stop offset="35%" stopColor="#38bdf8" />
              <stop offset="75%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#082f49" />
            </radialGradient>
          </defs>

          {/* Warm aura behind the pyramid */}
          <ellipse cx="210" cy="150" rx="195" ry="135" fill="url(#isoSunGlow)" />

          {/* Subtle Ancient Palm / Oasis Silhouettes in Upper Background */}
          <g fill="#2d1708" opacity="0.55">
            <path d="M58,155 Q42,115 15,102 Q45,105 64,132 Q55,98 32,80 Q60,92 72,126 Q72,92 62,68 Q80,88 80,128 Q96,96 116,86 Q95,112 82,142 Z" />
            <path d="M362,155 Q378,115 405,102 Q375,105 356,132 Q365,98 388,80 Q360,92 348,126 Q348,92 358,68 Q340,88 340,128 Q324,96 304,86 Q325,112 338,142 Z" />
          </g>

          {/* Underlying Monumental Pyramid Silhouette (connects stepped blocks into a solid 3D mass) */}
          <polygon
            points="210,48 28,282 210,332"
            fill="url(#pyrFlankLeft)"
            opacity="0.42"
          />
          <polygon
            points="210,48 392,282 210,332"
            fill="url(#pyrFlankRight)"
            opacity="0.52"
          />

          {/* Desert Sand Dunes & Rubble Wrapping the Base of the Pyramid */}
          <path
            d="M0,262 Q58,246 125,274 Q175,296 210,298 Q255,296 305,272 Q365,246 420,262 L420,360 L0,360 Z"
            fill="url(#isoSandBase)"
          />
          <path
            d="M0,292 Q82,276 162,306 Q210,322 262,304 Q342,276 420,290 L420,360 L0,360 Z"
            fill="url(#isoSandShadow)"
          />

          {/* Fallen Hieroglyphic Sandstone Blocks in the Sand (Left & Right Base) */}
          <g stroke="#3d220a" strokeWidth="0.7" opacity="0.85">
            {/* Left ruins */}
            <polygon points="48,284 74,274 88,284 62,294" fill="#c89654" />
            <polygon points="48,284 62,294 62,308 48,298" fill="#9c6b30" />
            <polygon points="62,294 88,284 88,298 62,308" fill="#633f18" />
            <polygon points="82,300 105,292 116,300 93,308" fill="#bf8b4b" />
            <polygon points="82,300 93,308 93,318 82,310" fill="#8f5f28" />
            <polygon points="93,308 116,300 116,310 93,318" fill="#543412" />
            {/* Right ruins */}
            <polygon points="372,284 346,274 332,284 358,294" fill="#bd8a48" />
            <polygon points="332,284 358,294 358,308 332,298" fill="#8c5d26" />
            <polygon points="358,294 372,284 372,298 358,308" fill="#523210" />
            <polygon points="338,300 315,292 304,300 327,308" fill="#b58040" />
            <polygon points="304,300 327,308 327,318 304,310" fill="#825420" />
            <polygon points="327,308 338,300 338,310 327,318" fill="#4a2b0d" />
          </g>

          {/* Bottom-Left Ornate Gothic-Egyptian Frame with Glowing Blue Crystals (matching reference) */}
          <g>
            <path
              d="M0,250 C28,252 46,272 56,298 C72,300 92,312 106,336 L106,360 L0,360 Z"
              fill="url(#ornateMetal)"
              stroke="#6b533b"
              strokeWidth="1.2"
            />
            <path
              d="M4,264 C24,268 38,284 44,308 C62,310 78,322 88,344"
              fill="none"
              stroke="#8c6d4e"
              strokeWidth="1"
              opacity="0.7"
            />
            {/* Glowing Blue Crystal Cluster Left */}
            <circle cx="24" cy="298" r="14" fill="#0ea5e9" fillOpacity="0.28" />
            <polygon
              points="16,282 28,276 34,294 24,310 12,298"
              fill="url(#blueGemGlow)"
              stroke="#bae6fd"
              strokeWidth="0.8"
            />
            <polygon
              points="32,306 42,298 48,312 38,322 28,316"
              fill="url(#blueGemGlow)"
              stroke="#7dd3fc"
              strokeWidth="0.7"
            />
            <circle cx="64" cy="332" r="8" fill="url(#blueGemGlow)" stroke="#bae6fd" strokeWidth="0.6" />
          </g>

          {/* Bottom-Right Ornate Gothic-Egyptian Frame with Glowing Blue Crystals (matching reference) */}
          <g>
            <path
              d="M420,250 C392,252 374,272 364,298 C348,300 328,312 314,336 L314,360 L420,360 Z"
              fill="url(#ornateMetal)"
              stroke="#6b533b"
              strokeWidth="1.2"
            />
            <path
              d="M416,264 C396,268 382,284 376,308 C358,310 342,322 332,344"
              fill="none"
              stroke="#8c6d4e"
              strokeWidth="1"
              opacity="0.7"
            />
            {/* Glowing Blue Crystal Cluster Right */}
            <circle cx="396" cy="298" r="14" fill="#0ea5e9" fillOpacity="0.28" />
            <polygon
              points="404,282 392,276 386,294 396,310 408,298"
              fill="url(#blueGemGlow)"
              stroke="#bae6fd"
              strokeWidth="0.8"
            />
            <polygon
              points="388,306 378,298 372,312 382,322 392,316"
              fill="url(#blueGemGlow)"
              stroke="#7dd3fc"
              strokeWidth="0.7"
            />
            <circle cx="356" cy="332" r="8" fill="url(#blueGemGlow)" stroke="#bae6fd" strokeWidth="0.6" />
          </g>
        </svg>
      </div>

      {/* Top HUD Section — compact, floating over the top of the sanctuary */}
      <div className="relative z-20 flex items-start justify-between gap-1 px-1.5 pt-0.5 pb-0 bg-gradient-to-b from-black/85 via-black/40 to-transparent shrink-0">
        {/* Left: Player Stats Panel */}
        <div
          data-tutorial="hud-bars"
          className="flex items-center gap-1.5 rounded-lg border border-amber-500/45 bg-slate-950/95 px-1.5 py-0.5 shadow-md"
        >
          <div
            onClick={onOpenCharModal}
            className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-amber-400 bg-slate-800 text-xs shrink-0 p-0.5 overflow-hidden"
            title="Открыть Персонажа и Почту"
          >
            <CharacterAvatar avatar={hero.avatar} nick={currentUser} className="w-full h-full object-contain" />
            {Boolean(hero.isPremium && hero.premiumUntil && hero.premiumUntil > Date.now()) && (
              <span className="absolute -top-1.5 -left-1.5 text-[7px] animate-bounce">👑</span>
            )}
            {(unreadMailCount > 0 || Number(hero.statPoints || 0) > 0) && (
              <span className="absolute -top-1.5 -right-1.5 flex h-3 min-w-[12px] items-center justify-center rounded-full bg-red-600 px-0.5 text-[6.5px] font-black text-white ring-1 ring-black animate-pulse shadow-[0_0_8px_#ef4444]">
                {unreadMailCount + Math.max(0, Number(hero.statPoints || 0))}
              </span>
            )}
          </div>

          <div className="flex w-24 flex-col gap-0.5">
            {/* Nickname & Level */}
            <div className="flex items-center justify-between text-[7px] font-extrabold leading-none">
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
            <div className="relative h-[7px] w-full overflow-hidden rounded bg-slate-800 border border-slate-700">
              <div className="h-full bg-red-600 transition-all" style={{ width: `${hpPercent}%` }} />
              <div className="absolute inset-0 flex items-center justify-center text-[5.5px] font-bold text-white drop-shadow tabular-nums">
                ❤️ {hero.hp}/{hero.maxHp}
              </div>
            </div>

            {/* Energy */}
            <div className="relative h-[7px] w-full overflow-hidden rounded bg-slate-800 border border-slate-700">
              <div className="h-full bg-sky-600 transition-all" style={{ width: `${enPercent}%` }} />
              <div className="absolute inset-0 flex items-center justify-center text-[5.5px] font-bold text-white drop-shadow tabular-nums">
                ⚡ {hero.energy}/{hero.maxEnergy}
              </div>
            </div>

            {/* EXP */}
            <div className="relative h-[5.5px] w-full overflow-hidden rounded bg-slate-800 border border-slate-700">
              <div className="h-full bg-purple-600 transition-all" style={{ width: `${expPercent}%` }} />
              <div className="absolute inset-0 flex items-center justify-center text-[4.5px] font-bold text-white drop-shadow tabular-nums">
                EXP {hero.exp}/{nextExp}
              </div>
            </div>
          </div>

          <div className="ml-0.5 flex flex-col items-end text-[7.5px] font-bold border-l border-slate-800 pl-1.5 tabular-nums leading-tight">
            <span className="text-amber-400">🪙 {hero.gold}</span>
            <span className="text-cyan-400">💎 {hero.crystals}</span>
          </div>
        </div>

        {/* Right: Tier Title, Step Cooldown, Mob Respawn, Rare Boss Timers & Coordinate Radar */}
        <div className="flex flex-col items-end gap-0.5 min-w-0">
          <div className="rounded bg-slate-950/90 border border-amber-500/40 px-1.5 py-[1px] text-[6.5px] font-bold text-amber-300 text-right max-w-[175px] truncate shadow">
            {tierTitle}
          </div>

          <div className="flex items-center gap-1">
            <div
              className={`rounded bg-slate-950/90 border border-slate-700 px-1.5 py-[1px] text-[6.5px] font-bold tabular-nums shadow ${
                isHeroStunned
                  ? 'text-yellow-400 border-yellow-500/70 animate-pulse bg-yellow-950/60'
                  : canMove
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
            >
              {isHeroStunned
                ? `💫 Оглушён (${stunRemainingSec}с)`
                : canMove
                ? '✅ Шаг готов'
                : `⏳ ${(timeRemaining / 1000).toFixed(1)}с`}
            </div>
            <div
              className="rounded bg-slate-950/90 border border-slate-700 px-1.5 py-[1px] text-[6.5px] text-slate-300 tabular-nums shadow"
              title="Таймер спавна обычных монстров на пустых клетках (каждую минуту)"
            >
              🔄 <span className="font-bold text-amber-300">{respawnTimeLeft}с</span>
            </div>
          </div>

          {/* Smooth Rare / Boss Queue Timers & Active Temporary Bonuses */}
          <div className="rounded border border-amber-500/30 bg-slate-950/95 px-1.5 py-0.5 text-[6.5px] text-slate-200 flex flex-col items-end gap-[1px] shadow min-w-[122px]">
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
                  <div className="flex items-center justify-between gap-1.5 w-full leading-tight border-t border-slate-800/90 pt-[1px]">
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

          {/* Coordinate & Player Radar Badge tucked right under the top-right panel (matching reference layout) */}
          <div className="flex items-center justify-end gap-1 overflow-x-auto whitespace-nowrap rounded border border-amber-500/35 bg-slate-950/90 px-1.5 py-[1px] text-[6px] text-slate-200 shadow max-w-[185px]">
            <span className="font-bold text-amber-300 shrink-0">
              📍 Вы: [ряд {playerPos.row}, кл. {playerPos.col}]
            </span>
            {isVisitingForeignPyramid && (
              <span
                className="rounded bg-purple-950/90 border border-purple-400/60 px-1 text-[5.5px] font-black text-purple-200 shrink-0"
                title="Вы перешли сюда по карточке. Выйдите на главную, чтобы вернуться в свою пирамиду."
              >
                🎫 П{homeTier}
              </span>
            )}
            {activeOtherPlayers.length > 0 ? (
              activeOtherPlayers.map((op) => (
                <span
                  key={op.nick}
                  className={`inline-flex items-center gap-0.5 rounded px-1 font-bold shrink-0 ${
                    op.isOnline
                      ? 'bg-red-950/90 border border-red-500/60 text-red-200 animate-pulse'
                      : 'bg-slate-900/95 border border-amber-500/50 text-slate-300'
                  }`}
                >
                  <span>{op.nick}</span>
                  <span className="text-amber-300">
                    [{op.row},{op.col}]
                  </span>
                </span>
              ))
            ) : (
              <span className="text-slate-400 truncate">• На клетках других игроков нет</span>
            )}
          </div>

          {/* Active Roaming NPCs Radar Badge */}
          {activePyramidNpcs.length > 0 && (
            <div className="flex items-center justify-end gap-1 overflow-x-auto whitespace-nowrap rounded border border-emerald-500/40 bg-slate-950/90 px-1.5 py-[1px] text-[6px] text-emerald-200 shadow max-w-[185px]">
              <span className="font-bold text-emerald-400 shrink-0">
                🤖 Стражи ({activePyramidNpcs.length}):
              </span>
              {activePyramidNpcs.map((npc) => {
                const pos = npcWanderPositions[npc.ownerNick.toLowerCase()] || { row: npc.row, col: npc.col };
                const isKillableByHero = !npc.isOwn && Boolean(hero.killerLicenseUntil && hero.killerLicenseUntil > nowMs);
                return (
                  <span
                    key={npc.ownerNick}
                    className={`inline-flex items-center gap-0.5 rounded px-1 font-bold shrink-0 ${
                      npc.isOwn
                        ? 'bg-emerald-950/90 border border-emerald-400 text-emerald-200'
                        : isKillableByHero
                        ? 'bg-red-950/90 border border-red-500/60 text-red-200 animate-pulse'
                        : 'bg-slate-900/95 border border-teal-500/50 text-teal-300'
                    }`}
                    title={
                      npc.isOwn
                        ? `Ваш Страж NPC (${npc.hp}/${npc.maxHp} ❤️, ${npc.energy}/${npc.maxEnergy} ⚡)`
                        : isKillableByHero
                        ? `Страж NPC игрока ${npc.ownerNick} — доступен для PvP-атаки по Лицензии киллера!`
                        : `Страж NPC игрока ${npc.ownerNick} (требуется Лицензия киллера для атаки)`
                    }
                  >
                    <span>{npc.icon} {npc.ownerNick}</span>
                    <span className="text-amber-300">[{pos.row},{pos.col}]</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Stun alert notification banner */}
      {isHeroStunned && (
        <div className="relative z-30 mx-2 mt-0.5 flex items-center justify-center gap-1.5 rounded-lg border-2 border-yellow-400 bg-gradient-to-r from-amber-950 via-yellow-900 to-amber-950 px-2.5 py-0.5 text-center shadow-[0_0_15px_rgba(234,179,8,0.7)] animate-pulse shrink-0">
          <span className="text-xs">💫</span>
          <span className="text-[9px] font-black uppercase text-yellow-200 tracking-wide">
            ВЫ ОГЛУШЕНЫ ({stunRemainingSec}с) — движение и атака заблокированы!
          </span>
          <span className="text-xs">💫</span>
        </div>
      )}

      {/* Left Flank: Potions + Pyramid Transition Cards (Карты перехода 1, 2, 3) */}
      <div className="absolute left-1 top-[54px] z-20 flex flex-col gap-1">
        {/* Potions Column */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onUsePotion('hp')}
            disabled={hero.hpPotions <= 0 || hero.hp >= hero.maxHp}
            className="group relative flex h-6 w-6 sm:h-7 sm:w-7 flex-col items-center justify-center rounded-md border border-red-400/80 bg-gradient-to-b from-red-800/90 via-red-950 to-slate-950 shadow-[0_0_6px_rgba(239,68,68,0.35)] transition-transform active:scale-90 disabled:opacity-40 hover:border-red-300"
            title="Эликсир жизни (+50 HP)"
          >
            <img src={ELIXIR_HP_IMG} alt="HP" className="h-4 w-4 object-contain drop-shadow" />
            <span className="text-[5px] font-black uppercase tracking-tighter text-red-200 leading-none">
              HP
            </span>
            <span className="absolute -top-1 -right-1 flex h-2.5 min-w-[11px] items-center justify-center rounded-full border border-red-200 bg-red-600 px-0.5 text-[6px] font-black text-white shadow tabular-nums">
              {hero.hpPotions}
            </span>
          </button>

          <button
            onClick={() => onUsePotion('en')}
            disabled={hero.enPotions <= 0 || hero.energy >= hero.maxEnergy}
            className="group relative flex h-6 w-6 sm:h-7 sm:w-7 flex-col items-center justify-center rounded-md border border-sky-400/80 bg-gradient-to-b from-sky-800/90 via-sky-950 to-slate-950 shadow-[0_0_6px_rgba(56,189,248,0.35)] transition-transform active:scale-90 disabled:opacity-40 hover:border-sky-300"
            title="Эликсир энергии (+20 EN)"
          >
            <img src={ELIXIR_EN_IMG} alt="EN" className="h-4 w-4 object-contain drop-shadow" />
            <span className="text-[5px] font-black uppercase tracking-tighter text-sky-200 leading-none">
              EN
            </span>
            <span className="absolute -top-1 -right-1 flex h-2.5 min-w-[11px] items-center justify-center rounded-full border border-sky-200 bg-sky-600 px-0.5 text-[6px] font-black text-white shadow tabular-nums">
              {hero.enPotions}
            </span>
          </button>

          <button
            onClick={() => onUsePotion('exp')}
            disabled={Number(hero.expPotions || 0) <= 0}
            className={`group relative flex h-6 w-6 sm:h-7 sm:w-7 flex-col items-center justify-center rounded-md border bg-gradient-to-b from-purple-800/90 via-purple-950 to-slate-950 shadow-[0_0_6px_rgba(168,85,247,0.4)] transition-transform active:scale-90 disabled:opacity-40 hover:border-purple-300 ${
              hero.expElixirUntil && hero.expElixirUntil > nowMs
                ? 'border-emerald-400 ring-1 ring-emerald-400/60'
                : 'border-purple-400/80'
            }`}
            title="Ячейка Эликсира Опыта (+25% к опыту на 30 мин)"
          >
            <img src={ELIXIR_EXP_IMG} alt="EXP" className="h-4 w-4 object-contain drop-shadow" />
            <span className="text-[5px] font-black uppercase tracking-tighter text-purple-200 leading-none">
              EXP
            </span>
            <span className="absolute -top-1 -right-1 flex h-2.5 min-w-[11px] items-center justify-center rounded-full border border-purple-200 bg-purple-600 px-0.5 text-[6px] font-black text-white shadow tabular-nums">
              {hero.expPotions || 0}
            </span>
          </button>
        </div>

        {/* Transition Cards Section on the Left (Карточки перехода в 1, 2, 3 пирамиду) */}
        <div
          className={`mt-0.5 flex flex-col gap-1 rounded-lg border p-1 transition-all ${
            isStandingOnPortal
              ? 'border-purple-400 bg-purple-950/90 shadow-[0_0_14px_rgba(168,85,247,0.85)]'
              : 'border-amber-500/35 bg-slate-950/85'
          }`}
          title="Карточки перехода между Пирамидами (работают, когда персонаж стоит на Портале 🌀)"
        >
          <span className="text-[5.5px] font-black uppercase text-center leading-none tracking-tighter text-purple-200">
            {isStandingOnPortal ? '🌀 ПОРТАЛ' : '🎫 КАРТЫ'}
          </span>
          {(
            [
              {
                tier: 1 as const,
                label: 'П1',
                count: Math.max(0, Number(hero.pyramidCard1 || 0)),
                colorCls: 'from-amber-700/90 via-amber-950 to-slate-950 border-amber-400/80 text-amber-200',
                badgeBg: 'bg-amber-600 border-amber-200'
              },
              {
                tier: 2 as const,
                label: 'П2',
                count: Math.max(0, Number(hero.pyramidCard2 || 0)),
                colorCls: 'from-purple-700/90 via-purple-950 to-slate-950 border-purple-400/80 text-purple-200',
                badgeBg: 'bg-purple-600 border-purple-200'
              },
              {
                tier: 3 as const,
                label: 'П3',
                count: Math.max(0, Number(hero.pyramidCard3 || 0)),
                colorCls: 'from-rose-700/90 via-rose-950 to-slate-950 border-rose-400/80 text-rose-200',
                badgeBg: 'bg-rose-600 border-rose-200'
              }
            ]
          ).map((card) => {
            const canUseNow = isStandingOnPortal && card.count > 0;
            return (
              <button
                key={card.tier}
                type="button"
                onClick={() => onUsePyramidCard?.(card.tier)}
                className={`relative flex flex-col items-center justify-center rounded-md border bg-gradient-to-b px-1 py-0.5 min-w-[34px] transition-all cursor-pointer active:scale-90 ${
                  card.colorCls
                } ${
                  canUseNow
                    ? 'ring-1 ring-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.85)] animate-pulse'
                    : card.count <= 0
                    ? 'opacity-45'
                    : 'opacity-85 hover:opacity-100'
                }`}
                title={
                  isStandingOnPortal
                    ? card.count > 0
                      ? `Нажмите «Использовать», чтобы переместиться в Пирамиду ${card.tier} (в наличии: ${card.count} шт.)`
                      : `Нет карточки перехода в Пирамиду ${card.tier} (купите в Магазине ➔ Лицензии за 3 💎)`
                    : `Карточка перехода в Пирамиду ${card.tier} (${card.count} шт.) — встаньте на Портал 🌀, чтобы использовать!`
                }
              >
                <div className="flex items-center gap-0.5 leading-none">
                  <span className="text-[8px]">🎫</span>
                  <span className="text-[7px] font-black">{card.label}</span>
                </div>
                <span
                  className={`mt-0.5 rounded px-0.5 text-[5px] font-black uppercase leading-tight ${
                    canUseNow
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300/90'
                  }`}
                >
                  {isStandingOnPortal && card.count > 0 ? 'Использовать' : `${card.count} шт.`}
                </span>
                <span
                  className={`absolute -top-1 -right-1 flex h-2.5 min-w-[11px] items-center justify-center rounded-full border px-0.5 text-[6px] font-black text-white shadow tabular-nums ${card.badgeBg}`}
                >
                  {card.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Glowing Action Button: Pick Up Gold/Crystal Sack OR Portal Action Banner */}
      {activeSack ? (
        <div className="absolute bottom-7 left-1/2 z-30 -translate-x-1/2 w-[85%] max-w-[260px]">
          <button
            onClick={() => onPickUpSack(activeSack.row, activeSack.col)}
            className={`w-full flex items-center justify-center gap-1.5 rounded-lg border-2 py-1 px-3 text-[10.5px] font-black text-slate-950 shadow-lg animate-pulse active:scale-95 ${
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
      ) : isStandingOnPortal ? (
        <div className="absolute bottom-7 left-1/2 z-30 -translate-x-1/2 w-[90%] max-w-[300px] flex flex-col gap-1">
          {pyramidTier < 3 && (
            <button
              type="button"
              onClick={() => onEnterNextTierPortal?.()}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border-2 border-purple-300 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-indigo-600 py-1 px-3 text-[10px] font-black text-white shadow-[0_0_15px_rgba(168,85,247,0.95)] animate-pulse active:scale-95 cursor-pointer"
            >
              <span>🌀</span>
              <span>
                ОТКРЫТЬ И ВОЙТИ В ПИРАМИДУ {pyramidTier + 1} (с {pyramidTier === 1 ? 5 : 10} ур.)
              </span>
            </button>
          )}
        </div>
      ) : null}

      {/* PYRAMID CRAWLER AREA — True 3D Isometric Stepped Pyramid Monument */}
      <div
        className="relative z-10 flex flex-1 min-h-0 w-full flex-col items-center justify-center overflow-y-auto overflow-x-hidden px-0.5 pb-1"
        style={
          {
            '--pyr-cell-w': 'clamp(32px, 9.1vw, 41px)',
            '--pyr-cell-h': 'clamp(30px, 4.95dvh, 39px)',
            '--pyr-row-overlap': 'calc(var(--pyr-cell-h) * -0.25)'
          } as React.CSSProperties
        }
      >
        <div className="my-auto flex flex-col items-center justify-center w-full pt-0.5">
          {/* 3D Pointed Egyptian Pyramidion Capstone at the Apex (matching reference image) */}
          <div
            className="pointer-events-none relative z-0 flex flex-col items-center select-none"
            style={{
              width: 'calc(var(--pyr-cell-w) * 1.45)',
              height: 'calc(var(--pyr-cell-h) * 0.92)',
              marginBottom: 'calc(var(--pyr-cell-h) * -0.28)'
            }}
          >
            <svg viewBox="0 0 88 52" className="h-full w-full overflow-visible drop-shadow-[0_4px_6px_rgba(0,0,0,0.85)]">
              <defs>
                <linearGradient id="capLeftLit" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f6dba6" />
                  <stop offset="55%" stopColor="#d4a359" />
                  <stop offset="100%" stopColor="#9c6b2e" />
                </linearGradient>
                <linearGradient id="capRightShade" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#a87538" />
                  <stop offset="55%" stopColor="#784e1e" />
                  <stop offset="100%" stopColor="#42270b" />
                </linearGradient>
              </defs>
              {/* Left sunlit face of Pyramidion */}
              <polygon
                points="44,2 6,36 44,50"
                fill="url(#capLeftLit)"
                stroke="#5c3a14"
                strokeWidth="1.1"
              />
              {/* Right shadowed face of Pyramidion */}
              <polygon
                points="44,2 82,36 44,50"
                fill="url(#capRightShade)"
                stroke="#3b220a"
                strokeWidth="1.1"
              />
              {/* Horizontal masonry joints on capstone */}
              <line x1="25" y1="19" x2="44" y2="26" stroke="#6e471b" strokeWidth="0.8" opacity="0.65" />
              <line x1="44" y1="26" x2="63" y2="19" stroke="#361f08" strokeWidth="0.8" opacity="0.65" />
              {/* Hieroglyphic carvings on the capstone */}
              <text x="23" y="36" fontSize="9" fill="#5e3a13" opacity="0.75" fontWeight="bold">
                𓂀
              </text>
              <text x="50" y="36" fontSize="9" fill="#2b1705" opacity="0.75" fontWeight="bold">
                𓋹
              </text>
              {/* Golden apex ridge highlight */}
              <line x1="44" y1="2" x2="44" y2="50" stroke="#fef08a" strokeWidth="0.9" opacity="0.55" />
            </svg>
          </div>

          {/* 10 Isometric Stepped Pyramid Tiers */}
          {pyramidMap.slice(0, 10).map((row, rIdx) => {
            const triangularRow = row.slice(0, rIdx + 1);
            return (
              <div
                key={rIdx}
                className="relative flex items-center justify-center"
                style={{
                  zIndex: rIdx + 1,
                  marginTop: rIdx === 0 ? '0px' : 'var(--pyr-row-overlap)'
                }}
              >
                {/* Left Outer Stepped Stone Wing */}
                <svg
                  viewBox="0 0 24 44"
                  aria-hidden="true"
                  className="pointer-events-none hidden min-[350px]:block shrink-0 -mr-[3px] opacity-95 drop-shadow-[-2px_3px_3px_rgba(0,0,0,0.75)]"
                  style={{
                    width: 'calc(var(--pyr-cell-w) * 0.34)',
                    height: 'calc(var(--pyr-cell-h) * 0.88)'
                  }}
                >
                  <polygon points="24,10 4,22 24,30" fill="#d9a866" stroke="#5c3a14" strokeWidth="1" />
                  <polygon points="4,22 24,30 24,43 4,34" fill="#9c6b30" stroke="#42270b" strokeWidth="1" />
                </svg>

                {/* Row of True 3D Isometric Sandstone Blocks */}
                <div className="relative flex items-center justify-center gap-[1px] sm:gap-[1.5px]">
                  {triangularRow.map((cell, cIdx) => {
                    const isPlayer = rIdx === playerPos.row && cIdx === playerPos.col;
                    const isExit = rIdx === pyramidMap.length - 1 && cIdx === 0;
                    const isSpawnNextToExit = rIdx === pyramidMap.length - 1 && cIdx === 1;
                    const isPortal = cell.type === 'portal' || cell.type === 'nextTier';
                    const isSack = cell.type === 'sack' && !isExit && !isSpawnNextToExit;

                    // Monsters always take precedence on their cell (except on the local player's cell, Exit [9,0], or Spawn [9,1])
                    const isMob =
                      (cell.type === 'mob' || (Number(cell.mobHp) > 0 && Boolean(cell.mobName))) &&
                      !isPlayer &&
                      !isExit &&
                      !isSpawnNextToExit;

                    const npcsOnCell = isMob
                      ? []
                      : activePyramidNpcs.filter((npc) => {
                          const pos = npcWanderPositions[npc.ownerNick.toLowerCase()] || { row: npc.row, col: npc.col };
                          return pos.row === rIdx && pos.col === cIdx;
                        });
                    const npcOnCell = npcsOnCell[0] || null;
                    const isHeroKillerActive = Boolean(hero.killerLicenseUntil && hero.killerLicenseUntil > nowMs);

                    const otherPlayersOnCell = isMob
                      ? []
                      : activeOtherPlayers.filter(
                          (p: any) => Number(p.row) === rIdx && Number(p.col) === cIdx
                        );
                    const otherPlayerOnCell = otherPlayersOnCell[0] || null;

                    const isOtherPlayer =
                      !isMob &&
                      (otherPlayersOnCell.length > 0 ||
                        cell.type === 'player' ||
                        Boolean(
                          cell.playerNick &&
                            (!currentUser ||
                              cell.playerNick.toLowerCase() !== currentUser.trim().toLowerCase())
                        ));

                    const hasLivingPlayerOnCell = isPlayer || isOtherPlayer;

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

                    // Alternating warm sandstone tones for isometric blocks
                    const isAltStone = (rIdx + cIdx) % 2 === 1;

                    // Isometric 3D cube face colors (Top diamond, Left lit riser, Right shadowed riser)
                    let topFaceFill = isAltStone ? '#e8c488' : '#deb676';
                    let topFaceInner = isAltStone ? '#f4dab0' : '#ecd09e';
                    let leftFaceFill = isAltStone ? '#b88542' : '#ab7938';
                    let rightFaceFill = isAltStone ? '#784e1e' : '#6b4418';
                    let topStroke = isAdjacent ? '#fde047' : '#6e471b';
                    let topStrokeWidth = isAdjacent ? '1.6' : '1.1';

                    if (isPlayer && isOtherPlayer) {
                      topFaceFill = '#ef4444';
                      topFaceInner = '#fca5a5';
                      leftFaceFill = '#b91c1c';
                      rightFaceFill = '#7f1d1d';
                      topStroke = '#fef08a';
                      topStrokeWidth = '2';
                    } else if (isPlayer) {
                      topFaceFill = '#facc15';
                      topFaceInner = '#fef08a';
                      leftFaceFill = '#ca8a04';
                      rightFaceFill = '#854d0e';
                      topStroke = '#ffffff';
                      topStrokeWidth = '2';
                    } else if (isOtherPlayer) {
                      topFaceFill = enemyIsOnline ? '#dc2626' : '#d97706';
                      topFaceInner = enemyIsOnline ? '#fca5a5' : '#fde68a';
                      leftFaceFill = enemyIsOnline ? '#991b1b' : '#92400e';
                      rightFaceFill = enemyIsOnline ? '#450a0a' : '#451a03';
                      topStroke = enemyIsOnline ? '#fecaca' : '#fcd34d';
                      topStrokeWidth = '1.6';
                    } else if (npcOnCell) {
                      if (npcOnCell.isOwn) {
                        topFaceFill = '#059669';
                        topFaceInner = '#6ee7b7';
                        leftFaceFill = '#047857';
                        rightFaceFill = '#065f46';
                        topStroke = '#34d399';
                        topStrokeWidth = '1.8';
                      } else {
                        topFaceFill = isHeroKillerActive ? '#b91c1c' : '#0f766e';
                        topFaceInner = isHeroKillerActive ? '#fca5a5' : '#5eead4';
                        leftFaceFill = isHeroKillerActive ? '#991b1b' : '#115e59';
                        rightFaceFill = isHeroKillerActive ? '#450a0a' : '#134e4a';
                        topStroke = isHeroKillerActive ? '#f87171' : '#2dd4bf';
                        topStrokeWidth = isHeroKillerActive ? '1.9' : '1.6';
                      }
                    } else if (isPortal) {
                      topFaceFill = '#9333ea';
                      topFaceInner = '#d8b4fe';
                      leftFaceFill = '#6b21a8';
                      rightFaceFill = '#3b0764';
                      topStroke = '#f3e8ff';
                      topStrokeWidth = '1.8';
                    } else if (isSack) {
                      const isCrystal =
                        cell.rareBossId === 'crystal' || (cell.sackCrystals && cell.sackCrystals > 0);
                      topFaceFill = isCrystal ? '#06b6d4' : '#f59e0b';
                      topFaceInner = isCrystal ? '#a5f3fc' : '#fde68a';
                      leftFaceFill = isCrystal ? '#0e7490' : '#b45309';
                      rightFaceFill = isCrystal ? '#164e63' : '#78350f';
                      topStroke = isCrystal ? '#cffafe' : '#fef08a';
                      topStrokeWidth = '1.7';
                    }

                    const glyphLeft = (rIdx + cIdx) % 3 === 0 ? '𓏤' : (rIdx + cIdx) % 3 === 1 ? '𓊽' : '𓋹';
                    const glyphRight = (rIdx + cIdx) % 2 === 0 ? '𓆣' : '𓇳';

                    return (
                      <button
                        key={`${rIdx}-${cIdx}`}
                        ref={isPlayer ? playerCellRef : undefined}
                        onClick={() => onBlockClick(rIdx, cIdx)}
                        disabled={!isAdjacent && !isPlayer}
                        style={{
                          width: 'var(--pyr-cell-w)',
                          height: 'var(--pyr-cell-h)'
                        }}
                        className={`group relative flex shrink-0 flex-col items-center justify-center overflow-visible bg-transparent p-0 text-[10px] font-bold transition-transform active:scale-90 ${
                          !isAdjacent && !isPlayer
                            ? 'opacity-95'
                            : 'hover:-translate-y-[1.5px] cursor-pointer'
                        }`}
                      >
                        {/* 3D Isometric Sandstone Cube SVG (Diamond Top + Left Carved Riser + Right Shadowed Riser) */}
                        <svg
                          viewBox="0 0 64 56"
                          preserveAspectRatio="none"
                          className={`pointer-events-none absolute inset-0 h-full w-full overflow-visible drop-shadow-[0_3px_3px_rgba(0,0,0,0.75)] ${
                            isPlayer
                              ? 'drop-shadow-[0_0_8px_rgba(250,204,21,0.9)]'
                              : isPortal
                              ? 'drop-shadow-[0_0_8px_rgba(168,85,247,0.9)]'
                              : ''
                          }`}
                        >
                          {/* Top Isometric Diamond Platform */}
                          <polygon
                            points="32,2 62,17 32,32 2,17"
                            fill={topFaceFill}
                            stroke={topStroke}
                            strokeWidth={topStrokeWidth}
                            strokeLinejoin="round"
                          />
                          {/* Subtle inner bevel on top diamond */}
                          <polygon
                            points="32,5 56,17 32,29 8,17"
                            fill="none"
                            stroke={topFaceInner}
                            strokeWidth="0.8"
                            opacity="0.65"
                          />

                          {/* Left Vertical Sunlit Sandstone Riser */}
                          <polygon
                            points="2,17 32,32 32,54 2,39"
                            fill={leftFaceFill}
                            stroke="#472c0e"
                            strokeWidth="1"
                            strokeLinejoin="round"
                          />
                          {/* Carved stone block seam & hieroglyph on left riser */}
                          <line x1="17" y1="24.5" x2="17" y2="46.5" stroke="#5c3812" strokeWidth="0.7" opacity="0.6" />
                          <text x="7" y="34" fontSize="7" fill="#4a2c0b" opacity="0.55">
                            {glyphLeft}
                          </text>

                          {/* Right Vertical Shadowed Sandstone Riser */}
                          <polygon
                            points="32,32 62,17 62,39 32,54"
                            fill={rightFaceFill}
                            stroke="#2b1806"
                            strokeWidth="1"
                            strokeLinejoin="round"
                          />
                          {/* Carved stone block seam & hieroglyph on right riser */}
                          <line x1="47" y1="24.5" x2="47" y2="46.5" stroke="#291605" strokeWidth="0.7" opacity="0.65" />
                          <text x="36" y="42" fontSize="7" fill="#241204" opacity="0.55">
                            {glyphRight}
                          </text>

                          {/* Center vertical corner ridge highlight */}
                          <line x1="32" y1="32" x2="32" y2="54" stroke="#fDE68A" strokeWidth="0.7" opacity="0.35" />
                        </svg>

                        {/* LAYER 1 (z-10): Monsters, Sacks & Portals standing naturally on the isometric diamond top */}
                        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
                          {isPortal ? (
                            <div
                              className={`flex flex-col items-center justify-center -translate-y-[5px] ${
                                hasLivingPlayerOnCell ? 'opacity-40 scale-75 translate-x-1.5 -translate-y-2' : ''
                              }`}
                              title={
                                pyramidTier === 1
                                  ? 'Портал во 2-ю Пирамиду (требуется 5+ ур.)'
                                  : pyramidTier === 2
                                  ? 'Портал в 3-ю Пирамиду (требуется 10+ ур.)'
                                  : 'Портал переходов между Пирамидами'
                              }
                            >
                              <span className="pointer-events-none absolute bottom-[2px] h-1.5 w-5 rounded-full bg-purple-950/80 blur-[0.5px]" />
                              <span className="relative z-10 text-[15px] sm:text-[17px] leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] animate-spin">
                                🌀
                              </span>
                            </div>
                          ) : isSack ? (
                            <div
                              className={`flex flex-col items-center justify-center -translate-y-[5px] leading-none ${
                                hasLivingPlayerOnCell
                                  ? 'absolute bottom-1 right-0.5 opacity-85 scale-75'
                                  : ''
                              }`}
                              title={
                                cell.rareBossId === 'crystal' || (cell.sackCrystals && cell.sackCrystals > 0)
                                  ? '💎 Тайник Кристаллов (+25 💎) — наступите, чтобы забрать'
                                  : 'Мешочек с золотом (наступите чтобы открыть)'
                              }
                            >
                              <span className="pointer-events-none absolute bottom-[1px] h-1.5 w-4 rounded-full bg-black/65" />
                              <span className="relative z-10 text-[14px] sm:text-[16px] leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">
                                {cell.rareBossId === 'crystal' || (cell.sackCrystals && cell.sackCrystals > 0)
                                  ? '💎'
                                  : '💰'}
                              </span>
                            </div>
                          ) : isMob && cell.mobMaxHp ? (
                            <div
                              className="relative flex flex-col items-center justify-center -translate-y-[5px] w-full h-full"
                              title={`${cell.mobName || 'Монстр'} (${cell.mobLvl} ур.) • HP: ${cell.mobHp}/${cell.mobMaxHp}`}
                            >
                              {/* Compact Mob HP Bar floating above monster */}
                              <div className="absolute top-[1px] z-20 h-[3px] w-[72%] rounded-full bg-red-950 border border-black/70 overflow-hidden shadow">
                                <div
                                  className="h-full bg-red-500 transition-all"
                                  style={{
                                    width: `${Math.max(0, (cell.mobHp! / cell.mobMaxHp!) * 100)}%`
                                  }}
                                />
                              </div>
                              {/* Isometric elliptical shadow on the diamond stone surface */}
                              <span className="pointer-events-none absolute bottom-[7px] h-1.5 w-5 rounded-full bg-black/65 blur-[0.4px]" />
                              <div
                                className="relative z-10 flex items-center justify-center"
                                style={{
                                  width: 'calc(var(--pyr-cell-h) - 8px)',
                                  height: 'calc(var(--pyr-cell-h) - 8px)'
                                }}
                              >
                                <ItemIcon
                                  icon={cell.icon || '🦂'}
                                  alt={cell.mobName || 'Монстр'}
                                  className="text-[16px] sm:text-[18px] leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]"
                                  imgClassName="w-full h-full object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]"
                                />
                              </div>
                              <span className="absolute bottom-[4px] z-20 rounded bg-black/80 border border-amber-500/40 px-0.5 text-[5.5px] sm:text-[6.5px] font-black text-amber-100 drop-shadow leading-none">
                                {cell.isBoss ? '👑' : ''}L{cell.mobLvl}
                              </span>
                            </div>
                          ) : null}
                        </div>

                        {/* LAYER 2 (z-20): Living Player Skins standing on the isometric diamond stone step */}
                        {hasLivingPlayerOnCell && (
                          <div className="relative z-20 flex h-full w-full flex-col items-center justify-center -translate-y-[5px]">
                            {isPlayer && isOtherPlayer ? (
                              <div
                                className="flex flex-col items-center justify-center leading-none w-full h-full"
                                title={`Вы и игрок ${enemyNick} (${enemyLvl} ур., ${
                                  enemyIsOnline ? 'Онлайн' : 'Оффлайн'
                                }) на одной ступени [${rIdx},${cIdx}]! Нажмите для атаки!`}
                              >
                                <div className="absolute top-[1px] z-30 h-[3px] w-[76%] rounded-full bg-red-950 border border-black/70 overflow-hidden">
                                  <div
                                    className="h-full bg-red-500"
                                    style={{
                                      width: `${Math.max(0, (enemyHp / Math.max(1, enemyMaxHp)) * 100)}%`
                                    }}
                                  />
                                </div>
                                {!enemyIsOnline && (
                                  <span className="absolute top-1 right-0.5 z-30 rounded bg-slate-950/90 border border-amber-400 px-0.5 text-[5px] font-black text-amber-300">
                                    ОФФ
                                  </span>
                                )}
                                <span className="pointer-events-none absolute bottom-[7px] h-1.5 w-6 rounded-full bg-black/70" />
                                <div className="relative z-10 flex items-center justify-center gap-0.5 drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)] max-w-full">
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
                                <div className="absolute top-[0px] z-30 h-[3.5px] w-[74%] rounded-full bg-slate-900/95 overflow-hidden border border-emerald-400/80 shadow">
                                  <div
                                    className="h-full bg-emerald-500 transition-all duration-200"
                                    style={{
                                      width: `${Math.min(100, Math.max(0, (hero.hp / Math.max(1, hero.maxHp)) * 100))}%`
                                    }}
                                  />
                                </div>
                                {/* Elliptical ground shadow on the isometric diamond */}
                                <span className="pointer-events-none absolute bottom-[6px] h-1.5 w-5 rounded-full bg-black/70 blur-[0.4px]" />
                                <CharacterAvatar
                                  avatar={hero.avatar}
                                  nick={currentUser}
                                  size="auto"
                                  style={{
                                    width: 'calc(var(--pyr-cell-h) - 5px)',
                                    height: 'calc(var(--pyr-cell-h) - 5px)'
                                  }}
                                  className="relative z-10 text-[17px] sm:text-[19px] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
                                />
                              </div>
                            ) : (
                              <div
                                className="relative flex flex-col items-center justify-center leading-none w-full h-full"
                                title={`⚔️ Игрок ${getPlayerClan(enemyNick) ? `[${getPlayerClan(enemyNick)?.tag}] ` : ''}${enemyNick} (${enemyLvl} ур., ${
                                  enemyIsOnline ? 'В сети' : 'ОФФЛАЙН'
                                }) [ряд ${rIdx}, кл. ${cIdx}] — Нажмите для PvP атаки!`}
                              >
                                <div className="absolute top-[0px] z-30 h-[3px] w-[74%] rounded-full bg-red-950 border border-black/70 overflow-hidden">
                                  <div
                                    className="h-full bg-red-500"
                                    style={{
                                      width: `${Math.max(0, (enemyHp / Math.max(1, enemyMaxHp)) * 100)}%`
                                    }}
                                  />
                                </div>
                                {enemyIsOnline ? (
                                  <span className="absolute top-1 right-0.5 z-30 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-1 ring-black" />
                                ) : (
                                  <span className="absolute top-1 right-0.5 z-30 rounded bg-slate-950/95 border border-amber-400/80 px-0.5 text-[5px] font-black leading-tight text-amber-300">
                                    ОФФ
                                  </span>
                                )}
                                <span className="pointer-events-none absolute bottom-[6px] h-1.5 w-5 rounded-full bg-black/65" />
                                <div
                                  className={`relative z-10 flex items-center justify-center ${
                                    !enemyIsOnline ? 'opacity-90' : ''
                                  }`}
                                >
                                  <CharacterAvatar
                                    avatar={enemyAvatar}
                                    nick={enemyNick}
                                    size="auto"
                                    style={{
                                      width: 'calc(var(--pyr-cell-h) - 6px)',
                                      height: 'calc(var(--pyr-cell-h) - 6px)'
                                    }}
                                    className="text-[16px] sm:text-[18px] object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]"
                                  />
                                </div>
                                {otherPlayersOnCell.length > 1 && (
                                  <span className="absolute -top-0.5 -right-0.5 z-30 rounded-full bg-red-600 px-0.5 text-[6px] font-black text-white">
                                    +{otherPlayersOnCell.length - 1}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* LAYER 3 (z-25): Roaming NPC Companion standing on the isometric platform */}
                        {npcOnCell && (
                          <div
                            className={`relative z-20 flex h-full w-full flex-col items-center justify-center -translate-y-[5px] ${
                              hasLivingPlayerOnCell ? 'scale-70 -translate-y-4 opacity-95' : ''
                            }`}
                            title={
                              npcOnCell.isOwn
                                ? `🤖 Ваш Страж NPC: ${npcOnCell.name} (${npcOnCell.hp}/${npcOnCell.maxHp} ❤️, ${npcOnCell.energy}/${npcOnCell.maxEnergy} ⚡, В рюкзаке: ${npcOnCell.bagGold.toLocaleString()} 🪙)`
                                : `🤖 Страж NPC игрока ${npcOnCell.ownerNick} (${npcOnCell.hp}/${npcOnCell.maxHp} ❤️, ${npcOnCell.energy}/${npcOnCell.maxEnergy} ⚡)${
                                    isHeroKillerActive
                                      ? ' ⚔️ Нажмите для атаки по Лицензии киллера!'
                                      : ' 🔒 Требуется Лицензия киллера для нападения!'
                                  }`
                            }
                          >
                            {/* Floating NPC HP Bar */}
                            <div className="absolute top-[0px] z-30 h-[3px] w-[74%] rounded-full bg-slate-950 border border-black/80 overflow-hidden shadow">
                              <div
                                className={`h-full ${npcOnCell.isOwn ? 'bg-emerald-400' : isHeroKillerActive ? 'bg-red-500' : 'bg-teal-400'}`}
                                style={{ width: `${Math.max(0, Math.min(100, (npcOnCell.hp / Math.max(1, npcOnCell.maxHp)) * 100))}%` }}
                              />
                            </div>

                            {/* Killer License attack crosshair */}
                            {!npcOnCell.isOwn && isHeroKillerActive && (
                              <span
                                className="absolute top-0.5 right-0.5 z-30 flex items-center justify-center text-[7px] text-red-300 drop-shadow animate-pulse"
                                title="Лицензия киллера активна — нажмите для атаки на Стража!"
                              >
                                ⚔️
                              </span>
                            )}

                            {/* Shadow on stone */}
                            <span className="pointer-events-none absolute bottom-[6px] h-1.5 w-5 rounded-full bg-black/70 blur-[0.4px]" />

                            {/* NPC Avatar Icon with animated glow */}
                            <div className="relative z-10 flex items-center justify-center text-[17px] sm:text-[19px] leading-none drop-shadow-[0_0_8px_rgba(16,185,129,0.85)]">
                              {npcOnCell.icon || '🤖'}
                            </div>

                            {/* Floating badge */}
                            <span
                              className={`absolute bottom-[2.5px] z-30 rounded border px-0.5 text-[5px] sm:text-[5.5px] font-black leading-tight drop-shadow truncate max-w-[94%] ${
                                npcOnCell.isOwn
                                  ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200'
                                  : isHeroKillerActive
                                  ? 'bg-red-950/95 border-red-400 text-red-200'
                                  : 'bg-slate-950/95 border-teal-400 text-teal-200'
                              }`}
                            >
                              {npcOnCell.isOwn ? '🤖 ВАШ NPC' : `🤖 ${npcOnCell.ownerNick}`}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Right Outer Stepped Stone Wing */}
                <svg
                  viewBox="0 0 24 44"
                  aria-hidden="true"
                  className="pointer-events-none hidden min-[350px]:block shrink-0 -ml-[3px] opacity-95 drop-shadow-[2px_3px_3px_rgba(0,0,0,0.8)]"
                  style={{
                    width: 'calc(var(--pyr-cell-w) * 0.34)',
                    height: 'calc(var(--pyr-cell-h) * 0.88)'
                  }}
                >
                  <polygon points="0,10 20,22 0,30" fill="#b88444" stroke="#42270b" strokeWidth="1" />
                  <polygon points="0,30 20,22 20,34 0,43" fill="#593714" stroke="#261405" strokeWidth="1" />
                </svg>
              </div>
            );
          })}

          {/* Carved Dark-Stone «ВЫХОД» Plaque at the Base of the Pyramid (works ONLY on the 1st line / bottom row) */}
          {(() => {
            const firstLineRow = (pyramidMap.length || 10) - 1;
            const isOnFirstLine = playerPos.row === firstLineRow;
            return (
              <div className="relative z-20 mt-0.5 flex items-center justify-center">
                <button
                  type="button"
                  data-tutorial="pyramid-exit"
                  onClick={() => onExitToCity()}
                  disabled={isHeroStunned}
                  title={
                    isOnFirstLine
                      ? 'Выйти из Пирамиды в город (вы на 1-й линии)'
                      : 'Выход работает только когда персонаж стоит на 1-й линии (нижний ряд у входа)!'
                  }
                  className={`group relative flex items-center justify-center gap-1.5 rounded-md border-2 px-4 py-0.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                    isOnFirstLine
                      ? 'border-cyan-400/90 bg-gradient-to-b from-[#2b353b] via-[#162026] to-[#0b1114] text-cyan-300 shadow-[0_3px_8px_rgba(0,0,0,0.9),0_0_12px_rgba(56,189,248,0.45),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:border-cyan-300'
                      : 'border-slate-600/80 bg-gradient-to-b from-[#1e2226] via-[#121619] to-[#090b0d] text-slate-400 opacity-75 hover:border-amber-500/60'
                  }`}
                >
                  <span
                    className={`text-[8px] ${
                      isOnFirstLine ? 'text-cyan-400 drop-shadow-[0_0_4px_#38bdf8]' : 'text-amber-400/80'
                    }`}
                  >
                    {isOnFirstLine ? '❖' : '🔒'}
                  </span>
                  <span
                    className={`font-serif text-[10px] sm:text-[11px] font-black tracking-[0.14em] uppercase ${
                      isOnFirstLine
                        ? 'text-cyan-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.85)]'
                        : 'text-slate-400'
                    }`}
                  >
                    {isOnFirstLine ? 'ВЫХОД' : 'ВЫХОД (1-Я ЛИНИЯ)'}
                  </span>
                  <span
                    className={`text-[8px] ${
                      isOnFirstLine ? 'text-cyan-400 drop-shadow-[0_0_4px_#38bdf8]' : 'text-amber-400/80'
                    }`}
                  >
                    ❖
                  </span>
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
