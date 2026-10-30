import React, { useState, useEffect, useRef } from 'react';
import { HeroState } from '../types/game';
import { EXP_TABLE, MAX_LEVEL, getPyramidTierForLevel } from '../utils/gameData';
import bgImage from '../assets/images/pyramid_city_1792151896034.jpg';
import CharacterAvatar from './CharacterAvatar';
import { GoldCoinIcon, CrystalIcon } from './CurrencyIcon';
import { ELIXIR_EN_IMG, ELIXIR_HP_IMG, ELIXIR_EXP_IMG } from '../utils/elixirAssets';
import { getDailyQuestsSummary } from '../utils/dailyQuests';

interface CityScreenProps {
  currentUser?: string | null;
  hero: HeroState;
  soundMuted: boolean;
  unreadMailCount?: number;
  lastRegenTickAt?: number;
  onToggleSound: () => void;
  onOpenCharModal: () => void;
  onOpenMailModal?: () => void;
  onEnterPyramid: () => void;
  onOpenAuction: () => void;
  onOpenInventory: () => void;
  onOpenWheel: () => void;
  onOpenPremium: () => void;
  onOpenCreateItem: () => void;
  onOpenAdmin: () => void;
  onOpenBank: () => void;
  onOpenShop?: () => void;
  onUsePotion: (type: 'hp' | 'en' | 'exp') => void;
  onOpenLeaderboard?: () => void;
  onOpenDailyReward?: () => void;
  onOpenDailyQuests?: () => void;
  canClaimDailyReward?: boolean;
  onOpenAchievements?: () => void;
  claimableAchievementsCount?: number;
  onOpenClans?: () => void;
  onOpenClanPyramid?: () => void;
  onOpenForum?: () => void;
  onToggleNpcActive?: () => void;
  onOpenNpcBag?: () => void;
  isAdmin?: boolean;
  isModerator?: boolean;
  featureFlags?: {
    rouletteEnabled?: boolean;
    exchangeEnabled?: boolean;
    premiumEnabled?: boolean;
    shopEnabled?: boolean;
    npcCompanionsEnabled?: boolean;
  };
}

export const CityScreen: React.FC<CityScreenProps> = ({
  currentUser,
  hero,
  soundMuted,
  unreadMailCount = 0,
  lastRegenTickAt,
  onToggleSound,
  onOpenWheel,
  onOpenPremium,
  onOpenCharModal,
  onOpenMailModal,
  onEnterPyramid,
  onOpenAdmin,
  onOpenBank,
  onOpenShop,
  onOpenLeaderboard,
  onOpenDailyReward,
  onOpenDailyQuests,
  canClaimDailyReward,
  onOpenAchievements,
  claimableAchievementsCount = 0,
  onOpenClans,
  onOpenClanPyramid,
  onOpenForum,
  onToggleNpcActive,
  onOpenNpcBag,
  onUsePotion,
  isAdmin,
  isModerator,
  featureFlags
}) => {
  const isModeratorRole = Boolean(isModerator || hero.role === 'mod' || Number((hero as any).is_admin) === 2 || Number((hero as any).admin_level) === 2);
  const hpPercent = Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100));
  const enPercent = Math.max(0, Math.min(100, (hero.energy / hero.maxEnergy) * 100));
  const nextExp = hero.level >= MAX_LEVEL ? 0 : EXP_TABLE[hero.level] || 1000;
  const expPercent = nextExp > 0 ? Math.min(100, (hero.exp / nextExp) * 100) : 100;

  const isPremActive = Boolean(
    featureFlags?.premiumEnabled &&
    hero.isPremium &&
    hero.premiumUntil &&
    hero.premiumUntil > Date.now()
  );
  const unspentStatPoints = Math.max(0, Number(hero.statPoints || 0));
  const hasCharacterNotification = unreadMailCount > 0 || unspentStatPoints > 0;
  const totalNotificationCount = unreadMailCount + unspentStatPoints;
  const dailyQuestsSummary = getDailyQuestsSummary(hero);
  const readyQuestChests = dailyQuestsSummary.totalReadyChests;

  // Automatic HP & Energy Regeneration Visual Progress Bar in City
  const isRegenNeeded = hero.hp < hero.maxHp || hero.energy < hero.maxEnergy;
  const regenIntervalSec = isPremActive ? 1 : 3;
  const regenStepMs = regenIntervalSec * 1000;
  const regenAmountPerTick = isPremActive ? 2 : 1;

  const localTickAnchorRef = useRef<number>(lastRegenTickAt || Date.now());
  const [regenNowMs, setRegenNowMs] = useState<number>(() => Date.now());

  // Sync anchor whenever HP or Energy ticks up or parent updates lastRegenTickAt
  useEffect(() => {
    localTickAnchorRef.current = Date.now();
    setRegenNowMs(Date.now());
  }, [hero.hp, hero.energy, lastRegenTickAt]);

  useEffect(() => {
    if (!isRegenNeeded) return;
    const timer = setInterval(() => {
      setRegenNowMs(Date.now());
    }, 150);
    return () => clearInterval(timer);
  }, [isRegenNeeded, regenStepMs]);

  const elapsedInCycleMs = isRegenNeeded
    ? Math.max(0, (regenNowMs - localTickAnchorRef.current) % regenStepMs)
    : regenStepMs;
  const regenTickProgressPct = isRegenNeeded
    ? Math.max(4, Math.min(100, Math.round((elapsedInCycleMs / regenStepMs) * 100)))
    : 100;
  const secToNextRegenTick = isRegenNeeded
    ? Math.max(0.1, (regenStepMs - elapsedInCycleMs) / 1000).toFixed(1)
    : '0.0';

  const missingHp = Math.max(0, hero.maxHp - hero.hp);
  const missingEn = Math.max(0, hero.maxEnergy - hero.energy);
  const maxMissingPool = Math.max(missingHp, missingEn);
  const ticksRemainingToFull = Math.ceil(maxMissingPool / regenAmountPerTick);
  const totalSecToFullRecovery = isRegenNeeded
    ? Math.max(
        1,
        Math.ceil(
          Math.max(0, ticksRemainingToFull - 1) * regenIntervalSec +
            (regenStepMs - elapsedInCycleMs) / 1000
        )
      )
    : 0;

  const formatShortDuration = (totalSec: number) => {
    if (totalSec <= 0) return '0с';
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return m > 0 ? `${m}м ${s}с` : `${s}с`;
  };

  return (
    <div
      className="relative flex flex-[64] min-h-0 flex-col justify-between overflow-y-auto overscroll-y-contain touch-pan-y border-b-2 border-orange-500/80 bg-cover bg-center"
      style={{ backgroundImage: `url(${bgImage})`, WebkitOverflowScrolling: 'touch' }}
    >
      {/* Halloween Festival Night Atmospheric Overlay */}
      <div className="pointer-events-none sticky inset-0 h-0 w-full z-0" />
      <div
        className="absolute inset-0 min-h-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 78% 18%, rgba(249,115,22,0.38) 0%, rgba(126,34,206,0.52) 38%, rgba(15,6,28,0.88) 78%, rgba(5,2,12,0.96) 100%)'
        }}
      />

      {/* Halloween Decorative SVG Scene (Harvest Blood Moon, Cobwebs, Bats & Glowing Pumpkins) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {/* Top-left & Top-right spooky cobwebs */}
        <svg
          className="absolute top-0 left-0 w-24 h-24 text-purple-200/20"
          viewBox="0 0 100 100"
          fill="none"
        >
          <path d="M0 0 L100 0 M0 0 L85 50 M0 0 L50 85 M0 0 L0 100" stroke="currentColor" strokeWidth="1.2" />
          <path d="M25 0 Q22 22 0 25 M50 0 Q42 42 0 50 M75 0 Q62 62 0 75" stroke="currentColor" strokeWidth="1" />
        </svg>
        <svg
          className="absolute top-0 right-0 w-24 h-24 text-orange-200/20 -scale-x-100"
          viewBox="0 0 100 100"
          fill="none"
        >
          <path d="M0 0 L100 0 M0 0 L85 50 M0 0 L50 85 M0 0 L0 100" stroke="currentColor" strokeWidth="1.2" />
          <path d="M25 0 Q22 22 0 25 M50 0 Q42 42 0 50 M75 0 Q62 62 0 75" stroke="currentColor" strokeWidth="1" />
        </svg>

        {/* Glowing Halloween Harvest Moon */}
        <div
          className="absolute top-8 right-12 w-16 h-16 rounded-full opacity-80"
          style={{
            background: 'radial-gradient(circle, #fed7aa 0%, #fb923c 55%, #ea580c 85%, transparent 100%)',
            boxShadow: '0 0 35px 10px rgba(249, 115, 22, 0.55)'
          }}
        />

        {/* Floating Bats */}
        <span className="absolute top-10 right-24 text-sm animate-bat-float opacity-85">🦇</span>
        <span
          className="absolute top-16 right-10 text-xs animate-bat-float opacity-75"
          style={{ animationDelay: '1.1s' }}
        >
          🦇
        </span>
        <span
          className="absolute top-14 left-1/3 text-xs animate-bat-float opacity-70"
          style={{ animationDelay: '0.6s' }}
        >
          🦇
        </span>

        {/* Flickering Jack-o'-lantern Pumpkins along the Pyramid Courtyard */}
        <span className="absolute bottom-[112px] left-3 text-lg animate-pumpkin-glow select-none">🎃</span>
        <span
          className="absolute bottom-[112px] right-3 text-lg animate-pumpkin-glow select-none"
          style={{ animationDelay: '0.8s' }}
        >
          🎃
        </span>
        <span
          className="absolute bottom-[145px] left-12 text-xs animate-pumpkin-glow opacity-80 select-none"
          style={{ animationDelay: '1.4s' }}
        >
          🕯️
        </span>
        <span
          className="absolute bottom-[145px] right-12 text-xs animate-pumpkin-glow opacity-80 select-none"
          style={{ animationDelay: '0.4s' }}
        >
          🕯️
        </span>
      </div>

      {/* Top Player HUD — compact, responsive layout so left controls & potions are never clipped */}
      <div className="relative z-10 flex flex-col gap-1.5 px-2 pt-1.5 pb-1 shrink-0">
        <div className="flex items-start justify-between gap-1.5">
          {/* Left: Player Status & Regeneration Card */}
          <div
            data-tutorial="hud-bars"
            className="flex flex-col gap-1 rounded-xl border border-orange-500/55 bg-slate-950/95 px-2 py-1.5 shadow-[0_0_15px_rgba(249,115,22,0.25)] min-w-0 flex-1 max-w-[265px]"
          >
            <div className="flex items-center gap-2">
              <div
                onClick={unreadMailCount > 0 && onOpenMailModal ? onOpenMailModal : onOpenCharModal}
                className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-orange-400 bg-slate-900 text-lg shadow p-0.5"
                title="Открыть персонажа, сумку и почту"
              >
                <div className="w-full h-full overflow-hidden rounded-sm">
                  <CharacterAvatar avatar={hero.avatar} nick={currentUser} className="w-full h-full object-contain" />
                </div>
                {isPremActive && (
                  <span className="absolute -top-1.5 -left-1 text-[9px] animate-bounce drop-shadow">👑</span>
                )}
                {hasCharacterNotification && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-black text-white ring-2 ring-slate-950 animate-pulse shadow-[0_0_10px_#ef4444]">
                    {totalNotificationCount}
                  </span>
                )}
              </div>

              <div className="flex flex-1 min-w-0 flex-col gap-0.5">
                {/* Nickname & Level header inside HUD */}
                <div className="flex items-center justify-between gap-1 text-[8.5px] font-extrabold leading-tight mb-0.5">
                  <span
                    className={`truncate flex items-center gap-0.5 min-w-0 ${
                      isModeratorRole
                        ? 'text-emerald-400'
                        : isAdmin || hero.role === 'admin' || Number((hero as any).is_admin) === 1
                        ? 'text-red-400'
                        : 'text-amber-300'
                    }`}
                  >
                    {hero.clanTag && (
                      <span className="shrink-0 rounded bg-amber-500/25 border border-amber-400/60 px-0.5 text-[6.5px] font-black text-amber-300">
                        [{hero.clanTag}]
                      </span>
                    )}
                    <span className="truncate">{currentUser || 'Игрок'}</span>
                  </span>
                  <span className="flex items-center gap-0.5 shrink-0">
                    <span className="rounded bg-orange-500/20 border border-orange-500/40 px-1 text-[7px] font-black text-orange-300">
                      🔺П{hero.homePyramidTier || hero.pyramidTier || 1}
                    </span>
                    <span className="text-purple-300">Ур.{hero.level}</span>
                  </span>
                </div>

                {/* HP */}
                <div className="relative h-2.5 w-full overflow-hidden rounded bg-slate-800 border border-slate-700">
                  <div className="h-full bg-red-600 transition-all" style={{ width: `${hpPercent}%` }} />
                  <div className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-white drop-shadow tabular-nums">
                    ❤️ {hero.hp}/{hero.maxHp}
                  </div>
                </div>

                {/* Energy */}
                <div className="relative h-2.5 w-full overflow-hidden rounded bg-slate-800 border border-slate-700">
                  <div className="h-full bg-sky-600 transition-all" style={{ width: `${enPercent}%` }} />
                  <div className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-white drop-shadow tabular-nums">
                    ⚡ {hero.energy}/{hero.maxEnergy}
                  </div>
                </div>

                {/* EXP */}
                <div className="relative h-2 w-full overflow-hidden rounded bg-slate-800 border border-slate-700">
                  <div className="h-full bg-purple-600 transition-all" style={{ width: `${expPercent}%` }} />
                  <div className="absolute inset-0 flex items-center justify-center text-[6px] font-bold text-white drop-shadow tabular-nums">
                    EXP: {hero.exp}/{nextExp}
                  </div>
                </div>
              </div>

              {/* Animated 3D Spinning Gold & Ultra-Bright Glowing Crystal */}
              <div className="flex flex-col items-end justify-center gap-1 text-[9px] font-black border-l border-slate-800 pl-2 shrink-0 tabular-nums">
                <span className="flex items-center gap-1 text-amber-300 drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]">
                  <GoldCoinIcon size="sm" />
                  <span>{hero.gold}</span>
                </span>
                <span className="flex items-center gap-1 text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
                  <CrystalIcon size="sm" />
                  <span>{hero.crystals}</span>
                </span>
              </div>
            </div>

            {/* Visual HP & Energy Regeneration Progress Bar */}
            <div
              className="mt-0.5 pt-1 border-t border-slate-800/90"
              title="Автоматическое восстановление здоровья и энергии в городе"
            >
              <div className="flex items-center justify-between text-[7.5px] font-extrabold leading-none mb-1">
                <span className="flex items-center gap-1 text-emerald-300">
                  <span className={isRegenNeeded ? 'animate-spin' : ''}>♻️</span>
                  <span>
                    {isRegenNeeded
                      ? `Восст. +${regenAmountPerTick}❤️/+${regenAmountPerTick}⚡${isPremActive ? ' (VIP 2x)' : ''}`
                      : 'Здоровье и ⚡ 100%'}
                  </span>
                </span>
                <span className="font-mono text-[7.5px] text-cyan-200 tabular-nums">
                  {isRegenNeeded
                    ? `через ${secToNextRegenTick}с • полн: ${formatShortDuration(totalSecToFullRecovery)}`
                    : 'Готов к походу'}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-emerald-500/40 shadow-inner">
                <div
                  className={`h-full transition-all duration-150 ${
                    isRegenNeeded
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-300'
                      : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                  }`}
                  style={{ width: `${regenTickProgressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Right: Compact Achievements, Daily Reward Gift & Sound toggle */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1">
              {onOpenAchievements && (
                <button
                  onClick={onOpenAchievements}
                  className={`relative flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-black shadow-lg transition-transform active:scale-95 ${
                    claimableAchievementsCount > 0
                      ? 'border-cyan-300 bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 animate-bounce shadow-[0_0_15px_rgba(34,211,238,0.7)]'
                      : 'border-amber-500/50 bg-slate-950/90 text-amber-300 hover:border-amber-400'
                  }`}
                  title="Достижения игрока и награды в кристаллах"
                >
                  <span className="text-xs">🏅</span>
                  <span className="uppercase tracking-tight font-extrabold">Подвиги</span>
                  {claimableAchievementsCount > 0 && (
                    <span className="ml-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-600 px-1 text-[7px] font-black text-white ring-1 ring-slate-950">
                      {claimableAchievementsCount}
                    </span>
                  )}
                </button>
              )}

              <button
                onClick={onToggleSound}
                className="rounded-lg border border-purple-500/40 bg-slate-950/90 px-2 py-1 text-[10px] text-slate-300 hover:text-white"
                title={soundMuted ? 'Включить звук' : 'Выключить звук'}
              >
                {soundMuted ? '🔇' : '🔊'}
              </button>
            </div>

            <div className="flex items-center gap-1">
              {(onOpenDailyQuests || onOpenDailyReward) && (
                <button
                  onClick={onOpenDailyQuests || onOpenDailyReward}
                  className={`relative flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-black shadow-lg transition-transform active:scale-95 ${
                    readyQuestChests > 0
                      ? 'border-cyan-300 bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 animate-bounce shadow-[0_0_15px_rgba(34,211,238,0.75)]'
                      : 'border-cyan-500/50 bg-slate-950/90 text-cyan-300 hover:border-cyan-400'
                  }`}
                  title="Ежедневные задания и Сундук с кристаллами"
                >
                  <span className="text-xs">🧰</span>
                  <span className="uppercase tracking-tight font-extrabold">Задания</span>
                  <span className="rounded bg-slate-900/80 px-1 text-[7.5px] font-black text-amber-300 border border-slate-700">
                    {dailyQuestsSummary.completedCount}/{dailyQuestsSummary.totalQuests}
                  </span>
                  {readyQuestChests > 0 && (
                    <span className="ml-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-600 px-1 text-[7px] font-black text-white ring-1 ring-slate-950">
                      {readyQuestChests}
                    </span>
                  )}
                </button>
              )}

              {onOpenDailyReward && (
                <button
                  data-tutorial="btn-daily-gift"
                  onClick={onOpenDailyReward}
                  className={`relative flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-black shadow-lg transition-transform active:scale-95 ${
                    canClaimDailyReward
                      ? 'border-orange-400 bg-gradient-to-r from-orange-600 to-amber-500 text-slate-950 animate-bounce shadow-[0_0_15px_rgba(249,115,22,0.7)]'
                      : 'border-orange-500/40 bg-slate-950/90 text-orange-300 hover:border-orange-400'
                  }`}
                  title="Ежедневный вход (Календарь наград)"
                >
                  <span className="text-xs">🎃</span>
                  <span className="uppercase tracking-tight font-extrabold">Подарок</span>
                  {canClaimDailyReward && (
                    <span className="ml-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-600 ring-1 ring-slate-950 animate-ping" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Compact Horizontal Quick Potion Bar (never clipped on the left) */}
        <div data-tutorial="potions-bar" className="flex items-center gap-1.5 pl-0.5 w-fit">
          <button
            onClick={() => onUsePotion('hp')}
            disabled={hero.hpPotions <= 0 || hero.hp >= hero.maxHp}
            className="group relative flex items-center gap-1 rounded-lg border border-red-400/80 bg-gradient-to-b from-red-800/90 via-red-950 to-slate-950 px-2 py-1 shadow-[0_0_10px_rgba(239,68,68,0.3)] transition-transform active:scale-95 disabled:opacity-40 hover:border-red-300"
            title="Эликсир жизни (+50 HP)"
          >
            <img src={ELIXIR_HP_IMG} alt="HP" className="h-4 w-4 object-contain drop-shadow" />
            <span className="text-[8px] font-black uppercase text-red-100">HP</span>
            <span className="rounded-full border border-red-200/70 bg-red-600 px-1.5 py-0.2 text-[7.5px] font-black text-white tabular-nums">
              {hero.hpPotions}
            </span>
          </button>

          <button
            onClick={() => onUsePotion('en')}
            disabled={hero.enPotions <= 0 || hero.energy >= hero.maxEnergy}
            className="group relative flex items-center gap-1 rounded-lg border border-sky-400/80 bg-gradient-to-b from-sky-800/90 via-sky-950 to-slate-950 px-2 py-1 shadow-[0_0_10px_rgba(56,189,248,0.3)] transition-transform active:scale-95 disabled:opacity-40 hover:border-sky-300"
            title="Эликсир энергии (+20 EN)"
          >
            <img src={ELIXIR_EN_IMG} alt="EN" className="h-4 w-4 object-contain drop-shadow" />
            <span className="text-[8px] font-black uppercase text-sky-100">EN</span>
            <span className="rounded-full border border-sky-200/70 bg-sky-600 px-1.5 py-0.2 text-[7.5px] font-black text-white tabular-nums">
              {hero.enPotions}
            </span>
          </button>

          <button
            onClick={() => onUsePotion('exp')}
            disabled={Number(hero.expPotions || 0) <= 0}
            className={`group relative flex items-center gap-1 rounded-lg border bg-gradient-to-b from-purple-800/90 via-purple-950 to-slate-950 px-2 py-1 shadow-[0_0_10px_rgba(168,85,247,0.35)] transition-transform active:scale-95 disabled:opacity-40 hover:border-purple-300 ${
              hero.expElixirUntil && hero.expElixirUntil > Date.now()
                ? 'border-emerald-400 ring-1 ring-emerald-400/60'
                : 'border-purple-400/80'
            }`}
            title="Ячейка Эликсира Опыта (+25% к опыту на 30 мин)"
          >
            <img src={ELIXIR_EXP_IMG} alt="EXP" className="h-4 w-4 object-contain drop-shadow" />
            <span className="text-[8px] font-black uppercase text-purple-100">EXP</span>
            <span className="rounded-full border border-purple-200/70 bg-purple-600 px-1.5 py-0.2 text-[7.5px] font-black text-white tabular-nums">
              {hero.expPotions || 0}
            </span>
          </button>
        </div>
      </div>

      {/* City Center Halloween Title */}
      <div className="relative z-10 text-center my-auto py-1 shrink-0">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/50 bg-purple-950/80 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.4)] mb-0.5">
          <span className="animate-pumpkin-glow">🎃</span>
          <span>Праздник Хеллоуин</span>
          <span className="animate-bat-float">🦇</span>
        </div>
        <h1 className="font-serif text-lg sm:text-xl font-bold tracking-widest text-[#ffb74d] drop-shadow-[0_2px_10px_rgba(249,115,22,0.95)]">
          🎃 ПИРАМИДА 🎃
        </h1>
        <div className="text-[9px] tracking-[0.22em] font-semibold text-purple-200 uppercase opacity-95 drop-shadow">
          Ночь Духов Фараонов
        </div>
      </div>

      {/* Convenient Structured Main Menu Hub */}
      <div className="relative z-10 flex flex-col gap-1.5 p-2 pb-3 shrink-0">
        {/* 1. Primary Heroic Action: Main Pyramid Entry */}
        <button
          data-tutorial="btn-enter-pyramid"
          onClick={onEnterPyramid}
          className={`group relative flex w-full items-center justify-between overflow-hidden rounded-xl border-2 px-3.5 py-2.5 shadow-lg transition-all active:scale-[0.98] ${
            hero.energy < 3
              ? 'border-slate-700 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-slate-400 opacity-90'
              : 'border-orange-500/90 bg-gradient-to-r from-orange-950/95 via-amber-950/90 to-purple-950/95 text-amber-200 shadow-[0_0_20px_rgba(249,115,22,0.45)] hover:border-orange-400 hover:shadow-[0_0_25px_rgba(249,115,22,0.6)]'
          }`}
          title={`Войти в свою Пирамиду ${hero.homePyramidTier || hero.pyramidTier || 1}`}
        >
          {/* Subtle glowing ambient pulse behind button */}
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-amber-500/15 to-transparent pointer-events-none" />

          <div className="relative flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-400/60 bg-gradient-to-b from-amber-600/30 to-orange-950/80 text-xl shadow-inner">
              🏛️
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[12px] font-black uppercase tracking-wider text-amber-300 drop-shadow flex items-center gap-1.5">
                <span>Войти в Пирамиду</span>
                <span className="rounded bg-orange-500/30 border border-orange-400/60 px-1 py-0.2 text-[9px] font-black text-orange-200">
                  Ярус {hero.homePyramidTier || hero.pyramidTier || 1}
                </span>
              </span>
              <span className="text-[9px] text-amber-100/70">
                {hero.energy < 3 ? '⚠️ Недостаточно энергии для входа' : 'Сражения с мумиями, поиск сокровищ и боссов'}
              </span>
            </div>
          </div>

          <div className="relative flex flex-col items-end shrink-0 pl-2">
            <div
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[9.5px] font-black border tabular-nums ${
                hero.energy >= 3
                  ? 'border-emerald-500/50 bg-emerald-950/80 text-emerald-300'
                  : 'border-red-500/50 bg-red-950/80 text-red-300'
              }`}
            >
              <span>⚡</span>
              <span>{hero.energy}/3 EN</span>
            </div>
            <span className="text-[7.5px] text-slate-400 mt-0.5">
              {hero.energy >= 3 ? 'Готов к походу ▶' : 'Требуется 3 EN'}
            </span>
          </div>
        </button>

        {/* 2. Core Player & City Facilities: Character, Shop, Bank */}
        <div className="grid grid-cols-3 gap-1.5">
          {/* Character / Bag */}
          <button
            data-tutorial="btn-character"
            onClick={unreadMailCount > 0 && onOpenMailModal ? onOpenMailModal : onOpenCharModal}
            className="group relative flex flex-col items-center justify-center rounded-lg border border-sky-500/70 bg-gradient-to-b from-sky-950/90 via-slate-900/95 to-slate-950 px-1 py-2 text-center shadow-md transition-all active:scale-95 hover:border-sky-400"
            title="Персонаж, Сумка, Статы, Коллекция и Почта"
          >
            {hasCharacterNotification && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-black text-white ring-2 ring-slate-950 animate-bounce shadow-[0_0_10px_#ef4444]">
                {totalNotificationCount}
              </span>
            )}
            <div className="text-base leading-none mb-0.5">👤</div>
            <span className="text-[10px] font-black text-sky-200 group-hover:text-sky-100">Персонаж</span>
            <span className="text-[7.5px] text-sky-300/60 leading-none">Сумка и статы</span>
          </button>

          {/* Shop */}
          {onOpenShop && (
            <button
              data-tutorial="btn-shop"
              onClick={onOpenShop}
              className="group relative flex flex-col items-center justify-center rounded-lg border border-emerald-500/70 bg-gradient-to-b from-emerald-950/90 via-slate-900/95 to-slate-950 px-1 py-2 text-center shadow-md transition-all active:scale-95 hover:border-emerald-400"
              title="Магазин, Аукцион и Создание оружия"
            >
              <div className="text-base leading-none mb-0.5">🛒</div>
              <span className="text-[10px] font-black text-emerald-200 group-hover:text-emerald-100">Магазин</span>
              <span className="text-[7.5px] text-emerald-300/60 leading-none">Аукцион, крафт</span>
            </button>
          )}

          {/* Bank */}
          <button
            data-tutorial="btn-bank"
            onClick={onOpenBank}
            className="group relative flex flex-col items-center justify-center rounded-lg border border-cyan-500/70 bg-gradient-to-b from-cyan-950/90 via-slate-900/95 to-slate-950 px-1 py-2 text-center shadow-md transition-all active:scale-95 hover:border-cyan-400"
            title="Банк: Покупка кристаллов и Обмен валют"
          >
            <div className="text-base leading-none mb-0.5">🏦</div>
            <span className="text-[10px] font-black text-cyan-200 group-hover:text-cyan-100">Банк</span>
            <span className="text-[7.5px] text-cyan-300/60 leading-none">Кристаллы, обмен</span>
          </button>
        </div>

        {/* 3. Clan Activities: Clans & Clan Pyramid */}
        {(onOpenClans || onOpenClanPyramid) && (
          <div className="grid grid-cols-2 gap-1.5">
            {onOpenClans && (
              <button
                onClick={onOpenClans}
                className="group relative flex items-center gap-2 rounded-lg border border-amber-500/70 bg-gradient-to-r from-amber-950/85 via-slate-900/95 to-slate-950 px-2.5 py-2 text-left shadow-md transition-all active:scale-95 hover:border-amber-400"
                title="Кланы: общий склад экипировки, аренда и совместные походы"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-amber-500/50 bg-amber-950/60 text-sm">
                  🛡️
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-[10px] font-black text-amber-200 group-hover:text-amber-100">Кланы</span>
                  <span className="truncate text-[7.5px] text-amber-300/65">Склад и союз</span>
                </div>
              </button>
            )}

            {onOpenClanPyramid && (
              <button
                onClick={onOpenClanPyramid}
                className="group relative flex items-center gap-2 rounded-lg border border-red-500/70 bg-gradient-to-r from-red-950/85 via-slate-900/95 to-slate-950 px-2.5 py-2 text-left shadow-md transition-all active:scale-95 hover:border-red-400"
                title="Битва за Клановую Пирамиду (только для участников кланов)"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-red-500/50 bg-red-950/60 text-sm animate-pulse">
                  🔺
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-[10px] font-black text-red-200 group-hover:text-red-100">Клановая Пирамида</span>
                  <span className="truncate text-[7.5px] text-red-300/65">Битва кланов</span>
                </div>
              </button>
            )}
          </div>
        )}

        {/* 4. Social & Fortune Bar: Roulette, Premium, Achievements, Leaderboard, Forum */}
        <div className="grid grid-cols-5 gap-1.5">
          {/* Gambling Hall: Wheel of Fortune, Anubis Dice, Classic Roulette 1-36, Scarab Totalizator */}
          <button
            data-tutorial="btn-wheel"
            onClick={onOpenWheel}
            className={`flex flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center shadow transition-all active:scale-95 ${
              featureFlags?.rouletteEnabled
                ? 'border-rose-500/70 bg-gradient-to-b from-rose-950/80 to-slate-950 text-rose-200 hover:border-rose-400'
                : 'border-slate-800 bg-slate-950/80 text-slate-500'
            }`}
            title={
              featureFlags?.rouletteEnabled
                ? 'Азартные игры: Колесо удачи, Кости Анубиса, Классическая Рулетка (1–36) и Бои Скарабеев'
                : 'Азартные игры временно закрыты'
            }
          >
            <span className="text-xs leading-none mb-0.5">🎰</span>
            <span className="text-[8.5px] font-black leading-tight">Азартные</span>
          </button>

          {/* Premium */}
          <button
            data-tutorial="btn-premium"
            onClick={onOpenPremium}
            className={`flex flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center shadow transition-all active:scale-95 ${
              featureFlags?.premiumEnabled
                ? 'border-yellow-500/70 bg-gradient-to-b from-yellow-950/80 to-slate-950 text-yellow-200 hover:border-yellow-400'
                : 'border-slate-800 bg-slate-950/80 text-slate-500'
            }`}
            title={featureFlags?.premiumEnabled ? 'VIP-бонусы и привилегии' : 'Премиум временно закрыт'}
          >
            <span className="text-xs leading-none mb-0.5">👑</span>
            <span className="text-[8.5px] font-black leading-tight">Премиум</span>
          </button>

          {/* Achievements */}
          {onOpenAchievements && (
            <button
              onClick={onOpenAchievements}
              className="relative flex flex-col items-center justify-center rounded-lg border border-cyan-500/70 bg-gradient-to-b from-cyan-950/80 to-slate-950 px-1 py-1.5 text-center text-cyan-200 shadow transition-all active:scale-95 hover:border-cyan-400"
              title="Система достижений игрока с наградами в кристаллах"
            >
              {claimableAchievementsCount > 0 && (
                <span className="absolute -top-1.5 -right-1 flex h-4 min-w-[15px] items-center justify-center rounded-full bg-red-600 px-1 text-[7.5px] font-black text-white ring-1 ring-slate-950 animate-bounce">
                  {claimableAchievementsCount}
                </span>
              )}
              <span className="text-xs leading-none mb-0.5">🏅</span>
              <span className="text-[8.5px] font-black leading-tight">Подвиги</span>
            </button>
          )}

          {/* Leaderboard */}
          {onOpenLeaderboard && (
            <button
              onClick={onOpenLeaderboard}
              className="flex flex-col items-center justify-center rounded-lg border border-amber-500/70 bg-gradient-to-b from-amber-950/80 to-slate-950 px-1 py-1.5 text-center text-amber-200 shadow transition-all active:scale-95 hover:border-amber-400"
              title="Рейтинг сильнейших игроков"
            >
              <span className="text-xs leading-none mb-0.5">🏆</span>
              <span className="text-[8.5px] font-black leading-tight">Рейтинг</span>
            </button>
          )}

          {/* Forum */}
          {onOpenForum && (
            <button
              data-tutorial="btn-forum"
              onClick={onOpenForum}
              className="flex flex-col items-center justify-center rounded-lg border border-indigo-500/70 bg-gradient-to-b from-indigo-950/80 to-slate-950 px-1 py-1.5 text-center text-indigo-200 shadow transition-all active:scale-95 hover:border-indigo-400"
              title="Форум: обновления игры и энциклопедия"
            >
              <span className="text-xs leading-none mb-0.5">📖</span>
              <span className="text-[8.5px] font-black leading-tight">Форум</span>
            </button>
          )}
        </div>

        {/* 5. Dedicated Admin Panel (if admin) */}
        {isAdmin && !isModeratorRole && (
          <button
            onClick={onOpenAdmin}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/80 bg-gradient-to-r from-red-950/90 via-slate-950 to-red-950/90 py-1.5 text-[10px] font-black tracking-wide text-red-200 shadow transition-all active:scale-98 hover:border-red-400"
            title="Панель администратора игры"
          >
            <span>🛠️</span>
            <span>Панель Администратора</span>
          </button>
        )}

        {/* 6. Dedicated Moderator Panel (if moderator) */}
        {isModeratorRole && !isAdmin && (
          <button
            onClick={onOpenAdmin}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/80 bg-gradient-to-r from-emerald-950/90 via-slate-950 to-emerald-950/90 py-1.5 text-[10px] font-black tracking-wide text-emerald-200 shadow transition-all active:scale-98 hover:border-emerald-400"
            title="Панель модератора чата"
          >
            <span>🛡️</span>
            <span>Панель Модератора</span>
          </button>
        )}
      </div>
    </div>
  );
};
