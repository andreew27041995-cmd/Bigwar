import React, { useState, useEffect, useMemo } from 'react';
import { HeroState, GameItem } from '../../types/game';
import {
  BattlePassGlobalConfig,
  BattlePassLevelConfig,
  BattlePassRewardDef,
  BattlePassQuestTemplate,
  PlayerBattlePassState,
  SeasonTitleId,
  DEFAULT_BATTLE_PASS_XP_TO_NEXT,
  getBattlePassLevelXpRequirement,
  getBattlePassConfig,
  normalizePlayerBattlePassState,
  addBattlePassXp,
  openBattlePassChest,
  createSeasonTransportItem,
  getActiveSeasonTitle
} from '../../utils/battlePassConfig';
import { normalizePlayerFishingState } from '../../utils/fishingConfig';
import { createRelicItem } from '../../utils/shopConfig';

interface BattlePassModalProps {
  hero: HeroState;
  inventory: GameItem[];
  isAdmin?: boolean;
  featureFlags?: any;
  onClose: () => void;
  onUpdateHeroAndInventory: (
    nextHero: HeroState,
    nextInventory?: GameItem[],
    toastMsg?: string
  ) => void;
  onOpenBank?: () => void;
  onOpenAdminSeason?: () => void;
}

interface FireworkParticle {
  id: string;
  emoji: string;
  dx: number;
  dy: number;
  color: string;
}

// Прогрессивная шкала опыта из ТЗ: от 50 XP (Ур. 1) до 3 880 XP (Ур. 40)
export const BATTLE_PASS_PROGRESSIVE_XP_TABLE: Record<number, number> = {
  ...DEFAULT_BATTLE_PASS_XP_TO_NEXT
};

export const BattlePassModal: React.FC<BattlePassModalProps> = ({
  hero,
  inventory,
  isAdmin,
  featureFlags,
  onClose,
  onUpdateHeroAndInventory,
  onOpenBank,
  onOpenAdminSeason
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [activeTab, setActiveTab] = useState<'rewards' | 'quests' | 'titles'>('rewards');
  const [levelFilter, setLevelFilter] = useState<'all' | 'claimable' | 'milestones'>('all');
  const [levelUpBanner, setLevelUpBanner] = useState<{ oldLvl: number; newLvl: number } | null>(null);
  const [claimBurst, setClaimBurst] = useState<{
    key: string;
    title: string;
    icon: string;
    summary: string;
    particles: FireworkParticle[];
  } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const bpConfig: BattlePassGlobalConfig = useMemo(
    () => getBattlePassConfig(featureFlags?.battlePassConfig),
    [featureFlags?.battlePassConfig, nowMs]
  );

  // Расчет уровня и текущего опыта по прогрессивной таблице из ТЗ: 50 XP (Ур. 1) ➔ 3 880 XP (Ур. 40)
  const { bpState, xpForNext, xpProgressPct, xpProgressDisplayPct, seasonOverallPct } = useMemo(() => {
    const normalized = normalizePlayerBattlePassState(hero.battlePass, nowMs, bpConfig);
    let calcLevel = Math.max(1, Math.min(40, normalized.level));
    let calcCurrentXp = Math.max(0, normalized.currentXp);

    while (calcLevel < 40) {
      const reqForLvl = Math.max(
        1,
        getBattlePassLevelXpRequirement(calcLevel, bpConfig) ||
          BATTLE_PASS_PROGRESSIVE_XP_TABLE[calcLevel] ||
          50
      );
      if (calcCurrentXp >= reqForLvl) {
        calcCurrentXp -= reqForLvl;
        calcLevel += 1;
      } else {
        break;
      }
    }

    const reqXp =
      calcLevel >= 40
        ? BATTLE_PASS_PROGRESSIVE_XP_TABLE[40] || 3880
        : Math.max(
            1,
            getBattlePassLevelXpRequirement(calcLevel, bpConfig) ||
              BATTLE_PASS_PROGRESSIVE_XP_TABLE[calcLevel] ||
              50
          );

    const effectiveCurrentXp = calcLevel >= 40 ? reqXp : Math.min(calcCurrentXp, reqXp);
    const rawPct = calcLevel >= 40 ? 100 : (effectiveCurrentXp / reqXp) * 100;
    const clampedPct = Math.max(0, Math.min(100, Number(rawPct.toFixed(1))));
    const displayPct = Math.max(0, Math.min(100, Math.round(rawPct)));
    const overallPct = Math.max(
      2.5,
      Math.min(100, Number((((calcLevel - 1 + clampedPct / 100) / 40) * 100).toFixed(1)))
    );

    return {
      bpState: {
        ...normalized,
        level: calcLevel,
        currentXp: calcLevel >= 40 ? 0 : calcCurrentXp
      },
      xpForNext: reqXp,
      xpProgressPct: clampedPct,
      xpProgressDisplayPct: displayPct,
      seasonOverallPct: overallPct
    };
  }, [hero.battlePass, nowMs, bpConfig]);

  const activeTitle = useMemo(() => getActiveSeasonTitle(hero, nowMs), [hero, nowMs]);


  // Count ready rewards & quests
  const readyRewardsCount = useMemo(() => {
    let c = 0;
    for (let l = 1; l <= bpState.level; l++) {
      if (!bpState.claimedFreeLevels.includes(l)) c++;
      if (bpState.isVipUnlocked && !bpState.claimedVipLevels.includes(l)) c++;
    }
    return c;
  }, [bpState]);

  const readyQuestsCount = useMemo(() => {
    let c = 0;
    Object.values(bpState.dailyQuests).forEach((q) => {
      if (q.isCompleted && !q.isClaimed) c++;
    });
    Object.values(bpState.weeklyQuests).forEach((q) => {
      if (q.isCompleted && !q.isClaimed) c++;
    });
    return c;
  }, [bpState]);

  const formatSeasonRemaining = (endTs: number) => {
    const diff = Math.max(0, endTs - nowMs);
    const days = Math.floor(diff / (24 * 3600 * 1000));
    const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
    const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
    return `${days}д ${hours}ч ${mins}м`;
  };

  const triggerFireworkBurst = (key: string, title: string, icon: string, summary: string) => {
    const emojis = ['🪙', '💎', '✨', '🌟', '🎉', '🔥', icon];
    const colors = ['#facc15', '#38bdf8', '#fb7185', '#34d399', '#c084fc'];
    const particles: FireworkParticle[] = Array.from({ length: 14 }, (_, idx) => {
      const angle = (idx / 14) * Math.PI * 2;
      const dist = 36 + (idx % 3) * 20;
      return {
        id: `p_${idx}_${Date.now()}`,
        emoji: emojis[idx % emojis.length],
        dx: Math.round(Math.cos(angle) * dist),
        dy: Math.round(Math.sin(angle) * dist),
        color: colors[idx % colors.length]
      };
    });
    setClaimBurst({ key, title, icon, summary, particles });
    setTimeout(() => {
      setClaimBurst((prev) => (prev?.key === key ? null : prev));
    }, 2400);
  };

  const applyRewardToHero = (
    reward: BattlePassRewardDef,
    baseHero: HeroState,
    baseInv: GameItem[],
    baseBp: PlayerBattlePassState
  ): {
    nextHero: HeroState;
    nextInv: GameItem[];
    nextBp: PlayerBattlePassState;
    summaryParts: string[];
  } => {
    let nextGold = Number(baseHero.gold || 0);
    let nextCrystals = Number(baseHero.crystals || 0);
    let nextEnergy = Number(baseHero.energy || 0);
    let nextHpPotions = Number(baseHero.hpPotions || 0);
    let nextEnPotions = Number(baseHero.enPotions || 0);
    let nextIsPremium = Boolean(baseHero.isPremium);
    let nextPremiumUntil = Number(baseHero.premiumUntil || 0);
    let nextFishing = normalizePlayerFishingState(baseHero.fishingState);
    const nextInv = [...baseInv];
    let nextBp = { ...baseBp };
    const summaryParts: string[] = [];

    if (reward.gold && reward.gold > 0) {
      nextGold += reward.gold;
      summaryParts.push(`+${reward.gold.toLocaleString('ru-RU')} 🪙`);
    }
    if (reward.crystals && reward.crystals > 0) {
      nextCrystals += reward.crystals;
      summaryParts.push(`+${reward.crystals} 💎`);
    }
    if (reward.energy && reward.energy > 0) {
      nextEnergy += reward.energy;
      summaryParts.push(`+${reward.energy} ⚡`);
    }
    if (reward.vipDays && reward.vipDays > 0) {
      const addMs = reward.vipDays * 24 * 60 * 60 * 1000;
      const baseTs = nextPremiumUntil > nowMs ? nextPremiumUntil : nowMs;
      nextIsPremium = true;
      nextPremiumUntil = baseTs + addMs;
      summaryParts.push(`VIP +${reward.vipDays} дн. 👑`);
    }
    if (reward.baitId && reward.baitCount && reward.baitCount > 0) {
      const nextBaits = { ...(nextFishing.baitsInventory || {}) };
      nextBaits[reward.baitId] = (nextBaits[reward.baitId] || 0) + reward.baitCount;
      nextFishing = {
        ...nextFishing,
        baitsInventory: nextBaits,
        equippedBaitId: nextFishing.equippedBaitId || reward.baitId
      };
      summaryParts.push(`+${reward.baitCount}x ${reward.baitName || 'Наживка'}`);
    }
    if (reward.keepnetLevels && reward.keepnetLevels > 0) {
      const nextKeepnetLvl = Math.min(5, (nextFishing.keepnetLevel || 1) + reward.keepnetLevels);
      nextFishing = {
        ...nextFishing,
        keepnetLevel: nextKeepnetLvl
      };
      summaryParts.push(`Садок Ур.${nextKeepnetLvl} 🪣`);
    }
    if (reward.relicsCount && reward.relicsCount > 0) {
      const tier = Math.max(1, Math.min(3, Number(baseHero.homePyramidTier || baseHero.pyramidTier || 1)));
      for (let i = 0; i < reward.relicsCount; i++) {
        nextInv.push(createRelicItem(tier));
      }
      summaryParts.push(`+${reward.relicsCount} 🏺 Реликвий`);
    }
    if (reward.transportId) {
      const transportItem = createSeasonTransportItem(
        reward.transportId,
        reward.transportName,
        reward.transportDurability
      );
      nextInv.push(transportItem);
      summaryParts.push(`Транспорт «${transportItem.name}» (${transportItem.durability}/${transportItem.maxDurability})`);
    }
    if (reward.chestType && (reward.chestCount || 1) > 0) {
      const chestRes = openBattlePassChest(reward.chestType, reward.chestCount || 1, baseHero.level || 1);
      nextGold += chestRes.gold;
      nextCrystals += chestRes.crystals;
      nextEnergy += chestRes.energy;
      nextHpPotions += chestRes.hpPotions;
      nextEnPotions += chestRes.enPotions;
      if (chestRes.items.length > 0) {
        nextInv.push(...chestRes.items);
      }
      summaryParts.push(chestRes.summaryText);
    }
    if (reward.seasonTitleId && reward.seasonTitleDays) {
      const durationMs = reward.seasonTitleDays * 24 * 60 * 60 * 1000;
      const expiresAt = nowMs + durationMs;
      const titleName =
        reward.seasonTitleName ||
        (reward.seasonTitleId === 'season_pharaoh' ? 'Фараон Сезона' : 'Исследователь Песков');
      const bonusPct =
        reward.seasonTitleStatBonusPct ||
        (reward.seasonTitleId === 'season_pharaoh' ? 25 : 15);

      const prevOwned = Array.isArray(nextBp.ownedTitles)
        ? nextBp.ownedTitles.filter((t) => t.id !== reward.seasonTitleId)
        : [];
      const nextOwned = [
        ...prevOwned,
        {
          id: reward.seasonTitleId,
          name: titleName,
          expiresAt,
          bonusPct
        }
      ];

      nextBp = {
        ...nextBp,
        activeTitleId: reward.seasonTitleId,
        activeTitleName: titleName,
        activeTitleUntil: expiresAt,
        activeTitleBonusPct: bonusPct,
        ownedTitles: nextOwned
      };
      summaryParts.push(`Титул «${titleName}» (+${bonusPct}% ко всем статам на ${reward.seasonTitleDays} дн.)!`);
    }

    const nextHero: HeroState = {
      ...baseHero,
      gold: nextGold,
      crystals: nextCrystals,
      energy: nextEnergy,
      hpPotions: nextHpPotions,
      enPotions: nextEnPotions,
      isPremium: nextIsPremium,
      premiumUntil: nextPremiumUntil,
      vipUntil: nextPremiumUntil,
      fishingState: nextFishing,
      battlePass: nextBp,
      seasonTitleId: nextBp.activeTitleId || null,
      seasonTitleName: nextBp.activeTitleName || null,
      seasonTitleUntil: nextBp.activeTitleUntil || 0,
      seasonTitleBonusPct: nextBp.activeTitleBonusPct || 0
    };

    return { nextHero, nextInv, nextBp, summaryParts };
  };

  const handleClaimSingleReward = (lvlCfg: BattlePassLevelConfig, track: 'free' | 'vip') => {
    if (bpState.level < lvlCfg.level) return;
    if (track === 'free' && bpState.claimedFreeLevels.includes(lvlCfg.level)) return;
    if (track === 'vip') {
      if (!bpState.isVipUnlocked) return;
      if (bpState.claimedVipLevels.includes(lvlCfg.level)) return;
    }

    const reward = track === 'free' ? lvlCfg.freeReward : lvlCfg.vipReward;
    const updatedBp: PlayerBattlePassState = {
      ...bpState,
      claimedFreeLevels:
        track === 'free' ? [...bpState.claimedFreeLevels, lvlCfg.level] : bpState.claimedFreeLevels,
      claimedVipLevels:
        track === 'vip' ? [...bpState.claimedVipLevels, lvlCfg.level] : bpState.claimedVipLevels
    };

    const { nextHero, nextInv, summaryParts } = applyRewardToHero(reward, hero, inventory, updatedBp);
    const summary = summaryParts.join(' • ') || reward.title;

    triggerFireworkBurst(`${track}_${lvlCfg.level}`, reward.title, reward.icon || '🎁', summary);
    onUpdateHeroAndInventory(
      nextHero,
      nextInv,
      `🎉 Награда ${lvlCfg.level} ур. (${track === 'vip' ? 'VIP' : 'Free'}) получена: ${summary}`
    );
  };

  const handleClaimAllAvailableRewards = () => {
    let curHero = { ...hero };
    let curInv = [...inventory];
    let curBp = { ...bpState };
    let claimedCount = 0;
    const allSummaries: string[] = [];

    for (let l = 1; l <= curBp.level; l++) {
      const lvlCfg = bpConfig.levels.find((item) => item.level === l);
      if (!lvlCfg) continue;

      if (!curBp.claimedFreeLevels.includes(l)) {
        curBp = {
          ...curBp,
          claimedFreeLevels: [...curBp.claimedFreeLevels, l]
        };
        const res = applyRewardToHero(lvlCfg.freeReward, curHero, curInv, curBp);
        curHero = res.nextHero;
        curInv = res.nextInv;
        curBp = res.nextBp;
        allSummaries.push(...res.summaryParts);
        claimedCount++;
      }

      if (curBp.isVipUnlocked && !curBp.claimedVipLevels.includes(l)) {
        curBp = {
          ...curBp,
          claimedVipLevels: [...curBp.claimedVipLevels, l]
        };
        const res = applyRewardToHero(lvlCfg.vipReward, curHero, curInv, curBp);
        curHero = res.nextHero;
        curInv = res.nextInv;
        curBp = res.nextBp;
        allSummaries.push(...res.summaryParts);
        claimedCount++;
      }
    }

    if (claimedCount === 0) return;

    triggerFireworkBurst(
      `all_${Date.now()}`,
      `Собрано наград: ${claimedCount} шт.!`,
      '🎊',
      allSummaries.slice(0, 4).join(' • ')
    );
    onUpdateHeroAndInventory(
      curHero,
      curInv,
      `🎊 Вы забрали все доступные награды Сезона (${claimedCount} шт.)!`
    );
  };

  const handleUnlockVipPass = () => {
    if (bpState.isVipUnlocked) return;
    const cost = Math.max(1, Number(bpConfig.vipUnlockCostCrystals || 2000));
    if ((hero.crystals || 0) < cost) {
      onUpdateHeroAndInventory(
        hero,
        undefined,
        `❌ Недостаточно кристаллов для покупки Сезона (VIP)! Стоимость: ${cost.toLocaleString('ru-RU')} 💎 (у вас ${(hero.crystals || 0).toLocaleString('ru-RU')} 💎).`
      );
      if (onOpenBank) {
        onOpenBank();
      }
      return;
    }

    const nextBp: PlayerBattlePassState = {
      ...bpState,
      isVipUnlocked: true,
      vipUnlockedAt: nowMs
    };

    const nextHero: HeroState = {
      ...hero,
      crystals: Math.max(0, (hero.crystals || 0) - cost),
      battlePass: nextBp
    };

    triggerFireworkBurst(
      'vip_unlock',
      'Премиум Пропуск (VIP) активирован!',
      '👑',
      `Списано ${cost.toLocaleString('ru-RU')} 💎 • Открыты все золотые награды 1–40 уровня!`
    );
    onUpdateHeroAndInventory(
      nextHero,
      undefined,
      `👑 Поздравляем! Вы купили Премиум Сезон (VIP) за ${cost.toLocaleString('ru-RU')} 💎!`
    );
  };

  const handleClaimQuestXp = (tpl: BattlePassQuestTemplate) => {
    const isDaily = tpl.category === 'daily';
    const progressMap = isDaily ? bpState.dailyQuests : bpState.weeklyQuests;
    const qState = progressMap[tpl.id];
    if (!qState || !qState.isCompleted || qState.isClaimed) return;

    const updatedMap = {
      ...progressMap,
      [tpl.id]: {
        ...qState,
        isClaimed: true
      }
    };

    const baseBp: PlayerBattlePassState = {
      ...bpState,
      dailyQuests: isDaily ? updatedMap : bpState.dailyQuests,
      weeklyQuests: !isDaily ? updatedMap : bpState.weeklyQuests
    };

    const xpRes = addBattlePassXp(baseBp, tpl.xpReward, nowMs, bpConfig);
    if (xpRes.leveledUp) {
      setLevelUpBanner({ oldLvl: xpRes.oldLevel, newLvl: xpRes.newLevel });
      setTimeout(() => setLevelUpBanner(null), 4000);
    }

    triggerFireworkBurst(
      `quest_${tpl.id}`,
      `${tpl.title}: +${tpl.xpReward} XP`,
      '✨',
      xpRes.leveledUp
        ? `Уровень Сезона повышен: ${xpRes.oldLevel} ➔ ${xpRes.newLevel}!`
        : `+${tpl.xpReward} Сезонного опыта`
    );

    const nextHero: HeroState = {
      ...hero,
      battlePass: xpRes.nextState
    };

    onUpdateHeroAndInventory(
      nextHero,
      undefined,
      xpRes.leveledUp
        ? `🌟 Задание выполнено (+${tpl.xpReward} XP)! Ваш уровень Боевого Пропуска вырос до ${xpRes.newLevel}!`
        : `✨ Получено +${tpl.xpReward} XP Боевого Пропуска за задание «${tpl.title}»!`
    );
  };

  const handleSelectActiveTitle = (titleId: SeasonTitleId | null) => {
    if (!titleId) {
      const nextBp: PlayerBattlePassState = {
        ...bpState,
        activeTitleId: null,
        activeTitleName: null,
        activeTitleUntil: 0,
        activeTitleBonusPct: 0
      };
      onUpdateHeroAndInventory(
        {
          ...hero,
          battlePass: nextBp,
          seasonTitleId: null,
          seasonTitleName: null,
          seasonTitleUntil: 0,
          seasonTitleBonusPct: 0
        },
        undefined,
        'Сезонный титул снят.'
      );
      return;
    }

    const found = (bpState.ownedTitles || []).find((t) => t.id === titleId && t.expiresAt > nowMs);
    if (!found) return;

    const nextBp: PlayerBattlePassState = {
      ...bpState,
      activeTitleId: found.id,
      activeTitleName: found.name,
      activeTitleUntil: found.expiresAt,
      activeTitleBonusPct: found.bonusPct
    };

    onUpdateHeroAndInventory(
      {
        ...hero,
        battlePass: nextBp,
        seasonTitleId: found.id,
        seasonTitleName: found.name,
        seasonTitleUntil: found.expiresAt,
        seasonTitleBonusPct: found.bonusPct
      },
      undefined,
      `👑 Активирован титул «${found.name}» (+${found.bonusPct}% ко всем статам)!`
    );
  };

  const filteredLevels = useMemo(() => {
    return bpConfig.levels.filter((lvlCfg) => {
      if (levelFilter === 'claimable') {
        const freeReady = bpState.level >= lvlCfg.level && !bpState.claimedFreeLevels.includes(lvlCfg.level);
        const vipReady =
          bpState.isVipUnlocked &&
          bpState.level >= lvlCfg.level &&
          !bpState.claimedVipLevels.includes(lvlCfg.level);
        return freeReady || vipReady;
      }
      if (levelFilter === 'milestones') {
        return [1, 5, 10, 15, 20, 25, 30, 35, 40].includes(lvlCfg.level);
      }
      return true;
    });
  }, [bpConfig.levels, levelFilter, bpState]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-3 backdrop-blur-sm">
      <div className="relative flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-amber-500/80 bg-gradient-to-b from-[#1a0f2e] via-slate-950 to-black text-white shadow-[0_0_40px_rgba(245,158,11,0.35)]">
        {/* Level-Up Flash & Glow Overlay */}
        {levelUpBanner && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-amber-500/20 backdrop-blur-[2px] animate-pulse">
            <div className="rounded-2xl border-2 border-yellow-300 bg-gradient-to-r from-amber-950 via-yellow-900 to-amber-950 px-6 py-4 text-center shadow-[0_0_50px_#facc15]">
              <div className="text-3xl mb-1">🌟🏆🌟</div>
              <div className="text-sm sm:text-base font-black uppercase tracking-wider text-yellow-300">
                Новый уровень Сезона!
              </div>
              <div className="mt-1 text-lg sm:text-xl font-black text-white">
                Уровень {levelUpBanner.oldLvl} ➔ Уровень {levelUpBanner.newLvl}
              </div>
              <div className="mt-1 text-[10px] font-bold text-amber-200">
                Новые награды Боевого Пропуска разблокированы!
              </div>
            </div>
          </div>
        )}

        {/* Floating Reward Fireworks Burst Overlay */}
        {claimBurst && (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
            <div className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-amber-300 bg-slate-950/95 px-5 py-3.5 text-center shadow-[0_0_40px_rgba(250,204,21,0.65)]">
              {/* Particle salute */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible">
                {claimBurst.particles.map((p) => (
                  <span
                    key={p.id}
                    className="absolute text-base animate-ping"
                    style={{
                      transform: `translate(${p.dx}px, ${p.dy}px)`,
                      color: p.color
                    }}
                  >
                    {p.emoji}
                  </span>
                ))}
              </div>
              <div className="text-3xl animate-bounce">{claimBurst.icon}</div>
              <div className="mt-1 text-xs sm:text-sm font-black text-amber-300">
                🎉 Награда получена!
              </div>
              <div className="text-[11px] font-bold text-white mt-0.5">{claimBurst.title}</div>
              <div className="text-[9.5px] font-semibold text-emerald-300 mt-0.5">
                {claimBurst.summary}
              </div>
            </div>
          </div>
        )}

        {/* Top Header */}
        <div className="border-b border-amber-500/35 bg-gradient-to-r from-amber-950/70 via-purple-950/60 to-slate-950 p-3 shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-amber-400 bg-gradient-to-b from-amber-500/30 to-purple-950 text-xl shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                🏆
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h2 className="text-sm sm:text-base font-black tracking-wide text-amber-300 truncate">
                    {bpConfig.seasonTitle}
                  </h2>
                  <span className="rounded-md bg-amber-500/20 border border-amber-400/60 px-1.5 py-0.5 text-[9px] font-black text-amber-200">
                    ⏳ {formatSeasonRemaining(bpConfig.seasonEndTimestamp)}
                  </span>
                </div>
                <p className="text-[9.5px] text-slate-300 truncate mt-0.5">
                  {bpConfig.seasonSubtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isAdmin && onOpenAdminSeason && (
                <button
                  type="button"
                  onClick={onOpenAdminSeason}
                  className="flex items-center gap-1 rounded-lg border border-red-400/80 bg-gradient-to-r from-red-950 via-red-900 to-amber-950 px-2.5 py-1.5 text-[10px] font-black text-amber-200 shadow hover:border-amber-300 cursor-pointer"
                  title="Открыть редактирование Сезона в Админ-панели"
                >
                  <span>🛠️</span>
                  <span>Редактор Сезона</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-sm font-bold text-slate-300 hover:border-amber-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Current Level & XP Bar + VIP Unlock Banner */}
          <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-[1.35fr_1fr] gap-2 items-center rounded-xl border border-amber-500/40 bg-slate-950/90 p-2.5">
            <div>
              <div className="flex items-center justify-between text-[10.5px] font-black mb-1">
                <span className="flex items-center gap-1.5 text-amber-300">
                  <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[9.5px] font-black text-slate-950 shadow">
                    Ур. {bpState.level} / 40
                  </span>
                  <span>Сезонный Пропуск</span>
                </span>
                <span className="font-mono text-cyan-300 tabular-nums">
                  {bpState.level >= 40
                    ? `МАКС. УРОВЕНЬ (${xpForNext.toLocaleString('ru-RU')} / ${xpForNext.toLocaleString('ru-RU')} XP • 100%)`
                    : `${bpState.currentXp.toLocaleString('ru-RU')} / ${xpForNext.toLocaleString('ru-RU')} XP (${xpProgressDisplayPct}%)`}
                </span>
              </div>
              {/* Полоска прогресса текущего уровня (масштабируется от 50 XP на Ур.1 до 3 880 XP на Ур.40) */}
              <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-slate-900 border border-amber-500/60 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-cyan-400 transition-all duration-500 shadow-[0_0_10px_rgba(250,204,21,0.6)]"
                  style={{
                    width: `${bpState.level >= 40 ? 100 : xpProgressPct > 0 ? Math.max(3, xpProgressPct) : 0}%`
                  }}
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  {bpState.level >= 40
                    ? '40 / 40 УР. ЗАВЕРШЕНО (100%)'
                    : `До Ур. ${bpState.level + 1}: осталось ${Math.max(0, xpForNext - bpState.currentXp).toLocaleString('ru-RU')} XP`}
                </div>
              </div>
              {/* Общая шкала сезона 1..40 */}
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[8px] font-bold text-amber-300/90 shrink-0">
                  Шкала 1–40 (50 ➔ 3 880 XP):
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 via-amber-400 to-emerald-400 transition-all duration-500"
                    style={{ width: `${seasonOverallPct}%` }}
                  />
                </div>
                <span className="text-[8px] font-mono font-bold text-amber-300 shrink-0">
                  {seasonOverallPct}%
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[8.5px] text-slate-400">
                <span>Всего опыта за сезон: {bpState.totalXpEarned.toLocaleString('ru-RU')} XP</span>
                {activeTitle ? (
                  <span className="text-emerald-300 font-bold">
                    👑 Титул: «{activeTitle.name}» (+{activeTitle.bonusPct}% статы)
                  </span>
                ) : (
                  <span>Шкала опыта ТЗ: 50 XP (Ур.1) ➔ 3 880 XP (Ур.40)</span>
                )}
              </div>
            </div>

            {/* VIP Pass Status / Unlock Button */}
            <div className="flex flex-col items-stretch justify-center">
              {bpState.isVipUnlocked ? (
                <div className="rounded-xl border border-yellow-400/80 bg-gradient-to-r from-yellow-950/90 via-amber-900/70 to-yellow-950/90 px-3 py-2 text-center shadow-[0_0_15px_rgba(250,204,21,0.3)]">
                  <div className="text-[10.5px] font-black text-yellow-300 flex items-center justify-center gap-1">
                    <span>👑</span>
                    <span>ПРЕМИУМ ПРОПУСК АКТИВЕН</span>
                  </div>
                  <div className="text-[8.5px] text-amber-200 mt-0.5">
                    Вам доступны обе линии наград (Free + VIP)!
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleUnlockVipPass}
                  className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-yellow-400 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-3 py-2 text-slate-950 shadow-[0_0_20px_rgba(250,204,21,0.5)] hover:brightness-110 active:scale-95 cursor-pointer"
                >
                  <div className="text-[10.5px] font-black uppercase tracking-wide flex items-center gap-1">
                    <span>👑 Купить Сезон (VIP)</span>
                    <span className="rounded bg-slate-950 px-1.5 py-0.5 text-[9.5px] font-black text-cyan-300">
                      {(bpConfig.vipUnlockCostCrystals || 2000).toLocaleString('ru-RU')} 💎
                    </span>
                  </div>
                  <div className="text-[8px] font-extrabold text-slate-900 mt-0.5">
                    Катер «Скарабей», Вертолет «Апач», VIP-дни и титул «Фараон Сезона» (+25%)!
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('rewards')}
              className={`relative flex items-center justify-center gap-1 rounded-xl py-1.5 px-2 text-[10.5px] font-black transition-all cursor-pointer ${
                activeTab === 'rewards'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow'
                  : 'border border-slate-800 bg-slate-900/90 text-slate-300 hover:text-white'
              }`}
            >
              <span>🎁</span>
              <span>Шкала наград (1–40)</span>
              {readyRewardsCount > 0 && (
                <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[8.5px] font-black text-white ring-1 ring-slate-950 animate-pulse">
                  {readyRewardsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('quests')}
              className={`relative flex items-center justify-center gap-1 rounded-xl py-1.5 px-2 text-[10.5px] font-black transition-all cursor-pointer ${
                activeTab === 'quests'
                  ? 'bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 shadow'
                  : 'border border-slate-800 bg-slate-900/90 text-slate-300 hover:text-white'
              }`}
            >
              <span>📜</span>
              <span>Задания (+XP)</span>
              {readyQuestsCount > 0 && (
                <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[8.5px] font-black text-white ring-1 ring-slate-950 animate-pulse">
                  {readyQuestsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('titles')}
              className={`relative flex items-center justify-center gap-1 rounded-xl py-1.5 px-2 text-[10.5px] font-black transition-all cursor-pointer ${
                activeTab === 'titles'
                  ? 'bg-gradient-to-r from-purple-500 to-rose-500 text-white shadow'
                  : 'border border-slate-800 bg-slate-900/90 text-slate-300 hover:text-white'
              }`}
            >
              <span>👑</span>
              <span>Титулы и Гранд-призы</span>
            </button>
          </div>
        </div>

        {/* =====================================================================
            TAB 1: REWARDS TRACK (FREE + VIP PARALLEL LINES FOR LEVELS 1..40)
        ===================================================================== */}
        {activeTab === 'rewards' && (
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-3">
            {/* Filter & Claim All Bar */}
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1">
                {[
                  { id: 'all' as const, label: 'Все уровни (1–40)' },
                  { id: 'claimable' as const, label: `Доступные (${readyRewardsCount})` },
                  { id: 'milestones' as const, label: '⭐ Ключевые (5/10/15/30/40)' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLevelFilter(f.id)}
                    className={`rounded-lg border px-2 py-1 text-[9.5px] font-black transition-all cursor-pointer ${
                      levelFilter === f.id
                        ? 'border-amber-400 bg-amber-500 text-slate-950'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {readyRewardsCount > 0 && (
                <button
                  type="button"
                  onClick={handleClaimAllAvailableRewards}
                  className="rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-500 to-cyan-400 px-3 py-1 text-[10px] font-black text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)] hover:brightness-110 active:scale-95 cursor-pointer animate-pulse"
                >
                  🎊 Забрать все ({readyRewardsCount})
                </button>
              )}
            </div>

            {/* Parallel Column Headers */}
            <div className="mb-1.5 grid grid-cols-[54px_1fr_1fr] gap-2 px-1 text-[9.5px] font-black uppercase tracking-wider shrink-0">
              <div className="text-center text-slate-400">Уровень</div>
              <div className="rounded-lg border border-sky-500/40 bg-sky-950/50 py-1 px-2 text-center text-sky-300">
                🛡️ Бесплатная линия (Free)
              </div>
              <div className="rounded-lg border border-amber-400/60 bg-gradient-to-r from-amber-950/80 via-yellow-900/50 to-amber-950/80 py-1 px-2 text-center text-yellow-300">
                👑 Премиум линия (VIP)
              </div>
            </div>

            {/* Scrollable 40 Levels Track */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredLevels.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center text-xs text-slate-400">
                  <span>Нет наград, подходящих под выбранный фильтр.</span>
                </div>
              ) : (
                filteredLevels.map((lvlCfg) => {
                  const isUnlocked = bpState.level >= lvlCfg.level;
                  const isCurrent = bpState.level === lvlCfg.level;
                  const isMilestone = [1, 5, 10, 15, 20, 30, 40].includes(lvlCfg.level);

                  const freeClaimed = bpState.claimedFreeLevels.includes(lvlCfg.level);
                  const freeCanClaim = isUnlocked && !freeClaimed;

                  const vipClaimed = bpState.claimedVipLevels.includes(lvlCfg.level);
                  const vipCanClaim = isUnlocked && bpState.isVipUnlocked && !vipClaimed;

                  return (
                    <div
                      key={lvlCfg.level}
                      className={`grid grid-cols-[54px_1fr_1fr] gap-2 items-stretch rounded-xl border p-2 transition-all ${
                        isMilestone
                          ? 'border-amber-400/70 bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                          : isCurrent
                          ? 'border-cyan-400/70 bg-slate-900/95'
                          : isUnlocked
                          ? 'border-emerald-500/35 bg-slate-900/75'
                          : 'border-slate-800/80 bg-slate-950/75 opacity-85'
                      }`}
                    >
                      {/* Level Number Column */}
                      <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-950 p-1 text-center">
                        <span
                          className={`text-xs font-black ${
                            isMilestone
                              ? 'text-yellow-300'
                              : isUnlocked
                              ? 'text-emerald-300'
                              : 'text-slate-400'
                          }`}
                        >
                          Ур.{lvlCfg.level}
                        </span>
                        <span className="text-[7.5px] font-mono text-cyan-300/90 mt-0.5">
                          {(lvlCfg.xpRequiredForNext || BATTLE_PASS_PROGRESSIVE_XP_TABLE[lvlCfg.level] || 50).toLocaleString('ru-RU')} XP
                        </span>
                        {lvlCfg.level === 40 && (
                          <span className="rounded bg-red-600/30 border border-red-400/50 px-1 text-[6.5px] font-black text-red-200 mt-0.5">
                            ФИНАЛ
                          </span>
                        )}
                        {isCurrent && lvlCfg.level < 40 && (
                          <div className="mt-1 w-full px-0.5">
                            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full bg-cyan-400 transition-all duration-300"
                                style={{ width: `${xpProgressPct}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {isUnlocked && (
                          <span className="mt-0.5 text-[9px] text-emerald-400" title="Уровень достигнут">
                            ✓
                          </span>
                        )}
                      </div>

                      {/* FREE REWARD CARD */}
                      <div
                        className={`flex flex-col justify-between rounded-xl border p-2 transition-all ${
                          freeCanClaim
                            ? 'border-sky-400 bg-gradient-to-b from-sky-950/80 to-slate-900 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                            : freeClaimed
                            ? 'border-slate-800 bg-slate-950/60 opacity-70'
                            : 'border-slate-800 bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/40 bg-slate-950 text-base">
                            {lvlCfg.freeReward.icon || '🎁'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-black text-sky-200 leading-tight">
                              {lvlCfg.freeReward.title}
                            </div>
                            <div className="text-[8.5px] text-slate-400 leading-snug mt-0.5">
                              {lvlCfg.freeReward.description}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2">
                          {freeClaimed ? (
                            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 py-1 text-center text-[8.5px] font-black text-emerald-400">
                              ✓ Забрано
                            </div>
                          ) : freeCanClaim ? (
                            <button
                              type="button"
                              onClick={() => handleClaimSingleReward(lvlCfg, 'free')}
                              className="w-full rounded-lg border border-sky-300 bg-gradient-to-r from-sky-500 to-cyan-400 py-1 text-[9.5px] font-black text-slate-950 shadow hover:brightness-110 active:scale-95 cursor-pointer animate-pulse"
                            >
                              🎁 Забрать
                            </button>
                          ) : (
                            <div className="rounded-lg border border-slate-800 bg-slate-950/70 py-1 text-center text-[8.5px] font-bold text-slate-500">
                              🔒 Требуется Ур. {lvlCfg.level}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* VIP REWARD CARD */}
                      <div
                        className={`flex flex-col justify-between rounded-xl border p-2 transition-all ${
                          vipCanClaim
                            ? 'border-yellow-400 bg-gradient-to-b from-amber-950/90 via-yellow-950/50 to-slate-900 shadow-[0_0_15px_rgba(250,204,21,0.35)]'
                            : vipClaimed
                            ? 'border-slate-800 bg-slate-950/60 opacity-70'
                            : 'border-amber-500/40 bg-gradient-to-b from-amber-950/35 to-slate-950/80'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/60 bg-amber-950/80 text-base shadow-inner">
                            {lvlCfg.vipReward.icon || '👑'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-black text-yellow-300 leading-tight">
                              {lvlCfg.vipReward.title}
                            </div>
                            <div className="text-[8.5px] text-amber-100/80 leading-snug mt-0.5">
                              {lvlCfg.vipReward.description}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2">
                          {vipClaimed ? (
                            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 py-1 text-center text-[8.5px] font-black text-emerald-400">
                              ✓ Забрано (VIP)
                            </div>
                          ) : vipCanClaim ? (
                            <button
                              type="button"
                              onClick={() => handleClaimSingleReward(lvlCfg, 'vip')}
                              className="w-full rounded-lg border border-yellow-300 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 py-1 text-[9.5px] font-black text-slate-950 shadow-[0_0_12px_rgba(250,204,21,0.5)] hover:brightness-110 active:scale-95 cursor-pointer animate-pulse"
                            >
                              👑 Забрать VIP
                            </button>
                          ) : !bpState.isVipUnlocked ? (
                            <button
                              type="button"
                              onClick={handleUnlockVipPass}
                              className="w-full rounded-lg border border-amber-500/50 bg-amber-950/70 py-1 text-center text-[8.5px] font-black text-amber-300 hover:bg-amber-900/80 cursor-pointer"
                            >
                              🔒 Купить VIP ({(bpConfig.vipUnlockCostCrystals || 2000).toLocaleString('ru-RU')} 💎)
                            </button>
                          ) : (
                            <div className="rounded-lg border border-slate-800 bg-slate-950/70 py-1 text-center text-[8.5px] font-bold text-slate-500">
                              🔒 Требуется Ур. {lvlCfg.level}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 2: DAILY & WEEKLY BATTLE PASS QUESTS (+XP)
        ===================================================================== */}
        {activeTab === 'quests' && (
          <div className="flex flex-1 min-h-0 flex-col overflow-y-auto p-3 space-y-3">
            <div className="rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/60 via-slate-900 to-purple-950/50 p-2.5 text-[10px] text-slate-200">
              <div className="font-black text-cyan-300 text-xs mb-0.5">
                ⚡ Как начисляется опыт Боевого Пропуска (XP)?
              </div>
              <div>
                Выполняйте ежедневные и еженедельные задания ниже, а также активно играйте: за шаги в Пирамиде, улов на Рыбалке, игры в Рулетке, рейсы в Порт и клановые битвы вы получаете сезонный опыт!
              </div>
            </div>

            {/* A. Daily Quests */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                  ☀️ А. Ежедневные задания (обновляются каждый день)
                </span>
                <span className="text-[9.5px] font-bold text-slate-400">
                  День: {bpState.dailyDayKey}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {bpConfig.dailyQuests.map((tpl) => {
                  const progState = bpState.dailyQuests[tpl.id] || {
                    id: tpl.id,
                    progress: 0,
                    isCompleted: false,
                    isClaimed: false
                  };
                  const pct = Math.min(100, Math.round((progState.progress / Math.max(1, tpl.target)) * 100));
                  const canClaim = progState.isCompleted && !progState.isClaimed;

                  return (
                    <div
                      key={tpl.id}
                      className={`flex flex-col justify-between rounded-xl border p-2.5 transition-all ${
                        canClaim
                          ? 'border-cyan-400 bg-gradient-to-b from-cyan-950/80 to-slate-900 shadow-[0_0_15px_rgba(34,211,238,0.25)]'
                          : progState.isClaimed
                          ? 'border-slate-800 bg-slate-950/60 opacity-70'
                          : 'border-slate-800 bg-slate-900/80'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-slate-950 text-base">
                              {tpl.icon}
                            </span>
                            <div>
                              <div className="text-xs font-black text-white">{tpl.title}</div>
                              <div className="text-[9.5px] text-slate-300">{tpl.description}</div>
                            </div>
                          </div>
                          <span className="shrink-0 rounded-lg bg-cyan-950 border border-cyan-400/50 px-2 py-0.5 text-[9.5px] font-black text-cyan-300">
                            +{tpl.xpReward} XP
                          </span>
                        </div>

                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mb-1">
                            <span>Прогресс:</span>
                            <span className="font-mono text-amber-300">
                              {progState.progress} / {tpl.target} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-cyan-400 transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5">
                        {progState.isClaimed ? (
                          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 py-1 text-center text-[9px] font-black text-emerald-400">
                            ✓ Опыт получен (+{tpl.xpReward} XP)
                          </div>
                        ) : canClaim ? (
                          <button
                            type="button"
                            onClick={() => handleClaimQuestXp(tpl)}
                            className="w-full rounded-lg border border-cyan-300 bg-gradient-to-r from-cyan-400 to-emerald-400 py-1.5 text-[10px] font-black text-slate-950 shadow hover:brightness-110 active:scale-95 cursor-pointer animate-pulse"
                          >
                            ✨ Забрать +{tpl.xpReward} XP
                          </button>
                        ) : (
                          <div className="rounded-lg border border-slate-800 bg-slate-950/70 py-1 text-center text-[9px] font-bold text-slate-500">
                            Выполняется в игре...
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* B. Weekly Quests */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                <span className="text-xs font-black uppercase tracking-wider text-purple-300">
                  🗓️ Б. Еженедельные задания (обновляются раз в неделю)
                </span>
                <span className="text-[9.5px] font-bold text-slate-400">
                  Неделя: {bpState.weeklyWeekKey}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {bpConfig.weeklyQuests.map((tpl) => {
                  const progState = bpState.weeklyQuests[tpl.id] || {
                    id: tpl.id,
                    progress: 0,
                    isCompleted: false,
                    isClaimed: false
                  };
                  const pct = Math.min(100, Math.round((progState.progress / Math.max(1, tpl.target)) * 100));
                  const canClaim = progState.isCompleted && !progState.isClaimed;

                  return (
                    <div
                      key={tpl.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border p-2.5 transition-all ${
                        canClaim
                          ? 'border-purple-400 bg-gradient-to-r from-purple-950/80 via-slate-900 to-amber-950/50 shadow-[0_0_15px_rgba(192,132,252,0.3)]'
                          : progState.isClaimed
                          ? 'border-slate-800 bg-slate-950/60 opacity-70'
                          : 'border-purple-500/30 bg-slate-900/85'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-purple-500/40 bg-slate-950 text-lg">
                            {tpl.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-black text-white">{tpl.title}</span>
                              <span className="rounded bg-purple-950 border border-purple-400/50 px-2 py-0.5 text-[9.5px] font-black text-purple-200">
                                +{tpl.xpReward} XP
                              </span>
                            </div>
                            <div className="text-[9.5px] text-slate-300 mt-0.5">{tpl.description}</div>
                          </div>
                        </div>

                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mb-1">
                            <span>Прогресс недели:</span>
                            <span className="font-mono text-purple-300">
                              {progState.progress} / {tpl.target} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-400 to-amber-400 transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="sm:w-40 shrink-0">
                        {progState.isClaimed ? (
                          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 py-2 text-center text-[9px] font-black text-emerald-400">
                            ✓ Получено (+{tpl.xpReward} XP)
                          </div>
                        ) : canClaim ? (
                          <button
                            type="button"
                            onClick={() => handleClaimQuestXp(tpl)}
                            className="w-full rounded-lg border border-purple-300 bg-gradient-to-r from-purple-500 to-amber-400 py-2 text-[10px] font-black text-slate-950 shadow hover:brightness-110 active:scale-95 cursor-pointer animate-pulse"
                          >
                            ✨ Забрать +{tpl.xpReward} XP
                          </button>
                        ) : (
                          <div className="rounded-lg border border-slate-800 bg-slate-950/70 py-2 text-center text-[9px] font-bold text-slate-500">
                            В процессе ({progState.progress}/{tpl.target})
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 3: SEASON TITLES & EXCLUSIVE TRANSPORTS SHOWCASE
        ===================================================================== */}
        {activeTab === 'titles' && (
          <div className="flex flex-1 min-h-0 flex-col overflow-y-auto p-3 space-y-3">
            {/* Final Level 40 Titles Comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Free Level 40 Title: Исследователь Песков */}
              <div className="rounded-2xl border-2 border-slate-400/60 bg-gradient-to-b from-slate-800/80 via-slate-900 to-slate-950 p-3 shadow-[0_0_20px_rgba(148,163,184,0.25)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-slate-700/80 border border-slate-400/50 px-2 py-0.5 text-[9px] font-black text-slate-200">
                      Уровень 40 (Бесплатная линия)
                    </span>
                    <span className="text-xl">🏜️</span>
                  </div>
                  <div className="mt-2 text-sm font-black text-slate-200 drop-shadow-[0_0_8px_rgba(226,232,240,0.7)]">
                    Титул «Исследователь Песков»
                  </div>
                  <div className="mt-1 text-[10px] text-emerald-300 font-bold">
                    ⚡ Бонус: +15% ко всем статам персонажа (7 дней)
                  </div>
                  <div className="mt-1 text-[9.5px] text-slate-300 leading-relaxed">
                    Никнейм игрока подсвечивается благородным серебристо-серым цветом с плавной анимацией свечения возле никнейма в чате и профиле.
                  </div>

                  {/* Preview Box */}
                  <div className="mt-2.5 rounded-xl border border-slate-600/60 bg-slate-950/90 p-2 text-center">
                    <div className="text-[8px] text-slate-400 mb-1">Предпросмотр в чате и профиле:</div>
                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-300/60 bg-slate-800/90 px-2.5 py-1 text-xs font-black text-slate-200 shadow-[0_0_12px_rgba(203,213,225,0.55)] animate-pulse">
                      <span>🏜️ [Исследователь Песков]</span>
                      <span>{hero.nick || 'Игрок'}</span>
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  {(bpState.ownedTitles || []).some((t) => t.id === 'sand_explorer' && t.expiresAt > nowMs) ? (
                    activeTitle?.id === 'sand_explorer' ? (
                      <div className="rounded-lg border border-emerald-400/60 bg-emerald-950/60 py-1.5 text-center text-[9.5px] font-black text-emerald-300">
                        ✓ Титул сейчас активен (+15% статы)
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectActiveTitle('sand_explorer')}
                        className="w-full rounded-lg border border-slate-300 bg-slate-200 py-1.5 text-[10px] font-black text-slate-950 hover:bg-white cursor-pointer"
                      >
                        Надеть титул «Исследователь Песков»
                      </button>
                    )
                  ) : (
                    <div className="rounded-lg border border-slate-700 bg-slate-900 py-1.5 text-center text-[9px] font-bold text-slate-400">
                      Достигните 40 уровня (Free) для получения
                    </div>
                  )}
                </div>
              </div>

              {/* VIP Level 40 Title: Фараон Сезона */}
              <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-amber-950/90 via-red-950/60 to-slate-950 p-3 shadow-[0_0_25px_rgba(245,158,11,0.35)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-gradient-to-r from-amber-500 to-red-500 px-2 py-0.5 text-[9px] font-black text-slate-950">
                      Уровень 40 (Премиум VIP)
                    </span>
                    <span className="text-xl">👑</span>
                  </div>
                  <div className="mt-2 text-sm font-black bg-gradient-to-r from-yellow-300 via-amber-400 to-red-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]">
                    Эксклюзивный титул «Фараон Сезона»
                  </div>
                  <div className="mt-1 text-[10px] text-yellow-300 font-black">
                    🔥 Бонус: +25% ко всем статам персонажа (14 дней)
                  </div>
                  <div className="mt-1 text-[9.5px] text-amber-100/90 leading-relaxed">
                    Никнейм игрока подсвечивается золотым с красным цветом с премиальной анимированной переливчатой рамкой и свечением в чате и профиле.
                  </div>

                  {/* Preview Box */}
                  <div className="mt-2.5 rounded-xl border border-amber-400/70 bg-slate-950/90 p-2 text-center">
                    <div className="text-[8px] text-amber-300/80 mb-1">Предпросмотр в чате и профиле:</div>
                    <span className="inline-flex items-center gap-1 rounded-md border-2 border-amber-400 bg-gradient-to-r from-amber-950 via-red-900 to-amber-950 px-2.5 py-1 text-xs font-black text-yellow-300 shadow-[0_0_16px_rgba(239,68,68,0.65)] animate-pulse">
                      <span>👑 [Фараон Сезона]</span>
                      <span className="bg-gradient-to-r from-yellow-300 via-amber-200 to-red-400 bg-clip-text text-transparent">
                        {hero.nick || 'Игрок'}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  {(bpState.ownedTitles || []).some((t) => t.id === 'season_pharaoh' && t.expiresAt > nowMs) ? (
                    activeTitle?.id === 'season_pharaoh' ? (
                      <div className="rounded-lg border border-yellow-400/70 bg-amber-950/70 py-1.5 text-center text-[9.5px] font-black text-yellow-300">
                        ✓ Титул сейчас активен (+25% статы)
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectActiveTitle('season_pharaoh')}
                        className="w-full rounded-lg border border-yellow-300 bg-gradient-to-r from-amber-400 to-red-500 py-1.5 text-[10px] font-black text-slate-950 hover:brightness-110 cursor-pointer"
                      >
                        Надеть титул «Фараон Сезона»
                      </button>
                    )
                  ) : (
                    <div className="rounded-lg border border-amber-500/40 bg-slate-950/80 py-1.5 text-center text-[9px] font-bold text-amber-300/80">
                      Достигните 40 уровня (VIP) для получения
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Unique Season Transports Showcase (Lv. 5 & Lv. 30 VIP) */}
            <div className="rounded-2xl border border-cyan-500/40 bg-slate-900/85 p-3 space-y-2">
              <div className="text-xs font-black text-cyan-300 uppercase tracking-wider">
                ⚓ Эксклюзивный сезонный транспорт для Порта (Премиум линия)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-slate-950/90 p-2.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/60 bg-amber-950/60 text-2xl">
                    🚤
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-amber-300">
                      Ур. 5 VIP: Легкий катер «Скарабей»
                    </div>
                    <div className="text-[9px] text-slate-300">
                      Прочность: <strong className="text-emerald-300">500 / 500</strong> • Время в Порт: 2 мин (-35%)
                    </div>
                    <div className="text-[8.5px] text-amber-200/80 mt-0.5">
                      Бонусы: +10⚔️ Урон, +100❤️ HP, +10⚡ Энергия, +8% 🪙/✨
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-xl border border-red-500/50 bg-slate-950/90 p-2.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-400/60 bg-red-950/60 text-2xl">
                    🚁
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-yellow-300">
                      Ур. 30 VIP: Вертолет «Апач Сезона»
                    </div>
                    <div className="text-[9px] text-slate-300">
                      Прочность: <strong className="text-emerald-300">1000 / 1000</strong> • Время в Порт: 1 мин (-50%)
                    </div>
                    <div className="text-[8.5px] text-amber-200/80 mt-0.5">
                      Бонусы: +25⚔️ Урон, +250❤️ HP, +25⚡ Энергия, +15% 🪙/✨
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
