import React, { useState, useEffect, useRef } from 'react';
import { HeroState } from '../types/game';
import { EXP_TABLE, MAX_LEVEL } from '../utils/gameData';
import { getDailyQuestsSummary } from '../utils/dailyQuests';
import {
  normalizePlayerBattlePassState,
  getBattlePassClaimableCount,
  getActiveSeasonTitle
} from '../utils/battlePassConfig';
import { BottomTabBar } from './BottomTabBar';
import { CityDynamicBackground } from './CityDynamicBackground';
import { CamelBonus } from './CamelBonus';
import { EgyptianHudAccordion } from './EgyptianHudAccordion';
import { CityNewbieGuide } from './CityNewbieGuide';

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
  onOpenAltar?: () => void;
  onOpenPort?: () => void;
  onOpenFishing?: () => void;
  onOpenBattlePass?: () => void;
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
  onOpenAltar,
  onOpenPort,
  onOpenFishing,
  onOpenBattlePass,
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
  const bpState = normalizePlayerBattlePassState(hero.battlePass);
  const bpClaimableCount = getBattlePassClaimableCount(hero);
  const activeSeasonTitle = getActiveSeasonTitle(hero);

  // Automatic HP & Energy Regeneration Visual Progress Bar in City
  const isRegenNeeded = hero.hp < hero.maxHp || hero.energy < hero.maxEnergy;
  const regenIntervalSec = isPremActive ? 1 : 3;
  const regenStepMs = regenIntervalSec * 1000;
  const regenAmountPerTick = isPremActive ? 2 : 1;

  const localTickAnchorRef = useRef<number>(lastRegenTickAt || Date.now());
  const [regenNowMs, setRegenNowMs] = useState<number>(() => Date.now());
  const [showNewbieGuide, setShowNewbieGuide] = useState<boolean>(() => {
    try {
      const nick = currentUser || hero.nick || 'guest';
      const doneForNick = localStorage.getItem(`bigwar_newbie_guide_done_${nick.toLowerCase()}`);
      const doneAll = localStorage.getItem('bigwar_newbie_guide_done_all');
      if (doneForNick === 'true' || doneAll === 'true') return false;
      return (hero.level || 1) <= 5;
    } catch {
      return false;
    }
  });

  // Sync anchor whenever HP or Energy ticks up or parent updates lastRegenTickAt
  useEffect(() => {
    localTickAnchorRef.current = Date.now();
    setRegenNowMs(Date.now());
  }, [hero.hp, hero.energy, lastRegenTickAt]);

  useEffect(() => {
    const hasActivePortTravel =
      hero.portTravel?.status === 'to_port' || hero.portTravel?.status === 'from_port';
    if (!isRegenNeeded && !hasActivePortTravel) return;
    const timer = setInterval(() => {
      setRegenNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [isRegenNeeded, regenStepMs, hero.portTravel?.status]);

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
      className="relative flex flex-[64] min-h-0 flex-col justify-between overflow-hidden border-b-2 border-orange-500/80 bg-[#160924]"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Dynamic 2D Landscape: Time of Day, Weather (Sandstorm), Interactive Pyramid Hotspot & Camel Bonus */}
      <CityDynamicBackground
        onEnterPyramid={onEnterPyramid}
        energy={hero.energy}
        homePyramidTier={hero.homePyramidTier || hero.pyramidTier || 1}
        isAdmin={
          String(currentUser || hero.nick || (hero as any).name || '')
            .trim()
            .toLowerCase() === 'redblack'
        }
      >
        {/* Retractable Egyptian Stone HUD Accordion (Компактная выдвижная шторка персонажа) */}
        <EgyptianHudAccordion
          currentUser={currentUser}
          hero={hero}
          soundMuted={soundMuted}
          unreadMailCount={unreadMailCount}
          unspentStatPoints={unspentStatPoints}
          hasCharacterNotification={hasCharacterNotification}
          totalNotificationCount={totalNotificationCount}
          isPremActive={isPremActive}
          isModeratorRole={isModeratorRole}
          isAdmin={isAdmin}
          activeSeasonTitle={activeSeasonTitle}
          isRegenNeeded={isRegenNeeded}
          regenAmountPerTick={regenAmountPerTick}
          secToNextRegenTick={secToNextRegenTick}
          totalSecToFullRecovery={totalSecToFullRecovery}
          formatShortDuration={formatShortDuration}
          onToggleSound={onToggleSound}
          onOpenCharModal={onOpenCharModal}
          onOpenMailModal={onOpenMailModal}
          onUsePotion={onUsePotion}
        />

        {/* Interactive Camel Daily Bonus Character (Верблюд с подарками 🐫) */}
        <CamelBonus
          canClaim={Boolean(canClaimDailyReward)}
          onOpenDailyReward={onOpenDailyReward || (() => {})}
        />

        {/* Quick Newbie Guide Reopen Button */}
        {!showNewbieGuide && (
          <button
            type="button"
            onClick={() => setShowNewbieGuide(true)}
            className="pointer-events-auto absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-full border border-amber-400/60 bg-slate-950/80 px-2.5 py-1 text-[9px] font-bold text-amber-300 shadow-md backdrop-blur-xs hover:border-amber-300 hover:bg-slate-900 cursor-pointer transition-all"
            title="Открыть подсказки для новичков"
          >
            <span>💡</span>
            <span>Подсказки</span>
          </button>
        )}
      </CityDynamicBackground>

      {/* Interactive Contextual Pointers for Newbies */}
      {showNewbieGuide && (
        <CityNewbieGuide
          playerNick={currentUser || hero.nick}
          onClose={() => setShowNewbieGuide(false)}
        />
      )}

      {/* 2. DOCKED BOTTOM NAVIGATION BAR & CONTROLS (Always Sticky / Fixed at bottom immediately above chat) */}
      <div className="relative z-30 shrink-0 w-full overflow-visible flex flex-col gap-1.5 pt-2 px-1.5 pb-1 sm:px-2 sm:pb-1.5 bg-gradient-to-t from-black via-slate-950/95 to-slate-950/90 border-t border-amber-500/50 shadow-[0_-6px_20px_rgba(0,0,0,0.85)]">
        {/* Season Battle Pass 2D RPG Banner */}
        {onOpenBattlePass && (
          <button
            type="button"
            onClick={onOpenBattlePass}
            className="game-2d-btn group relative overflow-visible flex w-full items-center justify-between rounded-xl border-[1.5px] border-amber-400/90 bg-gradient-to-r from-[#3a200d] via-[#4a2610] to-[#2e1042] px-2.5 py-1 text-left shadow-[0_2px_0_#1c0d06,0_3px_10px_rgba(0,0,0,0.8)] hover:border-yellow-300 cursor-pointer"
            title="Боевой Пропуск (Сезон 1–40 ур.): бесплатные и VIP награды, задания и титулы"
          >
            {bpClaimableCount > 0 && (
              <span className="absolute -top-2 right-1 z-30 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-yellow-300 bg-red-600 px-1 text-[7.5px] font-black text-white animate-bounce shadow-[0_0_10px_#ef4444]">
                {bpClaimableCount}
              </span>
            )}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs shrink-0 drop-shadow">🏆</span>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[8.5px] font-black uppercase tracking-wide text-yellow-300 truncate drop-shadow">
                  Сезон / Пропуск
                </span>
                <span className="text-[7.5px] font-bold text-amber-100/95 truncate">
                  {bpState.isVipUnlocked ? '👑 VIP активен' : 'Награды и задания'}
                </span>
              </div>
            </div>
            <span className="rounded-md bg-gradient-to-b from-amber-500/40 to-amber-900/60 border border-amber-300/80 px-1.5 py-0.5 text-[7.5px] font-black text-yellow-100 tabular-nums shrink-0 shadow-xs">
              Ур. {bpState.level} / 40
            </span>
          </button>
        )}

        {/* Modern Fixed Bottom Navigation Bar (5 Core Hubs with Submenus & Badges) */}
        <BottomTabBar
          currentScreen="city"
          unreadMailCount={unreadMailCount}
          unspentStatPoints={unspentStatPoints}
          claimableAchievementsCount={claimableAchievementsCount + readyQuestChests}
          claimableSeasonRewards={bpClaimableCount}
          canClaimDailyReward={canClaimDailyReward}
          isPortTraveling={hero.portTravel?.status && hero.portTravel.status !== 'idle'}
          isFishingBuffActive={Boolean(hero.fishingExpBuffUntil && hero.fishingExpBuffUntil > regenNowMs)}
          isVipActive={isPremActive}
          onEnterPyramid={onEnterPyramid}
          onOpenCharModal={onOpenCharModal}
          onOpenMailModal={onOpenMailModal}
          onOpenPort={onOpenPort || onOpenAltar}
          onOpenFishing={onOpenFishing}
          onOpenWheel={onOpenWheel}
          onOpenClans={onOpenClans}
          onOpenClanPyramid={onOpenClanPyramid}
          onOpenLeaderboard={onOpenLeaderboard}
          onOpenForum={onOpenForum}
          onOpenAchievements={onOpenAchievements}
          onOpenShop={onOpenShop}
          onOpenBank={onOpenBank}
          onOpenBattlePass={onOpenBattlePass}
          onOpenPremium={onOpenPremium}
          onOpenDailyReward={onOpenDailyReward}
        />
      </div>
    </div>
  );
};
