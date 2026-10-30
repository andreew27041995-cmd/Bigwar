import React, { useState, useEffect } from 'react';
import { DailyQuest, HeroState } from '../../types/game';
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

interface DailyRewardModalProps {
  hero: HeroState;
  currentUser: string | null;
  initialTab?: 'login' | 'quests';
  onClose: () => void;
  onClaimReward: (reward: DailyRewardDay) => void;
  onClaimQuestChest?: (quest: DailyQuest) => void;
  onClaimGrandCrystalChest?: () => void;
}

export const DailyRewardModal: React.FC<DailyRewardModalProps> = ({
  hero,
  currentUser,
  initialTab,
  onClose,
  onClaimReward,
  onClaimQuestChest,
  onClaimGrandCrystalChest
}) => {
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [chestOpenBanner, setChestOpenBanner] = useState<string | null>(null);

  const status = computeDailyRewardStatus(
    hero.dailyLoginDay ?? 0,
    hero.dailyLoginLastDate ?? '',
    nowTs
  );
  const questsSummary = getDailyQuestsSummary(hero, nowTs);

  const [activeTab, setActiveTab] = useState<'quests' | 'login'>(() => {
    if (initialTab) return initialTab;
    if (questsSummary.totalReadyChests > 0 && !status.canClaimToday) return 'quests';
    return 'quests';
  });

  // Live 1-second ticker for 00:01 countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleClaim = () => {
    if (!status.canClaimToday || isClaiming) return;
    const targetReward = DAILY_LOGIN_REWARDS.find((r) => r.day === status.activeDay);
    if (!targetReward) return;

    setIsClaiming(true);
    try {
      onClaimReward(targetReward);
    } finally {
      setTimeout(() => setIsClaiming(false), 500);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm animate-fade-in">
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl border-2 border-amber-500/70 bg-gradient-to-b from-slate-900 via-slate-950 to-black p-4 text-white shadow-[0_0_35px_rgba(245,158,11,0.35)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-500/30 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-bounce">
              {activeTab === 'quests' ? '🧰' : '🎁'}
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide text-amber-400">
                {activeTab === 'quests' ? 'Ежедневные задания и Сундук 💎' : 'Ежедневный вход (Календарь)'}
              </h2>
              <div className="text-[10.5px] text-slate-400">
                {activeTab === 'quests'
                  ? 'Выполняйте задания в Пирамиде и открывайте сундуки с кристаллами!'
                  : 'Заходите каждый день и получайте дары фараона!'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-sm font-bold text-slate-300 hover:border-amber-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Mode Switcher Tabs: Daily Quests vs Daily Login Calendar */}
        <div className="mt-2.5 grid grid-cols-2 gap-1.5 rounded-xl border border-slate-800 bg-slate-950/90 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('quests')}
            className={`relative flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-black transition-all cursor-pointer ${
              activeTab === 'quests'
                ? 'bg-gradient-to-r from-cyan-500 to-amber-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>📜</span>
            <span>Задания дня</span>
            {questsSummary.totalReadyChests > 0 && (
              <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[9px] font-black text-white ring-1 ring-slate-950 animate-pulse">
                {questsSummary.totalReadyChests}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('login')}
            className={`relative flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-black transition-all cursor-pointer ${
              activeTab === 'login'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>🎁</span>
            <span>Календарь (7 дн.)</span>
            {status.canClaimToday && (
              <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[9px] font-black text-white ring-1 ring-slate-950 animate-pulse">
                1
              </span>
            )}
          </button>
        </div>

        {chestOpenBanner && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-cyan-400/70 bg-gradient-to-r from-cyan-950/90 via-emerald-950/80 to-slate-900 px-3 py-2 text-[11px] font-black text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.3)]">
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

        {/* =====================================================================
            TAB 1: DAILY QUESTS & CRYSTAL CHESTS
        ===================================================================== */}
        {activeTab === 'quests' ? (
          <div className="mt-3 flex flex-col gap-3 overflow-y-auto pr-0.5">
            {/* Grand Royal Crystal Chest Banner */}
            <div
              className={`rounded-2xl border-2 p-3 transition-all ${
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
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-2xl shadow-inner ${
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
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-black">
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
                    ✓ Главный Сундук с кристаллами за сегодня уже открыт! (Сброс через {formatCountdown(status.msUntilNextReset)})
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
                      {formatCountdown(status.msUntilNextReset)}
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
        ) : (
          /* =====================================================================
              TAB 2: 7-DAY DAILY LOGIN REWARD CALENDAR
          ===================================================================== */
          <div className="mt-3 flex flex-col overflow-y-auto pr-0.5">
            {/* Status / Reset Banner */}
            <div>
              {status.canClaimToday ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/60 bg-emerald-950/70 p-2.5 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">✨</span>
                    <div>
                      <div className="text-xs font-black text-emerald-300">
                        Награда за День {status.activeDay} готова к получению!
                      </div>
                      <div className="text-[10px] text-emerald-200/80">
                        Нажмите «Забрать награду» ниже, чтобы зачислить ресурсы.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isClaiming}
                    onClick={handleClaim}
                    className="shrink-0 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 px-3.5 py-1.5 text-xs font-black text-slate-950 shadow hover:from-emerald-400 hover:to-green-500 active:scale-95 animate-pulse cursor-pointer"
                  >
                    {isClaiming ? 'Зачисление...' : 'Забрать! 🎁'}
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
                        Следующий день ({((status.lastClaimDay % 7) + 1)}-й) откроется в 00:01
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end rounded-lg bg-black/60 px-2.5 py-1 border border-slate-800">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400">До сброса:</span>
                    <span className="font-mono text-xs font-black text-amber-400 tabular-nums">
                      {formatCountdown(status.msUntilNextReset)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 7 Days Grid */}
            <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DAILY_LOGIN_REWARDS.map((reward) => {
                const is7thDay = reward.day === 7;
                const isClaimed =
                  status.hasClaimedToday
                    ? reward.day <= status.lastClaimDay
                    : reward.day < status.activeDay;
                const isReadyToClaim = status.canClaimToday && reward.day === status.activeDay;
                const isFuture = !isClaimed && !isReadyToClaim;

                return (
                  <div
                    key={reward.day}
                    className={`relative flex flex-col justify-between rounded-xl p-2.5 transition-all ${
                      is7thDay ? 'col-span-2 sm:col-span-2' : ''
                    } ${
                      isReadyToClaim
                        ? 'border-2 border-amber-400 bg-gradient-to-b from-amber-950/90 via-slate-900 to-black shadow-[0_0_18px_rgba(245,158,11,0.5)] scale-[1.02]'
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
                          disabled={isClaiming}
                          onClick={handleClaim}
                          className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 py-1 text-[11px] font-black text-slate-950 shadow hover:from-amber-400 hover:to-yellow-400 active:scale-95 cursor-pointer"
                        >
                          {isClaiming ? 'Зачисление...' : 'Забрать'}
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
            <div className="mt-3.5 rounded-xl border border-slate-800 bg-slate-950/80 p-2 text-[9.5px] text-slate-400 space-y-1">
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
    </div>
  );
};
