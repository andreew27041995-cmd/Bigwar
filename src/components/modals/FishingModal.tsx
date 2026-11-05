import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HeroState, GameItem } from '../../types/game';
import {
  GlobalFishingConfig,
  PlayerFishingState,
  FishSpecies,
  FishingRodTemplate,
  FishingRollOutcome,
  FishingLocationId,
  FishingBaitTemplate,
  FishingNetTemplate,
  FishingNetLicensePackage,
  FishingKeepnetUpgrade,
  FishingAchievementTemplate,
  StoredKeepnetFish,
  FishingLineTemplate,
  FishingHookTemplate,
  FISHING_LOCATIONS,
  FISHING_BAITS,
  FISHING_LINES,
  FISHING_HOOKS,
  FISHING_NETS,
  FISHING_NET_LICENSES,
  FISHING_KEEPNET_UPGRADES,
  FISHING_ACHIEVEMENTS,
  FishingDepthZoneId,
  FishingDepthZone,
  FISHING_DEPTH_ZONES,
  getActiveColdCurrentZone,
  TrophyMuseumItem,
  NILE_TROPHIES,
  getTrophyMuseumBonuses,
  getKeepnetCapacity,
  getRodExpRequiredForNextLevel,
  getActiveLocationWeather,
  getFishingAchievementProgress,
  getRarityMeta,
  rollFishingCatch,
  rollFishingNetHaul,
  normalizePlayerFishingState,
  getCurrentFishingWeekId
} from '../../utils/fishingConfig';
import { ensureDailyQuestsForToday } from '../../utils/dailyQuests';
import { GoldCoinIcon, CrystalIcon } from '../CurrencyIcon';
import { ItemIcon } from '../ItemIcon';
import {
  playCoinSound,
  playLootSound,
  playLevelUpSound,
  playStepSound,
  playAttackSound
} from '../../utils/audio';

interface FishingModalProps {
  hero: HeroState;
  inventory: GameItem[];
  fishingConfig: GlobalFishingConfig;
  onClose: () => void;
  onCatchOutcome: (
    outcome: FishingRollOutcome,
    updatedFishingState: PlayerFishingState,
    energyCost: number
  ) => void;
  onBuyOrEquipRod: (rod: FishingRodTemplate, action: 'buy' | 'equip') => void;
  onUpdateFishingAndBalance?: (
    updatedFishingState: PlayerFishingState,
    goldDelta: number,
    crystalsDelta: number,
    energyDelta: number,
    expGain: number,
    logMessage?: string,
    caughtFishList?: Array<{ fishId: string; fishName: string }>
  ) => void;
  onUseEnergyPotion?: () => void;
  onOpenLeaderboard?: () => void;
}

type FishingPhase = 'idle' | 'casting' | 'waiting' | 'nibble' | 'bite' | 'reeling' | 'caught' | 'escaped';

export const FishingModal: React.FC<FishingModalProps> = ({
  hero,
  inventory,
  fishingConfig,
  onClose,
  onCatchOutcome,
  onBuyOrEquipRod,
  onUpdateFishingAndBalance,
  onUseEnergyPotion,
  onOpenLeaderboard
}) => {
  const [activeTab, setActiveTab] = useState<'play' | 'collection' | 'shop' | 'achievements' | 'museum'>('play');
  const [shopSubTab, setShopSubTab] = useState<'rods' | 'keepnet' | 'lines' | 'hooks' | 'baits' | 'nets'>('rods');
  const [collectionLocationFilter, setCollectionLocationFilter] = useState<'all' | FishingLocationId>('all');
  const [collectionStatusFilter, setCollectionStatusFilter] = useState<'all' | 'caught' | 'uncaught'>('all');
  const [selectedFishDetail, setSelectedFishDetail] = useState<FishSpecies | null>(null);
  const [isLineModalOpen, setIsLineModalOpen] = useState(false);
  const [isHookModalOpen, setIsHookModalOpen] = useState(false);
  const [flyingCatchAnim, setFlyingCatchAnim] = useState<{ active: boolean; icon: string; name: string } | null>(null);
  const [selectedDepthZoneId, setSelectedDepthZoneId] = useState<FishingDepthZoneId>('shallow');
  const [trophyDiscoveryModal, setTrophyDiscoveryModal] = useState<TrophyMuseumItem | null>(null);

  const fishingState = useMemo(
    () => normalizePlayerFishingState(hero.fishingState),
    [hero.fishingState]
  );

  const equippedRod = useMemo(() => {
    return (
      fishingConfig.rods.find((r) => r.level === fishingState.equippedRodLevel) ||
      fishingConfig.rods[0]
    );
  }, [fishingConfig.rods, fishingState.equippedRodLevel]);

  const currentLocation = useMemo(() => {
    const found = FISHING_LOCATIONS.find((l) => l.id === fishingState.selectedLocationId);
    if (found && equippedRod.level >= found.minRodLevel) return found;
    return FISHING_LOCATIONS[0];
  }, [fishingState.selectedLocationId, equippedRod.level]);

  const activeBait = useMemo(() => {
    if (!fishingState.equippedBaitId) return null;
    const count = fishingState.baitsInventory[fishingState.equippedBaitId] || 0;
    if (count <= 0) return null;
    return FISHING_BAITS.find((b) => b.id === fishingState.equippedBaitId) || null;
  }, [fishingState.equippedBaitId, fishingState.baitsInventory]);

  const museumSummary = useMemo(
    () => getTrophyMuseumBonuses(fishingState.trophyMuseum),
    [fishingState.trophyMuseum]
  );

  const activeColdCurrent = useMemo(
    () => getActiveColdCurrentZone(Date.now()),
    []
  );

  const activeDepthZoneObj = useMemo(
    () => FISHING_DEPTH_ZONES.find((z) => z.id === selectedDepthZoneId) || FISHING_DEPTH_ZONES[0],
    [selectedDepthZoneId]
  );

  // Fishing Interactive Gameplay State
  const [phase, setPhase] = useState<FishingPhase>('idle');
  const [castProgress, setCastProgress] = useState<number>(0); // 0..1
  const [waitTimeTotalMs, setWaitTimeTotalMs] = useState<number>(3500);
  const [waitTimeLeftMs, setWaitTimeLeftMs] = useState<number>(0);
  const [reelProgress, setReelProgress] = useState<number>(25); // 0..100
  const [lineTension, setLineTension] = useState<number>(18); // 0..100
  const [isFishThrashing, setIsFishThrashing] = useState<boolean>(false);
  const [isHoldingReel, setIsHoldingReel] = useState<boolean>(false);
  const [biteTimeLeftMs, setBiteTimeLeftMs] = useState<number>(0);
  const [escapeReason, setEscapeReason] = useState<string>('');
  const [lastOutcome, setLastOutcome] = useState<FishingRollOutcome | null>(null);
  const [lastNetHaul, setLastNetHaul] = useState<Array<{
    fish: FishSpecies;
    weightKg: number;
    goldEarned: number;
    crystalsEarned: number;
    expEarned: number;
    isNewDiscovery: boolean;
  }> | null>(null);
  const [statusBanner, setStatusBanner] = useState<string>(
    'Выберите локацию и наживку, затем нажмите «Забросить удочку»'
  );

  // Refs for 60fps canvas & real-time reeling physics loop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<FishingPhase>(phase);
  phaseRef.current = phase;
  const castProgRef = useRef<number>(castProgress);
  castProgRef.current = castProgress;
  const reelProgRef = useRef<number>(reelProgress);
  reelProgRef.current = reelProgress;
  const tensionRef = useRef<number>(lineTension);
  tensionRef.current = lineTension;
  const thrashingRef = useRef<boolean>(isFishThrashing);
  thrashingRef.current = isFishThrashing;
  const holdingReelRef = useRef<boolean>(isHoldingReel);
  holdingReelRef.current = isHoldingReel;
  const pendingHookOutcomeRef = useRef<FishingRollOutcome | null>(null);
  const activeBaitUsedRef = useRef<FishingBaitTemplate | null>(null);

  const timersRef = useRef<number[]>([]);
  const clearAllTimers = () => {
    timersRef.current.forEach((id) => {
      window.clearTimeout(id);
      window.clearInterval(id);
    });
    timersRef.current = [];
  };

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  // 1-second clock for net timers and EXP buff
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const expBuffRemainingSec = useMemo(() => {
    const until = Number(fishingState.expBuffUntil || hero.fishingExpBuffUntil || 0);
    if (until <= nowMs) return 0;
    return Math.ceil((until - nowMs) / 1000);
  }, [fishingState.expBuffUntil, hero.fishingExpBuffUntil, nowMs]);

  const relicsInBagCount = useMemo(
    () => (inventory || []).filter((it) => it && it.isRelic).length,
    [inventory]
  );

  const uniqueCaughtCount = useMemo(() => {
    return fishingConfig.fishes.filter((f) => (fishingState.collection[f.id]?.count || 0) > 0).length;
  }, [fishingConfig.fishes, fishingState.collection]);

  const keepnetCapacity = useMemo(
    () => getKeepnetCapacity(fishingState.keepnetLevel || 1),
    [fishingState.keepnetLevel]
  );

  const keepnetFishList = fishingState.keepnetFish || [];
  const isKeepnetFull = keepnetFishList.length >= keepnetCapacity;

  const keepnetTotals = useMemo(() => {
    let gold = 0;
    let crystals = 0;
    let totalWeight = 0;
    for (const f of keepnetFishList) {
      gold += Number(f.goldValue || 0);
      crystals += Number(f.crystalsValue || 0);
      totalWeight += Number(f.weightKg || 0);
    }
    return { gold, crystals, totalWeight: Number(totalWeight.toFixed(2)) };
  }, [keepnetFishList]);

  const activeWeatherInfo = useMemo(
    () => getActiveLocationWeather(currentLocation.id, nowMs),
    [currentLocation.id, nowMs]
  );

  const dailyCatchQuest = useMemo(() => {
    const synced = ensureDailyQuestsForToday(hero, nowMs);
    return synced.dailyQuests.find((q) => q.type === 'catch_fish') || null;
  }, [hero, nowMs]);

  const claimableFishingAchievementsCount = useMemo(() => {
    const claimedSet = new Set(fishingState.claimedFishingAchievements || []);
    return FISHING_ACHIEVEMENTS.filter((ach) => {
      if (claimedSet.has(ach.id)) return false;
      const prog = getFishingAchievementProgress(ach, fishingState, uniqueCaughtCount);
      return prog >= ach.target;
    }).length;
  }, [fishingState, uniqueCaughtCount]);

  const formatTimer = (sec: number) => {
    const s = Math.max(0, Math.ceil(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  // Persist helper
  const commitFishingStateChange = (
    nextState: PlayerFishingState,
    goldDelta = 0,
    crystalsDelta = 0,
    energyDelta = 0,
    expGain = 0,
    logMessage?: string,
    caughtFishList?: Array<{ fishId: string; fishName: string }>
  ) => {
    if (onUpdateFishingAndBalance) {
      onUpdateFishingAndBalance(
        nextState,
        goldDelta,
        crystalsDelta,
        energyDelta,
        expGain,
        logMessage,
        caughtFishList
      );
    }
  };

  // Sell all fish currently in the Keepnet («Продать улов»)
  const handleSellKeepnetCatch = () => {
    if (keepnetFishList.length === 0) {
      setStatusBanner('🪣 Садок пуст! Сначала поймайте рыбу удочкой или сетью.');
      return;
    }
    const soldCount = keepnetFishList.length;
    const goldEarned = keepnetTotals.gold;
    const crystalsEarned = keepnetTotals.crystals;
    const nextState: PlayerFishingState = {
      ...fishingState,
      keepnetFish: []
    };
    playCoinSound();
    setStatusBanner(
      `💰 Вы продали весь улов из садка (${soldCount} рыб): +${goldEarned.toLocaleString('ru-RU')} 🪙${
        crystalsEarned > 0 ? `, +${crystalsEarned} 💎` : ''
      }! Садок свободен (0/${keepnetCapacity}).`
    );
    commitFishingStateChange(
      nextState,
      goldEarned,
      crystalsEarned,
      0,
      0,
      `💰 [Рыбалка] Продано рыб из садка (${soldCount} шт.): +${goldEarned.toLocaleString('ru-RU')} 🪙${
        crystalsEarned > 0 ? `, +${crystalsEarned} 💎` : ''
      }!`
    );
  };

  // Upgrade Keepnet Capacity in Shop
  const handleUpgradeKeepnet = (upgrade: FishingKeepnetUpgrade) => {
    const curLvl = fishingState.keepnetLevel || 1;
    if (upgrade.level <= curLvl) return;
    if (upgrade.level > curLvl + 1) {
      setStatusBanner(`⚠️ Сначала прокачайте садок до Уровня ${curLvl + 1}!`);
      return;
    }
    if (hero.gold < upgrade.priceGold || hero.crystals < upgrade.priceCrystals) {
      setStatusBanner(`❌ Недостаточно ресурсов для покупки «${upgrade.name}»!`);
      return;
    }
    const nextState: PlayerFishingState = {
      ...fishingState,
      keepnetLevel: upgrade.level
    };
    playLevelUpSound();
    setStatusBanner(
      `🪣 Садок улучшен до Ур. ${upgrade.level} («${upgrade.name}»)! Вместимость: ${upgrade.capacity} рыб.`
    );
    commitFishingStateChange(
      nextState,
      -upgrade.priceGold,
      -upgrade.priceCrystals,
      0,
      0,
      `🪣 [Рыбалка] Прокачан «${upgrade.name}» (Ур. ${upgrade.level}) — вместимость садка увеличена до ${upgrade.capacity} рыб!`
    );
  };

  // Claim Angler Achievement Reward
  const handleClaimFishingAchievement = (ach: FishingAchievementTemplate) => {
    const claimedSet = new Set(fishingState.claimedFishingAchievements || []);
    if (claimedSet.has(ach.id)) return;
    const prog = getFishingAchievementProgress(ach, fishingState, uniqueCaughtCount);
    if (prog < ach.target) return;

    const nextState: PlayerFishingState = {
      ...fishingState,
      claimedFishingAchievements: [...Array.from(claimedSet), ach.id]
    };
    playLevelUpSound();
    commitFishingStateChange(
      nextState,
      ach.rewardGold,
      ach.rewardCrystals,
      0,
      0,
      `🏆 [Достижение рыбака] «${ach.title}» выполнено! Награда: +${ach.rewardGold} 🪙${
        ach.rewardCrystals > 0 ? `, +${ach.rewardCrystals} 💎` : ''
      }!`
    );
  };

  // Select Fishing Location
  const handleSelectLocation = (locId: FishingLocationId) => {
    if (phase !== 'idle' && phase !== 'caught' && phase !== 'escaped') {
      setStatusBanner('⚠️ Завершите текущий заброс перед сменой локации!');
      return;
    }
    const loc = FISHING_LOCATIONS.find((l) => l.id === locId);
    if (!loc) return;
    if (equippedRod.level < loc.minRodLevel) {
      playAttackSound();
      setStatusBanner(
        `🔒 Локация «${loc.name}» требует удочку Ур. ${loc.minRodLevel}+! Купите или экипируйте удочку получше в Магазине.`
      );
      return;
    }
    const nextState: PlayerFishingState = {
      ...fishingState,
      selectedLocationId: locId
    };
    commitFishingStateChange(nextState);
    setStatusBanner(`🗺️ Вы перешли на локацию: «${loc.name}» (${loc.icon})`);
    playStepSound();
  };

  // Equip or unequip bait
  const handleSelectBait = (baitId: string | null) => {
    const nextState: PlayerFishingState = {
      ...fishingState,
      equippedBaitId: baitId
    };
    commitFishingStateChange(nextState);
    playStepSound();
  };

  // Buy Bait Pack in Shop
  const handleBuyBait = (bait: FishingBaitTemplate) => {
    if (bait.priceGold > 0 && hero.gold < bait.priceGold) {
      setStatusBanner(`❌ Недостаточно золота для покупки «${bait.name}» (${bait.priceGold} 🪙)!`);
      return;
    }
    if (bait.priceCrystals > 0 && hero.crystals < bait.priceCrystals) {
      setStatusBanner(`❌ Недостаточно кристаллов для покупки «${bait.name}» (${bait.priceCrystals} 💎)!`);
      return;
    }
    const nextBaits = { ...fishingState.baitsInventory };
    nextBaits[bait.id] = (nextBaits[bait.id] || 0) + bait.packSize;
    const nextState: PlayerFishingState = {
      ...fishingState,
      baitsInventory: nextBaits,
      equippedBaitId: bait.id
    };
    playCoinSound();
    commitFishingStateChange(
      nextState,
      -bait.priceGold,
      -bait.priceCrystals,
      0,
      0,
      `🪱 Куплена наживка «${bait.name}» (+${bait.packSize} шт.) и насажена на крючок!`
    );
  };

  // Buy Line in Shop
  const handleBuyLine = (line: FishingLineTemplate) => {
    if (line.priceGold > 0 && hero.gold < line.priceGold) {
      setStatusBanner(`❌ Недостаточно золота для покупки «${line.name}» (${line.priceGold} 🪙)!`);
      return;
    }
    if (line.priceCrystals > 0 && hero.crystals < line.priceCrystals) {
      setStatusBanner(`❌ Недостаточно кристаллов для покупки «${line.name}» (${line.priceCrystals} 💎)!`);
      return;
    }
    const nextLines = { ...(fishingState.linesInventory || {}) };
    nextLines[line.id] = (nextLines[line.id] || 0) + 1;
    const nextState: PlayerFishingState = {
      ...fishingState,
      linesInventory: nextLines,
      equippedLine: { ...line }
    };
    playCoinSound();
    commitFishingStateChange(
      nextState,
      -line.priceGold,
      -line.priceCrystals,
      0,
      0,
      `🧵 Приобретена и установлена «${line.name}» (прочность: ${line.maxDurability})!`
    );
    setStatusBanner(`🧵 Установлена «${line.name}» (${line.maxDurability}/${line.maxDurability} прочн.)!`);
    setIsLineModalOpen(false);
  };

  const handleEquipLine = (line: FishingLineTemplate | null) => {
    const nextState: PlayerFishingState = {
      ...fishingState,
      equippedLine: line ? { ...line } : null
    };
    playStepSound();
    commitFishingStateChange(nextState);
    setStatusBanner(line ? `🧵 Установлена леска «${line.name}»!` : '🧵 Леска снята со снасти.');
    setIsLineModalOpen(false);
  };

  // Buy Hook in Shop
  const handleBuyHook = (hook: FishingHookTemplate) => {
    if (hook.priceGold > 0 && hero.gold < hook.priceGold) {
      setStatusBanner(`❌ Недостаточно золота для покупки «${hook.name}» (${hook.priceGold} 🪙)!`);
      return;
    }
    if (hook.priceCrystals > 0 && hero.crystals < hook.priceCrystals) {
      setStatusBanner(`❌ Недостаточно кристаллов для покупки «${hook.name}» (${hook.priceCrystals} 💎)!`);
      return;
    }
    const nextHooks = { ...(fishingState.hooksInventory || {}) };
    nextHooks[hook.id] = (nextHooks[hook.id] || 0) + 1;
    const nextState: PlayerFishingState = {
      ...fishingState,
      hooksInventory: nextHooks,
      equippedHook: { ...hook }
    };
    playCoinSound();
    commitFishingStateChange(
      nextState,
      -hook.priceGold,
      -hook.priceCrystals,
      0,
      0,
      `🪝 Приобретен и установлен «${hook.name}» (прочность: ${hook.maxDurability})!`
    );
    setStatusBanner(`🪝 Установлен «${hook.name}» (${hook.maxDurability}/${hook.maxDurability} прочн.)!`);
    setIsHookModalOpen(false);
  };

  const handleEquipHook = (hook: FishingHookTemplate | null) => {
    const nextState: PlayerFishingState = {
      ...fishingState,
      equippedHook: hook ? { ...hook } : null
    };
    playStepSound();
    commitFishingStateChange(nextState);
    setStatusBanner(hook ? `🪝 Установлен крючок «${hook.name}»!` : '🪝 Крючок снят со снасти.');
    setIsHookModalOpen(false);
  };

  // Buy Net in Shop
  const handleBuyNet = (net: FishingNetTemplate) => {
    if (net.priceGold > 0 && hero.gold < net.priceGold) {
      setStatusBanner(`❌ Недостаточно золота для покупки «${net.name}» (${net.priceGold} 🪙)!`);
      return;
    }
    if (net.priceCrystals > 0 && hero.crystals < net.priceCrystals) {
      setStatusBanner(`❌ Недостаточно кристаллов для покупки «${net.name}» (${net.priceCrystals} 💎)!`);
      return;
    }
    const nextNets = { ...fishingState.netsInventory };
    nextNets[net.id] = (nextNets[net.id] || 0) + 1;
    const nextState: PlayerFishingState = {
      ...fishingState,
      netsInventory: nextNets
    };
    playCoinSound();
    commitFishingStateChange(
      nextState,
      -net.priceGold,
      -net.priceCrystals,
      0,
      0,
      `🕸️ Приобретена рыболовная сеть «${net.name}» (+1 шт.)!`
    );
  };

  // Buy Net License in Shop
  const handleBuyNetLicense = (lic: FishingNetLicensePackage) => {
    if (lic.priceGold > 0 && hero.gold < lic.priceGold) {
      setStatusBanner(`❌ Недостаточно золота для покупки «${lic.name}» (${lic.priceGold} 🪙)!`);
      return;
    }
    if (lic.priceCrystals > 0 && hero.crystals < lic.priceCrystals) {
      setStatusBanner(`❌ Недостаточно кристаллов для покупки «${lic.name}» (${lic.priceCrystals} 💎)!`);
      return;
    }
    const nextState: PlayerFishingState = {
      ...fishingState,
      netLicenseUses: (fishingState.netLicenseUses || 0) + lic.usesCount
    };
    playCoinSound();
    commitFishingStateChange(
      nextState,
      -lic.priceGold,
      -lic.priceCrystals,
      0,
      0,
      `📜 Получена «${lic.name}» (+${lic.usesCount} забросов сети)!`
    );
  };

  // Cast a Fishing Net into the current location
  const handleCastNet = (net: FishingNetTemplate) => {
    if (fishingState.activeNet) {
      setStatusBanner('⚠️ У вас уже заброшена сеть! Дождитесь улова и вытяните её.');
      return;
    }
    if ((fishingState.netLicenseUses || 0) <= 0) {
      playAttackSound();
      setStatusBanner('📜 Для заброса сети нужна Лицензия на сеть! Купите её в Магазине рыбалки.');
      setActiveTab('shop');
      setShopSubTab('nets');
      return;
    }
    const ownedCount = fishingState.netsInventory[net.id] || 0;
    if (ownedCount <= 0) {
      setStatusBanner(`🕸️ У вас нет сети «${net.name}»! Купите её в Магазине рыбалки.`);
      return;
    }
    if (equippedRod.level < net.minRodLevel) {
      setStatusBanner(`🔒 Для этой сети требуется удочка и навык рыболова Ур. ${net.minRodLevel}+!`);
      return;
    }

    const now = Date.now();
    const readyAt = now + net.catchDurationSec * 1000;
    const spoilAt = readyAt + net.spoilAfterReadySec * 1000;

    const nextNets = { ...fishingState.netsInventory };
    nextNets[net.id] = Math.max(0, ownedCount - 1);
    if (nextNets[net.id] <= 0) delete nextNets[net.id];

    const nextState: PlayerFishingState = {
      ...fishingState,
      netsInventory: nextNets,
      netLicenseUses: Math.max(0, (fishingState.netLicenseUses || 0) - 1),
      activeNet: {
        netId: net.id,
        netName: net.name,
        netIcon: net.icon,
        locationId: currentLocation.id,
        locationName: currentLocation.shortName,
        castAt: now,
        readyAt,
        spoilAt,
        minFishCount: net.minFishCount,
        maxFishCount: net.maxFishCount,
        rareBonusPct: net.rareBonusPct
      }
    };

    playStepSound();
    setLastNetHaul(null);
    setStatusBanner(
      `🕸️ Вы забросили «${net.name}» в локации «${currentLocation.shortName}»! Через ${Math.round(
        net.catchDurationSec / 60
      )} мин. вытяните сеть, иначе рыба погибнет!`
    );
    commitFishingStateChange(
      nextState,
      0,
      0,
      0,
      0,
      `🕸️ [Рыбалка] Заброшена «${net.name}» в локации «${currentLocation.shortName}» (использована 1 лицензия).`
    );
  };

  // Pull or clear the active Fishing Net
  const handlePullOrClearNet = () => {
    const activeNet = fishingState.activeNet;
    if (!activeNet) return;
    const now = Date.now();

    if (now < activeNet.readyAt) {
      setStatusBanner('⏳ Сеть ещё наполняется рыбой! Подождите окончания таймера.');
      return;
    }

    // Check if the player forgot the net for too long and the fish died!
    if (now >= activeNet.spoilAt) {
      playAttackSound();
      const nextState: PlayerFishingState = {
        ...fishingState,
        activeNet: null,
        totalEscapedFish: (fishingState.totalEscapedFish || 0) + activeNet.maxFishCount
      };
      setLastNetHaul(null);
      setStatusBanner(
        `💀 Вы слишком долго не проверяли «${activeNet.netName}»! Вся рыба в сети погибла и пропала...`
      );
      commitFishingStateChange(
        nextState,
        0,
        0,
        0,
        0,
        `💀 [Рыбалка] Вы забыли вовремя вытянуть «${activeNet.netName}» — вся рыба в сети погибла!`
      );
      return;
    }

    // Success! Roll the net haul!
    const haul = rollFishingNetHaul(fishingConfig, fishingState, activeNet);
    const nextCollection = { ...fishingState.collection };
    const nextKeepnet = [...(fishingState.keepnetFish || [])];
    let autoSoldGold = 0;
    let autoSoldCrystals = 0;
    let storedInKeepnetCount = 0;
    let totalExp = 0;

    for (let i = 0; i < haul.length; i++) {
      const item = haul[i];
      totalExp += item.expEarned;
      const prev = nextCollection[item.fish.id];
      nextCollection[item.fish.id] = {
        count: (prev?.count || 0) + 1,
        maxWeightKg: Math.max(prev?.maxWeightKg || 0, item.weightKg),
        firstCaughtAt: prev?.firstCaughtAt || now,
        totalGoldEarned: (prev?.totalGoldEarned || 0) + item.goldEarned,
        totalCrystalsEarned: (prev?.totalCrystalsEarned || 0) + item.crystalsEarned
      };

      if (nextKeepnet.length < keepnetCapacity) {
        nextKeepnet.push({
          uid: `kf_net_${now}_${i}`,
          fishId: item.fish.id,
          fishName: item.fish.name,
          rarity: item.fish.rarity,
          weightKg: item.weightKg,
          goldValue: item.goldEarned,
          crystalsValue: item.crystalsEarned,
          caughtAt: now
        });
        storedInKeepnetCount++;
      } else {
        autoSoldGold += item.goldEarned;
        autoSoldCrystals += item.crystalsEarned;
      }
    }

    const curWeekId = getCurrentFishingWeekId(now);
    const isSameWeek = fishingState.fishingWeekId === curWeekId;
    const baseWeekly = isSameWeek ? Number(fishingState.weeklyFishCaught ?? 0) : 0;
    const baseWeeklyWeight = isSameWeek ? Number(fishingState.weeklyFishWeightKg ?? 0) : 0;
    const baseWeeklyMaxWeight = isSameWeek ? Number(fishingState.weeklyMaxFishWeightKg ?? 0) : 0;
    const haulWeightSum = Number(
      haul.reduce((acc, item) => acc + Number(item.weightKg || 0), 0).toFixed(2)
    );
    const haulMaxWeight = haul.reduce(
      (maxW, item) => Math.max(maxW, Number(item.weightKg || 0)),
      0
    );

    const nextState: PlayerFishingState = {
      ...fishingState,
      totalFishCaught: (fishingState.totalFishCaught || 0) + haul.length,
      weeklyFishCaught: baseWeekly + haul.length,
      totalFishWeightKg: Number(
        ((fishingState.totalFishWeightKg || 0) + haulWeightSum).toFixed(2)
      ),
      weeklyFishWeightKg: Number((baseWeeklyWeight + haulWeightSum).toFixed(2)),
      weeklyMaxFishWeightKg: Number(Math.max(baseWeeklyMaxWeight, haulMaxWeight).toFixed(2)),
      fishingWeekId: curWeekId,
      totalNetsPulled: (fishingState.totalNetsPulled || 0) + 1,
      activeNet: null,
      collection: nextCollection,
      keepnetFish: nextKeepnet
    };

    playLevelUpSound();
    setLastNetHaul(haul);
    setStatusBanner(
      `🕸️ Сеть вытянута вовремя! Поймано ${haul.length} рыб (в садок: +${storedInKeepnetCount} шт., всего в садке ${nextKeepnet.length}/${keepnetCapacity}, +${totalExp} EXP)!`
    );
    commitFishingStateChange(
      nextState,
      autoSoldGold,
      autoSoldCrystals,
      0,
      totalExp,
      `🕸️ [Рыбалка] Вытянута «${activeNet.netName}» (${haul.length} рыб добавлено в садок ${nextKeepnet.length}/${keepnetCapacity}, +${totalExp} EXP)!`,
      haul.map((h) => ({ fishId: h.fish.id, fishName: h.fish.name }))
    );
  };

  // Trigger Fish Escape (early hook, missed bite window, snapped line, or slack line)
  const triggerFishEscape = (reason: string) => {
    clearAllTimers();
    setIsHoldingReel(false);
    setIsFishThrashing(false);
    setWaitTimeLeftMs(0);
    setPhase('escaped');
    setEscapeReason(reason);
    setStatusBanner(reason);
    playAttackSound();

    const nextState: PlayerFishingState = {
      ...fishingState,
      totalEscapedFish: (fishingState.totalEscapedFish || 0) + 1
    };
    // Consume the bait if one was used on this cast
    const usedBait = activeBaitUsedRef.current;
    if (usedBait) {
      const nextBaits = { ...nextState.baitsInventory };
      const rem = Math.max(0, (nextBaits[usedBait.id] || 0) - 1);
      if (rem > 0) nextBaits[usedBait.id] = rem;
      else delete nextBaits[usedBait.id];
      nextState.baitsInventory = nextBaits;
      if (rem <= 0 && nextState.equippedBaitId === usedBait.id) {
        nextState.equippedBaitId = null;
      }
      activeBaitUsedRef.current = null;
    }

    const energyCost = Math.max(1, Number(fishingConfig.energyPerCast || 2));
    commitFishingStateChange(nextState, 0, 0, -energyCost, 0, `💨 [Рыбалка] ${reason}`);
  };

  // Start Casting the Fishing Rod
  const handleStartCast = () => {
    // 1. Block casting if Keepnet (Садок) has reached its capacity limit!
    if (keepnetFishList.length >= keepnetCapacity) {
      playAttackSound();
      setStatusBanner(
        `🪣 Садок переполнен (${keepnetFishList.length} / ${keepnetCapacity})! Нажмите «Продать улов», чтобы освободить место для новой рыбы.`
      );
      return;
    }

    const energyCost = Math.max(1, Number(fishingConfig.energyPerCast || 2));
    if (hero.energy < energyCost) {
      setStatusBanner(`⚡ Недостаточно энергии для заброса! Требуется ${energyCost}⚡.`);
      return;
    }

    clearAllTimers();
    setLastOutcome(null);
    setLastNetHaul(null);
    setEscapeReason('');
    setIsHoldingReel(false);
    setIsFishThrashing(false);
    activeBaitUsedRef.current = activeBait;

    setPhase('casting');
    setCastProgress(0);
    setReelProgress(25);
    setLineTension(18);
    setStatusBanner(
      `🎣 Заброс в «${currentLocation.shortName}»${
        activeBait ? ` с наживкой «${activeBait.name}»` : ''
      }...`
    );
    playStepSound();

    // Animate cast 0 -> 1 over 420ms
    const castStart = Date.now();
    const castTick = window.setInterval(() => {
      const elapsed = Date.now() - castStart;
      const p = Math.min(1, elapsed / 420);
      setCastProgress(p);
      if (p >= 1) {
        window.clearInterval(castTick);
        setPhase('waiting');

        // Bite Waiting Timer (Таймер ожидания клёва): 3.0s - 5.0s base delay, accelerated by weather biteDelayMultiplier
        const baseDelayMs = 3000 + Math.floor(Math.random() * 2000); // 3000..5000 ms (3-5 sec)
        const weatherMult = activeWeatherInfo.weather.biteDelayMultiplier || 1;
        const biteDelayMs = Math.max(2200, Math.round(baseDelayMs * weatherMult));
        setWaitTimeTotalMs(biteDelayMs);
        setWaitTimeLeftMs(biteDelayMs);
        setStatusBanner(
          `⏳ Ожидание клёва (${(biteDelayMs / 1000).toFixed(1)} сек)... Следите за поплавком!`
        );

        const waitStart = Date.now();
        const waitCountdown = window.setInterval(() => {
          if (phaseRef.current !== 'waiting' && phaseRef.current !== 'nibble') {
            window.clearInterval(waitCountdown);
            return;
          }
          const rem = Math.max(0, biteDelayMs - (Date.now() - waitStart));
          setWaitTimeLeftMs(rem);
        }, 80);
        timersRef.current.push(waitCountdown as unknown as number);

        // Schedule 1 subtle nibble halfway through the 3-5s waiting timer
        const nibbleDelay = Math.round(biteDelayMs * 0.5);
        const nibbleTimer = window.setTimeout(() => {
          if (phaseRef.current !== 'waiting') return;
          setPhase('nibble');
          setStatusBanner('〰️ Поплавок слегка качнулся... Рыба кружит у крючка, ждите поклёвки!');
          const backToWait = window.setTimeout(() => {
            if (phaseRef.current !== 'nibble') return;
            setPhase('waiting');
          }, 600);
          timersRef.current.push(backToWait);
        }, nibbleDelay);
        timersRef.current.push(nibbleTimer);

        // Real bite occurs when the 3-5s Bite Waiting Timer finishes
        const biteTimer = window.setTimeout(() => {
          window.clearInterval(waitCountdown);
          setWaitTimeLeftMs(0);
          setPhase('bite');
          const reactionWindowMs = 2500 + equippedRod.level * 220; // 2.7s .. 3.6s
          setBiteTimeLeftMs(reactionWindowMs);
          setStatusBanner('⚡ КЛЮЁТ! Поплавок резко ушёл под воду — ЖМИТЕ «ПОДСЕЧЬ»!');
          playLootSound();

          const biteStart = Date.now();
          const biteCountdown = window.setInterval(() => {
            if (phaseRef.current !== 'bite') {
              window.clearInterval(biteCountdown);
              return;
            }
            const rem = Math.max(0, reactionWindowMs - (Date.now() - biteStart));
            setBiteTimeLeftMs(rem);
            if (rem <= 0) {
              window.clearInterval(biteCountdown);
              triggerFishEscape('🐟 Вы упустили момент поклёвки! Рыба стащила наживку и сорвалась с крючка.');
            }
          }, 80);
          timersRef.current.push(biteCountdown as unknown as number);
        }, biteDelayMs);
        timersRef.current.push(biteTimer);
      }
    }, 30);
    timersRef.current.push(castTick as unknown as number);
  };

  // Hook the fish when biting -> start real-time Reeling & Line Tension battle!
  const handleHookFish = () => {
    if (phase === 'waiting' || phase === 'nibble') {
      triggerFishEscape('💨 Вы дёрнули удочку до окончания таймера клёва! Рыба испугалась и уплыла.');
      return;
    }
    if (phase !== 'bite') return;

    clearAllTimers();
    setWaitTimeLeftMs(0);
    playStepSound();

    // Roll what is on the hook now so its strugglePower drives the fight
    const rolledOutcome = rollFishingCatch(
      fishingConfig,
      fishingState,
      () => {
        const relicClass = Math.floor(Math.random() * 3) + 1;
        const now = Date.now();
        return {
          id: `relic_fish_${now}_${Math.random().toString(36).slice(2, 6)}`,
          name: `Затонувшая Реликвия Нила [М${relicClass}]`,
          slot: 'ring',
          icon: '🏺',
          quality: relicClass >= 3 ? 'epic' : 'rare',
          lvl: 1,
          dmg: 0,
          hp: 0,
          price: 150 * relicClass,
          isRelic: true,
          relicTier: relicClass,
          modificationClass: relicClass,
          relicPower: relicClass,
          transferable: true,
          origin: 'fishing_chest'
        };
      },
      currentLocation.id,
      activeBaitUsedRef.current,
      selectedDepthZoneId
    );
    pendingHookOutcomeRef.current = rolledOutcome;

    const startProg = 26;
    const startTension = 24;
    setReelProgress(startProg);
    reelProgRef.current = startProg;
    setLineTension(startTension);
    tensionRef.current = startTension;
    setIsFishThrashing(false);
    thrashingRef.current = false;
    setPhase('reeling');
    setStatusBanner('🎣 РЫБА НА КРЮЧКЕ! Тяните катушку, но ослабляйте леску при рывках!');

    const fishStruggle =
      rolledOutcome.type === 'fish' ? Math.max(2, rolledOutcome.fish.strugglePower || 5) : 5;
    const rodControl = 1 + (equippedRod.level - 1) * 0.15;
    const baitControl = activeBaitUsedRef.current ? 1.15 : 1.0;
    const lineStability = fishingState.equippedLine ? (fishingState.equippedLine.stabilityBonusPct || 0) : 0;
    const totalControl = rodControl * baitControl * (1 + lineStability / 100);

    // Schedule dynamic fish thrashing cycles every ~1.4s - 2.3s
    let nextThrashToggleAt = Date.now() + 1400 + Math.random() * 900;

    // Real-time 60ms reeling & tension physics loop
    const battleLoop = window.setInterval(() => {
      if (phaseRef.current !== 'reeling') {
        window.clearInterval(battleLoop);
        return;
      }

      const now = Date.now();
      if (now >= nextThrashToggleAt) {
        const nextThrash = !thrashingRef.current;
        thrashingRef.current = nextThrash;
        setIsFishThrashing(nextThrash);
        if (nextThrash) {
          // Thrash lasts 1.0s - 1.6s
          nextThrashToggleAt = now + 1000 + Math.random() * 650;
          setStatusBanner('💢 РЫБА БЬЁТСЯ И ТЯНЕТ В ГЛУБИНУ! Ослабьте леску, чтобы не порвать!');
        } else {
          // Calm window lasts 1.6s - 2.4s
          nextThrashToggleAt = now + 1600 + Math.random() * 800;
          setStatusBanner('🟢 Рыба притихла — ТЯНИТЕ КАТУШКУ К БЕРЕГУ!');
        }
      }

      const pulling = holdingReelRef.current;
      const thrashing = thrashingRef.current;

      let nextProg = reelProgRef.current;
      let nextTens = tensionRef.current;

      if (pulling) {
        // Player is actively pulling the reel
        const pullGain = thrashing ? (1.4 * totalControl) / (fishStruggle * 0.22) : 2.9 * Math.sqrt(totalControl);
        nextProg += pullGain;

        // Tension increases much faster if pulling while the fish is thrashing!
        const tensionSpike = thrashing
          ? (4.2 * (fishStruggle / 5)) / totalControl
          : (1.55 * (fishStruggle / 5)) / totalControl;
        nextTens += tensionSpike;
      } else {
        // Player released the reel to cool down tension
        const fishPullBack = thrashing ? 1.15 * (fishStruggle / 6) : 0.45 * (fishStruggle / 6);
        nextProg -= fishPullBack;
        const coolDown = thrashing ? 1.6 * totalControl : 3.2 * totalControl;
        nextTens -= coolDown;
      }

      nextProg = Math.max(0, Math.min(100, Number(nextProg.toFixed(1))));
      nextTens = Math.max(5, Math.min(100, Number(nextTens.toFixed(1))));

      reelProgRef.current = nextProg;
      tensionRef.current = nextTens;
      setReelProgress(Math.round(nextProg));
      setLineTension(Math.round(nextTens));

      // Check line snap (Tension >= 100%)
      if (nextTens >= 100) {
        window.clearInterval(battleLoop);
        const escapedName =
          rolledOutcome.type === 'fish' ? `«${rolledOutcome.fish.name}»` : 'крупная добыча';
        triggerFishEscape(
          `💥 ОБРЫВ ЛЕСКИ! Натяжение достигло 100% — ${escapedName} оборвала снасть и сорвалась!`
        );
        return;
      }

      // Check fish escaped into the deep (Progress <= 0%)
      if (nextProg <= 0) {
        window.clearInterval(battleLoop);
        triggerFishEscape(
          '🐟 СХОД РЫБЫ! Вы слишком долго не подтягивали катушку — рыба освободилась с крючка и ушла на дно!'
        );
        return;
      }

      // Check victory (Progress >= 100%)
      if (nextProg >= 100) {
        window.clearInterval(battleLoop);
        finalizeCatch(rolledOutcome);
      }
    }, 60);

    timersRef.current.push(battleLoop as unknown as number);
  };

  // Impulse tap on the Reel button (for players who tap rapidly on mobile in addition to holding)
  const handleReelTapImpulse = () => {
    if (phase !== 'reeling') return;
    const outcome = pendingHookOutcomeRef.current;
    const fishStruggle = outcome && outcome.type === 'fish' ? outcome.fish.strugglePower || 5 : 5;
    const rodControl = 1 + (equippedRod.level - 1) * 0.16;
    const baitControl = 1 + (activeBaitUsedRef.current?.tensionControlBonusPct || 0) / 100;
    const totalControl = rodControl * baitControl;

    const thrashing = thrashingRef.current;
    const progStep = thrashing ? 4.5 : 8.5 * Math.sqrt(totalControl);
    const tensStep = thrashing
      ? (13.5 * (fishStruggle / 5)) / totalControl
      : (5.8 * (fishStruggle / 5)) / totalControl;

    const nextProg = Math.min(100, reelProgRef.current + progStep);
    const nextTens = Math.min(100, tensionRef.current + tensStep);

    reelProgRef.current = nextProg;
    tensionRef.current = nextTens;
    setReelProgress(Math.round(nextProg));
    setLineTension(Math.round(nextTens));
    playStepSound();

    if (nextTens >= 100) {
      const escapedName = outcome && outcome.type === 'fish' ? `«${outcome.fish.name}»` : 'добыча';
      triggerFishEscape(
        `💥 ОБРЫВ ЛЕСКИ! Вы тянули во время рывка рыбы — ${escapedName} порвала леску и сорвалась!`
      );
      return;
    }

    if (nextProg >= 100 && outcome) {
      finalizeCatch(outcome);
    }
  };

  // Manual Slack button to quickly ease tension
  const handleSlackLineImpulse = () => {
    if (phase !== 'reeling') return;
    setIsHoldingReel(false);
    holdingReelRef.current = false;
    const nextTens = Math.max(8, tensionRef.current - 16);
    const nextProg = Math.max(3, reelProgRef.current - 3);
    tensionRef.current = nextTens;
    reelProgRef.current = nextProg;
    setLineTension(Math.round(nextTens));
    setReelProgress(Math.round(nextProg));
  };

  // Complete catch & commit rewards
  const finalizeCatch = (outcome: FishingRollOutcome) => {
    clearAllTimers();
    setIsHoldingReel(false);
    setIsFishThrashing(false);
    const energyCost = Math.max(1, Number(fishingConfig.energyPerCast || 2));

    const nextState: PlayerFishingState = {
      ...fishingState,
      baitsInventory: { ...fishingState.baitsInventory },
      collection: { ...fishingState.collection }
    };

    // Consume 1 unit of equipped bait if used
    const usedBait = activeBaitUsedRef.current;
    if (usedBait) {
      const rem = Math.max(0, (nextState.baitsInventory[usedBait.id] || 0) - 1);
      if (rem > 0) nextState.baitsInventory[usedBait.id] = rem;
      else delete nextState.baitsInventory[usedBait.id];
      if (rem <= 0 && nextState.equippedBaitId === usedBait.id) {
        nextState.equippedBaitId = null;
      }
      activeBaitUsedRef.current = null;
    }

    // 1. Calculate Rod Experience gained from catch
    const gainedRodExp =
      outcome.type === 'fish'
        ? outcome.fish.rarity === 'mythic'
          ? 180
          : outcome.fish.rarity === 'legendary'
          ? 100
          : outcome.fish.rarity === 'epic'
          ? 60
          : outcome.fish.rarity === 'rare'
          ? 35
          : outcome.fish.rarity === 'uncommon'
          ? 20
          : 12
        : 35;

    const curRodLvl = nextState.equippedRodLevel || 1;
    const reqRodExp = getRodExpRequiredForNextLevel(curRodLvl);
    let newRodExp = (nextState.rodExp || 0) + gainedRodExp;
    let rodLevelUpNote = ` (+${gainedRodExp} EXP удочки)`;

    if (newRodExp >= reqRodExp && curRodLvl < 5) {
      const nextLvl = curRodLvl + 1;
      newRodExp = newRodExp - reqRodExp;
      nextState.equippedRodLevel = nextLvl;
      nextState.ownedRodLevels = Array.from(new Set([...nextState.ownedRodLevels, nextLvl]));
      rodLevelUpNote += ` 🎉 Удочка прокачана до Уровня ${nextLvl}!`;
      playLevelUpSound();
    }
    nextState.rodExp = newRodExp;

    // 2. Reduce Durability of Equipped Line & Hook
    let tackleWearNote = '';
    if (nextState.equippedLine) {
      const nextDur = Math.max(0, nextState.equippedLine.durability - 1);
      if (nextDur <= 0) {
        tackleWearNote += ` ⚠️ Леска «${nextState.equippedLine.name}» лопнула от износа!`;
        nextState.equippedLine = null;
      } else {
        nextState.equippedLine = { ...nextState.equippedLine, durability: nextDur };
      }
    }
    if (nextState.equippedHook) {
      const nextDur = Math.max(0, nextState.equippedHook.durability - 1);
      if (nextDur <= 0) {
        tackleWearNote += ` ⚠️ Крючок «${nextState.equippedHook.name}» затупился и сломался!`;
        nextState.equippedHook = null;
      } else {
        nextState.equippedHook = { ...nextState.equippedHook, durability: nextDur };
      }
    }

    // 3. Trigger Flying Catch Animation into Keepnet
    setFlyingCatchAnim({
      active: true,
      icon: outcome.type === 'fish' ? (outcome.fish.image || outcome.fish.iconUrl || '🐟') : '🧰',
      name: outcome.type === 'fish' ? outcome.fish.name : 'Сундук Фараона'
    });
    const flyTimer = window.setTimeout(() => setFlyingCatchAnim(null), 1200);
    timersRef.current.push(flyTimer);

    if (outcome.type === 'fish') {
      const now = Date.now();
      const curWeekId = getCurrentFishingWeekId(now);
      const isSameWeek = nextState.fishingWeekId === curWeekId;
      const baseWeekly = isSameWeek ? Number(nextState.weeklyFishCaught ?? 0) : 0;
      const baseWeeklyWeight = isSameWeek ? Number(nextState.weeklyFishWeightKg ?? 0) : 0;
      const baseWeeklyMaxWeight = isSameWeek ? Number(nextState.weeklyMaxFishWeightKg ?? 0) : 0;
      const fishW = Math.max(0.05, Number(outcome.weightKg || 0));

      nextState.totalFishCaught = (nextState.totalFishCaught || 0) + 1;
      nextState.weeklyFishCaught = baseWeekly + 1;
      nextState.totalFishWeightKg = Number(
        ((nextState.totalFishWeightKg || 0) + fishW).toFixed(2)
      );
      nextState.weeklyFishWeightKg = Number((baseWeeklyWeight + fishW).toFixed(2));
      nextState.weeklyMaxFishWeightKg = Number(Math.max(baseWeeklyMaxWeight, fishW).toFixed(2));
      nextState.fishingWeekId = curWeekId;
      const prevRec = nextState.collection[outcome.fish.id];
      nextState.collection[outcome.fish.id] = {
        count: (prevRec?.count || 0) + 1,
        maxWeightKg: Math.max(prevRec?.maxWeightKg || 0, outcome.weightKg),
        firstCaughtAt: prevRec?.firstCaughtAt || now,
        totalGoldEarned: (prevRec?.totalGoldEarned || 0) + outcome.goldEarned,
        totalCrystalsEarned: (prevRec?.totalCrystalsEarned || 0) + outcome.crystalsEarned
      };

      const nextKeepnet: StoredKeepnetFish[] = [
        ...(fishingState.keepnetFish || []),
        {
          uid: `kf_${now}_${Math.random().toString(36).slice(2, 6)}`,
          fishId: outcome.fish.id,
          fishName: outcome.fish.name,
          rarity: outcome.fish.rarity,
          weightKg: outcome.weightKg,
          goldValue: outcome.goldEarned,
          crystalsValue: outcome.crystalsEarned,
          caughtAt: now
        }
      ];
      nextState.keepnetFish = nextKeepnet;

      if (
        outcome.crystalsEarned > 0 ||
        outcome.fish.rarity === 'legendary' ||
        outcome.fish.rarity === 'mythic'
      ) {
        playLevelUpSound();
      } else {
        playCoinSound();
      }
      setStatusBanner(
        `🐟 Улов: «${outcome.fish.name}» (${outcome.weightKg} кг) • +${outcome.goldEarned} 🪙${
          outcome.crystalsEarned > 0 ? ` +${outcome.crystalsEarned} 💎` : ''
        }${rodLevelUpNote}${tackleWearNote}`
      );
    } else {
      nextState.totalChestsOpened = (nextState.totalChestsOpened || 0) + 1;
      if (outcome.prizeType === 'exp_buff' && outcome.expBuffMinutes) {
        const now = Date.now();
        const baseUntil =
          nextState.expBuffUntil && nextState.expBuffUntil > now ? nextState.expBuffUntil : now;
        nextState.expBuffUntil = baseUntil + outcome.expBuffMinutes * 60 * 1000;
        nextState.expBuffPct = outcome.expBuffPct || 50;
      }
      playLevelUpSound();
      setStatusBanner(`🧰 Вы вытянули со дна Затонувший сундук фараона!${rodLevelUpNote}${tackleWearNote}`);
    }

    // Check if an Ancient Nile Trophy / Relic was discovered!
    if (outcome.trophyAwarded) {
      const tr = outcome.trophyAwarded;
      const prevTrophyCount = nextState.trophyMuseum?.[tr.id] || 0;
      nextState.trophyMuseum = {
        ...(nextState.trophyMuseum || {}),
        [tr.id]: prevTrophyCount + 1
      };
      setTrophyDiscoveryModal(tr);
      playLevelUpSound();
    }

    setLastOutcome(outcome);
    setPhase('caught');
    onCatchOutcome(outcome, nextState, energyCost);
  };

  // Classic 2D Canvas Renderer for the selected Fishing Location & Active Net
  useEffect(() => {
    if (activeTab !== 'play') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const startTime = performance.now();

    const swimmers = [
      { x: 0.2, y: 0.58, speed: 0.04, scale: 0.55, dir: 1, depth: 0.35 },
      { x: 0.75, y: 0.68, speed: 0.055, scale: 0.75, dir: -1, depth: 0.6 },
      { x: 0.45, y: 0.78, speed: 0.035, scale: 0.95, dir: 1, depth: 0.85 },
      { x: 0.6, y: 0.52, speed: 0.06, scale: 0.45, dir: -1, depth: 0.25 }
    ];

    const renderFrame = (now: number) => {
      if (document.visibilityState === 'hidden') {
        animId = requestAnimationFrame(renderFrame);
        return;
      }

      const t = (now - startTime) * 0.001;
      const w = canvas.width;
      const h = canvas.height;
      const curPhase = phaseRef.current;
      const isThrash = thrashingRef.current;

      ctx.clearRect(0, 0, w, h);

      // 1. Dynamic Time-of-Day Lighting (Morning, Day, Sunset, Night)
      const curHour = new Date().getHours();
      const isNight = curHour >= 22 || curHour < 5;
      const isMorning = curHour >= 5 && curHour < 11;
      const isSunset = curHour >= 18 && curHour < 22;

      const horizonY = h * 0.27;
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);

      if (isNight) {
        skyGrad.addColorStop(0, '#020617');
        skyGrad.addColorStop(0.5, '#090d16');
        skyGrad.addColorStop(1, '#0f172a');
      } else if (isSunset) {
        skyGrad.addColorStop(0, '#4c0519');
        skyGrad.addColorStop(0.45, '#9f1239');
        skyGrad.addColorStop(0.8, '#d97706');
        skyGrad.addColorStop(1, '#fde047');
      } else if (isMorning) {
        skyGrad.addColorStop(0, '#0c4a6e');
        skyGrad.addColorStop(0.5, '#0284c7');
        skyGrad.addColorStop(0.85, '#fdba74');
        skyGrad.addColorStop(1, '#fef08a');
      } else {
        skyGrad.addColorStop(0, currentLocation.skyColors[0]);
        skyGrad.addColorStop(0.55, currentLocation.skyColors[1]);
        skyGrad.addColorStop(1, currentLocation.skyColors[2]);
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, horizonY + 2);

      // Night Sky Stars
      if (isNight) {
        const starSeeds = [
          [0.1, 0.06], [0.18, 0.14], [0.26, 0.05], [0.34, 0.18], [0.42, 0.08],
          [0.55, 0.05], [0.62, 0.16], [0.71, 0.07], [0.82, 0.12], [0.89, 0.04],
          [0.94, 0.19], [0.15, 0.22], [0.78, 0.23], [0.48, 0.21]
        ];
        starSeeds.forEach(([sx, sy], idx) => {
          const starAlpha = 0.35 + Math.sin(t * 2.8 + idx * 1.7) * 0.45;
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, Math.min(1, starAlpha))})`;
          ctx.fillRect(sx * w, sy * horizonY, 1.6, 1.6);
        });
      }

      // Sun / Moon Celestial Disc
      const celestialX = w * (isNight ? 0.32 : isSunset ? 0.65 : isMorning ? 0.35 : 0.5);
      const celestialY = horizonY * (isSunset ? 0.78 : isMorning ? 0.72 : 0.6);
      const celestialGrad = ctx.createRadialGradient(celestialX, celestialY, 2, celestialX, celestialY, 36);

      if (isNight) {
        // Glowing Crescent Moon
        celestialGrad.addColorStop(0, '#f8fafc');
        celestialGrad.addColorStop(0.35, '#cbd5e1');
        celestialGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = celestialGrad;
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, 22, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(celestialX + 4.5, celestialY - 2, 9.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const glowColor = isSunset ? '#fb923c' : isMorning ? '#fde047' : currentLocation.sunColor;
        celestialGrad.addColorStop(0, glowColor);
        celestialGrad.addColorStop(0.45, isSunset ? '#b91c1c' : currentLocation.skyColors[2]);
        celestialGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = celestialGrad;
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, 36, 0, Math.PI * 2);
        ctx.fill();
      }

      // Distant Pyramids, Sand Dunes & Palm Silhouettes on Far Nile Bank
      const bankColor = isNight ? '#070b14' : isSunset ? '#3b0714' : isMorning ? '#1e293b' : '#291c12';
      ctx.fillStyle = bankColor;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.quadraticCurveTo(w * 0.15, horizonY - 8, w * 0.35, horizonY - 4);
      ctx.quadraticCurveTo(w * 0.65, horizonY - 10, w, horizonY - 3);
      ctx.lineTo(w, horizonY + 2);
      ctx.lineTo(0, horizonY + 2);
      ctx.closePath();
      ctx.fill();

      // Great Pyramids on Horizon with Lit Facets
      ctx.fillStyle = isNight ? '#0b1120' : isSunset ? '#4c0519' : '#3a2618';
      ctx.beginPath();
      ctx.moveTo(w * 0.07, horizonY);
      ctx.lineTo(w * 0.21, horizonY - 36);
      ctx.lineTo(w * 0.35, horizonY);
      ctx.closePath();
      ctx.fill();

      // Sunlit pyramid facet
      ctx.fillStyle = isNight
        ? 'rgba(148, 163, 184, 0.12)'
        : isSunset
        ? 'rgba(251, 146, 60, 0.28)'
        : 'rgba(253, 224, 71, 0.22)';
      ctx.beginPath();
      ctx.moveTo(w * 0.21, horizonY - 36);
      ctx.lineTo(w * 0.35, horizonY);
      ctx.lineTo(w * 0.24, horizonY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = isNight ? '#090d16' : isSunset ? '#3b0610' : '#2e1d12';
      ctx.beginPath();
      ctx.moveTo(w * 0.68, horizonY);
      ctx.lineTo(w * 0.79, horizonY - 28);
      ctx.lineTo(w * 0.9, horizonY);
      ctx.closePath();
      ctx.fill();

      // Far-bank Nile Date Palms
      const palmXList = [w * 0.04, w * 0.38, w * 0.64, w * 0.93];
      palmXList.forEach((px, pIdx) => {
        const sway = Math.sin(t * 1.4 + pIdx) * 1.8;
        ctx.strokeStyle = bankColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, horizonY);
        ctx.quadraticCurveTo(px + sway * 0.5, horizonY - 10, px + sway, horizonY - 18);
        ctx.stroke();
        for (let f = -2; f <= 2; f++) {
          ctx.beginPath();
          ctx.moveTo(px + sway, horizonY - 18);
          ctx.quadraticCurveTo(px + sway + f * 4, horizonY - 21, px + sway + f * 7, horizonY - 15 + Math.abs(f));
          ctx.stroke();
        }
      });

      // Soft Drifting Clouds in Sky
      if (!isNight) {
        ctx.save();
        ctx.fillStyle = isSunset
          ? 'rgba(253, 186, 116, 0.18)'
          : isMorning
          ? 'rgba(254, 249, 195, 0.24)'
          : 'rgba(255, 255, 255, 0.22)';
        for (let c = 0; c < 3; c++) {
          const cx = ((w * (0.2 + c * 0.33) + t * (4 + c * 1.5)) % (w + 80)) - 40;
          const cy = horizonY * (0.28 + (c % 2) * 0.2);
          ctx.beginPath();
          ctx.ellipse(cx, cy, 26 + c * 6, 5.5, 0, 0, Math.PI * 2);
          ctx.ellipse(cx - 12, cy + 2, 16, 4, 0, 0, Math.PI * 2);
          ctx.ellipse(cx + 14, cy + 1.5, 18, 4.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 2. Realistic Multi-Depth Nile Water Surface
      const waterGrad = ctx.createLinearGradient(0, horizonY, 0, h);
      if (isNight) {
        waterGrad.addColorStop(0, '#040d1a');
        waterGrad.addColorStop(0.28, '#062038');
        waterGrad.addColorStop(0.68, '#082f49');
        waterGrad.addColorStop(1, '#041322');
      } else if (isSunset) {
        waterGrad.addColorStop(0, '#7c2d12');
        waterGrad.addColorStop(0.25, '#5b1c14');
        waterGrad.addColorStop(0.65, '#164e63');
        waterGrad.addColorStop(1, '#082f49');
      } else if (isMorning) {
        waterGrad.addColorStop(0, '#0e7490');
        waterGrad.addColorStop(0.3, '#0284c7');
        waterGrad.addColorStop(0.7, '#0369a1');
        waterGrad.addColorStop(1, '#083344');
      } else {
        waterGrad.addColorStop(0, currentLocation.waterColors[0]);
        waterGrad.addColorStop(0.3, currentLocation.waterColors[1]);
        waterGrad.addColorStop(0.7, currentLocation.waterColors[2]);
        waterGrad.addColorStop(1, currentLocation.waterColors[3]);
      }
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, horizonY, w, h - horizonY);

      // 2.1. Dynamic Sun/Moon Shimmering Reflection Path on Water
      const shimmerCenterX = celestialX;
      const shimmerBaseColor = isNight
        ? 'rgba(186, 230, 253,'
        : isSunset
        ? 'rgba(251, 146, 60,'
        : isMorning
        ? 'rgba(254, 240, 138,'
        : 'rgba(253, 224, 71,';
      for (let sr = 0; sr < 14; sr++) {
        const srRatio = sr / 14;
        const sy = horizonY + 4 + Math.pow(srRatio, 1.35) * (h - horizonY - 22);
        const spread = (6 + srRatio * 42) + Math.sin(t * 3.2 + sr * 0.9) * 5;
        const sxOffset = Math.sin(t * 2.4 + sr * 1.3) * (3 + srRatio * 8);
        const alpha = (1 - srRatio * 0.65) * 0.28;
        ctx.fillStyle = `${shimmerBaseColor}${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(shimmerCenterX + sxOffset, sy, spread, 1.2 + srRatio * 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2.2. Sunken Barge Silhouette (Deep Water Landmark)
      const bargeX = w * 0.68;
      const bargeY = h * 0.72;
      ctx.save();
      ctx.fillStyle = 'rgba(7, 24, 42, 0.55)';
      ctx.beginPath();
      ctx.moveTo(bargeX - 42, bargeY + 8);
      ctx.quadraticCurveTo(bargeX, bargeY + 18, bargeX + 48, bargeY + 5);
      ctx.lineTo(bargeX + 38, bargeY - 6);
      ctx.quadraticCurveTo(bargeX, bargeY + 2, bargeX - 35, bargeY - 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(12, 38, 62, 0.65)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(bargeX - 5, bargeY);
      ctx.lineTo(bargeX - 18, bargeY - 32);
      ctx.stroke();
      ctx.fillStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.beginPath();
      ctx.arc(bargeX + 15, bargeY + 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2.3. Active Cold Current Animated Azure Ribbon
      const ccZoneId = activeColdCurrent.zoneId;
      const ccCenterX =
        ccZoneId === 'shallow' ? w * 0.32 : ccZoneId === 'canyon' ? w * 0.48 : w * 0.64;
      const ccGrad = ctx.createRadialGradient(ccCenterX, h * 0.65, 5, ccCenterX, h * 0.65, 68);
      ccGrad.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
      ccGrad.addColorStop(0.6, 'rgba(14, 165, 233, 0.1)');
      ccGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ccGrad;
      ctx.beginPath();
      ctx.ellipse(ccCenterX, h * 0.65, 62, 24, 0, 0, Math.PI * 2);
      ctx.fill();

      // Multi-layered Realistic Nile Wave Crest Glints
      for (let layer = 0; layer < 7; layer++) {
        const depthRatio = layer / 6;
        const baseY = horizonY + 8 + Math.pow(depthRatio, 1.28) * (h - horizonY - 16);
        const amp = 1.2 + depthRatio * 3.5;
        const freq = 0.038 - depthRatio * 0.015;
        const speed = (0.75 + depthRatio * 1.25) * (layer % 2 === 0 ? 1 : -0.85);

        ctx.strokeStyle = isNight
          ? `rgba(125, 211, 252, ${0.09 + depthRatio * 0.11})`
          : isMorning
          ? `rgba(254, 240, 138, ${0.15 + depthRatio * 0.16})`
          : isSunset
          ? `rgba(253, 186, 116, ${0.15 + depthRatio * 0.15})`
          : layer % 2 === 0
          ? `rgba(186, 230, 253, ${0.16 + depthRatio * 0.15})`
          : `rgba(253, 224, 71, ${0.09 + (1 - depthRatio) * 0.12})`;
        ctx.lineWidth = 0.9 + depthRatio * 1.25;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 10) {
          const y =
            baseY +
            Math.sin(x * freq + t * speed + layer) * amp +
            Math.cos(x * freq * 1.7 - t * speed * 0.6) * (amp * 0.35);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 3. Cast Fishing Net Buoys on Left Side of Water
      if (fishingState.activeNet) {
        const netReady = Date.now() >= fishingState.activeNet.readyAt;
        const netSpoiled = Date.now() >= fishingState.activeNet.spoilAt;
        const netX = w * 0.18;
        const netY = h * 0.56 + Math.sin(t * 2.5) * 2.5;

        ctx.save();
        ctx.strokeStyle = netSpoiled
          ? 'rgba(239, 68, 68, 0.85)'
          : netReady
          ? 'rgba(52, 211, 153, 0.95)'
          : 'rgba(251, 191, 36, 0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.ellipse(netX, netY, 28, 11, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        [-24, -8, 8, 24].forEach((dx, i) => {
          const by = netY + Math.sin(i * 1.5 + t * 3) * 3;
          ctx.fillStyle = netSpoiled ? '#ef4444' : netReady ? '#10b981' : '#f59e0b';
          ctx.beginPath();
          ctx.arc(netX + dx, by - 4, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }

      // 4. Underwater Swimming Fish Shadows
      swimmers.forEach((sw, idx) => {
        sw.x += sw.speed * sw.dir * 0.012;
        if (sw.dir > 0 && sw.x > 1.12) sw.x = -0.12;
        if (sw.dir < 0 && sw.x < -0.12) sw.x = 1.12;

        const fx = sw.x * w;
        const fy = sw.y * h + Math.sin(t * 2 + idx) * 4;
        const sc = sw.scale;

        ctx.save();
        ctx.translate(fx, fy);
        ctx.scale(sw.dir * sc, sc * 0.65);
        ctx.fillStyle = `rgba(4, 24, 42, ${0.28 + sw.depth * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        const wag = Math.sin(t * 7 + idx * 2) * 4;
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(-26, -7 + wag);
        ctx.lineTo(-26, 7 + wag);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });

      // 4.5. Foreground Nile Papyrus Reeds & Lotus Lily Pads on Left Shore
      ctx.save();
      const lilyPads = [
        { x: w * 0.09, y: h * 0.86, rx: 14, ry: 5.5, hasLotus: true },
        { x: w * 0.16, y: h * 0.91, rx: 11, ry: 4.5, hasLotus: false }
      ];
      lilyPads.forEach((lp, idx) => {
        const bob = Math.sin(t * 2.2 + idx) * 1.5;
        ctx.fillStyle = isNight ? '#064e3b' : '#15803d';
        ctx.beginPath();
        ctx.ellipse(lp.x, lp.y + bob, lp.rx, lp.ry, 0, 0.25, Math.PI * 1.9);
        ctx.lineTo(lp.x, lp.y + bob);
        ctx.closePath();
        ctx.fill();
        if (lp.hasLotus) {
          ctx.fillStyle = '#f472b6';
          for (let p = -2; p <= 2; p++) {
            ctx.beginPath();
            ctx.ellipse(lp.x + p * 2.2, lp.y + bob - 3, 2.2, 4.5, p * 0.25, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(lp.x, lp.y + bob - 2.5, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Swaying Papyrus stalks on bottom-left corner
      const reedOffsets = [8, 16, 25, 34];
      reedOffsets.forEach((rx, rIdx) => {
        const reedSway = Math.sin(t * 1.8 + rIdx * 0.7) * 4;
        const topX = rx + reedSway;
        const topY = h - 38 - (rIdx % 2) * 12;
        ctx.strokeStyle = isNight ? '#064e3b' : '#166534';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(rx, h);
        ctx.quadraticCurveTo(rx + reedSway * 0.4, h - 22, topX, topY);
        ctx.stroke();
        // Papyrus umbel tuft
        ctx.strokeStyle = isNight ? '#047857' : '#4ade80';
        ctx.lineWidth = 1;
        for (let u = -2; u <= 2; u++) {
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.lineTo(topX + u * 3.2, topY - 6 + Math.abs(u));
          ctx.stroke();
        }
      });
      ctx.restore();

      // 5. Float & High-Detail Rod Coordinates (Anchored to selected Depth Zone!)
      const rodBaseX = w * 0.84;
      const rodBaseY = h * 0.99;
      const biteShake =
        curPhase === 'bite'
          ? Math.sin(t * 36) * 6
          : curPhase === 'reeling'
          ? Math.sin(t * (isThrash ? 45 : 24)) * (isThrash ? 7 : 3)
          : curPhase === 'nibble'
          ? Math.sin(t * 20) * 2.5
          : 0;
      const rodBend =
        curPhase === 'reeling'
          ? 22 + (tensionRef.current / 100) * 28
          : curPhase === 'bite'
          ? 19
          : curPhase === 'casting'
          ? -12
          : 4;

      const rodTipX = w * 0.56 - rodBend * 0.62 + biteShake * 0.4;
      const rodTipY = h * 0.2 + rodBend * 0.88 + Math.sin(t * 2.2) * 2;
      const rodCtrlX = w * 0.72 - rodBend * 0.2;
      const rodCtrlY = h * 0.5 + rodBend * 0.42;

      const targetFloatX = w * activeDepthZoneObj.floatTargetXRatio;
      const targetFloatY = h * activeDepthZoneObj.floatTargetYRatio;

      let floatX = targetFloatX;
      let floatY = targetFloatY;
      let showFloat = false;

      if (curPhase === 'casting') {
        showFloat = true;
        const p = Math.min(1, Math.max(0, castProgRef.current));
        floatX = rodTipX + (targetFloatX - rodTipX) * p;
        const arcLift = Math.sin(p * Math.PI) * 58;
        floatY = rodTipY + (targetFloatY - rodTipY) * p - arcLift;
      } else if (
        curPhase === 'waiting' ||
        curPhase === 'nibble' ||
        curPhase === 'bite' ||
        curPhase === 'reeling'
      ) {
        showFloat = true;
        const reelPull = curPhase === 'reeling' ? (reelProgRef.current / 100) * 0.65 : 0;
        // Bobber plunges deep underwater during bite
        const bobOffset =
          curPhase === 'bite'
            ? 14 + Math.sin(t * 36) * 6.5
            : curPhase === 'nibble'
            ? 4 + Math.sin(t * 22) * 3.2
            : curPhase === 'reeling'
            ? 5 + Math.sin(t * (isThrash ? 38 : 20)) * (isThrash ? 6.5 : 3.2)
            : Math.sin(t * 3.2) * 2.5;
        floatX =
          targetFloatX +
          (rodBaseX * 0.68 - targetFloatX) * reelPull +
          (curPhase === 'reeling' ? Math.sin(t * (isThrash ? 18 : 9)) * (isThrash ? 22 : 11) : 0);
        floatY = targetFloatY + (h * 0.84 - targetFloatY) * reelPull + bobOffset;
      }

      // 6. Water Ripples, Splash Droplets & High-Detail Egyptian Bobber
      if (showFloat && (curPhase !== 'casting' || castProgRef.current > 0.85)) {
        // Ambient concentric water ripples while bobber rests on water
        if (curPhase === 'waiting' || curPhase === 'nibble') {
          for (let wr = 0; wr < 3; wr++) {
            const ripProg = (t * 0.85 + wr * 0.33) % 1;
            const rRadX = 6 + ripProg * (curPhase === 'nibble' ? 34 : 24);
            const rRadY = rRadX * 0.38;
            ctx.strokeStyle = `rgba(186, 230, 253, ${(1 - ripProg) * (curPhase === 'nibble' ? 0.7 : 0.48)})`;
            ctx.lineWidth = curPhase === 'nibble' ? 1.7 : 1.15;
            ctx.beginPath();
            ctx.ellipse(floatX, floatY + 3, rRadX, rRadY, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        const rippleCount = curPhase === 'bite' || curPhase === 'reeling' ? 4 : 2;
        for (let r = 0; r < rippleCount; r++) {
          const rPhase =
            (t * (curPhase === 'bite' || curPhase === 'reeling' ? 2.5 : 0.9) + r / rippleCount) % 1;
          const rx = 8 + rPhase * (curPhase === 'bite' || isThrash ? 45 : 25);
          const ry = rx * 0.38;
          ctx.strokeStyle =
            curPhase === 'reeling' && isThrash
              ? `rgba(252, 165, 165, ${(1 - rPhase) * 0.8})`
              : `rgba(186, 230, 253, ${(1 - rPhase) * 0.7})`;
          ctx.lineWidth = curPhase === 'bite' || isThrash ? 2.3 : 1.3;
          ctx.beginPath();
          ctx.ellipse(floatX, floatY + 4, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Splash droplets flying up on active bite or fish thrashing
        if (curPhase === 'bite' || (curPhase === 'reeling' && isThrash)) {
          ctx.save();
          ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
          for (let sp = 0; sp < 6; sp++) {
            const spPhase = (t * 4.5 + sp * 0.55) % 1;
            const angle = -Math.PI * 0.18 - (sp / 5) * Math.PI * 0.64;
            const dist = spPhase * 22;
            const dx = floatX + Math.cos(angle) * dist;
            const dy = floatY + Math.sin(angle) * dist + spPhase * spPhase * 16;
            ctx.beginPath();
            ctx.arc(dx, dy, (1 - spPhase) * 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // Hooked Fish Shadow thrashing below the bobber
        if (curPhase === 'bite' || curPhase === 'reeling') {
          ctx.save();
          ctx.translate(floatX + Math.sin(t * 14) * 5, floatY + 11);
          ctx.fillStyle = 'rgba(2, 12, 27, 0.72)';
          ctx.beginPath();
          ctx.ellipse(0, 0, 24, 9.5, Math.sin(t * 6) * 0.22, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // High-Detail Egyptian Bobber Sprite
        ctx.save();
        ctx.translate(floatX, floatY);
        ctx.rotate(
          curPhase === 'bite'
            ? Math.sin(t * 25) * 0.38
            : curPhase === 'reeling'
            ? isThrash
              ? Math.sin(t * 35) * 0.52
              : -0.42
            : Math.sin(t * 2.5) * 0.08
        );

        // Golden aura around bobber during bite or active cold current/chum
        if (curPhase === 'bite' || Boolean(activeBait) || activeColdCurrent.zoneId === selectedDepthZoneId) {
          const auraGrad = ctx.createRadialGradient(0, -4, 2, 0, -4, curPhase === 'bite' ? 20 : 13);
          auraGrad.addColorStop(0, curPhase === 'bite' ? 'rgba(250, 204, 21, 0.75)' : 'rgba(56, 189, 248, 0.45)');
          auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = auraGrad;
          ctx.beginPath();
          ctx.arc(0, -4, curPhase === 'bite' ? 20 : 13, 0, Math.PI * 2);
          ctx.fill();
        }

        // Submerged lower quill stem
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.lineTo(0, 12);
        ctx.stroke();

        // Main painted Egyptian balsa body (Gold & Turquoise lower half, Crimson upper dome)
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.ellipse(0, 2, 5.8, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Turquoise middle band
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(-5.4, -2, 10.8, 3);

        // Crimson top dome
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.ellipse(0, -3, 5.5, 5.8, 0, Math.PI, Math.PI * 2);
        ctx.fill();

        // Specular highlight on bobber body
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.beginPath();
        ctx.ellipse(-2, -2, 1.5, 4, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // High-visibility antenna tip with glowing bead
        ctx.strokeStyle = curPhase === 'bite' ? '#fef08a' : '#facc15';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(0, -19);
        ctx.stroke();

        ctx.fillStyle = curPhase === 'bite' ? '#22d3ee' : '#fb7185';
        ctx.beginPath();
        ctx.arc(0, -19.5, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 7. Realistic Taut / Vibrating Fishing Line
      const lineHighTension = curPhase === 'reeling' && tensionRef.current >= 78;
      const lineMedTension = curPhase === 'reeling' && tensionRef.current >= 48;
      ctx.save();
      ctx.strokeStyle = lineHighTension
        ? '#ef4444'
        : lineMedTension
        ? '#fbbf24'
        : curPhase === 'bite'
        ? '#38bdf8'
        : 'rgba(241, 245, 249, 0.92)';
      ctx.lineWidth = curPhase === 'reeling' ? 1.9 : 1.3;
      if (lineHighTension || curPhase === 'bite') {
        ctx.shadowColor = lineHighTension ? '#ef4444' : '#38bdf8';
        ctx.shadowBlur = 6;
      }
      ctx.beginPath();
      ctx.moveTo(rodTipX, rodTipY);
      if (showFloat) {
        const midX = (rodTipX + floatX) * 0.5;
        const isTaut = curPhase === 'reeling' || curPhase === 'bite';
        const vibration = isTaut
          ? Math.sin(t * (lineHighTension ? 75 : 42)) * (lineHighTension ? 3.5 : 1.8)
          : 0;
        const slack = isTaut ? vibration : 18 + Math.sin(t * 2.5) * 2;
        const midY = (rodTipY + floatY) * 0.5 + slack;
        ctx.quadraticCurveTo(midX + vibration * 0.5, midY, floatX, floatY - 18);
      } else {
        ctx.quadraticCurveTo(rodTipX - 8, rodTipY + 28, rodTipX - 4, rodTipY + 46);
      }
      ctx.stroke();
      ctx.restore();

      // 8. High-Detail Foreground Fishing Rod with Guides & Spinning Reel
      ctx.save();
      // Drop shadow
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 7.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(rodBaseX + 4, rodBaseY);
      ctx.quadraticCurveTo(rodCtrlX + 3, rodCtrlY + 4, rodTipX + 3, rodTipY + 4);
      ctx.stroke();

      // Guide rings along the rod blank
      [0.32, 0.55, 0.78, 0.96].forEach((gt) => {
        const omt = 1 - gt;
        const gx = omt * omt * rodBaseX + 2 * omt * gt * rodCtrlX + gt * gt * rodTipX;
        const gy = omt * omt * rodBaseY + 2 * omt * gt * rodCtrlY + gt * gt * rodTipY;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(gx - 3, gy + 2, 2.8 * (1 - gt * 0.35), 0, Math.PI * 2);
        ctx.stroke();
      });

      // Main tapered rod blank
      const rodGrad = ctx.createLinearGradient(rodBaseX, rodBaseY, rodTipX, rodTipY);
      if (equippedRod.level >= 5) {
        rodGrad.addColorStop(0, '#f59e0b');
        rodGrad.addColorStop(0.5, '#22d3ee');
        rodGrad.addColorStop(1, '#fde047');
      } else if (equippedRod.level === 4) {
        rodGrad.addColorStop(0, '#92400e');
        rodGrad.addColorStop(0.5, '#fbbf24');
        rodGrad.addColorStop(1, '#fef08a');
      } else if (equippedRod.level === 3) {
        rodGrad.addColorStop(0, '#1e293b');
        rodGrad.addColorStop(0.5, '#0284c7');
        rodGrad.addColorStop(1, '#7dd3fc');
      } else if (equippedRod.level === 2) {
        rodGrad.addColorStop(0, '#365314');
        rodGrad.addColorStop(0.5, '#65a30d');
        rodGrad.addColorStop(1, '#bef264');
      } else {
        rodGrad.addColorStop(0, '#78350f');
        rodGrad.addColorStop(0.5, '#b45309');
        rodGrad.addColorStop(1, '#fcd34d');
      }

      ctx.strokeStyle = rodGrad;
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(rodBaseX, rodBaseY);
      ctx.quadraticCurveTo(rodCtrlX, rodCtrlY, rodTipX, rodTipY);
      ctx.stroke();

      // Ornate Egyptian Cork/Gold Handle Grip & Spinning Reel at base
      const reelT = 0.22;
      const omtR = 1 - reelT;
      const reelX = omtR * omtR * rodBaseX + 2 * omtR * reelT * rodCtrlX + reelT * reelT * rodTipX;
      const reelY = omtR * omtR * rodBaseY + 2 * omtR * reelT * rodCtrlY + reelT * reelT * rodTipY;

      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(reelX - 7, reelY + 5, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Rotating reel crank handle when reeling
      const crankAngle = curPhase === 'reeling' ? t * (holdingReelRef.current ? 18 : 5) : 0.6;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(reelX - 7, reelY + 5);
      ctx.lineTo(reelX - 7 + Math.cos(crankAngle) * 7, reelY + 5 + Math.sin(crankAngle) * 7);
      ctx.stroke();
      ctx.restore();

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [activeTab, equippedRod.level, currentLocation, fishingState.activeNet, selectedDepthZoneId, activeBait, activeColdCurrent.zoneId]);

  // Filtered fishes for the Collection Album tab
  const filteredFishes = useMemo(() => {
    return fishingConfig.fishes.filter((fish) => {
      if (collectionLocationFilter !== 'all' && fish.locationId !== collectionLocationFilter) {
        return false;
      }
      const isCaught = (fishingState.collection[fish.id]?.count || 0) > 0;
      if (collectionStatusFilter === 'caught') return isCaught;
      if (collectionStatusFilter === 'uncaught') return !isCaught;
      return true;
    });
  }, [
    fishingConfig.fishes,
    fishingState.collection,
    collectionLocationFilter,
    collectionStatusFilter
  ]);

  const activeNetStatus = useMemo(() => {
    const net = fishingState.activeNet;
    if (!net) return null;
    if (nowMs < net.readyAt) {
      const remSec = Math.ceil((net.readyAt - nowMs) / 1000);
      const totalSec = Math.max(1, Math.round((net.readyAt - net.castAt) / 1000));
      const pct = Math.min(100, Math.max(0, Math.round(((totalSec - remSec) / totalSec) * 100)));
      return { state: 'catching' as const, remSec, pct };
    }
    if (nowMs < net.spoilAt) {
      const spoilRemSec = Math.ceil((net.spoilAt - nowMs) / 1000);
      return { state: 'ready' as const, spoilRemSec };
    }
    return { state: 'spoiled' as const };
  }, [fishingState.activeNet, nowMs]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-1.5 sm:p-2 backdrop-blur-sm">
      <div className="relative flex h-[94dvh] max-h-[820px] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border-2 border-cyan-500/80 bg-gradient-to-b from-slate-950 via-[#071324] to-slate-950 text-white shadow-[0_0_30px_rgba(6,182,212,0.3)]">
        {/* Top Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-cyan-500/40 bg-slate-950/90 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/60 bg-cyan-950/80 text-lg">
              🎣
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xs font-black uppercase tracking-wider text-cyan-200">
                Рыбалка Древнего Египта
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-300 tabular-nums">
                <span>
                  Улов: <strong className="text-emerald-300">{fishingState.totalFishCaught}</strong>
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <span>Садок:</span>
                  <strong className={isKeepnetFull ? 'text-red-400' : 'text-cyan-300'}>
                    {keepnetFishList.length}/{keepnetCapacity}
                  </strong>
                  <button
                    type="button"
                    onClick={handleSellKeepnetCatch}
                    disabled={keepnetFishList.length === 0}
                    title={
                      keepnetFishList.length > 0
                        ? `Продать весь садок (+${keepnetTotals.gold} 🪙${
                            keepnetTotals.crystals > 0 ? ` +${keepnetTotals.crystals} 💎` : ''
                          })`
                        : 'Садок пуст'
                    }
                    className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[8px] font-black transition-all cursor-pointer ${
                      keepnetFishList.length > 0
                        ? 'border border-amber-300 bg-amber-400 text-slate-950 hover:bg-amber-300 active:scale-95 shadow-xs'
                        : 'border border-slate-700 bg-slate-900 text-slate-500 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <span>🪙</span>
                    <span>Продать всё</span>
                    {keepnetFishList.length > 0 && <span>(+{keepnetTotals.gold}🪙)</span>}
                  </button>
                </span>
                <span>·</span>
                <span>
                  Альбом: <strong className="text-amber-300">{uniqueCaughtCount}/50</strong>
                </span>
                <span>·</span>
                <span>
                  Сети: <strong className="text-teal-300">{fishingState.netLicenseUses || 0} 📜</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenLeaderboard && (
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="flex items-center gap-1 rounded-lg border border-amber-400/80 bg-gradient-to-b from-amber-500/30 to-amber-950/90 px-2 py-1 text-[9.5px] font-black text-amber-200 hover:border-yellow-300 hover:text-white active:scale-95 shadow cursor-pointer"
                title="Открыть еженедельный рейтинг лучших рыболовов Нила (по весу пойманной рыбы)"
              >
                <span>🏆</span>
                <span>Рейтинг</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-bold text-slate-300 hover:border-red-400 hover:text-white active:scale-95 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Live Synchronized Player Resources Strip */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-1.5 border-b border-slate-800 bg-slate-900/90 px-3 py-1.5 text-[10px] font-bold tabular-nums">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1 text-amber-300">
              <GoldCoinIcon size="sm" />
              <span>{hero.gold.toLocaleString('ru-RU')}</span>
            </span>
            <span className="flex items-center gap-1 text-cyan-200">
              <CrystalIcon size="sm" />
              <span>{hero.crystals.toLocaleString('ru-RU')}</span>
            </span>
            <span className="flex items-center gap-1 text-sky-300">
              <span>⚡</span>
              <span>
                {hero.energy}/{hero.maxEnergy}
              </span>
            </span>
            <span className="flex items-center gap-1 text-purple-300" title="Реликвии для Алтаря Модификации">
              <span>🏺</span>
              <span>{relicsInBagCount}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {expBuffRemainingSec > 0 && (
              <span className="rounded border border-purple-400/60 bg-purple-950/90 px-1.5 py-0.5 text-[8.5px] font-black text-purple-200">
                ✨ +{fishingState.expBuffPct || 50}% EXP ({Math.floor(expBuffRemainingSec / 60)}м{' '}
                {expBuffRemainingSec % 60}с)
              </span>
            )}
            {hero.energy < (fishingConfig.energyPerCast || 2) &&
              onUseEnergyPotion &&
              hero.enPotions > 0 && (
                <button
                  onClick={onUseEnergyPotion}
                  className="rounded border border-sky-400 bg-sky-900/90 px-1.5 py-0.5 text-[8.5px] font-black text-sky-100 hover:bg-sky-800 cursor-pointer"
                >
                  +20⚡ Зелье ({hero.enPotions})
                </button>
              )}
          </div>
        </div>

        {/* 5 Main Navigation Tabs */}
        <div className="grid shrink-0 grid-cols-5 gap-1 border-b border-amber-500/30 bg-slate-950 p-1">
          <button
            onClick={() => setActiveTab('play')}
            className={`flex flex-col items-center justify-center rounded-lg py-1 text-[8.5px] font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'play'
                ? 'border border-cyan-400 bg-gradient-to-b from-cyan-700 to-cyan-950 text-white shadow'
                : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-sm leading-none">🎣</span>
            <span className="mt-0.5">Лов</span>
          </button>

          <button
            onClick={() => setActiveTab('museum')}
            className={`relative flex flex-col items-center justify-center rounded-lg py-1 text-[8.5px] font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'museum'
                ? 'border border-amber-400 bg-gradient-to-b from-amber-700 to-amber-950 text-white shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-sm leading-none">🏛️</span>
            <span className="mt-0.5 text-amber-200">
              Трофеи ({museumSummary.collectedCount}/8)
            </span>
            {museumSummary.collectedCount > 0 && (
              <span className="absolute -top-1 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('collection')}
            className={`flex flex-col items-center justify-center rounded-lg py-1 text-[8.5px] font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'collection'
                ? 'border border-sky-400 bg-gradient-to-b from-sky-700 to-sky-950 text-white shadow'
                : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-sm leading-none">📘</span>
            <span className="mt-0.5">Альбом ({uniqueCaughtCount}/50)</span>
          </button>

          <button
            onClick={() => setActiveTab('shop')}
            className={`flex flex-col items-center justify-center rounded-lg py-1 text-[8.5px] font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'shop'
                ? 'border border-emerald-400 bg-gradient-to-b from-emerald-700 to-emerald-950 text-white shadow'
                : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-sm leading-none">🛒</span>
            <span className="mt-0.5">Лавка</span>
          </button>

          <button
            onClick={() => setActiveTab('achievements')}
            className={`relative flex flex-col items-center justify-center rounded-lg py-1 text-[8.5px] font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'achievements'
                ? 'border border-purple-400 bg-gradient-to-b from-purple-700 to-purple-950 text-white shadow'
                : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-sm leading-none">🏆</span>
            <span className="mt-0.5">Ачивки</span>
            {claimableFishingAchievementsCount > 0 && (
              <span className="absolute -top-1 -right-0.5 rounded-full bg-red-600 px-1 text-[7px] font-black text-white animate-pulse">
                {claimableFishingAchievementsCount}
              </span>
            )}
          </button>
        </div>

        {/* TAB CONTENT */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5">
          {/* ================= TAB 1: НА РЫБАЛКУ ================= */}
          {activeTab === 'play' && (
            <div className="flex flex-col gap-2">
              {/* Keepnet (Садок) Bar + Quick Sell Catch Button */}
              <div
                className={`rounded-xl border p-2 transition-colors ${
                  isKeepnetFull
                    ? 'border-red-500/80 bg-red-950/35'
                    : 'border-cyan-500/40 bg-slate-900/95'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black tabular-nums">
                      <span>🪣</span>
                      <span className={isKeepnetFull ? 'text-red-300' : 'text-cyan-200'}>
                        Садок: {keepnetFishList.length} / {keepnetCapacity}
                      </span>
                      <span className="text-[8.5px] font-bold text-slate-400">
                        (Ур. {fishingState.keepnetLevel || 1})
                      </span>
                      {isKeepnetFull && (
                        <span className="rounded bg-red-600/90 px-1.5 py-0.5 text-[7.5px] font-black uppercase text-white">
                          ПОЛОН!
                        </span>
                      )}
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isKeepnetFull
                            ? 'bg-red-500'
                            : keepnetFishList.length >= keepnetCapacity * 0.75
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((keepnetFishList.length / Math.max(1, keepnetCapacity)) * 100)
                          )}%`
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={handleSellKeepnetCatch}
                      disabled={keepnetFishList.length === 0}
                      className={`rounded-lg px-2.5 py-1.5 text-[9.5px] font-black transition-all cursor-pointer ${
                        keepnetFishList.length > 0
                          ? 'border border-amber-300 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow hover:brightness-110 active:scale-95'
                          : 'border border-slate-800 bg-slate-950 text-slate-500 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      💰 Продать улов
                      {keepnetFishList.length > 0
                        ? ` (+${keepnetTotals.gold}🪙${
                            keepnetTotals.crystals > 0 ? ` +${keepnetTotals.crystals}💎` : ''
                          })`
                        : ''}
                    </button>
                    {(fishingState.keepnetLevel || 1) < 5 && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('shop');
                          setShopSubTab('keepnet');
                        }}
                        title="Увеличить вместимость садка в Магазине рыбалки"
                        className="rounded-lg border border-cyan-500/60 bg-cyan-950/90 px-2 py-1.5 text-[9px] font-black text-cyan-200 hover:bg-cyan-900 cursor-pointer"
                      >
                        +Места
                      </button>
                    )}
                  </div>
                </div>

                {/* Daily Quest Fish Species Tracker */}
                {dailyCatchQuest && (
                  <div className="mt-1.5 flex items-center justify-between rounded-lg border border-amber-500/35 bg-slate-950/90 px-2 py-1 text-[8.5px]">
                    <span className="truncate font-bold text-amber-200">
                      📋 Заказ дня: поймать «{dailyCatchQuest.targetFishName || 'рыбу'}»
                    </span>
                    <span
                      className={`ml-2 shrink-0 font-black tabular-nums ${
                        dailyCatchQuest.isCompleted ? 'text-emerald-300' : 'text-amber-300'
                      }`}
                    >
                      {dailyCatchQuest.isCompleted
                        ? '✅ Выполнено!'
                        : `${dailyCatchQuest.progress} / ${dailyCatchQuest.target}`}
                    </span>
                  </div>
                )}
              </div>

              {/* 1. Fishing Locations Selector (5 Locations, locked by Rod Level) + Dynamic Weather Banner */}
              <div className="rounded-xl border border-cyan-500/35 bg-slate-900/90 p-2 space-y-1.5">
                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-cyan-200">
                  <span>🗺️ Локации рыбалки (Удочка Ур. {equippedRod.level}/5)</span>
                  <span className="text-amber-300">
                    {currentLocation.icon} {currentLocation.shortName}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {FISHING_LOCATIONS.map((loc) => {
                    const isUnlocked = equippedRod.level >= loc.minRodLevel;
                    const isSelected = currentLocation.id === loc.id;
                    const locFishes = fishingConfig.fishes.filter((f) => f.locationId === loc.id);
                    const caughtInLoc = locFishes.filter(
                      (f) => (fishingState.collection[f.id]?.count || 0) > 0
                    ).length;
                    const locWeather = getActiveLocationWeather(loc.id, nowMs).weather;

                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => handleSelectLocation(loc.id)}
                        className={`flex flex-col items-center justify-between rounded-lg border p-1 text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'border-amber-400 bg-amber-950/80 text-white shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                            : isUnlocked
                            ? 'border-slate-700 bg-slate-950 text-slate-200 hover:border-cyan-400/60'
                            : 'border-slate-800 bg-slate-950/60 text-slate-500 opacity-65'
                        }`}
                        title={`${loc.name} — требуется удочка Ур. ${loc.minRodLevel}+ (${locWeather.icon} ${locWeather.name})`}
                      >
                        <div className="flex items-center gap-0.5 text-sm leading-none">
                          <span>{isUnlocked ? loc.icon : '🔒'}</span>
                          {isUnlocked && <span className="text-[10px]">{locWeather.icon}</span>}
                        </div>
                        <span className="mt-0.5 w-full truncate text-[7.5px] font-black leading-tight">
                          {loc.shortName.split(' ')[0]}
                        </span>
                        <span
                          className={`text-[7px] font-bold tabular-nums ${
                            isUnlocked ? 'text-emerald-300' : 'text-amber-400/80'
                          }`}
                        >
                          {isUnlocked ? `${caughtInLoc}/${locFishes.length}` : `Уд.${loc.minRodLevel}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Location Weather / Boost Strip */}
                <div
                  className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1 text-[8.5px] ${activeWeatherInfo.weather.badgeColor}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 font-black">
                      <span>{activeWeatherInfo.weather.icon}</span>
                      <span>Погода: {activeWeatherInfo.weather.name}</span>
                    </div>
                    <div className="text-[8px] opacity-90 leading-tight mt-0.5">
                      {activeWeatherInfo.weather.description}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[8px] font-black tabular-nums">
                    <div>Смена через</div>
                    <div>{formatTimer(activeWeatherInfo.remainingSec)}</div>
                  </div>
                </div>
              </div>

              {/* 2. Equipped Rod & Active Bait Selector Bar */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/50 bg-cyan-950 text-base">
                      <ItemIcon
                        icon={equippedRod.icon}
                        alt={equippedRod.name}
                        className="text-base"
                        imgClassName="h-6 w-6 object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[10px] font-black text-cyan-200">
                        {equippedRod.name} (Ур. {equippedRod.level})
                      </div>
                      <div className="text-[8.5px] text-slate-300 tabular-nums">
                        Редкие:{' '}
                        <span className="text-emerald-300">
                          +
                          {equippedRod.rareFishChanceBonusPct +
                            currentLocation.rareBonusPct +
                            (activeBait?.rareChanceBonusPct || 0) +
                            (fishingState.equippedHook?.rareFishChanceBonusPct || 0) +
                            (activeWeatherInfo.weather.rareBonusPct || 0)}
                          %
                        </span>{' '}
                        · Леска: <span className="text-sky-300">{equippedRod.lineStrength}</span>
                        {fishingState.equippedLine && (
                          <span className="text-emerald-300">
                            {' '}
                            (+{fishingState.equippedLine.stabilityBonusPct}% контр.)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setActiveTab('shop');
                        setShopSubTab('baits');
                      }}
                      className="rounded-lg border border-emerald-500/60 bg-emerald-950/80 px-2 py-1 text-[8.5px] font-black text-emerald-200 hover:bg-emerald-900 cursor-pointer whitespace-nowrap"
                    >
                      🪱 Наживки
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('shop');
                        setShopSubTab('lines');
                      }}
                      className="rounded-lg border border-cyan-500/60 bg-cyan-950/80 px-2 py-1 text-[8.5px] font-black text-cyan-200 hover:bg-cyan-900 cursor-pointer whitespace-nowrap"
                    >
                      🧵 Снасти
                    </button>
                  </div>
                </div>

                {/* 2.1. Rod Experience Progress Bar */}
                {(() => {
                  const curRodExp = fishingState.rodExp || 0;
                  const reqRodExp = getRodExpRequiredForNextLevel(equippedRod.level);
                  const isMaxLvl = equippedRod.level >= 5;
                  const rodExpPct = isMaxLvl
                    ? 100
                    : Math.min(100, Math.round((curRodExp / Math.max(1, reqRodExp)) * 100));

                  return (
                    <div className="rounded-lg border border-cyan-500/30 bg-slate-950/80 p-1.5 space-y-1">
                      <div className="flex items-center justify-between text-[8px] font-black tabular-nums">
                        <span className="text-cyan-300 flex items-center gap-1">
                          <span>⚡ Опыт удочки:</span>
                          <span className="text-white">
                            {isMaxLvl ? 'МАКС. УРОВЕНЬ' : `${curRodExp} / ${reqRodExp} EXP`}
                          </span>
                        </span>
                        <span className={isMaxLvl ? 'text-amber-300' : 'text-emerald-300'}>
                          {isMaxLvl ? '★ УР. 5' : `${rodExpPct}%`}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-amber-300 transition-all duration-300"
                          style={{ width: `${rodExpPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* 2.2. Interactive Auxiliary Gear Slots (Ornate Egyptian Stone & Gold Design) */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  {/* Slot 1: Леска */}
                  <button
                    type="button"
                    onClick={() => setIsLineModalOpen(true)}
                    className={`relative flex items-center gap-2 rounded-xl border p-2 text-left transition-all cursor-pointer ${
                      fishingState.equippedLine
                        ? 'border-amber-500/80 bg-gradient-to-br from-[#2a1708] via-[#1a0f07] to-[#0d0703] shadow-[0_2px_10px_rgba(217,119,6,0.25)] hover:border-amber-300'
                        : 'border-dashed border-amber-600/40 bg-gradient-to-br from-[#1c120a] to-[#0a0502] hover:border-amber-500'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-amber-400/70 bg-gradient-to-b from-amber-950 via-slate-900 to-amber-950 text-lg shadow-inner">
                      {fishingState.equippedLine ? fishingState.equippedLine.icon : '🧵'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-[9px] font-black uppercase tracking-wider text-amber-200">
                          {fishingState.equippedLine ? fishingState.equippedLine.name : 'Слот лески'}
                        </span>
                        <span className="text-[8px] font-black text-amber-400">
                          {fishingState.equippedLine ? '✎' : '+'}
                        </span>
                      </div>
                      {fishingState.equippedLine ? (
                        <div className="space-y-0.5 mt-0.5">
                          <div className="flex items-center justify-between text-[7px] text-slate-300 font-bold tabular-nums">
                            <span>Прочность:</span>
                            <span className="text-amber-300">
                              {fishingState.equippedLine.durability}/
                              {fishingState.equippedLine.maxDurability}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-950 border border-amber-500/40">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-yellow-300"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round(
                                    (fishingState.equippedLine.durability /
                                      Math.max(1, fishingState.equippedLine.maxDurability)) *
                                      100
                                  )
                                )}%`
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-[7.5px] text-amber-400/70 font-semibold">
                          Не установлена · Жмите +
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Slot 2: Крючок / Оснастка */}
                  <button
                    type="button"
                    onClick={() => setIsHookModalOpen(true)}
                    className={`relative flex items-center gap-2 rounded-xl border p-2 text-left transition-all cursor-pointer ${
                      fishingState.equippedHook
                        ? 'border-amber-500/80 bg-gradient-to-br from-[#2a1708] via-[#1a0f07] to-[#0d0703] shadow-[0_2px_10px_rgba(217,119,6,0.25)] hover:border-amber-300'
                        : 'border-dashed border-amber-600/40 bg-gradient-to-br from-[#1c120a] to-[#0a0502] hover:border-amber-500'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-amber-400/70 bg-gradient-to-b from-amber-950 via-slate-900 to-amber-950 text-lg shadow-inner">
                      {fishingState.equippedHook ? fishingState.equippedHook.icon : '🪝'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-[9px] font-black uppercase tracking-wider text-amber-200">
                          {fishingState.equippedHook ? fishingState.equippedHook.name : 'Оснастка'}
                        </span>
                        <span className="text-[8px] font-black text-amber-400">
                          {fishingState.equippedHook ? '✎' : '+'}
                        </span>
                      </div>
                      {fishingState.equippedHook ? (
                        <div className="space-y-0.5 mt-0.5">
                          <div className="flex items-center justify-between text-[7px] text-slate-300 font-bold tabular-nums">
                            <span>Прочность:</span>
                            <span className="text-amber-300">
                              {fishingState.equippedHook.durability}/
                              {fishingState.equippedHook.maxDurability}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-950 border border-amber-500/40">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-yellow-300"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round(
                                    (fishingState.equippedHook.durability /
                                      Math.max(1, fishingState.equippedHook.maxDurability)) *
                                      100
                                  )
                                )}%`
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-[7.5px] text-amber-400/70 font-semibold">
                          Базовый крючок · Жмите +
                        </div>
                      )}
                    </div>
                  </button>
                </div>

                {/* Quick Bait Selector Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                  <button
                    type="button"
                    onClick={() => handleSelectBait(null)}
                    className={`shrink-0 rounded-md border px-2 py-0.5 text-[8.5px] font-bold cursor-pointer ${
                      !activeBait
                        ? 'border-cyan-400 bg-cyan-950 text-cyan-200'
                        : 'border-slate-800 bg-slate-950 text-slate-400'
                    }`}
                  >
                    🪝 Без наживки
                  </button>
                  {FISHING_BAITS.map((bait) => {
                    const count = fishingState.baitsInventory[bait.id] || 0;
                    const isSelected = activeBait?.id === bait.id;
                    return (
                      <button
                        key={bait.id}
                        type="button"
                        disabled={count <= 0}
                        onClick={() => handleSelectBait(bait.id)}
                        className={`shrink-0 flex items-center gap-1 rounded-md border px-2 py-0.5 text-[8.5px] font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-amber-400 bg-amber-950/90 text-amber-200'
                            : count > 0
                            ? 'border-slate-700 bg-slate-950 text-slate-200 hover:border-amber-400/50'
                            : 'border-slate-800/70 bg-slate-950/40 text-slate-500 opacity-55 cursor-not-allowed'
                        }`}
                        title={`${bait.name}: ${bait.description}`}
                      >
                        <span>{bait.icon}</span>
                        <span>{bait.name.split(' ')[0]}</span>
                        <span className="text-emerald-300">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2.3. Карта глубин и «Холодные течения» (Depth Zones & Current Selection) */}
              <div className="rounded-xl border border-cyan-500/50 bg-gradient-to-b from-[#09182b] via-[#071322] to-slate-950 p-2 space-y-1.5">
                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
                  <span className="flex items-center gap-1 text-cyan-200">
                    <span>🌊</span>
                    <span>Карта глубин и зоны заброса</span>
                  </span>
                  <span className="text-sky-300 text-[8px] tabular-nums">
                    Текущая: {activeDepthZoneObj.depthMeters}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {FISHING_DEPTH_ZONES.map((zone) => {
                    const isSelected = selectedDepthZoneId === zone.id;
                    const isColdActive = activeColdCurrent.zoneId === zone.id;

                    return (
                      <button
                        key={zone.id}
                        type="button"
                        onClick={() => setSelectedDepthZoneId(zone.id)}
                        className={`relative flex flex-col items-center justify-between rounded-xl border p-1.5 text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'border-amber-400 bg-gradient-to-b from-amber-950/80 to-slate-950 text-white shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                            : 'border-slate-800 bg-slate-950/80 text-slate-300 hover:border-cyan-400/60'
                        }`}
                      >
                        {isColdActive && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-sky-300 bg-sky-950 px-1.5 py-0.2 text-[7px] font-black text-sky-200 animate-pulse shadow-sm">
                            ❄️ Течение +25%
                          </div>
                        )}
                        <div className="text-base leading-none mt-1">{zone.icon}</div>
                        <div className="mt-1 w-full truncate text-[8.5px] font-black text-white">
                          {zone.name.split(' ')[0]}
                        </div>
                        <div className="text-[7px] text-cyan-300 font-bold tabular-nums">
                          {zone.depthMeters}
                        </div>
                        <div className="mt-0.5 text-[6.5px] text-amber-300/90 leading-tight">
                          {zone.id === 'shallow'
                            ? 'Быстрый клев'
                            : zone.id === 'canyon'
                            ? 'Вес x1.25'
                            : 'Сундуки / Реликвии'}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Cold Current Active Status Strip */}
                <div className="flex items-center justify-between rounded-lg border border-sky-400/40 bg-sky-950/60 px-2 py-1 text-[8px]">
                  <div className="flex items-center gap-1 font-bold text-sky-200">
                    <span className="text-sm">❄️</span>
                    <span>
                      Течение сейчас:{' '}
                      <strong className="text-amber-300 font-black">
                        «{activeColdCurrent.name}»
                      </strong>
                    </span>
                  </div>
                  <div className="text-sky-300 font-black tabular-nums">
                    +25% к редким
                  </div>
                </div>
              </div>

              {/* 3. Interactive Water Canvas with Bite Waiting Timer & Reeling Tension Zone HUD */}
              <div className="relative overflow-hidden rounded-2xl border-2 border-cyan-500/60 bg-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.18)]">
                <canvas
                  ref={canvasRef}
                  width={380}
                  height={215}
                  className="block h-[210px] w-full select-none pointer-events-none"
                />

                {/* Top Overlay Status Banner */}
                <div className="pointer-events-none absolute top-2 left-2 right-2 flex items-center justify-between gap-1.5">
                  <div
                    className={`w-full rounded-lg border px-2.5 py-1 text-[9.5px] font-bold shadow ${
                      phase === 'escaped'
                        ? 'border-rose-400/80 bg-rose-950/90 text-rose-100'
                        : phase === 'reeling' && isFishThrashing
                        ? 'border-red-400 bg-red-950/95 text-red-100 animate-pulse'
                        : phase === 'bite'
                        ? 'border-amber-300 bg-amber-950/95 text-amber-100 animate-pulse'
                        : 'border-cyan-400/40 bg-slate-950/85 text-cyan-100'
                    }`}
                  >
                    {statusBanner}
                  </div>
                </div>

                {/* Bite Waiting Timer (Таймер ожидания клёва) */}
                {(phase === 'waiting' || phase === 'nibble') && waitTimeTotalMs > 0 && (
                  <div className="pointer-events-none absolute bottom-2 left-2.5 right-2.5 rounded-xl border border-sky-400/70 bg-slate-950/95 p-2 shadow-lg">
                    <div className="flex items-center justify-between text-[9px] font-black text-sky-200 mb-1 tabular-nums">
                      <span>
                        {phase === 'nibble'
                          ? '〰️ Рыба пробует наживку (поплавок дрожит)...'
                          : '⏳ Ожидание поклёвки...'}
                      </span>
                      <span className="text-amber-300">
                        {(waitTimeLeftMs / 1000).toFixed(1)} сек
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800 border border-sky-500/30">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-75"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              ((waitTimeTotalMs - waitTimeLeftMs) / Math.max(1, waitTimeTotalMs)) * 100
                            )
                          )}%`
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Bite Reaction Window Bar */}
                {phase === 'bite' && (
                  <div className="pointer-events-none absolute bottom-2 left-2.5 right-2.5 rounded-xl border-2 border-amber-400 bg-slate-950/95 p-2 shadow-lg">
                    <div className="flex items-center justify-between text-[9.5px] font-black text-amber-300 mb-1 tabular-nums">
                      <span>⚡ ПОПЛАВОК УШЁЛ ПОД ВОДУ! ЖМИТЕ «ПОДСЕЧЬ» СПРАВА!</span>
                      <span>{(biteTimeLeftMs / 1000).toFixed(1)} сек</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400 transition-all duration-75"
                        style={{ width: `${Math.min(100, (biteTimeLeftMs / 3000) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Real-Time Reeling Distance & Interactive Optimal Tension Zone Slider */}
                {phase === 'reeling' && (
                  <div className="pointer-events-none absolute bottom-1.5 left-2 right-2 rounded-xl border border-cyan-400/80 bg-slate-950/95 p-2 shadow-lg space-y-1.5">
                    {/* Bar 1: Fish Distance / Reel Progress with Fish Runner */}
                    <div>
                      <div className="flex items-center justify-between text-[8.5px] font-black tabular-nums mb-0.5">
                        <span className="text-emerald-300">
                          🐟 ПОДТЯГИВАНИЕ К БЕРЕГУ (100% = В САДОК)
                        </span>
                        <span className="text-white">{reelProgress}%</span>
                      </div>
                      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-800 border border-emerald-500/40">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 via-emerald-400 to-amber-300 transition-all duration-75"
                          style={{ width: `${reelProgress}%` }}
                        />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[9px] leading-none transition-all duration-75"
                          style={{ left: `${Math.min(96, Math.max(4, reelProgress))}%` }}
                        >
                          🐟
                        </div>
                      </div>
                    </div>

                    {/* Bar 2: Interactive Line Tension Slider with Green/Gold Optimal Zone */}
                    <div>
                      <div className="flex items-center justify-between text-[8.5px] font-black tabular-nums mb-0.5">
                        <span
                          className={
                            lineTension >= 78
                              ? 'text-red-400 animate-pulse'
                              : isFishThrashing
                              ? 'text-amber-300'
                              : 'text-emerald-300'
                          }
                        >
                          {isFishThrashing
                            ? '💢 РЫБА БЬЁТСЯ! ОТПУСТИТЕ КАТУШКУ!'
                            : '🟢 РЫБА УСТАЛА — УДЕРЖИВАЙТЕ В ЗЕЛЁНОЙ/ЗОЛОТОЙ ЗОНЕ!'}
                        </span>
                        <span
                          className={
                            lineTension >= 78 ? 'text-red-400 font-black' : 'text-amber-300 font-black'
                          }
                        >
                          {lineTension}%
                        </span>
                      </div>
                      <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-700">
                        {/* Optimal Green/Gold Zone (25% - 75%) */}
                        <div
                          className="absolute inset-y-0 bg-emerald-500/25 border-x border-emerald-400/60"
                          style={{ left: '25%', width: '50%' }}
                        />
                        {/* Danger Red Zone (78% - 100%) */}
                        <div
                          className="absolute inset-y-0 bg-red-500/25 border-l border-red-500/60"
                          style={{ left: '78%', width: '22%' }}
                        />
                        {/* Active Tension Fill */}
                        <div
                          className={`h-full transition-all duration-75 ${
                            lineTension >= 78
                              ? 'bg-gradient-to-r from-amber-500 to-red-600'
                              : lineTension >= 55
                              ? 'bg-gradient-to-r from-emerald-400 to-amber-400'
                              : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                          }`}
                          style={{ width: `${lineTension}%` }}
                        />
                        {/* Slider Marker Needle */}
                        <div
                          className="absolute top-0 bottom-0 w-1 -translate-x-1/2 bg-white shadow-[0_0_6px_#fff] transition-all duration-75"
                          style={{ left: `${Math.min(99, Math.max(1, lineTension))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Physically Separated Dual-Zone Fishing Controls (Anti-Accidental Tap Protection) */}
              <div className="grid grid-cols-12 gap-2 items-stretch">
                {/* LEFT ZONE (5 cols): Cast Rod / Sell Keepnet / Cast Status ONLY */}
                <div className="col-span-5 flex">
                  {phase === 'idle' || phase === 'caught' || phase === 'escaped' ? (
                    isKeepnetFull ? (
                      <button
                        type="button"
                        onClick={handleSellKeepnetCatch}
                        className="w-full rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-2 py-2.5 text-[10.5px] font-black uppercase tracking-wide text-slate-950 shadow-md hover:brightness-110 active:scale-[0.98] cursor-pointer"
                      >
                        🪣 Продать улов (+{keepnetTotals.gold}🪙)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartCast}
                        disabled={hero.energy < (fishingConfig.energyPerCast || 2)}
                        className="w-full rounded-xl border-2 border-cyan-300 bg-gradient-to-b from-cyan-400 via-sky-500 to-blue-600 px-2.5 py-2.5 text-[11px] font-black uppercase tracking-wide text-slate-950 shadow-[0_0_16px_rgba(6,182,212,0.35)] hover:brightness-110 active:scale-[0.98] disabled:opacity-45 cursor-pointer"
                      >
                        🎣 Забросить (-{fishingConfig.energyPerCast || 2} ⚡)
                      </button>
                    )
                  ) : (
                    <div className="w-full flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950/90 px-2 py-2 text-center select-none">
                      <span className="text-[9px] font-black uppercase tracking-wider text-cyan-400">
                        {phase === 'casting'
                          ? '🎣 Заброс снасти...'
                          : phase === 'reeling'
                          ? '🐟 Вываживание'
                          : '🌊 Удочка в воде'}
                      </span>
                      <span className="text-[8px] text-slate-400 mt-0.5">
                        Защита от случайного перезаброса
                      </span>
                    </div>
                  )}
                </div>

                {/* RIGHT ZONE (7 cols): Hook Bite / Interactive Reel Tension Controls ONLY */}
                <div className="col-span-7 flex">
                  {phase === 'idle' || phase === 'caught' || phase === 'escaped' || phase === 'casting' ? (
                    <div className="w-full flex items-center justify-center rounded-xl border border-slate-800/90 bg-slate-900/50 px-3 py-2.5 text-center text-[9.5px] font-bold text-slate-500 select-none">
                      {phase === 'casting'
                        ? 'Поплавок летит в выбранную зону...'
                        : 'Сначала забросьте удочку кнопкой слева'}
                    </div>
                  ) : phase === 'waiting' || phase === 'nibble' ? (
                    <div className="w-full flex items-center justify-between gap-2 rounded-xl border border-sky-500/40 bg-slate-900/90 px-3 py-2 select-none">
                      <div className="text-left">
                        <div className="text-[9.5px] font-black uppercase text-sky-200">
                          {phase === 'nibble' ? '〰️ Поплавок качается...' : '⏳ Ждите поклёвки...'}
                        </div>
                        <div className="text-[8px] text-slate-400">
                          Кнопка подсечки загорится при клёве ({(waitTimeLeftMs / 1000).toFixed(1)}с)
                        </div>
                      </div>
                      <span className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[9px] font-black text-amber-300 tabular-nums">
                        {(waitTimeLeftMs / 1000).toFixed(1)}с
                      </span>
                    </div>
                  ) : phase === 'bite' ? (
                    <button
                      type="button"
                      onClick={handleHookFish}
                      className="w-full animate-bounce rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 px-3 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-[0_0_22px_rgba(245,158,11,0.65)] active:scale-95 cursor-pointer"
                    >
                      ⚡ ПОДСЕЧЬ СЕЙЧАС! ({(biteTimeLeftMs / 1000).toFixed(1)}с)
                    </button>
                  ) : (
                    <div className="flex w-full items-stretch gap-1.5">
                      <button
                        type="button"
                        onPointerDown={() => {
                          setIsHoldingReel(true);
                          holdingReelRef.current = true;
                          handleReelTapImpulse();
                        }}
                        onPointerUp={() => {
                          setIsHoldingReel(false);
                          holdingReelRef.current = false;
                        }}
                        onPointerLeave={() => {
                          setIsHoldingReel(false);
                          holdingReelRef.current = false;
                        }}
                        onPointerCancel={() => {
                          setIsHoldingReel(false);
                          holdingReelRef.current = false;
                        }}
                        className={`flex-[2] select-none rounded-xl border-2 px-2 py-2.5 text-[10.5px] font-black uppercase tracking-wide transition-all active:scale-95 cursor-pointer ${
                          isFishThrashing
                            ? 'border-amber-400 bg-amber-900/90 text-amber-100'
                            : 'border-emerald-300 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                        }`}
                      >
                        {isHoldingReel ? '🔄 ТЯНЕМ К БЕРЕГУ...' : '🎣 УДЕРЖИВАТЬ КАТУШКУ'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSlackLineImpulse}
                        className="flex-1 select-none rounded-xl border border-sky-400/70 bg-slate-900 px-1.5 py-2.5 text-[9.5px] font-black uppercase text-sky-200 hover:bg-slate-800 active:scale-95 cursor-pointer"
                      >
                        ✋ Стравить
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Escaped Fish Alert Card */}
              {phase === 'escaped' && escapeReason && (
                <div className="rounded-xl border-2 border-rose-500/80 bg-rose-950/60 p-2.5 text-[10.5px] font-bold text-rose-100 flex items-center gap-2.5">
                  <span className="text-2xl">💨</span>
                  <div>
                    <div className="font-black uppercase text-rose-300">Рыба сорвалась!</div>
                    <div className="text-[9.5px] text-rose-100/90 mt-0.5">{escapeReason}</div>
                  </div>
                </div>
              )}

              {/* Last Caught Result Showcase Card */}
              {lastOutcome && phase === 'caught' && (
                <div className="rounded-xl border-2 border-amber-400/80 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-2.5 shadow-lg">
                  {lastOutcome.type === 'fish' ? (
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-14 w-18 shrink-0 items-center justify-center rounded-xl border border-cyan-500/40 bg-slate-950 p-1">
                        <img
                          src={lastOutcome.fish.iconUrl}
                          alt={lastOutcome.fish.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1 text-[9px] font-bold">
                          <span className={getRarityMeta(lastOutcome.fish.rarity).colorText}>
                            {getRarityMeta(lastOutcome.fish.rarity).label} #{lastOutcome.fish.index}
                          </span>
                          {lastOutcome.isNewDiscovery && (
                            <span className="text-emerald-300">· 🌟 НОВАЯ В КОЛЛЕКЦИИ!</span>
                          )}
                          {!lastOutcome.isNewDiscovery && lastOutcome.isRecordWeight && (
                            <span className="text-amber-300">· 🏆 РЕКОРД ВЕСА!</span>
                          )}
                        </div>
                        <div className="truncate text-xs font-black text-white mt-0.5">
                          {lastOutcome.fish.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-extrabold tabular-nums">
                          <span className="text-sky-200">⚖️ {lastOutcome.weightKg} кг</span>
                          <span className="text-cyan-300">🪣 В садок ({keepnetFishList.length}/{keepnetCapacity})</span>
                          <span className="text-amber-300">Оценка: +{lastOutcome.goldEarned} 🪙</span>
                          {lastOutcome.crystalsEarned > 0 && (
                            <span className="text-cyan-300">+{lastOutcome.crystalsEarned} 💎</span>
                          )}
                          <span className="text-purple-300">+{lastOutcome.expEarned} ✨ EXP</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-amber-400/60 bg-amber-950/60 text-2xl">
                        🧰
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                          Затонувший сундук фараона!
                        </div>
                        <div className="mt-0.5 text-xs font-black text-white">
                          {lastOutcome.prizeType === 'relic' && lastOutcome.relicItem
                            ? `🏺 Получена реликвия: «${lastOutcome.relicItem.name}»`
                            : lastOutcome.prizeType === 'exp_buff'
                            ? `✨ Бафф к опыту +${lastOutcome.expBuffPct}% на ${lastOutcome.expBuffMinutes} мин.!`
                            : `⚡ Восстановлено +${lastOutcome.energyRestored} Энергии!`}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5. FISHING NET PANEL (Заброс сети по лицензии + таймер свежести улова) */}
              <div className="rounded-xl border-2 border-teal-500/50 bg-slate-900/95 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🕸️</span>
                    <div>
                      <div className="text-[10.5px] font-black uppercase text-teal-200">
                        Рыболовная сеть (Ловля по лицензии)
                      </div>
                      <div className="text-[8.5px] text-slate-300">
                        Лицензий на заброс сети:{' '}
                        <strong className="text-amber-300">{fishingState.netLicenseUses || 0} 📜</strong>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('shop');
                      setShopSubTab('nets');
                    }}
                    className="rounded-lg border border-teal-400/60 bg-teal-950/80 px-2 py-1 text-[8.5px] font-black text-teal-200 hover:bg-teal-900 cursor-pointer"
                  >
                    🛒 Сети и Лицензии
                  </button>
                </div>

                {fishingState.activeNet && activeNetStatus ? (
                  <div
                    className={`rounded-xl border p-2.5 ${
                      activeNetStatus.state === 'spoiled'
                        ? 'border-red-500/80 bg-red-950/50'
                        : activeNetStatus.state === 'ready'
                        ? 'border-emerald-400 bg-emerald-950/60'
                        : 'border-amber-500/50 bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-black">
                      <span className="text-white">
                        {fishingState.activeNet.netIcon} {fishingState.activeNet.netName} ({fishingState.activeNet.locationName})
                      </span>
                      {activeNetStatus.state === 'catching' && (
                        <span className="text-amber-300 tabular-nums">
                          ⏳ Улов через: {formatTimer(activeNetStatus.remSec)}
                        </span>
                      )}
                      {activeNetStatus.state === 'ready' && (
                        <span className="text-emerald-300 animate-pulse tabular-nums">
                          ✅ УЛОВ ГОТОВ!
                        </span>
                      )}
                      {activeNetStatus.state === 'spoiled' && (
                        <span className="text-red-300 font-black">💀 РЫБА ПОГИБЛА!</span>
                      )}
                    </div>

                    {activeNetStatus.state === 'catching' && (
                      <div className="mt-1.5">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full bg-amber-400 transition-all duration-300"
                            style={{ width: `${activeNetStatus.pct}%` }}
                          />
                        </div>
                        <div className="mt-1 text-[8.5px] text-slate-300">
                          Не забудьте вовремя вытянуть сеть после наполнения, иначе рыба внутри задохнётся и погибнет!
                        </div>
                      </div>
                    )}

                    {activeNetStatus.state === 'ready' && (
                      <div className="mt-1.5 space-y-1.5">
                        <div className="text-[9.5px] font-bold text-amber-200 tabular-nums">
                          ⚠️ Срочно вытяните сеть! До гибели рыбы осталось:{' '}
                          <span className="text-red-300 font-black">
                            {formatTimer(activeNetStatus.spoilRemSec)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handlePullOrClearNet}
                          className="w-full rounded-lg border-2 border-emerald-300 bg-gradient-to-r from-emerald-500 to-teal-500 py-2 text-[10.5px] font-black uppercase text-slate-950 shadow-md active:scale-95 cursor-pointer"
                        >
                          🐟 Вытянуть сеть с уловом ({fishingState.activeNet.minFishCount}–{fishingState.activeNet.maxFishCount} рыб)!
                        </button>
                      </div>
                    )}

                    {activeNetStatus.state === 'spoiled' && (
                      <div className="mt-1.5 space-y-1.5">
                        <div className="text-[9px] text-red-200">
                          Вы забыли вовремя вытянуть сеть — вся пойманная рыба уснула и погибла.
                        </div>
                        <button
                          type="button"
                          onClick={handlePullOrClearNet}
                          className="w-full rounded-lg border border-red-400 bg-red-900/80 py-1.5 text-[10px] font-black text-white hover:bg-red-800 cursor-pointer"
                        >
                          🧹 Вытащить испорченную сеть
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {FISHING_NETS.map((net) => {
                      const count = fishingState.netsInventory[net.id] || 0;
                      const canCast =
                        count > 0 &&
                        (fishingState.netLicenseUses || 0) > 0 &&
                        equippedRod.level >= net.minRodLevel;
                      return (
                        <button
                          key={net.id}
                          type="button"
                          onClick={() => handleCastNet(net)}
                          className={`flex flex-col items-center justify-between rounded-lg border p-1.5 text-center transition-all cursor-pointer ${
                            canCast
                              ? 'border-teal-400/70 bg-teal-950/60 text-white hover:bg-teal-900/70'
                              : 'border-slate-800 bg-slate-950/70 text-slate-400 opacity-75'
                          }`}
                        >
                          <span className="text-base">{net.icon}</span>
                          <span className="text-[8.5px] font-black leading-tight mt-0.5 line-clamp-1">
                            {net.name.split(' ')[0]}
                          </span>
                          <span className="text-[8px] font-bold text-emerald-300">
                            В наличии: {count} шт.
                          </span>
                          <span className="mt-0.5 rounded bg-slate-900 px-1.5 py-0.5 text-[7.5px] font-black text-amber-200">
                            {canCast ? 'Закинуть 🕸️' : count <= 0 ? 'Купить в маг.' : 'Нужна лиц. 📜'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Net Haul Showcase if just pulled */}
                {lastNetHaul && lastNetHaul.length > 0 && (
                  <div className="rounded-xl border border-emerald-400/70 bg-slate-950 p-2 space-y-1">
                    <div className="text-[9.5px] font-black text-emerald-300">
                      🎉 Улов из вашей сети ({lastNetHaul.length} рыб отправлено в Садок):
                    </div>
                    <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto">
                      {lastNetHaul.map((item, idx) => (
                        <div
                          key={`${item.fish.id}_${idx}`}
                          className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900/90 px-1.5 py-1 text-[8.5px]"
                        >
                          <img
                            src={item.fish.iconUrl}
                            alt={item.fish.name}
                            className="h-5 w-6 object-contain shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-bold text-white">{item.fish.name}</div>
                            <div className="text-[7.5px] text-amber-300 tabular-nums">
                              {item.weightKg}кг · +{item.goldEarned}🪙
                              {item.crystalsEarned > 0 ? ` +${item.crystalsEarned}💎` : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB: ЗАЛ ТРОФЕЕВ НИЛА («СТЕНА СЛАВЫ») ================= */}
          {activeTab === 'museum' && (
            <div className="flex flex-col gap-2.5">
              {/* Header & Overall Museum Progress */}
              <div className="rounded-xl border border-amber-500/60 bg-gradient-to-b from-[#251508] via-[#150c05] to-slate-950 p-2.5 shadow-[0_0_15px_rgba(251,191,36,0.2)]">
                <div className="flex items-center justify-between text-[10.5px] font-black mb-1 tabular-nums">
                  <span className="flex items-center gap-1.5 text-amber-200">
                    <span className="text-base">🏛️</span>
                    <span>Зал славы и трофеев Нила</span>
                  </span>
                  <span className="text-amber-300 font-extrabold">
                    {museumSummary.collectedCount} / {museumSummary.totalCount} (
                    {Math.round((museumSummary.collectedCount / museumSummary.totalCount) * 100)}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950 border border-amber-500/50">
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-300 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (museumSummary.collectedCount / museumSummary.totalCount) * 100
                      )}%`
                    }}
                  />
                </div>
                <div className="mt-1 text-[8px] text-amber-300/80 leading-tight">
                  Все найденные на крючке древние реликвии навечно хранятся в музее и наделяют вашего
                  персонажа пассивными бонусами!
                </div>
              </div>

              {/* Museum Set Tier Bonuses Banner */}
              <div className="rounded-xl border border-amber-500/40 bg-slate-900/90 p-2 space-y-1.5">
                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-amber-300">
                  <span>📜 Награды за сбор коллекции</span>
                  <span className="text-[8px] text-slate-400 font-bold">Пассивные эффекты</span>
                </div>

                <div className="grid grid-cols-1 gap-1 text-[8.5px]">
                  {/* Tier 1: 3 Trophies */}
                  <div
                    className={`flex items-center justify-between rounded-lg border px-2 py-1 transition-all ${
                      museumSummary.isSetBonus3Active
                        ? 'border-emerald-500/70 bg-emerald-950/40 text-emerald-200'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <span>{museumSummary.isSetBonus3Active ? '✅' : '🔒'}</span>
                      <span>3 Реликвии:</span>
                      <span className="text-white">+10 макс. энергии, +5% золота с рыбы</span>
                    </div>
                    <span className="shrink-0 font-black tabular-nums">
                      {museumSummary.collectedCount >= 3 ? 'АКТИВЕН' : `${museumSummary.collectedCount}/3`}
                    </span>
                  </div>

                  {/* Tier 2: 5 Trophies */}
                  <div
                    className={`flex items-center justify-between rounded-lg border px-2 py-1 transition-all ${
                      museumSummary.isSetBonus5Active
                        ? 'border-emerald-500/70 bg-emerald-950/40 text-emerald-200'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <span>{museumSummary.isSetBonus5Active ? '✅' : '🔒'}</span>
                      <span>5 Реликвий:</span>
                      <span className="text-white">+10% шанс редкой рыбы, +50 HP</span>
                    </div>
                    <span className="shrink-0 font-black tabular-nums">
                      {museumSummary.collectedCount >= 5 ? 'АКТИВЕН' : `${museumSummary.collectedCount}/5`}
                    </span>
                  </div>

                  {/* Tier 3: 8 Trophies (Complete Set) */}
                  <div
                    className={`flex items-center justify-between rounded-lg border px-2 py-1 transition-all ${
                      museumSummary.isSetBonusAllActive
                        ? 'border-amber-400 bg-amber-950/60 text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <span>{museumSummary.isSetBonusAllActive ? '👑' : '🔒'}</span>
                      <span>Все 8 Реликвий:</span>
                      <span className="text-amber-300 font-black">
                        +15 энергии, +5% крит. урон в Пирамиде, +15% к цене всей рыбы
                      </span>
                    </div>
                    <span className="shrink-0 font-black tabular-nums">
                      {museumSummary.isSetBonusAllActive ? 'ВЛАДЫКА ВОД' : `${museumSummary.collectedCount}/8`}
                    </span>
                  </div>
                </div>
              </div>

              {/* 8 Nile Trophies Showcase Grid */}
              <div className="grid grid-cols-1 gap-2">
                {NILE_TROPHIES.map((trophy) => {
                  const caughtCount = (fishingState.trophyMuseum || {})[trophy.id] || 0;
                  const isCaught = caughtCount > 0;

                  return (
                    <div
                      key={trophy.id}
                      className={`relative flex items-center gap-2.5 rounded-xl border p-2 transition-all ${
                        isCaught
                          ? 'border-amber-400/80 bg-gradient-to-r from-[#281507] via-[#190e05] to-slate-950 text-white shadow-[0_2px_12px_rgba(251,191,36,0.18)]'
                          : 'border-slate-800/80 bg-slate-950/70 text-slate-400 opacity-70'
                      }`}
                    >
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-2xl shadow-inner ${
                          isCaught
                            ? 'border-amber-400/80 bg-gradient-to-b from-amber-950 to-slate-900'
                            : 'border-slate-800 bg-slate-900/90 text-slate-600'
                        }`}
                      >
                        {isCaught ? trophy.icon : '🏺'}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`truncate text-[10px] font-black ${
                              isCaught ? 'text-amber-200' : 'text-slate-300'
                            }`}
                          >
                            {trophy.name}
                          </span>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.2 text-[7px] font-black uppercase ${
                              isCaught
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isCaught ? `Собрано (${caughtCount})` : 'Не найдено'}
                          </span>
                        </div>

                        <p className="mt-0.5 text-[8px] text-slate-300 italic line-clamp-1">
                          «{trophy.description}»
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[7.5px] font-bold">
                          <span className={isCaught ? 'text-emerald-300' : 'text-slate-500'}>
                            ✨ {trophy.bonusText}
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="text-cyan-300">
                            📍 {trophy.source}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Informational Guidance Banner */}
              <div className="rounded-xl border border-cyan-500/30 bg-slate-900/70 p-2 text-[8px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1 font-bold text-cyan-200">
                  <span>💡</span>
                  <span>Совет хранителя музея:</span>
                </div>
                <p>
                  Древние реликвии погребены на дне Нила. Выбирайте правильную зону заброса на вкладке
                  «Лов», следите за перемещением Холодных течений (+25% шанс) и погодными баффами
                  (Рассвет, Песчаная буря), или используйте редкие прикормки из лавки!
                </p>
              </div>
            </div>
          )}

          {/* ================= TAB 2: КОЛЛЕКЦИИ РЫБ ПО 5 ЛОКАЦИЯМ ================= */}
          {activeTab === 'collection' && (
            <div className="flex flex-col gap-2.5">
              {/* Overall & Location Progress */}
              <div className="rounded-xl border border-amber-500/40 bg-slate-900/90 p-2.5">
                <div className="flex items-center justify-between text-[10px] font-black mb-1 tabular-nums">
                  <span className="text-amber-200">📘 Полная энциклопедия рыб (5 локаций)</span>
                  <span className="text-emerald-300">
                    {uniqueCaughtCount} / 50 ({Math.round((uniqueCaughtCount / 50) * 100)}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950 border border-amber-500/40">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, (uniqueCaughtCount / 50) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Filter by Location Collection */}
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setCollectionLocationFilter('all')}
                  className={`rounded-lg px-2 py-1 text-[8.5px] font-black transition-colors cursor-pointer ${
                    collectionLocationFilter === 'all'
                      ? 'bg-amber-500 text-slate-950'
                      : 'border border-slate-800 bg-slate-900 text-slate-300'
                  }`}
                >
                  Все локации (50)
                </button>
                {FISHING_LOCATIONS.map((loc) => {
                  const locFishes = fishingConfig.fishes.filter((f) => f.locationId === loc.id);
                  const caught = locFishes.filter(
                    (f) => (fishingState.collection[f.id]?.count || 0) > 0
                  ).length;
                  return (
                    <button
                      key={loc.id}
                      onClick={() => setCollectionLocationFilter(loc.id)}
                      className={`rounded-lg px-2 py-1 text-[8.5px] font-black transition-colors cursor-pointer ${
                        collectionLocationFilter === loc.id
                          ? 'bg-cyan-500 text-slate-950'
                          : 'border border-slate-800 bg-slate-900 text-slate-300'
                      }`}
                    >
                      {loc.icon} {loc.shortName} ({caught}/{locFishes.length})
                    </button>
                  );
                })}
              </div>

              {/* Status Filter */}
              <div className="flex gap-1">
                {(
                  [
                    { id: 'all', label: 'Все виды' },
                    { id: 'caught', label: 'Пойманные' },
                    { id: 'uncaught', label: 'Не пойманные' }
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setCollectionStatusFilter(st.id)}
                    className={`rounded-md px-2 py-0.5 text-[8.5px] font-bold cursor-pointer ${
                      collectionStatusFilter === st.id
                        ? 'bg-slate-200 text-slate-950'
                        : 'border border-slate-800 bg-slate-950 text-slate-400'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Selected Fish Detail Inspector */}
              {selectedFishDetail && (
                <div className="rounded-xl border-2 border-cyan-400/70 bg-slate-900 p-2.5 shadow-lg">
                  {(() => {
                    const rec = fishingState.collection[selectedFishDetail.id];
                    const isCaught = Boolean(rec && rec.count > 0);
                    const meta = getRarityMeta(selectedFishDetail.rarity);
                    const loc = FISHING_LOCATIONS.find((l) => l.id === selectedFishDetail.locationId);
                    return (
                      <div className="flex items-center gap-3">
                        <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 p-1.5">
                          <img
                            src={selectedFishDetail.iconUrl}
                            alt={selectedFishDetail.name}
                            referrerPolicy="no-referrer"
                            className={`h-full w-full object-contain ${
                              isCaught ? '' : 'brightness-0 contrast-200 opacity-50'
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1 text-[10px]">
                          <div className="flex items-center justify-between">
                            <span className={`font-black ${meta.colorText}`}>
                              #{selectedFishDetail.index} · {meta.label} · {loc?.icon} {loc?.shortName}
                            </span>
                            <button
                              onClick={() => setSelectedFishDetail(null)}
                              className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="text-xs font-black text-white">
                            {isCaught ? selectedFishDetail.name : '??? Неизвестный вид рыбы'}
                          </div>
                          <p className="text-[9px] text-slate-300 mt-0.5">
                            {isCaught
                              ? selectedFishDetail.description
                              : `Водится в локации «${loc?.name}» (требуется удочка Ур. ${selectedFishDetail.minRodLevel}+).`}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] font-bold tabular-nums">
                            <span className="text-amber-300">База: {selectedFishDetail.baseGold} 🪙</span>
                            {selectedFishDetail.baseCrystals > 0 && (
                              <span className="text-cyan-300">+{selectedFishDetail.baseCrystals} 💎</span>
                            )}
                            <span className="text-emerald-300">Поймано: {rec?.count || 0} шт.</span>
                            {rec?.maxWeightKg ? (
                              <span className="text-sky-300">Рекорд: {rec.maxWeightKg} кг</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Fish Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {filteredFishes.map((fish) => {
                  const rec = fishingState.collection[fish.id];
                  const isCaught = Boolean(rec && rec.count > 0);
                  const meta = getRarityMeta(fish.rarity);
                  const loc = FISHING_LOCATIONS.find((l) => l.id === fish.locationId);
                  return (
                    <button
                      key={fish.id}
                      onClick={() => setSelectedFishDetail(fish)}
                      className={`group relative flex flex-col justify-between rounded-xl border bg-gradient-to-b p-2 text-left transition-all active:scale-95 cursor-pointer ${
                        isCaught
                          ? `${meta.borderCls} ${meta.bgCls}`
                          : 'border-slate-800/90 from-slate-950 to-slate-950 opacity-80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[8px] font-bold tabular-nums">
                        <span className={isCaught ? meta.colorText : 'text-slate-500'}>
                          #{fish.index} · {meta.label}
                        </span>
                        <span className="text-slate-400">
                          {loc?.icon} Уд.{fish.minRodLevel}
                        </span>
                      </div>

                      <div className="relative my-1 flex h-11 w-full items-center justify-center rounded-lg bg-black/40 p-1">
                        <img
                          src={fish.iconUrl}
                          alt={fish.name}
                          referrerPolicy="no-referrer"
                          className={`h-full w-full object-contain ${
                            isCaught ? '' : 'brightness-0 contrast-200 opacity-45 select-none'
                          }`}
                        />
                        {!isCaught && (
                          <span className="pointer-events-none absolute text-xs font-black text-slate-400/90">
                            ❓
                          </span>
                        )}
                      </div>

                      <div className="truncate text-[9.5px] font-black text-white">
                        {isCaught ? fish.name : 'Не поймана'}
                      </div>

                      <div className="mt-0.5 flex items-center justify-between text-[8px] font-bold tabular-nums">
                        <span className="text-amber-300">
                          {fish.baseGold}🪙{fish.baseCrystals > 0 ? ` +${fish.baseCrystals}💎` : ''}
                        </span>
                        <span className={isCaught ? 'text-emerald-300' : 'text-slate-500'}>
                          {isCaught ? `${rec?.count} шт.` : '0 шт.'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= TAB 3: МАГАЗИН РЫБАЛКИ (УДОЧКИ, САДОК, НАЖИВКИ, СЕТИ И ЛИЦЕНЗИИ) ================= */}
          {activeTab === 'shop' && (
            <div className="flex flex-col gap-2">
              {/* Sub-navigation inside Fishing Shop */}
              <div className="grid grid-cols-6 gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1 text-center">
                <button
                  type="button"
                  onClick={() => setShopSubTab('rods')}
                  className={`rounded-lg py-1.5 text-[8px] font-black transition-all cursor-pointer ${
                    shopSubTab === 'rods'
                      ? 'bg-emerald-600 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  🎣 Удочки
                </button>
                <button
                  type="button"
                  onClick={() => setShopSubTab('lines')}
                  className={`rounded-lg py-1.5 text-[8px] font-black transition-all cursor-pointer ${
                    shopSubTab === 'lines'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  🧵 Лески
                </button>
                <button
                  type="button"
                  onClick={() => setShopSubTab('hooks')}
                  className={`rounded-lg py-1.5 text-[8px] font-black transition-all cursor-pointer ${
                    shopSubTab === 'hooks'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  🪝 Оснастка
                </button>
                <button
                  type="button"
                  onClick={() => setShopSubTab('keepnet')}
                  className={`rounded-lg py-1.5 text-[8px] font-black transition-all cursor-pointer ${
                    shopSubTab === 'keepnet'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  🪣 Садок
                </button>
                <button
                  type="button"
                  onClick={() => setShopSubTab('baits')}
                  className={`rounded-lg py-1.5 text-[8px] font-black transition-all cursor-pointer ${
                    shopSubTab === 'baits'
                      ? 'bg-orange-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  🪱 Наживки
                </button>
                <button
                  type="button"
                  onClick={() => setShopSubTab('nets')}
                  className={`rounded-lg py-1.5 text-[8px] font-black transition-all cursor-pointer ${
                    shopSubTab === 'nets'
                      ? 'bg-teal-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  🕸️ Сети
                </button>
              </div>

              {/* SUB-TAB 1: УДОЧКИ */}
              {shopSubTab === 'rods' && (
                <div className="space-y-2">
                  <div className="rounded-xl border border-emerald-500/40 bg-slate-900/90 p-2 text-[9.5px] text-slate-200">
                    Каждая новая удочка открывает доступ к **новой локации рыбалки** со своей коллекцией редких рыб и повышает прочность лески при рывках!
                  </div>
                  {fishingConfig.rods.map((rod) => {
                    const isOwned =
                      fishingState.ownedRodLevels.includes(rod.level) || rod.level === 1;
                    const isEquipped = fishingState.equippedRodLevel === rod.level;
                    const fishReqMet = fishingState.totalFishCaught >= rod.requiredFishCaught;
                    const canAffordGold = hero.gold >= rod.priceGold;
                    const canAffordCrystals = hero.crystals >= rod.priceCrystals;
                    const canBuy = !isOwned && fishReqMet && canAffordGold && canAffordCrystals;
                    const unlockedLoc = FISHING_LOCATIONS.find((l) => l.minRodLevel === rod.level);

                    return (
                      <div
                        key={rod.id}
                        className={`rounded-xl border p-2.5 transition-all ${
                          isEquipped
                            ? 'border-2 border-emerald-400 bg-emerald-950/30'
                            : isOwned
                            ? 'border-cyan-500/50 bg-slate-900/90'
                            : 'border-slate-800 bg-slate-950/90'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/40 bg-slate-950 text-xl">
                              <ItemIcon
                                icon={rod.icon}
                                alt={rod.name}
                                className="text-xl"
                                imgClassName="h-7 w-7 object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10.5px] font-black text-white truncate">
                                Ур. {rod.level} · {rod.name}
                              </div>
                              <p className="text-[8.5px] text-slate-300 mt-0.5 leading-snug">
                                {rod.description}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[8.5px] font-bold">
                                <span className="text-emerald-300">
                                  Редкие: +{rod.rareFishChanceBonusPct}%
                                </span>
                                <span className="text-sky-300">Леска: {rod.lineStrength}</span>
                                {unlockedLoc && (
                                  <span className="text-amber-300">
                                    Открывает: {unlockedLoc.icon} {unlockedLoc.shortName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end shrink-0 gap-1">
                            {isEquipped ? (
                              <span className="rounded-lg border border-emerald-400/60 bg-emerald-950 px-2 py-1 text-[8.5px] font-black text-emerald-300">
                                ✓ В руках
                              </span>
                            ) : isOwned ? (
                              <button
                                onClick={() => onBuyOrEquipRod(rod, 'equip')}
                                className="rounded-lg border border-cyan-400 bg-cyan-600 hover:bg-cyan-500 px-2.5 py-1 text-[9px] font-black text-slate-950 cursor-pointer"
                              >
                                Взять
                              </button>
                            ) : (
                              <button
                                onClick={() => onBuyOrEquipRod(rod, 'buy')}
                                disabled={!canBuy}
                                className={`rounded-lg px-2.5 py-1 text-[9px] font-black cursor-pointer ${
                                  canBuy
                                    ? 'border border-amber-300 bg-amber-500 text-slate-950'
                                    : 'border border-slate-700 bg-slate-800 text-slate-400 opacity-60 cursor-not-allowed'
                                }`}
                              >
                                {rod.priceGold > 0 ? `${rod.priceGold.toLocaleString('ru-RU')} 🪙 ` : ''}
                                {rod.priceCrystals > 0 ? `${rod.priceCrystals} 💎` : ''}
                              </button>
                            )}
                          </div>
                        </div>
                        {rod.requiredFishCaught > 0 && !isOwned && (
                          <div className="mt-1.5 text-[8px] font-bold text-amber-300">
                            {fishReqMet
                              ? `✓ Условие улова выполнено (${rod.requiredFishCaught} рыб)`
                              : `🔒 Требуется поймать рыб: ${fishingState.totalFishCaught} / ${rod.requiredFishCaught} шт.`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SUB-TAB: ЛЕСКИ */}
              {shopSubTab === 'lines' && (
                <div className="space-y-2">
                  <div className="rounded-xl border border-cyan-500/40 bg-slate-900/90 p-2 text-[9.5px] text-slate-200">
                    **Рыболовные лески** гасят резкие рывки рыбы и увеличивают контроль катушки (+% стабильности), предотвращая обрыв снасти!
                  </div>
                  {FISHING_LINES.map((line) => {
                    const ownedCount = (fishingState.linesInventory || {})[line.id] || 0;
                    const isEquipped = fishingState.equippedLine?.id === line.id;
                    const canAfford =
                      line.currency === 'gold'
                        ? hero.gold >= line.priceGold
                        : hero.crystals >= line.priceCrystals;

                    return (
                      <div
                        key={line.id}
                        className={`rounded-xl border p-2.5 flex items-center justify-between gap-2.5 ${
                          isEquipped
                            ? 'border-2 border-cyan-400 bg-cyan-950/35'
                            : ownedCount > 0
                            ? 'border-emerald-500/40 bg-slate-900/90'
                            : 'border-slate-800 bg-slate-950/90'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/40 bg-slate-950 text-xl">
                            {line.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10.5px] font-black text-white">{line.name}</span>
                              {isEquipped && (
                                <span className="rounded bg-cyan-950 border border-cyan-500/50 px-1.5 py-0.5 text-[8px] font-black text-cyan-300">
                                  Установлена
                                </span>
                              )}
                            </div>
                            <p className="text-[8.5px] text-slate-300 mt-0.5">{line.description}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[8px] font-bold">
                              <span className="text-emerald-300">
                                Контроль: +{line.stabilityBonusPct}%
                              </span>
                              <span className="text-sky-300">
                                Прочность:{' '}
                                {isEquipped
                                  ? `${fishingState.equippedLine?.durability}/`
                                  : ''}
                                {line.maxDurability} забросов
                              </span>
                              {ownedCount > 0 && !isEquipped && (
                                <span className="text-amber-300">В запасе: {ownedCount} шт.</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end shrink-0 gap-1">
                          {isEquipped ? (
                            <button
                              type="button"
                              onClick={() => handleEquipLine(null)}
                              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[8.5px] font-black text-slate-300 hover:text-white cursor-pointer"
                            >
                              Снять
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleBuyLine(line)}
                              disabled={!canAfford}
                              className={`rounded-lg px-2.5 py-1.5 text-[9px] font-black cursor-pointer ${
                                canAfford
                                  ? 'border border-cyan-300 bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                                  : 'border border-slate-700 bg-slate-800 text-slate-400 opacity-60 cursor-not-allowed'
                              }`}
                            >
                              {line.currency === 'gold'
                                ? `${line.priceGold} 🪙`
                                : `${line.priceCrystals} 💎`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SUB-TAB: КРЮЧКИ И ОСНАСТКА */}
              {shopSubTab === 'hooks' && (
                <div className="space-y-2">
                  <div className="rounded-xl border border-amber-500/40 bg-slate-900/90 p-2 text-[9.5px] text-slate-200">
                    **Крючки и древнеегипетская оснастка** привлекают редчайшие виды рыбы (+% шанс) и повышают вероятность выловить Затонувший сундук сокровищ!
                  </div>
                  {FISHING_HOOKS.map((hook) => {
                    const ownedCount = (fishingState.hooksInventory || {})[hook.id] || 0;
                    const isEquipped = fishingState.equippedHook?.id === hook.id;
                    const canAfford =
                      hook.currency === 'gold'
                        ? hero.gold >= hook.priceGold
                        : hero.crystals >= hook.priceCrystals;

                    return (
                      <div
                        key={hook.id}
                        className={`rounded-xl border p-2.5 flex items-center justify-between gap-2.5 ${
                          isEquipped
                            ? 'border-2 border-amber-400 bg-amber-950/35'
                            : ownedCount > 0
                            ? 'border-emerald-500/40 bg-slate-900/90'
                            : 'border-slate-800 bg-slate-950/90'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-slate-950 text-xl">
                            {hook.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10.5px] font-black text-white">{hook.name}</span>
                              {isEquipped && (
                                <span className="rounded bg-amber-950 border border-amber-500/50 px-1.5 py-0.5 text-[8px] font-black text-amber-300">
                                  Установлен
                                </span>
                              )}
                            </div>
                            <p className="text-[8.5px] text-slate-300 mt-0.5">{hook.description}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[8px] font-bold">
                              <span className="text-emerald-300">
                                Редкие: +{hook.rareFishChanceBonusPct}%
                              </span>
                              <span className="text-amber-300">
                                Сундуки: +{hook.chestChanceBonusPct}%
                              </span>
                              <span className="text-sky-300">
                                Прочность:{' '}
                                {isEquipped
                                  ? `${fishingState.equippedHook?.durability}/`
                                  : ''}
                                {hook.maxDurability} забросов
                              </span>
                              {ownedCount > 0 && !isEquipped && (
                                <span className="text-amber-300">В запасе: {ownedCount} шт.</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end shrink-0 gap-1">
                          {isEquipped ? (
                            <button
                              type="button"
                              onClick={() => handleEquipHook(null)}
                              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[8.5px] font-black text-slate-300 hover:text-white cursor-pointer"
                            >
                              Снять
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleBuyHook(hook)}
                              disabled={!canAfford}
                              className={`rounded-lg px-2.5 py-1.5 text-[9px] font-black cursor-pointer ${
                                canAfford
                                  ? 'border border-amber-300 bg-amber-500 text-slate-950 hover:bg-amber-400'
                                  : 'border border-slate-700 bg-slate-800 text-slate-400 opacity-60 cursor-not-allowed'
                              }`}
                            >
                              {hook.currency === 'gold'
                                ? `${hook.priceGold} 🪙`
                                : `${hook.priceCrystals} 💎`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SUB-TAB 2: ПРОКАЧКА САДКА (ВМЕСТИМОСТЬ УЛОВА) */}
              {shopSubTab === 'keepnet' && (
                <div className="space-y-2">
                  <div className="rounded-xl border border-cyan-500/40 bg-slate-900/90 p-2 text-[9.5px] text-slate-200">
                    **Садок** определяет, сколько пойманной рыбы вы можете хранить до продажи. Базовый лимит — **20 рыб**. При заполнении садка заброс удочки блокируется, пока вы не продадите улов!
                  </div>
                  {FISHING_KEEPNET_UPGRADES.map((upg) => {
                    const curLvl = fishingState.keepnetLevel || 1;
                    const isOwned = upg.level <= curLvl;
                    const isCurrent = upg.level === curLvl;
                    const isNext = upg.level === curLvl + 1;
                    const canAfford =
                      hero.gold >= upg.priceGold && hero.crystals >= upg.priceCrystals;
                    const canBuy = isNext && canAfford;

                    return (
                      <div
                        key={upg.level}
                        className={`rounded-xl border p-2.5 flex items-center justify-between gap-2.5 ${
                          isCurrent
                            ? 'border-2 border-cyan-400 bg-cyan-950/35'
                            : isOwned
                            ? 'border-emerald-500/40 bg-slate-900/90'
                            : 'border-slate-800 bg-slate-950/90'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/40 bg-slate-950 text-xl">
                            {upg.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10.5px] font-black text-white">
                                Ур. {upg.level} · {upg.name}
                              </span>
                              <span className="rounded bg-cyan-950 border border-cyan-500/50 px-1.5 py-0.5 text-[8px] font-black text-cyan-300">
                                Лимит: {upg.capacity} рыб
                              </span>
                            </div>
                            <p className="text-[8.5px] text-slate-300 mt-0.5 leading-snug">
                              {upg.description}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isCurrent ? (
                            <span className="rounded-lg border border-cyan-400/60 bg-cyan-950 px-2 py-1 text-[8.5px] font-black text-cyan-200">
                              ✓ Активен
                            </span>
                          ) : isOwned ? (
                            <span className="rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-2 py-1 text-[8.5px] font-bold text-emerald-300">
                              ✓ Открыт
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUpgradeKeepnet(upg)}
                              disabled={!canBuy}
                              className={`rounded-lg px-2.5 py-1.5 text-[9px] font-black cursor-pointer ${
                                canBuy
                                  ? 'border border-amber-300 bg-amber-500 text-slate-950 hover:bg-amber-400'
                                  : 'border border-slate-700 bg-slate-800 text-slate-400 opacity-60 cursor-not-allowed'
                              }`}
                            >
                              {isNext ? (
                                <>
                                  {upg.priceGold > 0 ? `${upg.priceGold.toLocaleString('ru-RU')} 🪙 ` : ''}
                                  {upg.priceCrystals > 0 ? `${upg.priceCrystals} 💎` : ''}
                                </>
                              ) : (
                                `Нужен Ур. ${upg.level - 1}`
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SUB-TAB 3: НАЖИВКИ ДЛЯ РЕДКИХ РЫБ */}
              {shopSubTab === 'baits' && (
                <div className="space-y-2">
                  <div className="rounded-xl border border-amber-500/40 bg-slate-900/90 p-2 text-[9.5px] text-slate-200">
                    Наживки приманивают **редкую, эпическую и мифическую рыбу**, увеличивают вес трофеев и помогают удерживать рыбу на крючке при рывках!
                  </div>
                  {FISHING_BAITS.map((bait) => {
                    const owned = fishingState.baitsInventory[bait.id] || 0;
                    const canAfford =
                      bait.currency === 'gold'
                        ? hero.gold >= bait.priceGold
                        : hero.crystals >= bait.priceCrystals;
                    return (
                      <div
                        key={bait.id}
                        className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 flex items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-slate-950 text-xl">
                            {bait.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10.5px] font-black text-white">
                                {bait.name}
                              </span>
                              <span className="rounded bg-amber-950 border border-amber-500/50 px-1.5 py-0.5 text-[8px] font-bold text-amber-300">
                                У вас: {owned} шт.
                              </span>
                            </div>
                            <p className="text-[8.5px] text-slate-300 mt-0.5 leading-snug">
                              {bait.description}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleBuyBait(bait)}
                          disabled={!canAfford}
                          className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[9px] font-black cursor-pointer ${
                            canAfford
                              ? 'border border-amber-300 bg-amber-500 text-slate-950 hover:bg-amber-400'
                              : 'border border-slate-700 bg-slate-800 text-slate-400 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          +{bait.packSize} шт. за{' '}
                          {bait.currency === 'gold'
                            ? `${bait.priceGold} 🪙`
                            : `${bait.priceCrystals} 💎`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SUB-TAB 4: РЫБОЛОВНЫЕ СЕТИ И ЛИЦЕНЗИИ */}
              {shopSubTab === 'nets' && (
                <div className="space-y-2.5">
                  <div className="rounded-xl border border-teal-500/40 bg-slate-900/90 p-2 text-[9.5px] text-slate-200">
                    Для каждого заброса сети требуется **1 📜 Лицензия на сеть** и сама **🕸️ Сетка**. Вытягивайте сеть сразу после наполнения — если забыть про неё надолго, рыба в сети погибнет!
                  </div>

                  {/* Licenses Section */}
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                    📜 Лицензии на заброс сети (Доступно: {fishingState.netLicenseUses || 0} забросов)
                  </div>
                  {FISHING_NET_LICENSES.map((lic) => {
                    const canAfford =
                      lic.currency === 'gold'
                        ? hero.gold >= lic.priceGold
                        : hero.crystals >= lic.priceCrystals;
                    return (
                      <div
                        key={lic.id}
                        className="rounded-xl border border-amber-500/35 bg-slate-900/90 p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/50 bg-slate-950 text-xl">
                            {lic.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10.5px] font-black text-amber-200">{lic.name}</div>
                            <p className="text-[8.5px] text-slate-300 mt-0.5">{lic.description}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleBuyNetLicense(lic)}
                          disabled={!canAfford}
                          className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[9px] font-black cursor-pointer ${
                            canAfford
                              ? 'border border-amber-300 bg-amber-500 text-slate-950 hover:bg-amber-400'
                              : 'border border-slate-700 bg-slate-800 text-slate-400 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          Купить за{' '}
                          {lic.currency === 'gold'
                            ? `${lic.priceGold} 🪙`
                            : `${lic.priceCrystals} 💎`}
                        </button>
                      </div>
                    );
                  })}

                  {/* Nets Section */}
                  <div className="pt-1 text-[10px] font-black uppercase tracking-wider text-teal-300">
                    🕸️ Рыболовные сети
                  </div>
                  {FISHING_NETS.map((net) => {
                    const owned = fishingState.netsInventory[net.id] || 0;
                    const canAfford =
                      net.currency === 'gold'
                        ? hero.gold >= net.priceGold
                        : hero.crystals >= net.priceCrystals;
                    return (
                      <div
                        key={net.id}
                        className="rounded-xl border border-teal-500/35 bg-slate-900/90 p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-400/50 bg-slate-950 text-xl">
                            {net.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10.5px] font-black text-white">{net.name}</span>
                              <span className="rounded bg-teal-950 border border-teal-500/50 px-1.5 py-0.5 text-[8px] font-bold text-teal-300">
                                В запасе: {owned} шт.
                              </span>
                            </div>
                            <p className="text-[8.5px] text-slate-300 mt-0.5">{net.description}</p>
                            <div className="mt-0.5 text-[8px] font-bold text-amber-300">
                              Мин. удочка: Ур. {net.minRodLevel} · Улов: {net.minFishCount}–{net.maxFishCount} рыб
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleBuyNet(net)}
                          disabled={!canAfford}
                          className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[9px] font-black cursor-pointer ${
                            canAfford
                              ? 'border border-teal-300 bg-teal-500 text-slate-950 hover:bg-teal-400'
                              : 'border border-slate-700 bg-slate-800 text-slate-400 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          Купить за{' '}
                          {net.currency === 'gold'
                            ? `${net.priceGold} 🪙`
                            : `${net.priceCrystals} 💎`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 4: ДОСТИЖЕНИЯ РЫБАКА (АЧИВКИ) ================= */}
          {activeTab === 'achievements' && (
            <div className="flex flex-col gap-2">
              <div className="rounded-xl border border-purple-500/40 bg-slate-900/90 p-2.5 text-[9.5px] text-slate-200 flex items-center justify-between gap-2">
                <div>
                  <div className="font-black text-purple-200 uppercase text-[10px]">
                    🏆 Достижения Рыбака Древнего Египта
                  </div>
                  <div className="text-[8.5px] text-slate-300 mt-0.5">
                    Ловите рыбу, поднимайте затонувшие сундуки и собирайте коллекцию из 50 видов для получения золота и кристаллов!
                  </div>
                </div>
                <div className="shrink-0 text-right font-black tabular-nums text-[10px] text-amber-300">
                  {(fishingState.claimedFishingAchievements || []).length} / {FISHING_ACHIEVEMENTS.length}
                </div>
              </div>

              {FISHING_ACHIEVEMENTS.map((ach) => {
                const isClaimed = (fishingState.claimedFishingAchievements || []).includes(ach.id);
                const prog = getFishingAchievementProgress(ach, fishingState, uniqueCaughtCount);
                const isReady = prog >= ach.target && !isClaimed;
                const pct = Math.min(100, Math.round((prog / Math.max(1, ach.target)) * 100));

                return (
                  <div
                    key={ach.id}
                    className={`rounded-xl border p-2.5 transition-all ${
                      isReady
                        ? 'border-2 border-amber-400 bg-amber-950/30 shadow'
                        : isClaimed
                        ? 'border-emerald-500/40 bg-slate-900/70 opacity-80'
                        : 'border-slate-800 bg-slate-900/90'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-purple-500/40 bg-slate-950 text-xl">
                          {ach.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[10.5px] font-black text-white">
                              {ach.title}
                            </span>
                            <span className="shrink-0 text-[8.5px] font-bold text-amber-300 tabular-nums">
                              +{ach.rewardGold}🪙 {ach.rewardCrystals > 0 ? `+${ach.rewardCrystals}💎` : ''}
                            </span>
                          </div>
                          <p className="text-[8.5px] text-slate-300 mt-0.5">{ach.description}</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  isClaimed
                                    ? 'bg-emerald-400'
                                    : isReady
                                    ? 'bg-amber-400'
                                    : 'bg-cyan-400'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[8px] font-black tabular-nums text-slate-300">
                              {prog}/{ach.target}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isClaimed ? (
                          <span className="rounded-lg border border-emerald-500/50 bg-emerald-950 px-2 py-1 text-[8.5px] font-black text-emerald-300">
                            ✓ Получено
                          </span>
                        ) : isReady ? (
                          <button
                            type="button"
                            onClick={() => handleClaimFishingAchievement(ach)}
                            className="rounded-lg border border-amber-300 bg-gradient-to-r from-amber-500 to-yellow-400 px-2.5 py-1.5 text-[9px] font-black text-slate-950 shadow hover:brightness-110 active:scale-95 cursor-pointer"
                          >
                            🎁 Забрать
                          </button>
                        ) : (
                          <span className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[8px] font-bold text-slate-500">
                            В процессе
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Flying Catch Animation to Keepnet Overlay */}
        {flyingCatchAnim && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center overflow-hidden">
            <style>{`
              @keyframes flyCatchIntoKeepnet {
                0% { transform: translateY(40px) scale(0.5); opacity: 0; }
                25% { transform: translateY(-10px) scale(1.1); opacity: 1; }
                75% { transform: translate(-70px, -220px) scale(0.85); opacity: 0.9; }
                100% { transform: translate(-100px, -290px) scale(0.2); opacity: 0; }
              }
            `}</style>
            <div
              className="flex items-center gap-2 rounded-2xl border-2 border-amber-300 bg-slate-950/95 px-3.5 py-2 shadow-[0_0_25px_rgba(251,191,36,0.7)]"
              style={{
                animation: 'flyCatchIntoKeepnet 1.1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards'
              }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/40 p-1 overflow-hidden">
                {flyingCatchAnim.icon.startsWith('http') ||
                flyingCatchAnim.icon.startsWith('data:') ||
                flyingCatchAnim.icon.startsWith('/') ? (
                  <img
                    src={flyingCatchAnim.icon}
                    alt={flyingCatchAnim.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-2xl">{flyingCatchAnim.icon}</span>
                )}
              </div>
              <div className="text-left leading-tight">
                <div className="text-[10px] font-black text-amber-300">В садок! ✨</div>
                <div className="text-[9px] font-bold text-white truncate max-w-[130px]">
                  {flyingCatchAnim.name}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Выбор и покупка лески */}
        {isLineModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-2 backdrop-blur-xs">
            <div className="w-full max-w-[380px] rounded-2xl border-2 border-cyan-400 bg-slate-950 p-3 shadow-2xl text-white space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🧵</span>
                  <div className="text-xs font-black uppercase text-cyan-200">
                    Оснастка: Рыболовная леска
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLineModalOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-[8.5px] text-slate-300 leading-snug">
                Качественная леска сглаживает рывки крупной рыбы (+% контроль) и предотвращает её обрыв. При каждом забросе расходуется 1 ед. прочности.
              </p>

              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-0.5">
                {FISHING_LINES.map((line) => {
                  const isEquipped = fishingState.equippedLine?.id === line.id;
                  const count = (fishingState.linesInventory || {})[line.id] || 0;
                  const canAfford =
                    line.currency === 'gold'
                      ? hero.gold >= line.priceGold
                      : hero.crystals >= line.priceCrystals;

                  return (
                    <div
                      key={line.id}
                      className={`rounded-xl border p-2 flex items-center justify-between gap-2 ${
                        isEquipped
                          ? 'border-cyan-400 bg-cyan-950/40'
                          : 'border-slate-800 bg-slate-900/90'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0">{line.icon}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[9.5px] font-black text-white">
                              {line.name}
                            </span>
                            {isEquipped && (
                              <span className="rounded bg-cyan-900 px-1 py-0.2 text-[7px] font-black text-cyan-200">
                                В руках
                              </span>
                            )}
                          </div>
                          <div className="text-[7.5px] text-emerald-300 font-bold mt-0.5">
                            +{line.stabilityBonusPct}% контроль · {line.maxDurability} забросов
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isEquipped ? (
                          <button
                            type="button"
                            onClick={() => handleEquipLine(null)}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[8px] font-bold text-slate-300 hover:text-white cursor-pointer"
                          >
                            Снять
                          </button>
                        ) : count > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleEquipLine(line)}
                            className="rounded-lg border border-cyan-400 bg-cyan-600 px-2 py-1 text-[8px] font-black text-slate-950 hover:bg-cyan-500 cursor-pointer"
                          >
                            Надеть ({count})
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleBuyLine(line)}
                            disabled={!canAfford}
                            className={`rounded-lg px-2 py-1 text-[8px] font-black cursor-pointer ${
                              canAfford
                                ? 'border border-cyan-300 bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                                : 'border border-slate-700 bg-slate-800 text-slate-400 opacity-60 cursor-not-allowed'
                            }`}
                          >
                            {line.currency === 'gold' ? `${line.priceGold} 🪙` : `${line.priceCrystals} 💎`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Выбор и покупка крючка / аксессуара */}
        {isHookModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-2 backdrop-blur-xs">
            <div className="w-full max-w-[380px] rounded-2xl border-2 border-amber-400 bg-slate-950 p-3 shadow-2xl text-white space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🪝</span>
                  <div className="text-xs font-black uppercase text-amber-200">
                    Оснастка: Крючок / Аксессуар
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHookModalOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-[8.5px] text-slate-300 leading-snug">
                Особые древнеегипетские крючки привлекают редких и мифических рыб, а также притягивают затонувшие сундуки фараонов с золотом и реликвиями.
              </p>

              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-0.5">
                {FISHING_HOOKS.map((hook) => {
                  const isEquipped = fishingState.equippedHook?.id === hook.id;
                  const count = (fishingState.hooksInventory || {})[hook.id] || 0;
                  const canAfford =
                    hook.currency === 'gold'
                      ? hero.gold >= hook.priceGold
                      : hero.crystals >= hook.priceCrystals;

                  return (
                    <div
                      key={hook.id}
                      className={`rounded-xl border p-2 flex items-center justify-between gap-2 ${
                        isEquipped
                          ? 'border-amber-400 bg-amber-950/40'
                          : 'border-slate-800 bg-slate-900/90'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0">{hook.icon}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[9.5px] font-black text-white">
                              {hook.name}
                            </span>
                            {isEquipped && (
                              <span className="rounded bg-amber-900 px-1 py-0.2 text-[7px] font-black text-amber-200">
                                В руках
                              </span>
                            )}
                          </div>
                          <div className="text-[7.5px] text-emerald-300 font-bold mt-0.5">
                            +{hook.rareFishChanceBonusPct}% редкие · +{hook.chestChanceBonusPct}% сундуки
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isEquipped ? (
                          <button
                            type="button"
                            onClick={() => handleEquipHook(null)}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[8px] font-bold text-slate-300 hover:text-white cursor-pointer"
                          >
                            Снять
                          </button>
                        ) : count > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleEquipHook(hook)}
                            className="rounded-lg border border-amber-400 bg-amber-600 px-2 py-1 text-[8px] font-black text-slate-950 hover:bg-amber-500 cursor-pointer"
                          >
                            Надеть ({count})
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleBuyHook(hook)}
                            disabled={!canAfford}
                            className={`rounded-lg px-2 py-1 text-[8px] font-black cursor-pointer ${
                              canAfford
                                ? 'border border-amber-300 bg-amber-500 text-slate-950 hover:bg-amber-400'
                                : 'border border-slate-700 bg-slate-800 text-slate-400 opacity-60 cursor-not-allowed'
                            }`}
                          >
                            {hook.currency === 'gold' ? `${hook.priceGold} 🪙` : `${hook.priceCrystals} 💎`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Торжественное открытие Древнего Трофея Нила («Стена Славы») */}
        {trophyDiscoveryModal && (
          <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/85 p-3 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-[360px] overflow-hidden rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-[#381c08] via-[#1a0c04] to-slate-950 p-5 text-center text-white shadow-[0_0_50px_rgba(251,191,36,0.6)]">
              {/* Golden Sunburst Background Flare */}
              <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.25)_0%,transparent_70%)] animate-pulse" />

              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-600 via-amber-900 to-black text-4xl shadow-xl">
                {trophyDiscoveryModal.icon}
              </div>

              <div className="mt-3 inline-block rounded-full border border-amber-300/80 bg-amber-500/20 px-3 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-300">
                🏛️ Древний Трофей Нила
              </div>

              <h3 className="mt-2 text-base font-black text-amber-100">
                «{trophyDiscoveryModal.name}»
              </h3>

              <p className="mt-2 text-[10px] italic text-amber-200/90 leading-relaxed px-2">
                «{trophyDiscoveryModal.description}»
              </p>

              <div className="mt-3 rounded-xl border border-emerald-400/60 bg-emerald-950/70 p-2 text-[10px] font-extrabold text-emerald-200">
                ✨ Постоянное усиление героя:
                <div className="text-white mt-0.5">{trophyDiscoveryModal.bonusText}</div>
              </div>

              <p className="mt-2 text-[8px] text-amber-300/75">
                Артефакт навсегда занесён в ваш Зал Славы Нила!
              </p>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTrophyDiscoveryModal(null);
                    setActiveTab('museum');
                  }}
                  className="flex-1 rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-2.5 text-xs font-black uppercase text-slate-950 shadow-lg hover:brightness-110 active:scale-95 cursor-pointer"
                >
                  🏛️ В Зал Славы
                </button>
                <button
                  type="button"
                  onClick={() => setTrophyDiscoveryModal(null)}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white active:scale-95 cursor-pointer"
                >
                  Продолжить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
