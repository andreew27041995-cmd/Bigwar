import React, { useState, useEffect } from 'react';
import { HeroState } from '../../types/game';
import {
  DAILY_LOGIN_REWARDS,
  computeDailyRewardStatus,
  formatCountdown,
  DailyRewardDay
} from '../../utils/dailyReward';

interface DailyRewardModalProps {
  hero: HeroState;
  currentUser: string | null;
  onClose: () => void;
  onClaimReward: (reward: DailyRewardDay) => void;
}

export const DailyRewardModal: React.FC<DailyRewardModalProps> = ({
  hero,
  currentUser,
  onClose,
  onClaimReward
}) => {
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const [isClaiming, setIsClaiming] = useState<boolean>(false);

  // Live 1-second ticker for 00:01 countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const status = computeDailyRewardStatus(
    hero.dailyLoginDay ?? 0,
    hero.dailyLoginLastDate ?? '',
    nowTs
  );

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm animate-fade-in">
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl border-2 border-amber-500/70 bg-gradient-to-b from-slate-900 via-slate-950 to-black p-4 text-white shadow-[0_0_35px_rgba(245,158,11,0.35)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-500/30 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-bounce">🎁</span>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide text-amber-400">
                Ежедневный вход
              </h2>
              <div className="text-[10.5px] text-slate-400">
                Заходите каждый день и получайте щедрые дары фараона!
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-sm font-bold text-slate-300 hover:border-amber-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Status / Reset Banner */}
        <div className="mt-3">
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
                className="shrink-0 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 px-3.5 py-1.5 text-xs font-black text-slate-950 shadow hover:from-emerald-400 hover:to-green-500 active:scale-95 animate-pulse"
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
        <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2 overflow-y-auto pr-0.5">
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
                  {isFuture && (
                    <span className="text-[9px] text-slate-500">
                      🔒
                    </span>
                  )}
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
                      className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 py-1 text-[11px] font-black text-slate-950 shadow hover:from-amber-400 hover:to-yellow-400 active:scale-95"
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
            <span className="text-red-400 font-bold shrink-0">⚠️</span>
            <span>
              <strong>Пропуск дня:</strong> если вы пропустите день, серия прерывается и награды начинаются снова с 1-го дня.
            </span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-cyan-400 font-bold shrink-0">🔄</span>
            <span>
              <strong>Обновление:</strong> каждый день в <strong>00:01</strong> по времени сервера. После забора награды 7-го дня весь список обновляется и запускается новый цикл!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
