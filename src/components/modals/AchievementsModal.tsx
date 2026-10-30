import React, { useState, useMemo, useEffect } from 'react';
import { DailyQuest, HeroState } from '../../types/game';
import {
  ACHIEVEMENT_CATEGORIES,
  AchievementCategoryKey,
  EvaluatedAchievement,
  evaluatePlayerAchievements
} from '../../utils/achievements';
import {
  DAILY_LOGIN_REWARDS,
  computeDailyRewardStatus,
  formatCountdown,
  DailyRewardDay
} from '../../utils/dailyReward';
import {
  getDailyQuestsSummary,
  GRAND_DAILY_CRYSTAL_CHEST
} from '../../utils/dailyQuests';
import { CrystalIcon } from '../CurrencyIcon';

export type AchievementsModalTab = 'achievements' | 'quests' | 'gift';

interface AchievementsModalProps {
  hero: HeroState;
  currentUser?: string | null;
  initialTab?: AchievementsModalTab;
  onClose: () => void;
  onClaimAchievement: (achievement: EvaluatedAchievement) => void;
  onClaimAllAchievements: (achievements: EvaluatedAchievement[]) => void;
  onClaimDailyReward?: (reward: DailyRewardDay) => void;
  onClaimQuestChest?: (quest: DailyQuest) => void;
  onClaimGrandCrystalChest?: () => void;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  hero,
  initialTab,
  onClose,
  onClaimAchievement,
  onClaimAllAchievements,
  onClaimDailyReward,
  onClaimQuestChest,
  onClaimGrandCrystalChest
}) => {
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const [isClaimingGift, setIsClaimingGift] = useState<boolean>(false);
  const [chestOpenBanner, setChestOpenBanner] = useState<string | null>(null);

  const summary = useMemo(() => evaluatePlayerAchievements(hero), [hero]);
  const dailyStatus = useMemo(
    () =>
      computeDailyRewardStatus(
        hero.dailyLoginDay ?? 0,
        hero.dailyLoginLastDate ?? '',
        nowTs
      ),
    [hero.dailyLoginDay, hero.dailyLoginLastDate, nowTs]
  );
  const questsSummary = useMemo(() => getDailyQuestsSummary(hero, nowTs), [hero, nowTs]);

  const [activeMainTab, setActiveMainTab] = useState<AchievementsModalTab>(() => {
    if (initialTab) return initialTab;
    if (summary.claimableCount > 0) return 'achievements';
    if (questsSummary.totalReadyChests > 0) return 'quests';
    if (dailyStatus.canClaimToday) return 'gift';
    return 'achievements';
  });

  const [selectedCategory, setSelectedCategory] = useState<'all' | AchievementCategoryKey>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'claimable' | 'in_progress' | 'claimed'>('all');

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const filteredAchievements = useMemo(() => {
    return summary.items
      .filter((item) => {
        if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
        if (statusFilter === 'claimable') return item.canClaim;
        if (statusFilter === 'in_progress') return !item.isCompleted;
        if (statusFilter === 'claimed') return item.isClaimed;
        return true;
      })
      .sort((a, b) => {
        if (a.canClaim !== b.canClaim) return a.canClaim ? -1 : 1;
        if (a.isClaimed !== b.isClaimed) return a.isClaimed ? 1 : -1;
        if (!a.isCompleted && !b.isCompleted && b.pct !== a.pct) {
          return b.pct - a.pct;
        }
        return 0;
      });
  }, [summary.items, selectedCategory, statusFilter]);

  const claimableList = useMemo(
    () => summary.items.filter((it) => it.canClaim),
    [summary.items]
  );

  const overallPct = Math.round((summary.completedCount / Math.max(1, summary.totalCount)) * 100);

  const handleClaimGift = () => {
    if (!dailyStatus.canClaimToday || isClaimingGift || !onClaimDailyReward) return;
    const targetReward = DAILY_LOGIN_REWARDS.find((r) => r.day === dailyStatus.activeDay);
    if (!targetReward) return;

    setIsClaimingGift(true);
    try {
      onClaimDailyReward(targetReward);
    } finally {
      setTimeout(() => setIsClaimingGift(false), 500);
    }
  };

  const handleOpenSingleQuestChest = (quest: DailyQuest) => {
    if (!onClaimQuestChest || quest.isClaimed || !(quest.isCompleted || quest.progress >= quest.target)) {
      return;
    }
    onClaimQuestChest(quest);
    setChestOpenBanner(
      `🧰 Вы открыли «${quest.chestName || 'Сундук с кристаллами'}»! Получено: +${quest.reward} 💎 Кристаллов${
        quest.rewardGold ? ` и +${quest.rewardGold} 🪙 Золота` : ''
      }!`
    );
  };

  const handleOpenGrandChest = () => {
    if (!onClaimGrandCrystalChest || !questsSummary.canClaimGrandChest) return;
    onClaimGrandCrystalChest();
    setChestOpenBanner(
      `👑 Открыт ${GRAND_DAILY_CRYSTAL_CHEST.title}! Вы получили: +${GRAND_DAILY_CRYSTAL_CHEST.crystals} 💎 Кристаллов, +${GRAND_DAILY_CRYSTAL_CHEST.gold} 🪙 Золота и +${GRAND_DAILY_CRYSTAL_CHEST.expPotions} ✨ Эликсир Опыта!`
    );
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-slate-950/95 p-3 text-white">
      {/* Top Modal Header */}
      <div className="flex items-center justify-between border-b border-amber-500/40 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/70 bg-gradient-to-b from-amber-500/30 to-amber-950 text-sm shadow">
            {activeMainTab === 'achievements' ? '🏅' : activeMainTab === 'quests' ? '🧰' : '🎁'}
          </span>
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-amber-300">
              {activeMainTab === 'achievements'
                ? 'Подвиги и Достижения Фараона'
                : activeMainTab === 'quests'
                ? 'Ежедневные Задания и Сундуки 💎'
                : 'Ежедневный Подарок (Календарь 7 дн.)'}
            </div>
            <div className="text-[9px] text-slate-400">
              Подвиги, ежедневные поручения и календарь подарков в одном разделе
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/40 bg-red-950/60 text-sm font-bold text-red-300 hover:bg-red-900 hover:text-white active:scale-95 cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Main 3 Switcher Tabs: Подвиги | Задания | Подарок */}
      <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 p-1 shrink-0">
        <button
          type="button"
          onClick={() => setActiveMainTab('achievements')}
          className={`relative flex items-center justify-center gap-1 rounded-lg py-1.5 px-2 text-[10.5px] font-black transition-all cursor-pointer ${
            activeMainTab === 'achievements'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>🏅</span>
          <span>Подвиги</span>
          {summary.claimableCount > 0 && (
            <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[8.5px] font-black text-white ring-1 ring-slate-950 animate-pulse">
              {summary.claimableCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('quests')}
          className={`relative flex items-center justify-center gap-1 rounded-lg py-1.5 px-2 text-[10.5px] font-black transition-all cursor-pointer ${
            activeMainTab === 'quests'
              ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>🧰</span>
          <span>Задания</span>
          <span
            className={`rounded px-1 text-[8px] font-black ${
              activeMainTab === 'quests'
                ? 'bg-slate-950/25 text-slate-950'
                : 'bg-slate-950 text-amber-300 border border-slate-700'
            }`}
          >
            {questsSummary.completedCount}/{questsSummary.totalQuests}
          </span>
          {questsSummary.totalReadyChests > 0 && (
            <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[8.5px] font-black text-white ring-1 ring-slate-950 animate-pulse">
              {questsSummary.totalReadyChests}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('gift')}
          className={`relative flex items-center justify-center gap-1 rounded-lg py-1.5 px-2 text-[10.5px] font-black transition-all cursor-pointer ${
            activeMainTab === 'gift'
              ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-slate-950 shadow'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>🎁</span>
          <span>Подарок</span>
          {dailyStatus.canClaimToday && (
            <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[8.5px] font-black text-white ring-1 ring-slate-950 animate-pulse">
              1
            </span>
          )}
        </button>
      </div>

      {/* =====================================================================
          TAB 1: ПОДВИГИ (ACHIEVEMENTS)
      ===================================================================== */}
      {activeMainTab === 'achievements' && (
        <>
          {/* Overall Summary & Claim All Banner */}
          <div className="mt-2 rounded-xl border-2 border-amber-500/50 bg-gradient-to-r from-[#24160b] via-slate-900 to-[#111c2d] p-2.5 shadow-[0_0_20px_rgba(245,158,11,0.18)] shrink-0 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-[10.5px] font-black text-amber-200">
                  <span>🏆 Прогресс подвигов:</span>
                  <span className="rounded bg-amber-500/25 border border-amber-400/60 px-1.5 py-0.2 text-amber-300 tabular-nums">
                    {summary.completedCount} / {summary.totalCount} ({overallPct}%)
                  </span>
                </div>
                <div className="text-[9px] text-slate-300 flex items-center gap-2 flex-wrap">
                  <span>
                    Заработано наград:{' '}
                    <strong className="text-cyan-300">{summary.earnedCrystalsTotal} 💎</strong> из{' '}
                    <strong className="text-slate-200">{summary.maxPossibleCrystals} 💎</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Ваш баланс:{' '}
                    <strong className="text-cyan-200">{hero.crystals.toLocaleString('ru-RU')} 💎</strong>
                  </span>
                </div>
              </div>

              {claimableList.length > 0 && (
                <button
                  type="button"
                  onClick={() => onClaimAllAchievements(claimableList)}
                  className="rounded-xl border-2 border-cyan-300 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 px-3 py-1.5 text-[10px] font-black uppercase text-slate-950 shadow-[0_0_16px_rgba(34,211,238,0.75)] hover:brightness-110 active:scale-95 animate-pulse cursor-pointer shrink-0"
                >
                  🎁 Забрать все ({claimableList.length}) • +{summary.totalClaimableCrystals} 💎
                </button>
              )}
            </div>

            {/* Overall Completion Bar */}
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-amber-500/40">
              <div
                className="h-full bg-gradient-to-r from-amber-600 via-yellow-400 to-cyan-400 transition-all duration-300"
                style={{ width: `${overallPct}%` }}
              />
            </div>

            {/* Quick Player Tracked Counters */}
            <div className="grid grid-cols-4 gap-1 pt-0.5 text-center">
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-1.5 py-1">
                <div className="text-[7.5px] text-slate-400">Собрано золота</div>
                <div className="text-[9.5px] font-black text-amber-300 tabular-nums">
                  {Math.max(hero.totalGoldCollected || 0, hero.gold || 0).toLocaleString('ru-RU')} 🪙
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-1.5 py-1">
                <div className="text-[7.5px] text-slate-400">Убито монстров</div>
                <div className="text-[9.5px] font-black text-emerald-300 tabular-nums">
                  {Math.max(hero.mobsKilled || 0, hero.mobKills || 0).toLocaleString('ru-RU')} 🦂
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-1.5 py-1">
                <div className="text-[7.5px] text-slate-400">Побед над боссами</div>
                <div className="text-[9.5px] font-black text-red-300 tabular-nums">
                  {Math.max(
                    hero.bossesKilled || 0,
                    Math.max(1, hero.homePyramidTier || hero.pyramidTier || 1) - 1
                  )}{' '}
                  👹
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-1.5 py-1">
                <div className="text-[7.5px] text-slate-400">Побед в PvP</div>
                <div className="text-[9.5px] font-black text-purple-300 tabular-nums">
                  {(hero.pvpKills || 0).toLocaleString('ru-RU')} ⚔️
                </div>
              </div>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-1 shrink-0 no-scrollbar">
            {(Object.keys(ACHIEVEMENT_CATEGORIES) as ('all' | AchievementCategoryKey)[]).map((catKey) => {
              const cat = ACHIEVEMENT_CATEGORIES[catKey];
              const isSelected = selectedCategory === catKey;
              const catClaimable = summary.items.filter(
                (i) => (catKey === 'all' || i.category === catKey) && i.canClaim
              ).length;

              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setSelectedCategory(catKey)}
                  className={`relative flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'border-amber-400 bg-amber-500 text-slate-950 shadow'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  {catClaimable > 0 && (
                    <span className="ml-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-600 px-1 text-[7.5px] font-black text-white">
                      {catClaimable}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Status Sub-Filter */}
          <div className="mt-1 grid grid-cols-4 gap-1 border-b border-slate-800 pb-2 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-md py-1 text-[8.5px] font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-700 text-white border border-slate-500'
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              Все ({summary.totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('claimable')}
              className={`rounded-md py-1 text-[8.5px] font-bold transition-all cursor-pointer ${
                statusFilter === 'claimable'
                  ? 'bg-cyan-600 text-slate-950 font-black border border-cyan-300'
                  : summary.claimableCount > 0
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/60 animate-pulse'
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800'
              }`}
            >
              🎁 Забрать ({summary.claimableCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('in_progress')}
              className={`rounded-md py-1 text-[8.5px] font-bold transition-all cursor-pointer ${
                statusFilter === 'in_progress'
                  ? 'bg-amber-600 text-slate-950 font-black border border-amber-300'
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              ⏳ В пути ({summary.totalCount - summary.completedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('claimed')}
              className={`rounded-md py-1 text-[8.5px] font-bold transition-all cursor-pointer ${
                statusFilter === 'claimed'
                  ? 'bg-emerald-600 text-slate-950 font-black border border-emerald-300'
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              ✅ Получено ({summary.claimedCount})
            </button>
          </div>

          {/* Achievements List */}
          <div className="mt-2 flex-1 overflow-y-auto space-y-2 pr-0.5">
            {filteredAchievements.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 py-10 text-center">
                <span className="text-3xl mb-1">🏅</span>
                <div className="text-xs font-bold text-amber-300">Нет достижений в выбранном фильтре</div>
                <div className="text-[9.5px] text-slate-400 mt-0.5">
                  Переключите вкладку категории или фильтр статуса выше
                </div>
              </div>
            ) : (
              filteredAchievements.map((ach) => {
                const catMeta = ACHIEVEMENT_CATEGORIES[ach.category];
                const displayProgress = Math.min(ach.progress, ach.target);

                return (
                  <div
                    key={ach.id}
                    className={`relative rounded-xl border-2 p-2.5 transition-all ${
                      ach.canClaim
                        ? 'border-cyan-400 bg-gradient-to-r from-cyan-950/75 via-slate-900 to-emerald-950/65 shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                        : ach.isClaimed
                        ? 'border-emerald-500/40 bg-gradient-to-r from-emerald-950/30 via-slate-900/90 to-slate-950 opacity-90'
                        : 'border-slate-800 bg-slate-900/90 hover:border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      {/* Left: Icon & Info */}
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div
                          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xl shadow-inner ${
                            ach.canClaim
                              ? 'border-cyan-300 bg-cyan-950/90 animate-bounce'
                              : ach.isClaimed
                              ? 'border-emerald-400/70 bg-emerald-950/70'
                              : 'border-amber-500/40 bg-slate-950'
                          }`}
                        >
                          <span>{ach.icon}</span>
                          {ach.isClaimed && (
                            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-black text-slate-950 shadow">
                              ✓
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-black text-white">{ach.title}</span>
                            <span
                              className={`rounded border px-1.5 py-0.2 text-[7.5px] font-extrabold uppercase ${catMeta.badgeClass}`}
                            >
                              {catMeta.icon} {catMeta.label}
                            </span>
                          </div>
                          <div className="text-[9px] text-slate-300 mt-0.5 leading-snug">
                            {ach.description}
                          </div>

                          {/* Progress Bar & Counter */}
                          <div className="mt-1.5 space-y-1">
                            <div className="flex items-center justify-between text-[8.5px] font-bold">
                              <span
                                className={
                                  ach.isCompleted ? 'text-emerald-300 font-extrabold' : 'text-slate-400'
                                }
                              >
                                {ach.isCompleted
                                  ? '✨ Выполнено!'
                                  : `Прогресс: ${displayProgress.toLocaleString('ru-RU')} / ${ach.target.toLocaleString('ru-RU')} ${ach.unitLabel}`}
                              </span>
                              <span className="text-amber-300 tabular-nums">{ach.pct}%</span>
                            </div>
                            <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-700">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  ach.canClaim
                                    ? 'bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400'
                                    : ach.isClaimed
                                    ? 'bg-gradient-to-r from-emerald-600 to-green-400'
                                    : 'bg-gradient-to-r from-amber-600 to-yellow-400'
                                }`}
                                style={{ width: `${ach.pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Crystal Reward & Claim Action */}
                      <div className="flex flex-col items-end justify-between shrink-0 gap-1.5">
                        <div className="flex items-center gap-1 rounded-lg border border-cyan-400/50 bg-cyan-950/80 px-2 py-0.5 text-[10px] font-black text-cyan-200 shadow-inner">
                          <span>+{ach.rewardCrystals}</span>
                          <CrystalIcon size="sm" />
                        </div>

                        {ach.canClaim ? (
                          <button
                            type="button"
                            onClick={() => onClaimAchievement(ach)}
                            className="rounded-lg border border-cyan-200 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 px-2.5 py-1.5 text-[9.5px] font-black uppercase text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.7)] hover:brightness-110 active:scale-95 animate-pulse cursor-pointer"
                          >
                            🎁 Забрать
                          </button>
                        ) : ach.isClaimed ? (
                          <span className="rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-2 py-1 text-[8.5px] font-extrabold text-emerald-300">
                            ✅ Получено
                          </span>
                        ) : (
                          <span className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[8px] font-bold text-slate-400 tabular-nums">
                            Ещё {ach.remaining.toLocaleString('ru-RU')} {ach.unitLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* =====================================================================
          TAB 2: ЗАДАНИЯ (DAILY QUESTS & CRYSTAL CHESTS)
      ===================================================================== */}
      {activeMainTab === 'quests' && (
        <div className="mt-2.5 flex-1 flex flex-col gap-3 overflow-y-auto pr-0.5">
          {chestOpenBanner && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-cyan-400/70 bg-gradient-to-r from-cyan-950/90 via-emerald-950/80 to-slate-900 px-3 py-2 text-[11px] font-black text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.3)] shrink-0">
              <span>{chestOpenBanner}</span>
              <button
                type="button"
                onClick={() => setChestOpenBanner(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Grand Royal Crystal Chest Banner */}
          <div
            className={`rounded-2xl border-2 p-3 transition-all shrink-0 ${
              questsSummary.canClaimGrandChest
                ? 'border-cyan-400 bg-gradient-to-br from-cyan-950/90 via-amber-950/60 to-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.45)]'
                : questsSummary.isGrandChestClaimed
                ? 'border-emerald-500/40 bg-emerald-950/25'
                : 'border-amber-500/40 bg-gradient-to-br from-slate-900 via-purple-950/30 to-slate-950'
            }`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-2xl shadow-inner ${
                    questsSummary.canClaimGrandChest
                      ? 'border-cyan-300 bg-cyan-500/20 animate-bounce'
                      : 'border-amber-500/50 bg-amber-950/60'
                  }`}
                >
                  🧰
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-xs sm:text-sm font-black text-cyan-300">
                      {GRAND_DAILY_CRYSTAL_CHEST.title}
                    </h3>
                    <span className="rounded bg-slate-950/90 border border-cyan-500/40 px-1.5 py-0.5 text-[9px] font-black text-amber-300">
                      {Math.min(
                        GRAND_DAILY_CRYSTAL_CHEST.requiredCompletedQuests,
                        questsSummary.completedCount
                      )}{' '}
                      / {GRAND_DAILY_CRYSTAL_CHEST.requiredCompletedQuests} заданий
                    </span>
                  </div>
                  <p className="text-[9.5px] text-slate-300 mt-0.5 leading-snug">
                    {GRAND_DAILY_CRYSTAL_CHEST.desc}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9.5px] font-black">
                    <span className="rounded bg-cyan-950/90 border border-cyan-500/50 px-2 py-0.5 text-cyan-200">
                      💎 +{GRAND_DAILY_CRYSTAL_CHEST.crystals} Кристаллов
                    </span>
                    <span className="rounded bg-amber-950/90 border border-amber-500/50 px-2 py-0.5 text-amber-300">
                      🪙 +{GRAND_DAILY_CRYSTAL_CHEST.gold} Золота
                    </span>
                    <span className="rounded bg-purple-950/90 border border-purple-500/50 px-2 py-0.5 text-purple-200">
                      ✨ +{GRAND_DAILY_CRYSTAL_CHEST.expPotions} Эликсир Опыта
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar & Claim Button for Grand Chest */}
            <div className="mt-2.5 space-y-2">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400 transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (questsSummary.completedCount /
                          GRAND_DAILY_CRYSTAL_CHEST.requiredCompletedQuests) *
                          100
                      )
                    )}%`
                  }}
                />
              </div>

              {questsSummary.canClaimGrandChest ? (
                <button
                  type="button"
                  onClick={handleOpenGrandChest}
                  className="w-full rounded-xl border border-cyan-300 bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400 py-2 text-xs font-black text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.5)] hover:brightness-110 active:scale-98 cursor-pointer animate-pulse"
                >
                  🧰 Открыть Главный Сундук с Кристаллами! (+{GRAND_DAILY_CRYSTAL_CHEST.crystals} 💎)
                </button>
              ) : questsSummary.isGrandChestClaimed ? (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 py-1.5 text-center text-[10px] font-black text-emerald-300">
                  ✓ Главный Сундук с кристаллами за сегодня уже открыт! (Сброс через {formatCountdown(dailyStatus.msUntilNextReset)})
                </div>
              ) : (
                <div className="text-center text-[9.5px] font-bold text-slate-400">
                  Выполните ещё{' '}
                  <span className="text-amber-300 font-black">
                    {Math.max(
                      0,
                      GRAND_DAILY_CRYSTAL_CHEST.requiredCompletedQuests -
                        questsSummary.completedCount
                    )}
                  </span>{' '}
                  задание(я) для открытия Главного Сундука • До обновления:{' '}
                  <span className="font-mono text-cyan-300">
                    {formatCountdown(dailyStatus.msUntilNextReset)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Individual Daily Quests List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 px-0.5">
              <span>Список заданий на сегодня:</span>
              <span className="text-cyan-300">
                Выполнено: {questsSummary.completedCount} / {questsSummary.totalQuests}
              </span>
            </div>

            {questsSummary.quests.map((quest) => {
              const isDone = quest.isCompleted || quest.progress >= quest.target;
              const canClaimChest = isDone && !quest.isClaimed;
              const pct = Math.min(100, Math.round((quest.progress / quest.target) * 100));

              return (
                <div
                  key={quest.id}
                  className={`rounded-xl border p-2.5 transition-all ${
                    canClaimChest
                      ? 'border-cyan-400 bg-gradient-to-r from-cyan-950/70 via-slate-900 to-amber-950/50 shadow-[0_0_15px_rgba(34,211,238,0.25)]'
                      : quest.isClaimed
                      ? 'border-slate-800 bg-slate-950/60 opacity-75'
                      : 'border-slate-800 bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-slate-950 text-lg">
                        {quest.icon || '📜'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-black text-white">
                            {quest.title || 'Ежедневное задание'}
                          </span>
                          {quest.isClaimed ? (
                            <span className="rounded bg-emerald-950 border border-emerald-500/40 px-1.5 py-0.2 text-[8.5px] font-black text-emerald-400">
                              ✓ Сундук открыт
                            </span>
                          ) : canClaimChest ? (
                            <span className="rounded bg-cyan-400 px-1.5 py-0.2 text-[8.5px] font-black text-slate-950 animate-pulse">
                              СУНДУК ГОТОВ!
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[10px] text-slate-300 mt-0.5">
                          {quest.description}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9.5px] font-bold">
                          <span className="text-slate-400">Награда:</span>
                          <span className="rounded bg-cyan-950/90 border border-cyan-500/40 px-1.5 py-0.2 text-cyan-200 font-black">
                            🧰 Сундук (+{quest.reward} 💎{quest.rewardGold ? `, +${quest.rewardGold} 🪙` : ''})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="font-mono text-xs font-black text-amber-300 tabular-nums">
                        {quest.progress} / {quest.target}
                      </div>
                      <div className="text-[8.5px] text-slate-400">{pct}%</div>
                    </div>
                  </div>

                  {/* Progress bar + Open Chest button */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isDone
                            ? 'bg-gradient-to-r from-emerald-400 to-cyan-400'
                            : 'bg-gradient-to-r from-amber-500 to-orange-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {canClaimChest && (
                      <button
                        type="button"
                        onClick={() => handleOpenSingleQuestChest(quest)}
                        className="shrink-0 rounded-lg border border-cyan-300 bg-gradient-to-r from-cyan-400 to-emerald-400 px-3 py-1 text-[10px] font-black text-slate-950 shadow hover:brightness-110 active:scale-95 cursor-pointer"
                      >
                        🧰 Открыть (+{quest.reward} 💎)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: ПОДАРОК (7-DAY DAILY LOGIN REWARD CALENDAR)
      ===================================================================== */}
      {activeMainTab === 'gift' && (
        <div className="mt-2.5 flex-1 flex flex-col overflow-y-auto pr-0.5">
          {/* Status / Reset Banner */}
          <div>
            {dailyStatus.canClaimToday ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/60 bg-emerald-950/70 p-2.5 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                <div className="flex items-center gap-2">
                  <span className="text-xl">✨</span>
                  <div>
                    <div className="text-xs font-black text-emerald-300">
                      Награда за День {dailyStatus.activeDay} готова к получению!
                    </div>
                    <div className="text-[10px] text-emerald-200/80">
                      Нажмите «Забрать! 🎁», чтобы получить золото и кристаллы.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isClaimingGift}
                  onClick={handleClaimGift}
                  className="shrink-0 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 px-3.5 py-1.5 text-xs font-black text-slate-950 shadow hover:from-emerald-400 hover:to-green-500 active:scale-95 animate-pulse cursor-pointer"
                >
                  {isClaimingGift ? 'Зачисление...' : 'Забрать! 🎁'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-slate-900/90 p-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⏳</span>
                  <div>
                    <div className="font-bold text-amber-300">
                      Награда за сегодня уже забрана!
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Следующий день ({((dailyStatus.lastClaimDay % 7) + 1)}-й) откроется в 00:01
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end rounded-lg bg-black/60 px-2.5 py-1 border border-slate-800">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400">До сброса:</span>
                  <span className="font-mono text-xs font-black text-amber-400 tabular-nums">
                    {formatCountdown(dailyStatus.msUntilNextReset)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 7 Days Grid */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DAILY_LOGIN_REWARDS.map((reward) => {
              const is7thDay = reward.day === 7;
              const isClaimed =
                dailyStatus.hasClaimedToday
                  ? reward.day <= dailyStatus.lastClaimDay
                  : reward.day < dailyStatus.activeDay;
              const isReadyToClaim = dailyStatus.canClaimToday && reward.day === dailyStatus.activeDay;
              const isFuture = !isClaimed && !isReadyToClaim;

              return (
                <div
                  key={reward.day}
                  className={`relative flex flex-col justify-between rounded-xl p-2.5 transition-all ${
                    is7thDay ? 'col-span-2 sm:col-span-2' : ''
                  } ${
                    isReadyToClaim
                      ? 'border-2 border-amber-400 bg-gradient-to-b from-amber-950/90 via-slate-900 to-black shadow-[0_0_18px_rgba(245,158,11,0.5)] scale-[1.01]'
                      : isClaimed
                      ? 'border border-slate-800 bg-slate-950/60 opacity-60'
                      : 'border border-slate-800/90 bg-slate-900/60'
                  }`}
                >
                  {/* Badge Top */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider ${
                        isReadyToClaim
                          ? 'text-amber-300'
                          : isClaimed
                          ? 'text-slate-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {reward.title}
                    </span>
                    {isClaimed && (
                      <span className="rounded bg-emerald-950 px-1.5 py-0.2 text-[8.5px] font-black text-emerald-400 border border-emerald-500/40">
                        ✓ Забрано
                      </span>
                    )}
                    {isReadyToClaim && (
                      <span className="rounded bg-amber-500 px-1.5 py-0.2 text-[8.5px] font-black text-slate-950 animate-pulse">
                        ГОТОВО!
                      </span>
                    )}
                    {isFuture && <span className="text-[9px] text-slate-500">🔒</span>}
                  </div>

                  {/* Reward Icons & Amounts */}
                  <div className="my-1.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                      <span>🪙</span>
                      <span>+{reward.gold} Золота</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-black text-cyan-300">
                      <span>💎</span>
                      <span>+{reward.crystals} Кристаллов</span>
                    </div>
                    {reward.expPotions > 0 && (
                      <div className="flex items-center gap-1.5 text-xs font-black text-purple-300">
                        <span>✨</span>
                        <span>+{reward.expPotions} Эликсиров Опыта</span>
                      </div>
                    )}
                  </div>

                  {/* Status bottom action or label */}
                  <div className="mt-1 pt-1 border-t border-slate-800/60">
                    {isReadyToClaim ? (
                      <button
                        type="button"
                        disabled={isClaimingGift}
                        onClick={handleClaimGift}
                        className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 py-1 text-[11px] font-black text-slate-950 shadow hover:from-amber-400 hover:to-yellow-400 active:scale-95 cursor-pointer"
                      >
                        {isClaimingGift ? 'Зачисление...' : 'Забрать'}
                      </button>
                    ) : isClaimed ? (
                      <div className="text-center text-[9.5px] font-bold text-slate-500">
                        Получено
                      </div>
                    ) : (
                      <div className="text-center text-[9.5px] text-slate-500">
                        День {reward.day}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Notes */}
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/80 p-2 text-[9.5px] text-slate-400 space-y-1">
            <div className="flex items-start gap-1.5">
              <span className="text-amber-400 font-bold shrink-0">📌</span>
              <span>
                <strong>Правила наград:</strong> забирайте подарки каждый день подряд. Получив награду, на следующий день вы забираете следующую!
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-cyan-400 font-bold shrink-0">🔄</span>
              <span>
                <strong>Обновление:</strong> каждый день в <strong>00:01</strong> по времени сервера.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
