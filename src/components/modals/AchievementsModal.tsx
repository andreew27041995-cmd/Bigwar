import React, { useState, useMemo } from 'react';
import { HeroState } from '../../types/game';
import {
  ACHIEVEMENT_CATEGORIES,
  AchievementCategoryKey,
  EvaluatedAchievement,
  evaluatePlayerAchievements
} from '../../utils/achievements';
import { CrystalIcon } from '../CurrencyIcon';

interface AchievementsModalProps {
  hero: HeroState;
  onClose: () => void;
  onClaimAchievement: (achievement: EvaluatedAchievement) => void;
  onClaimAllAchievements: (achievements: EvaluatedAchievement[]) => void;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  hero,
  onClose,
  onClaimAchievement,
  onClaimAllAchievements
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | AchievementCategoryKey>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'claimable' | 'in_progress' | 'claimed'>('all');

  const summary = useMemo(() => evaluatePlayerAchievements(hero), [hero]);

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
        // Sort order: 1. Ready to claim first, 2. In progress (by highest % completion), 3. Already claimed
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

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-slate-950/95 p-3 text-white">
      {/* Top Modal Header */}
      <div className="flex items-center justify-between border-b border-amber-500/40 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/70 bg-gradient-to-b from-amber-500/30 to-amber-950 text-sm shadow">
            🏅
          </span>
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-amber-300">
              Зал Достижений Фараона
            </div>
            <div className="text-[9px] text-slate-400">
              Выполняйте подвиги в Пирамиде и получайте кристаллы 💎
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/40 bg-red-950/60 text-sm font-bold text-red-300 hover:bg-red-900 hover:text-white active:scale-95"
        >
          ✕
        </button>
      </div>

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
    </div>
  );
};
