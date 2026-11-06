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

  // 1-second clock synchronized with the character's system time
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Bucketed 30-second tick so Canvas sky gradients update smoothly with system time without restarting the 60fps loop every second
  const skySyncBucket = Math.floor(nowMs / 30000);

  // Formatted character system clock (HH:MM)
  const characterSystemTimeLabel = useMemo(() => {
    const d = new Date(nowMs);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }, [ Math.floor(nowMs / 10000) ]);

  // Time-of-Day state synchronized with character system time ('morning' | 'day' | 'sunset' | 'night')
  const activeTimeOfDay = useMemo<'morning' | 'day' | 'sunset' | 'night'>(() => {
    try {
      const saved = localStorage.getItem('bigwar_force_time_of_day');
      if (saved === 'morning' || saved === 'day' || saved === 'sunset' || saved === 'night') {
        return saved;
      }
    } catch {}
    const d = new Date(skySyncBucket * 30000);
    const h = d.getHours();
    if (h >= 5 && h < 9) return 'morning';
    if (h >= 9 && h < 17) return 'day';
    if (h >= 17 && h < 21) return 'sunset';
    return 'night';
  }, [skySyncBucket]);

  // Dynamic Sky & Horizon Gradient Profile synchronized with character system clock (smooth sunrise/sunset transitions)
  const dynamicSkyProfile = useMemo(() => {
    const d = new Date(skySyncBucket * 30000);
    const fractionalHour = d.getHours() + d.getMinutes() / 60;

    // Determine effective hour based on forced override or live character system clock
    let effectiveHour = fractionalHour;
    try {
      const saved = localStorage.getItem('bigwar_force_time_of_day');
      if (saved === 'morning') effectiveHour = 6.5 + ((d.getMinutes() % 30) / 30) * 1.2;
      else if (saved === 'day') effectiveHour = 13.0 + ((d.getMinutes() % 30) / 30) * 2.0;
      else if (saved === 'sunset') effectiveHour = 18.5 + ((d.getMinutes() % 30) / 30) * 1.2;
      else if (saved === 'night') effectiveHour = 23.0 + ((d.getMinutes() % 30) / 30) * 1.0;
    } catch {}

    // Dawn / Sunrise transition (04:30 - 09:00)
    if (effectiveHour >= 4.5 && effectiveHour < 9.0) {
      const progress = (effectiveHour - 4.5) / 4.5; // 0 -> 1 from pre-dawn to late morning
      const isEarlyDawn = progress < 0.45;
      return {
        phaseLabel: isEarlyDawn ? 'Алый восход Ра' : 'Золотой рассвет Нила',
        skyStops: isEarlyDawn
          ? ['#090d26', '#3b0a37', '#b91c1c', '#fb923c', '#fef08a']
          : ['#072ac8', '#0284c7', '#f97316', '#fdba74', '#fef9c3'],
        waterStops: isEarlyDawn
          ? ['#f97316', '#9a3412', '#1e3a8a', '#09152b']
          : ['#fbbf24', '#0e7490', '#0369a1', '#06283d'],
        horizonGlowRgba: isEarlyDawn ? 'rgba(251, 113, 133, 0.42)' : 'rgba(251, 191, 36, 0.38)',
        cloudTintRgba: isEarlyDawn ? 'rgba(244, 114, 182, 0.28)' : 'rgba(253, 224, 71, 0.25)',
        celestialX: 0.18 + progress * 0.24,
        celestialY: 0.82 - progress * 0.34,
        cssTopBannerClass: isEarlyDawn
          ? 'bg-gradient-to-b from-red-800/35 via-orange-400/20 to-transparent'
          : 'bg-gradient-to-b from-sky-700/30 via-amber-400/20 to-transparent'
      };
    }

    // Sunset / Dusk transition (16:30 - 21:00)
    if (effectiveHour >= 16.5 && effectiveHour < 21.0) {
      const progress = (effectiveHour - 16.5) / 4.5; // 0 -> 1 from golden hour to deep dusk
      const isDeepDusk = progress > 0.55;
      return {
        phaseLabel: isDeepDusk ? 'Багряный закат Атона' : 'Золотой закат над Нилом',
        skyStops: isDeepDusk
          ? ['#14052b', '#4c0519', '#991b1b', '#ea580c', '#fde047']
          : ['#1e1b4b', '#7c2d12', '#dc2626', '#f97316', '#fef08a'],
        waterStops: isDeepDusk
          ? ['#c2410c', '#6b1d2f', '#1e1b4b', '#070b19']
          : ['#ea580c', '#7c2d12', '#153e63', '#071c2e'],
        horizonGlowRgba: isDeepDusk ? 'rgba(239, 68, 68, 0.45)' : 'rgba(249, 115, 22, 0.42)',
        cloudTintRgba: isDeepDusk ? 'rgba(248, 113, 113, 0.30)' : 'rgba(251, 146, 60, 0.32)',
        celestialX: 0.58 + progress * 0.24,
        celestialY: 0.46 + progress * 0.38,
        cssTopBannerClass: isDeepDusk
          ? 'bg-gradient-to-b from-red-900/40 via-orange-600/25 to-transparent'
          : 'bg-gradient-to-b from-orange-800/35 via-yellow-400/20 to-transparent'
      };
    }

    // Daytime solar arc (09:00 - 16:30)
    if (effectiveHour >= 9.0 && effectiveHour < 16.5) {
      const progress = (effectiveHour - 9.0) / 7.5; // 0 -> 1 across day
      const isLateAfternoon = progress > 0.72;
      return {
        phaseLabel: isLateAfternoon ? 'Предзакатный зной Ра' : 'Лазурный полдень Ра',
        skyStops: isLateAfternoon
          ? ['#0c4a6e', '#0284c7', '#38bdf8', '#fbbf24', '#fef08a']
          : [
              currentLocation.skyColors[0],
              currentLocation.skyColors[1],
              '#38bdf8',
              '#bae6fd',
              currentLocation.skyColors[2]
            ],
        waterStops: [
          currentLocation.waterColors[0],
          currentLocation.waterColors[1],
          currentLocation.waterColors[2],
          currentLocation.waterColors[3]
        ],
        horizonGlowRgba: isLateAfternoon ? 'rgba(251, 191, 36, 0.30)' : 'rgba(186, 230, 253, 0.24)',
        cloudTintRgba: isLateAfternoon ? 'rgba(254, 240, 138, 0.24)' : 'rgba(255, 255, 255, 0.22)',
        celestialX: 0.38 + progress * 0.24,
        celestialY: 0.42 - Math.sin(progress * Math.PI) * 0.14,
        cssTopBannerClass: isLateAfternoon
          ? 'bg-gradient-to-b from-sky-700/25 via-amber-400/15 to-transparent'
          : 'bg-gradient-to-b from-sky-500/20 via-sky-200/10 to-transparent'
      };
    }

    // Night lunar arc (21:00 - 04:30)
    const nightHour = effectiveHour >= 21 ? effectiveHour - 21 : effectiveHour + 3;
    const progress = Math.min(1, Math.max(0, nightHour / 7.5));
    return {
      phaseLabel: 'Звёздная ночь Хонсу',
      skyStops: ['#02040a', '#060d21', '#0c1938', '#152c55', '#1e3a6d'],
      waterStops: ['#07172e', '#092444', '#051d36', '#020b16'],
      horizonGlowRgba: 'rgba(56, 189, 248, 0.18)',
      cloudTintRgba: 'rgba(148, 163, 184, 0.12)',
      celestialX: 0.22 + progress * 0.52,
      celestialY: 0.58 - Math.sin(progress * Math.PI) * 0.22,
      cssTopBannerClass: 'bg-gradient-to-b from-slate-950/45 via-blue-950/20 to-transparent'
    };
  }, [skySyncBucket, currentLocation]);

  // Sandstorm Weather Effect state (activates automatically under random weather conditions or Redblack global sandstorm)
  const [randomSandstormGust, setRandomSandstormGust] = useState<boolean>(() => Math.random() < 0.35);

  useEffect(() => {
    // Periodically roll random desert sandstorm gusts every 25s
    const gustInterval = window.setInterval(() => {
      setRandomSandstormGust((prev) => (Math.random() < 0.38 ? !prev : prev));
    }, 25000);
    return () => window.clearInterval(gustInterval);
  }, []);

  // Water Splash & Golden Radiance VFX when pulling out a catch or rare artifact
  const [catchSplashVfx, setCatchSplashVfx] = useState<{
    active: boolean;
    isGolden: boolean;
    title: string;
    subtitle: string;
  } | null>(null);

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
  holdingReelRef.current = holdingReelRef.current;
  const pendingHookOutcomeRef = useRef<FishingRollOutcome | null>(null);
  const activeBaitUsedRef = useRef<FishingBaitTemplate | null>(null);
  const castSplashTimestampRef = useRef<number>(0);
  const catchSplashTimestampRef = useRef<number>(0);
  const catchIsGoldenRef = useRef<boolean>(false);

  // Lightweight 1-second transient water ripple & splash sprite bursts (auto-expiring after 1000ms)
  const waterBurstsRef = useRef<
    Array<{
      id: number;
      bornAt: number;
      kind: 'calm' | 'reeling' | 'bite' | 'cast';
    }>
  >([]);

  const spawnWaterSplashBurst = (kind: 'calm' | 'reeling' | 'bite' | 'cast') => {
    const nowPerf = performance.now();
    const alive = waterBurstsRef.current.filter((b) => nowPerf - b.bornAt < 1000);
    if (alive.length >= 5) alive.shift();
    alive.push({
      id: nowPerf + Math.random(),
      bornAt: nowPerf,
      kind
    });
    waterBurstsRef.current = alive;
  };

  // Direct DOM refs for GPU-accelerated transform: scaleX(...) bars (eliminates React re-render lag on mobile)
  const waitBarFillDomRef = useRef<HTMLDivElement | null>(null);
  const waitTimerTextDomRef = useRef<HTMLSpanElement | null>(null);
  const waitRightTimerDomRef = useRef<HTMLSpanElement | null>(null);
  const biteBarFillDomRef = useRef<HTMLDivElement | null>(null);
  const biteTimerTextDomRef = useRef<HTMLSpanElement | null>(null);
  const biteBtnTimerDomRef = useRef<HTMLSpanElement | null>(null);
  const reelBarFillDomRef = useRef<HTMLDivElement | null>(null);
  const reelFishTrackDomRef = useRef<HTMLDivElement | null>(null);
  const reelPctTextDomRef = useRef<HTMLSpanElement | null>(null);
  const tensionBarFillDomRef = useRef<HTMLDivElement | null>(null);
  const tensionMarkerTrackDomRef = useRef<HTMLDivElement | null>(null);
  const tensionPctTextDomRef = useRef<HTMLSpanElement | null>(null);

  const syncReelingDomImmediate = (prog: number, tens: number) => {
    const clampedProg = Math.max(0, Math.min(100, prog));
    const clampedTens = Math.max(0, Math.min(100, tens));
    if (reelBarFillDomRef.current) {
      reelBarFillDomRef.current.style.transform = `scaleX(${(clampedProg / 100).toFixed(4)})`;
    }
    if (reelFishTrackDomRef.current) {
      reelFishTrackDomRef.current.style.transform = `translate3d(${Math.min(96, Math.max(4, clampedProg)).toFixed(1)}%, 0, 0)`;
    }
    if (reelPctTextDomRef.current) {
      reelPctTextDomRef.current.textContent = `${Math.round(clampedProg)}%`;
    }
    if (tensionBarFillDomRef.current) {
      tensionBarFillDomRef.current.style.transform = `scaleX(${(clampedTens / 100).toFixed(4)})`;
    }
    if (tensionMarkerTrackDomRef.current) {
      tensionMarkerTrackDomRef.current.style.transform = `translate3d(${Math.min(99, Math.max(1, clampedTens)).toFixed(1)}%, 0, 0)`;
    }
    if (tensionPctTextDomRef.current) {
      tensionPctTextDomRef.current.textContent = `${Math.round(clampedTens)}%`;
    }
  };

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

  const isSandstormActive = useMemo(() => {
    try {
      const savedEnd = localStorage.getItem('bigwar_sandstorm_end');
      if (savedEnd && Number(savedEnd) > nowMs) return true;
    } catch {}
    return (
      activeWeatherInfo.weather.id === 'weather_sandstorm' ||
      (activeWeatherInfo.weather.id === 'weather_oasis_breeze' && randomSandstormGust) ||
      randomSandstormGust
    );
  }, [activeWeatherInfo.weather.id, randomSandstormGust, nowMs]);

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
      castProgRef.current = p;
      if (p >= 1) {
        window.clearInterval(castTick);
        setCastProgress(1);
        castSplashTimestampRef.current = performance.now();
        spawnWaterSplashBurst('cast');
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
        let lastWaitStateSync = waitStart;
        const waitCountdown = window.setInterval(() => {
          if (phaseRef.current !== 'waiting' && phaseRef.current !== 'nibble') {
            window.clearInterval(waitCountdown);
            return;
          }
          const nowW = Date.now();
          const rem = Math.max(0, biteDelayMs - (nowW - waitStart));
          const ratio = Math.min(1, Math.max(0, (biteDelayMs - rem) / Math.max(1, biteDelayMs)));
          if (waitBarFillDomRef.current) {
            waitBarFillDomRef.current.style.transform = `scaleX(${ratio.toFixed(4)})`;
          }
          const secStr = `${(rem / 1000).toFixed(1)} сек`;
          if (waitTimerTextDomRef.current) {
            waitTimerTextDomRef.current.textContent = secStr;
          }
          if (waitRightTimerDomRef.current) {
            waitRightTimerDomRef.current.textContent = `${(rem / 1000).toFixed(1)}с`;
          }
          if (nowW - lastWaitStateSync >= 300 || rem <= 0) {
            lastWaitStateSync = nowW;
            setWaitTimeLeftMs(rem);
          }
        }, 60);
        timersRef.current.push(waitCountdown as unknown as number);

        // Schedule 1 subtle nibble halfway through the 3-5s waiting timer
        const nibbleDelay = Math.round(biteDelayMs * 0.5);
        const nibbleTimer = window.setTimeout(() => {
          if (phaseRef.current !== 'waiting') return;
          spawnWaterSplashBurst('calm');
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
          spawnWaterSplashBurst('bite');
          setPhase('bite');
          const reactionWindowMs = 2500 + equippedRod.level * 220; // 2.7s .. 3.6s
          setBiteTimeLeftMs(reactionWindowMs);
          setStatusBanner('⚡ КЛЮЁТ! Поплавок резко ушёл под воду — ЖМИТЕ «ПОДСЕЧЬ»!');
          playLootSound();

          const biteStart = Date.now();
          let lastBiteStateSync = biteStart;
          const biteCountdown = window.setInterval(() => {
            if (phaseRef.current !== 'bite') {
              window.clearInterval(biteCountdown);
              return;
            }
            const nowB = Date.now();
            const rem = Math.max(0, reactionWindowMs - (nowB - biteStart));
            const ratio = Math.min(1, Math.max(0, rem / Math.max(1, reactionWindowMs)));
            if (biteBarFillDomRef.current) {
              biteBarFillDomRef.current.style.transform = `scaleX(${ratio.toFixed(4)})`;
            }
            if (biteTimerTextDomRef.current) {
              biteTimerTextDomRef.current.textContent = `${(rem / 1000).toFixed(1)} сек`;
            }
            if (biteBtnTimerDomRef.current) {
              biteBtnTimerDomRef.current.textContent = `⚡ ПОДСЕЧЬ СЕЙЧАС! (${(rem / 1000).toFixed(1)}с)`;
            }
            if (nowB - lastBiteStateSync >= 300 || rem <= 0) {
              lastBiteStateSync = nowB;
              setBiteTimeLeftMs(rem);
            }
            if (rem <= 0) {
              window.clearInterval(biteCountdown);
              triggerFishEscape('🐟 Вы упустили момент поклёвки! Рыба стащила наживку и сорвалась с крючка.');
            }
          }, 60);
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
    spawnWaterSplashBurst('reeling');

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
    setStatusBanner('🟢 Рыба притихла — ТЯНИТЕ КАТУШКУ К БЕРЕГУ!');
    spawnWaterSplashBurst('calm');

    const fishStruggle =
      rolledOutcome.type === 'fish' ? Math.max(2, rolledOutcome.fish.strugglePower || 5) : 5;
    const rodControl = 1 + (equippedRod.level - 1) * 0.15;
    const baitControl = activeBaitUsedRef.current ? 1.15 : 1.0;
    const lineStability = fishingState.equippedLine ? (fishingState.equippedLine.stabilityBonusPct || 0) : 0;
    const totalControl = rodControl * baitControl * (1 + lineStability / 100);

    // Schedule dynamic fish thrashing cycles every ~1.4s - 2.3s
    let nextThrashToggleAt = Date.now() + 1400 + Math.random() * 900;
    let lastReactSyncAt = Date.now();
    let lastRippleSpawnAt = Date.now();
    let lastZoneBucket = 0; // 0: <55, 1: 55..77, 2: >=78

    // Real-time 60ms reeling & tension physics loop (GPU scaleX via direct DOM refs — zero lag!)
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
          spawnWaterSplashBurst('reeling');
        } else {
          // Calm window lasts 1.6s - 2.4s -> trigger 1-second calm water rings & splash sprites!
          nextThrashToggleAt = now + 1600 + Math.random() * 800;
          setStatusBanner('🟢 Рыба притихла — ТЯНИТЕ КАТУШКУ К БЕРЕГУ!');
          spawnWaterSplashBurst('calm');
        }
      }

      const pulling = holdingReelRef.current;
      const thrashing = thrashingRef.current;

      // Spawn periodic 1-second water rings & splashes during active reeling
      if (now - lastRippleSpawnAt >= (pulling || thrashing ? 520 : 780)) {
        lastRippleSpawnAt = now;
        spawnWaterSplashBurst(thrashing || pulling ? 'reeling' : 'calm');
      }

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

      // Instant GPU transform: scaleX(...) update without waiting for React re-render
      syncReelingDomImmediate(nextProg, nextTens);

      const curBucket = nextTens >= 78 ? 2 : nextTens >= 55 ? 1 : 0;
      if (curBucket !== lastZoneBucket || now - lastReactSyncAt >= 260) {
        lastZoneBucket = curBucket;
        lastReactSyncAt = now;
        setReelProgress(Math.round(nextProg));
        setLineTension(Math.round(nextTens));
      }

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
    syncReelingDomImmediate(nextProg, nextTens);
    spawnWaterSplashBurst('reeling');
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
    syncReelingDomImmediate(nextProg, nextTens);
    spawnWaterSplashBurst('calm');
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

    // 3. Trigger Flying Catch Animation into Keepnet + Cinematic Water Splash & Golden Radiance VFX
    const isRareOrArtifact =
      outcome.type === 'chest' ||
      Boolean(outcome.trophyAwarded) ||
      (outcome.type === 'fish' &&
        (outcome.fish.rarity === 'rare' ||
          outcome.fish.rarity === 'epic' ||
          outcome.fish.rarity === 'legendary' ||
          outcome.fish.rarity === 'mythic' ||
          outcome.weightKg >= 5 ||
          outcome.isRecordWeight));

    catchSplashTimestampRef.current = performance.now();
    catchIsGoldenRef.current = isRareOrArtifact;

    setCatchSplashVfx({
      active: true,
      isGolden: isRareOrArtifact,
      title:
        outcome.type === 'fish'
          ? isRareOrArtifact
            ? `✨ ЦАРСКИЙ УЛОВ: ${outcome.fish.name.toUpperCase()}!`
            : `💦 УЛОВ: ${outcome.fish.name}`
          : '👑 СОКРОВИЩЕ ГЛУБИН НИЛА!',
      subtitle:
        outcome.type === 'fish'
          ? `${outcome.weightKg} кг · +${outcome.goldEarned} 🪙${
              outcome.crystalsEarned > 0 ? ` +${outcome.crystalsEarned} 💎` : ''
            }`
          : 'Затонувший сундук фараона поднят на берег!'
    });
    const splashVfxTimer = window.setTimeout(() => setCatchSplashVfx(null), 2200);
    timersRef.current.push(splashVfxTimer);

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

  // Optimized 60FPS 2D Canvas Renderer: High-Visibility Tackle (Rod, Contrasted Line, Glowing Enlarged Bobber), 1s Splash Sprites & Sandstorm VFX
  useEffect(() => {
    if (activeTab !== 'play') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const startTime = performance.now();
    const w = canvas.width;
    const h = canvas.height;
    const horizonY = h * 0.28;

    const isNight = activeTimeOfDay === 'night';
    const isMorning = activeTimeOfDay === 'morning';
    const isSunset = activeTimeOfDay === 'sunset';

    // Pre-build dynamic system-time sky & water gradients once per 30s sky bucket (zero per-frame GC or lag!)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, dynamicSkyProfile.skyStops[0]);
    skyGrad.addColorStop(0.32, dynamicSkyProfile.skyStops[1]);
    skyGrad.addColorStop(0.62, dynamicSkyProfile.skyStops[2]);
    skyGrad.addColorStop(0.85, dynamicSkyProfile.skyStops[3]);
    skyGrad.addColorStop(1, dynamicSkyProfile.skyStops[4]);

    // Horizon Sunrise/Sunset Atmospheric Glow Band
    const horizonGlowGrad = ctx.createLinearGradient(0, horizonY * 0.35, 0, horizonY + 14);
    horizonGlowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    horizonGlowGrad.addColorStop(0.65, dynamicSkyProfile.horizonGlowRgba);
    horizonGlowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    const waterGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    waterGrad.addColorStop(0, dynamicSkyProfile.waterStops[0]);
    waterGrad.addColorStop(0.28, dynamicSkyProfile.waterStops[1]);
    waterGrad.addColorStop(0.68, dynamicSkyProfile.waterStops[2]);
    waterGrad.addColorStop(1, dynamicSkyProfile.waterStops[3]);

    const swimmers = [
      { x: 0.2, y: 0.58, speed: 0.036, scale: 0.58, dir: 1, depth: 0.35 },
      { x: 0.74, y: 0.68, speed: 0.048, scale: 0.76, dir: -1, depth: 0.6 },
      { x: 0.42, y: 0.78, speed: 0.032, scale: 0.92, dir: 1, depth: 0.85 }
    ];

    // Lightweight Night Fireflies
    const fireflies = Array.from({ length: 12 }, (_, i) => ({
      baseX: 0.08 + ((i * 0.077) % 0.84),
      baseY: 0.34 + ((i * 0.051) % 0.54),
      orbitRx: 7 + (i % 3) * 4,
      orbitRy: 4 + (i % 2) * 3,
      speed: 1.0 + (i % 4) * 0.3,
      phase: i * 1.7
    }));

    // Sandstorm falling & blowing sand particles (36 lightweight particles)
    const sandParticles = Array.from({ length: 36 }, (_, i) => ({
      x: (i * 0.029) % 1,
      y: (i * 0.067) % 1,
      speedX: 0.26 + (i % 5) * 0.055,
      speedY: 0.14 + (i % 4) * 0.038,
      len: 7 + (i % 4) * 4,
      size: 1.1 + (i % 3) * 0.6,
      alpha: 0.35 + (i % 4) * 0.14
    }));

    const starSeeds = [
      [0.06, 0.08], [0.14, 0.19], [0.22, 0.06], [0.31, 0.14], [0.39, 0.07],
      [0.48, 0.18], [0.57, 0.06], [0.66, 0.15], [0.75, 0.09], [0.84, 0.19],
      [0.92, 0.08], [0.18, 0.24], [0.53, 0.23], [0.79, 0.25]
    ];

    const renderFrame = (now: number) => {
      if (document.visibilityState === 'hidden') {
        animId = requestAnimationFrame(renderFrame);
        return;
      }

      const t = (now - startTime) * 0.001;
      const curPhase = phaseRef.current;
      const isThrash = thrashingRef.current;

      ctx.clearRect(0, 0, w, h);

      // 1. Dynamic Sky Gradient Background (Synchronized with Character System Time)
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, horizonY + 2);

      // 1.05. Animated Sunrise/Sunset Horizon Glow & Drifting Twilight Clouds
      ctx.fillStyle = horizonGlowGrad;
      ctx.fillRect(0, horizonY * 0.35, w, horizonY * 0.75);

      ctx.fillStyle = dynamicSkyProfile.cloudTintRgba;
      for (let ci = 0; ci < 4; ci++) {
        const cx = ((ci * 0.27 + t * (0.008 + ci * 0.002)) % 1.25 - 0.12) * w;
        const cy = horizonY * (0.36 + (ci % 2) * 0.22);
        const cw = 46 + (ci % 3) * 18;
        const ch = 4.5 + (ci % 2) * 2.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 1.1. Night / Dawn / Dusk Stars
      if (isNight || isMorning || isSunset) {
        const starVisibility = isNight ? 1.0 : 0.38;
        starSeeds.forEach(([sx, sy], idx) => {
          if (!isNight && sy > 0.16) return;
          const twinkle = (0.35 + (Math.sin(t * 2.4 + idx * 1.7) * 0.5 + 0.5) * 0.65) * starVisibility;
          ctx.fillStyle = `rgba(224, 242, 254, ${twinkle.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(sx * w, sy * horizonY, idx % 4 === 0 ? 1.4 : 0.95, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // 1.2. Sun / Moon Celestial Disc synchronized with system time arc
      const celestialX = w * dynamicSkyProfile.celestialX;
      const celestialY = horizonY * dynamicSkyProfile.celestialY;
      if (isNight) {
        ctx.fillStyle = 'rgba(186, 230, 253, 0.22)';
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#071026';
        ctx.beginPath();
        ctx.arc(celestialX + 4.5, celestialY - 2, 9.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = isSunset
          ? 'rgba(251, 113, 133, 0.34)'
          : isMorning
          ? 'rgba(251, 191, 36, 0.34)'
          : 'rgba(253, 224, 71, 0.26)';
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isSunset ? '#fdba74' : isMorning ? '#fde047' : '#fef9c3';
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, 13.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 1.3. Far Nile Bank & Pyramids on Horizon
      const bankColor = isNight ? '#060c18' : isSunset ? '#2d0610' : isMorning ? '#17253b' : '#291c12';
      ctx.fillStyle = bankColor;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.quadraticCurveTo(w * 0.2, horizonY - 8, w * 0.45, horizonY - 4);
      ctx.quadraticCurveTo(w * 0.72, horizonY - 10, w, horizonY - 3);
      ctx.lineTo(w, horizonY + 2);
      ctx.lineTo(0, horizonY + 2);
      ctx.closePath();
      ctx.fill();

      // Great Pyramids
      ctx.fillStyle = isNight ? '#0a1529' : isSunset ? '#3f0814' : '#3a2618';
      ctx.beginPath();
      ctx.moveTo(w * 0.08, horizonY);
      ctx.lineTo(w * 0.21, horizonY - 36);
      ctx.lineTo(w * 0.34, horizonY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = isNight ? 'rgba(186, 230, 253, 0.14)' : 'rgba(253, 224, 71, 0.25)';
      ctx.beginPath();
      ctx.moveTo(w * 0.21, horizonY - 36);
      ctx.lineTo(w * 0.34, horizonY);
      ctx.lineTo(w * 0.23, horizonY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = isNight ? '#081121' : '#2e1d12';
      ctx.beginPath();
      ctx.moveTo(w * 0.66, horizonY);
      ctx.lineTo(w * 0.77, horizonY - 27);
      ctx.lineTo(w * 0.88, horizonY);
      ctx.closePath();
      ctx.fill();

      // 2. Nile Water Base + Shimmering Sun/Moon Path (Lightweight — main wave motion is handled by GPU CSS/SVG waves!)
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, horizonY, w, h - horizonY);

      // Sun / Moon Shimmering Path (10 lightweight glints)
      const shimmerColor = isNight
        ? 'rgba(186, 230, 253, 0.22)'
        : isSunset
        ? 'rgba(251, 146, 60, 0.28)'
        : 'rgba(253, 224, 71, 0.24)';
      ctx.fillStyle = shimmerColor;
      for (let sr = 0; sr < 10; sr++) {
        const srRatio = sr / 10;
        const sy = horizonY + 5 + srRatio * (h - horizonY - 18);
        const spread = 6 + srRatio * 34 + Math.sin(t * 3 + sr) * 4;
        const sxOff = Math.sin(t * 2.2 + sr * 1.1) * (2 + srRatio * 6);
        ctx.beginPath();
        ctx.ellipse(celestialX + sxOff, sy, spread, 1.2 + srRatio * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Cast Fishing Net Buoys on Left Side of Water
      if (fishingState.activeNet) {
        const netReady = Date.now() >= fishingState.activeNet.readyAt;
        const netSpoiled = Date.now() >= fishingState.activeNet.spoilAt;
        const netX = w * 0.16;
        const netY = h * 0.56 + Math.sin(t * 2.4) * 2;
        ctx.save();
        ctx.strokeStyle = netSpoiled ? '#ef4444' : netReady ? '#10b981' : '#f59e0b';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.ellipse(netX, netY, 24, 9, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // 4. Underwater Swimming Fish Shadows
      swimmers.forEach((sw, idx) => {
        sw.x += sw.speed * sw.dir * 0.012;
        if (sw.dir > 0 && sw.x > 1.1) sw.x = -0.1;
        if (sw.dir < 0 && sw.x < -0.1) sw.x = 1.1;
        const fx = sw.x * w;
        const fy = sw.y * h + Math.sin(t * 2 + idx) * 3;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.scale(sw.dir * sw.scale, sw.scale * 0.62);
        ctx.fillStyle = `rgba(3, 18, 34, ${0.3 + sw.depth * 0.22})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Night Fireflies
      if (isNight) {
        fireflies.forEach((ff) => {
          const fx = ff.baseX * w + Math.cos(t * ff.speed + ff.phase) * ff.orbitRx;
          const fy = ff.baseY * h + Math.sin(t * ff.speed * 1.2 + ff.phase) * ff.orbitRy;
          const alpha = 0.35 + (Math.sin(t * 3.5 + ff.phase) * 0.5 + 0.5) * 0.6;
          ctx.fillStyle = `rgba(253, 224, 71, ${alpha.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(fx, fy, 2.1, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // 4.9. SANDSTORM WEATHER EFFECT («Песчаная буря»: падающие частицы песка и легкое снижение видимости фона)
      if (isSandstormActive) {
        ctx.save();
        // Warm desert dust veil that slightly reduces visibility of background objects
        ctx.fillStyle = isNight ? 'rgba(120, 72, 24, 0.24)' : 'rgba(217, 119, 6, 0.22)';
        ctx.fillRect(0, 0, w, h);

        // Diagonal falling & blowing sand particles across the screen
        ctx.strokeStyle = isNight ? 'rgba(253, 224, 71, 0.42)' : 'rgba(254, 240, 138, 0.55)';
        ctx.fillStyle = isNight ? 'rgba(251, 191, 36, 0.55)' : 'rgba(254, 249, 195, 0.7)';
        for (let i = 0; i < sandParticles.length; i++) {
          const sp = sandParticles[i];
          const px = ((sp.x + t * sp.speedX) % 1.12 - 0.06) * w;
          const py = ((sp.y + t * sp.speedY) % 1.12 - 0.06) * h;

          // Diagonal wind streak
          ctx.lineWidth = sp.size * 0.75;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - sp.len, py - sp.len * 0.48);
          ctx.stroke();

          // Sand grain head
          ctx.beginPath();
          ctx.arc(px, py, sp.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // ============================================================================
      // 5. HIGH-VISIBILITY TACKLE: FOREGROUND ROD, CONTRASTED LINE & GLOWING BOBBER
      // Always visible on top of water, night sky, and sandstorm!
      // ============================================================================
      const rodBaseX = w * 0.87;
      const rodBaseY = h * 0.98;
      const biteShake =
        curPhase === 'bite'
          ? Math.sin(t * 42) * 7.5
          : curPhase === 'reeling'
          ? Math.sin(t * (isThrash ? 46 : 24)) * (isThrash ? 8.0 : 3.2)
          : curPhase === 'nibble'
          ? Math.sin(t * 24) * 3.8
          : 0;
      const rodBend =
        curPhase === 'reeling'
          ? 22 + (tensionRef.current / 100) * 28
          : curPhase === 'bite'
          ? 20
          : curPhase === 'nibble'
          ? 8 + Math.sin(t * 18) * 3
          : curPhase === 'casting'
          ? -12
          : 4;

      const rodTipX = w * 0.55 - rodBend * 0.58 + biteShake * 0.45;
      const rodTipY = h * 0.17 + rodBend * 0.82 + Math.sin(t * 2.2) * 1.8 + biteShake * 0.35;
      const rodCtrlX = w * 0.73 - rodBend * 0.2;
      const rodCtrlY = h * 0.48 + rodBend * 0.4;

      const targetFloatX = w * activeDepthZoneObj.floatTargetXRatio;
      const targetFloatY = h * activeDepthZoneObj.floatTargetYRatio;

      // Bobber is ALWAYS shown on screen so the player never loses sight of their tackle
      let floatX = targetFloatX;
      let floatY = targetFloatY + Math.sin(t * 2.8) * 2.2;

      if (curPhase === 'casting') {
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
        const reelPull = curPhase === 'reeling' ? (reelProgRef.current / 100) * 0.58 : 0;
        const bobOffset =
          curPhase === 'bite'
            ? 12 + Math.sin(t * 36) * 6.5
            : curPhase === 'nibble'
            ? 4.0 + Math.sin(t * 26) * 4.0
            : curPhase === 'reeling'
            ? 4.5 + Math.sin(t * (isThrash ? 38 : 20)) * (isThrash ? 6.5 : 3.2)
            : Math.sin(t * 3.0) * 2.4;
        floatX =
          targetFloatX +
          (rodBaseX * 0.66 - targetFloatX) * reelPull +
          (curPhase === 'reeling' ? Math.sin(t * (isThrash ? 16 : 8)) * (isThrash ? 20 : 10) : 0) +
          (curPhase === 'nibble' ? Math.cos(t * 20) * 2.2 : 0);
        floatY = targetFloatY + (h * 0.81 - targetFloatY) * reelPull + bobOffset;
      }

      // 6. 1-SECOND AUTO-EXPIRING WATER RINGS & SPLASH DROPLET SPRITES AT BOBBER POINT
      // Triggered on «Рыба притихла» (calm), active reeling, bite, and cast touchdown; disappears in 1.0s without memory bloat!
      const activeBursts = waterBurstsRef.current;
      for (let i = activeBursts.length - 1; i >= 0; i--) {
        const ageMs = now - activeBursts[i].bornAt;
        if (ageMs >= 1000) {
          activeBursts.splice(i, 1);
          continue;
        }
        const p = Math.max(0, Math.min(1, ageMs / 1000)); // 0..1 over exactly 1 second
        const fade = 1 - p;
        const kind = activeBursts[i].kind;
        const ringColor =
          kind === 'calm'
            ? `rgba(110, 231, 183, ${(fade * 0.9).toFixed(2)})`
            : kind === 'bite'
            ? `rgba(253, 224, 71, ${(fade * 0.95).toFixed(2)})`
            : `rgba(224, 242, 254, ${(fade * 0.88).toFixed(2)})`;

        ctx.save();
        // 3 expanding concentric water rings around the bobber
        for (let r = 0; r < 3; r++) {
          const rp = Math.max(0, Math.min(1, p * 1.25 - r * 0.16));
          if (rp <= 0 || rp >= 1) continue;
          const rx = 10 + rp * (kind === 'reeling' || kind === 'bite' ? 46 : 36);
          const ry = rx * 0.38;
          ctx.strokeStyle = ringColor;
          ctx.lineWidth = (1 - rp) * 2.4 + 0.6;
          ctx.beginPath();
          ctx.ellipse(floatX, floatY + 5, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 6 lightweight animated splash droplet sprites arcing up and vanishing within 1 second
        ctx.fillStyle =
          kind === 'calm'
            ? `rgba(167, 243, 208, ${(fade * 0.92).toFixed(2)})`
            : `rgba(224, 242, 254, ${(fade * 0.95).toFixed(2)})`;
        for (let d = 0; d < 6; d++) {
          const angle = -Math.PI * 0.15 - (d / 5) * Math.PI * 0.7;
          const dist = p * (16 + (d % 3) * 8);
          const dx = floatX + Math.cos(angle) * dist;
          const dy = floatY + Math.sin(angle) * dist - Math.sin(p * Math.PI) * 14 + p * p * 16;
          const dropRadius = Math.max(0.6, fade * (d % 2 === 0 ? 2.6 : 1.9));
          ctx.beginPath();
          ctx.arc(dx, dy, dropRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Continuous subtle ambient ripple around bobber on water
      if (curPhase !== 'casting' || castProgRef.current > 0.85) {
        const ambPhase = (t * (curPhase === 'reeling' || curPhase === 'bite' ? 1.8 : 0.75)) % 1;
        const ambRx = 9 + ambPhase * 24;
        ctx.strokeStyle = `rgba(186, 230, 253, ${((1 - ambPhase) * 0.65).toFixed(2)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(floatX, floatY + 5, ambRx, ambRx * 0.38, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Catch Extraction Golden/Water Splash on Canvas
      const msSinceCatch = now - catchSplashTimestampRef.current;
      if (msSinceCatch >= 0 && msSinceCatch < 1200) {
        const cp = msSinceCatch / 1200;
        const fade = 1 - cp;
        const splashCX = w * 0.52;
        const splashCY = h * 0.72;
        ctx.save();
        ctx.strokeStyle = catchIsGoldenRef.current
          ? `rgba(253, 224, 71, ${(fade * 0.9).toFixed(2)})`
          : `rgba(186, 230, 253, ${(fade * 0.85).toFixed(2)})`;
        ctx.lineWidth = 2.5 * fade;
        ctx.beginPath();
        ctx.ellipse(splashCX, splashCY, 14 + cp * 58, (14 + cp * 58) * 0.36, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 7. ENLARGED HIGH-VISIBILITY BOBBER WITH SOFT LUMINOUS HALO GLOW
      ctx.save();
      ctx.translate(floatX, floatY);
      ctx.rotate(
        curPhase === 'bite'
          ? Math.sin(t * 28) * 0.42
          : curPhase === 'nibble'
          ? Math.sin(t * 22) * 0.24
          : curPhase === 'reeling'
          ? isThrash
            ? Math.sin(t * 34) * 0.48
            : -0.34
          : Math.sin(t * 2.5) * 0.07
      );

      // Soft Luminous Glow Halo around the Bobber (always active so it stands out at night & in sandstorms)
      const haloRadius = curPhase === 'bite' ? 36 : curPhase === 'reeling' ? 30 : 26;
      const bobberGlow = ctx.createRadialGradient(0, -6, 2, 0, -6, haloRadius);
      if (curPhase === 'bite') {
        bobberGlow.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
        bobberGlow.addColorStop(0.45, 'rgba(250, 204, 21, 0.55)');
        bobberGlow.addColorStop(1, 'rgba(250, 204, 21, 0)');
      } else if (curPhase === 'reeling' && isThrash) {
        bobberGlow.addColorStop(0, 'rgba(254, 202, 202, 0.9)');
        bobberGlow.addColorStop(0.45, 'rgba(239, 68, 68, 0.5)');
        bobberGlow.addColorStop(1, 'rgba(239, 68, 68, 0)');
      } else {
        bobberGlow.addColorStop(0, 'rgba(254, 249, 195, 0.85)');
        bobberGlow.addColorStop(0.42, 'rgba(56, 189, 248, 0.45)');
        bobberGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
      }
      ctx.fillStyle = bobberGlow;
      ctx.beginPath();
      ctx.arc(0, -6, haloRadius, 0, Math.PI * 2);
      ctx.fill();

      // Submerged lower quill stem
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(0, 7);
      ctx.lineTo(0, 16);
      ctx.stroke();

      // Dark outer contrast outline around enlarged bobber body
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.ellipse(0, 1, 10.2, 13.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Enlarged Egyptian Balsa Body — Golden lower half
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.ellipse(0, 2, 8.6, 11.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Luminous Turquoise middle band
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(-8.2, -3, 16.4, 4.2);

      // Bright Crimson-Orange upper dome
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.ellipse(0, -3.5, 8.2, 8.5, 0, Math.PI, Math.PI * 2);
      ctx.fill();

      // White specular shine on bobber
      ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
      ctx.beginPath();
      ctx.ellipse(-3, -3.5, 2.2, 5.5, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // High-visibility tall antenna with dark casing + neon core
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(0, -28);
      ctx.stroke();

      ctx.strokeStyle = curPhase === 'bite' ? '#ffffff' : '#fef08a';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(0, -28);
      ctx.stroke();

      // Glowing fiber-optic beacon tip at top of antenna
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(0, -29, 5.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = curPhase === 'bite' ? '#22d3ee' : curPhase === 'reeling' && isThrash ? '#ef4444' : '#fde047';
      ctx.beginPath();
      ctx.arc(0, -29, 4.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-1.2, -30.2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 8. HIGH-CONTRAST FISHING LINE (Dual-pass with real-time physical tension visualization)
      const lineHighTension = curPhase === 'reeling' && tensionRef.current >= 78;
      const lineMedTension = curPhase === 'reeling' && tensionRef.current >= 48;
      const isTaut = curPhase === 'reeling' || curPhase === 'bite';
      const vibration = isTaut
        ? Math.sin(t * (lineHighTension ? 75 : 42)) * (lineHighTension ? 4.2 : 2.0)
        : curPhase === 'nibble'
        ? Math.sin(t * 28) * 1.5
        : 0;
      const slack = isTaut ? vibration : 16 + Math.sin(t * 2.5) * 2.2;
      const attachX = floatX;
      const attachY = floatY - 27;
      const midX = (rodTipX + attachX) * 0.5 + vibration * 0.5;
      const midY = (rodTipY + attachY) * 0.5 + slack;

      ctx.save();
      ctx.lineCap = 'round';
      // Pass 1: Dark high-contrast outer casing so line never blends into bright sky/sand/water
      ctx.strokeStyle = 'rgba(5, 10, 20, 0.85)';
      ctx.lineWidth = isTaut ? 4.6 : 3.8;
      ctx.beginPath();
      ctx.moveTo(rodTipX, rodTipY);
      ctx.quadraticCurveTo(midX, midY, attachX, attachY);
      ctx.stroke();

      // Pass 2: Bright luminous inner line showing tension state
      ctx.strokeStyle = lineHighTension
        ? '#ff3b3b'
        : lineMedTension
        ? '#facc15'
        : curPhase === 'bite'
        ? '#fde047'
        : curPhase === 'reeling'
        ? '#6ee7b7'
        : '#e0f2fe';
      ctx.lineWidth = isTaut ? 2.6 : 2.0;
      ctx.beginPath();
      ctx.moveTo(rodTipX, rodTipY);
      ctx.quadraticCurveTo(midX, midY, attachX, attachY);
      ctx.stroke();
      ctx.restore();

      // 9. HIGH-VISIBILITY FOREGROUND FISHING ROD, SPINNING REEL & GLOWING ROD TIP
      ctx.save();
      ctx.lineCap = 'round';

      // Outer dark contrast border around rod blank
      ctx.strokeStyle = '#050811';
      ctx.lineWidth = 9.5;
      ctx.beginPath();
      ctx.moveTo(rodBaseX, rodBaseY);
      ctx.quadraticCurveTo(rodCtrlX, rodCtrlY, rodTipX, rodTipY);
      ctx.stroke();

      // Golden guide rings along the rod blank
      [0.3, 0.54, 0.76, 0.94].forEach((gt) => {
        const omt = 1 - gt;
        const gx = omt * omt * rodBaseX + 2 * omt * gt * rodCtrlX + gt * gt * rodTipX;
        const gy = omt * omt * rodBaseY + 2 * omt * gt * rodCtrlY + gt * gt * rodTipY;
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(gx - 3.5, gy + 2.5, 3.2 * (1 - gt * 0.3), 0, Math.PI * 2);
        ctx.stroke();
      });

      // Main tapered rod blank
      const rodGrad = ctx.createLinearGradient(rodBaseX, rodBaseY, rodTipX, rodTipY);
      rodGrad.addColorStop(0, '#78350f');
      rodGrad.addColorStop(0.45, '#d97706');
      rodGrad.addColorStop(0.82, '#fbbf24');
      rodGrad.addColorStop(1, '#fef08a');
      ctx.strokeStyle = rodGrad;
      ctx.lineWidth = 6.2;
      ctx.beginPath();
      ctx.moveTo(rodBaseX, rodBaseY);
      ctx.quadraticCurveTo(rodCtrlX, rodCtrlY, rodTipX, rodTipY);
      ctx.stroke();

      // Soft luminous glow + high-contrast beacon at Rod Tip so player clearly sees rod tip twitching
      const tipGlow = ctx.createRadialGradient(rodTipX, rodTipY, 1, rodTipX, rodTipY, 14);
      tipGlow.addColorStop(
        0,
        curPhase === 'bite' || lineHighTension ? 'rgba(254, 240, 138, 0.95)' : 'rgba(56, 189, 248, 0.85)'
      );
      tipGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = tipGlow;
      ctx.beginPath();
      ctx.arc(rodTipX, rodTipY, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(rodTipX, rodTipY, 5.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle =
        curPhase === 'bite'
          ? '#fde047'
          : lineHighTension
          ? '#ef4444'
          : curPhase === 'reeling'
          ? '#34d399'
          : '#38bdf8';
      ctx.beginPath();
      ctx.arc(rodTipX, rodTipY, 3.8, 0, Math.PI * 2);
      ctx.fill();

      // Spinning Reel at rod base
      const reelT = 0.22;
      const omtR = 1 - reelT;
      const reelX = omtR * omtR * rodBaseX + 2 * omtR * reelT * rodCtrlX + reelT * reelT * rodTipX;
      const reelY = omtR * omtR * rodBaseY + 2 * omtR * reelT * rodCtrlY + reelT * reelT * rodTipY;

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(reelX - 8, reelY + 5, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const crankAngle = curPhase === 'reeling' ? t * (holdingReelRef.current ? 18 : 5) : 0.6;
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(reelX - 8, reelY + 5);
      ctx.lineTo(reelX - 8 + Math.cos(crankAngle) * 8, reelY + 5 + Math.sin(crankAngle) * 8);
      ctx.stroke();
      ctx.restore();

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [
    activeTab,
    equippedRod.level,
    currentLocation,
    fishingState.activeNet,
    selectedDepthZoneId,
    activeBait,
    activeColdCurrent.zoneId,
    activeTimeOfDay,
    dynamicSkyProfile,
    isSandstormActive
  ]);

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
      <div className="relative flex h-[94dvh] max-h-[820px] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border-2 border-amber-500/85 bg-gradient-to-b from-[#16100a] via-[#0c131d] to-[#120c07] text-white shadow-[0_0_40px_rgba(245,158,11,0.32),inset_0_1px_0_rgba(254,240,138,0.4)]">
        {/* Top Header — Polished Egyptian Obsidian & Gold Frieze */}
        <div className="flex shrink-0 items-center justify-between border-b-2 border-amber-500/45 bg-gradient-to-r from-[#1f1308] via-[#130d06] to-[#1f1308] px-3 py-2 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-amber-400/80 bg-gradient-to-b from-amber-900/90 via-[#1a1105] to-amber-950 text-lg shadow-[0_0_12px_rgba(251,191,36,0.35)]">
              🎣
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xs font-black uppercase tracking-wider text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                Священная Рыбалка Нила
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-amber-100/80 tabular-nums">
                <span>
                  Улов: <strong className="text-emerald-300">{fishingState.totalFishCaught}</strong>
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <span>Садок:</span>
                  <strong className={isKeepnetFull ? 'text-red-400' : 'text-amber-300'}>
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
                        ? 'border border-amber-200 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 text-slate-950 hover:brightness-110 active:scale-95 shadow-xs'
                        : 'border border-amber-900/50 bg-[#140d06] text-slate-500 opacity-60 cursor-not-allowed'
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
                className="flex items-center gap-1 rounded-lg border border-amber-400/80 bg-gradient-to-b from-amber-500/35 to-amber-950/90 px-2 py-1 text-[9.5px] font-black text-amber-200 hover:border-yellow-300 hover:text-white active:scale-95 shadow cursor-pointer"
                title="Открыть еженедельный рейтинг лучших рыболовов Нила (по весу пойманной рыбы)"
              >
                <span>🏆</span>
                <span>Рейтинг</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg border border-amber-500/50 bg-[#1c1209] px-2.5 py-1 text-xs font-bold text-amber-200 hover:border-red-400 hover:text-white active:scale-95 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Live Synchronized Player Resources Strip — Carved Sandstone & Gold Trim */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-1.5 border-b border-amber-500/30 bg-gradient-to-r from-[#170f07] via-[#1f150a] to-[#170f07] px-3 py-1.5 text-[10px] font-bold tabular-nums shadow-inner">
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

        {/* 5 Main Navigation Tabs — Ancient Egyptian Stone Tablets */}
        <div className="grid shrink-0 grid-cols-5 gap-1 border-b border-amber-500/40 bg-[#110b05] p-1">
          <button
            onClick={() => setActiveTab('play')}
            className={`flex flex-col items-center justify-center rounded-lg py-1 text-[8.5px] font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'play'
                ? 'border border-amber-300 bg-gradient-to-b from-amber-600 via-amber-800 to-[#241406] text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                : 'border border-amber-900/40 bg-[#1a1108] text-amber-200/60 hover:text-amber-100'
            }`}
          >
            <span className="text-sm leading-none">🎣</span>
            <span className="mt-0.5">Лов</span>
          </button>

          <button
            onClick={() => setActiveTab('museum')}
            className={`relative flex flex-col items-center justify-center rounded-lg py-1 text-[8.5px] font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'museum'
                ? 'border border-amber-300 bg-gradient-to-b from-amber-600 via-amber-800 to-[#241406] text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.4)]'
                : 'border border-amber-900/40 bg-[#1a1108] text-amber-200/60 hover:text-amber-100'
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
                ? 'border border-amber-300 bg-gradient-to-b from-amber-600 via-amber-800 to-[#241406] text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                : 'border border-amber-900/40 bg-[#1a1108] text-amber-200/60 hover:text-amber-100'
            }`}
          >
            <span className="text-sm leading-none">📘</span>
            <span className="mt-0.5">Альбом ({uniqueCaughtCount}/50)</span>
          </button>

          <button
            onClick={() => setActiveTab('shop')}
            className={`flex flex-col items-center justify-center rounded-lg py-1 text-[8.5px] font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'shop'
                ? 'border border-amber-300 bg-gradient-to-b from-amber-600 via-amber-800 to-[#241406] text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                : 'border border-amber-900/40 bg-[#1a1108] text-amber-200/60 hover:text-amber-100'
            }`}
          >
            <span className="text-sm leading-none">🛒</span>
            <span className="mt-0.5">Лавка</span>
          </button>

          <button
            onClick={() => setActiveTab('achievements')}
            className={`relative flex flex-col items-center justify-center rounded-lg py-1 text-[8.5px] font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'achievements'
                ? 'border border-amber-300 bg-gradient-to-b from-amber-600 via-amber-800 to-[#241406] text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                : 'border border-amber-900/40 bg-[#1a1108] text-amber-200/60 hover:text-amber-100'
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
              {/* Keepnet (Садок) Bar — Carved Egyptian Sandstone & Papyrus Scroll Panel */}
              <div
                className={`rounded-xl border-2 p-2.5 transition-colors shadow-[0_6px_18px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(253,224,71,0.22)] ${
                  isKeepnetFull
                    ? 'border-red-500/85 bg-gradient-to-b from-red-950/70 via-[#240b0b] to-[#140606]'
                    : 'border-amber-500/55 bg-gradient-to-b from-[#24170b] via-[#171008] to-[#110b05]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black tabular-nums">
                      <span>🪣</span>
                      <span className={isKeepnetFull ? 'text-red-300' : 'text-amber-200'}>
                        Садок фараона: {keepnetFishList.length} / {keepnetCapacity}
                      </span>
                      <span className="text-[8.5px] font-bold text-amber-400/80">
                        (Ур. {fishingState.keepnetLevel || 1})
                      </span>
                      {isKeepnetFull && (
                        <span className="rounded bg-red-600/90 px-1.5 py-0.5 text-[7.5px] font-black uppercase text-white">
                          ПОЛОН!
                        </span>
                      )}
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#0b0703] border border-amber-500/40 shadow-inner">
                      <div
                        className={`h-full w-full origin-left will-change-transform transition-transform duration-300 ${
                          isKeepnetFull
                            ? 'bg-gradient-to-r from-red-600 to-rose-400'
                            : keepnetFishList.length >= keepnetCapacity * 0.75
                            ? 'bg-gradient-to-r from-amber-600 to-yellow-300'
                            : 'bg-gradient-to-r from-emerald-600 via-teal-400 to-amber-300'
                        }`}
                        style={{
                          transform: `scaleX(${Math.min(
                            1,
                            Math.max(0, keepnetFishList.length / Math.max(1, keepnetCapacity))
                          ).toFixed(3)})`
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
                          ? 'border-2 border-amber-200 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 text-slate-950 shadow-[0_2px_10px_rgba(245,158,11,0.45)] hover:brightness-110 active:scale-95'
                          : 'border border-amber-900/40 bg-[#140d07] text-slate-500 opacity-60 cursor-not-allowed'
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
                        className="rounded-lg border border-amber-400/60 bg-gradient-to-b from-amber-900/70 to-[#1a1006] px-2 py-1.5 text-[9px] font-black text-amber-200 hover:border-amber-300 cursor-pointer"
                      >
                        +Места
                      </button>
                    )}
                  </div>
                </div>

                {/* Daily Quest Fish Species Tracker — Papyrus Strip */}
                {dailyCatchQuest && (
                  <div className="mt-1.5 flex items-center justify-between rounded-lg border border-amber-500/45 bg-gradient-to-r from-[#2c1d0d] via-[#211509] to-[#2c1d0d] px-2.5 py-1 text-[8.5px] shadow-inner">
                    <span className="truncate font-bold text-amber-100">
                      📜 Папирус дня: поймать «{dailyCatchQuest.targetFishName || 'рыбу'}»
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
              <div className="rounded-xl border-2 border-amber-500/50 bg-gradient-to-b from-[#21150a] via-[#150e07] to-[#0e0904] p-2.5 space-y-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(253,224,71,0.2)]">
                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-amber-200">
                  <span>🗺️ Берега Нила (Удилище Ур. {equippedRod.level}/5)</span>
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
                            ? 'border-2 border-amber-300 bg-gradient-to-b from-amber-700/80 via-amber-950 to-[#1a0f05] text-white shadow-[0_0_12px_rgba(251,191,36,0.4)]'
                            : isUnlocked
                            ? 'border-amber-700/40 bg-[#170f08] text-amber-100 hover:border-amber-400/70'
                            : 'border-stone-800 bg-[#0f0a06]/70 text-stone-500 opacity-65'
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
                      {isSandstormActive && (
                        <span className="rounded bg-amber-600/90 px-1 py-0.2 text-[7.5px] font-black text-white">
                          🌪️ Песчаная буря
                        </span>
                      )}
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

              {/* 2. Equipped Rod & Active Bait Selector Bar — Polished Egyptian Granite & Gold Inlay */}
              <div className="rounded-xl border-2 border-amber-500/50 bg-gradient-to-b from-[#23160b] via-[#160e07] to-[#0f0904] p-2.5 space-y-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(253,224,71,0.22)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-amber-400/75 bg-gradient-to-b from-amber-900/80 via-[#170f06] to-amber-950 text-base shadow-inner">
                      <ItemIcon
                        icon={equippedRod.icon}
                        alt={equippedRod.name}
                        className="text-base"
                        imgClassName="h-6 w-6 object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[10px] font-black text-amber-200">
                        {equippedRod.name} (Ур. {equippedRod.level})
                      </div>
                      <div className="text-[8.5px] text-amber-100/80 tabular-nums">
                        Редкие:{' '}
                        <span className="text-emerald-300 font-bold">
                          +
                          {equippedRod.rareFishChanceBonusPct +
                            currentLocation.rareBonusPct +
                            (activeBait?.rareChanceBonusPct || 0) +
                            (fishingState.equippedHook?.rareFishChanceBonusPct || 0) +
                            (activeWeatherInfo.weather.rareBonusPct || 0)}
                          %
                        </span>{' '}
                        · Леска: <span className="text-amber-300 font-bold">{equippedRod.lineStrength}</span>
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
                      className="rounded-lg border border-amber-400/60 bg-gradient-to-b from-amber-800/70 to-[#241507] px-2 py-1 text-[8.5px] font-black text-amber-100 hover:border-yellow-300 cursor-pointer whitespace-nowrap shadow-xs"
                    >
                      🪱 Наживки
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('shop');
                        setShopSubTab('lines');
                      }}
                      className="rounded-lg border border-amber-400/60 bg-gradient-to-b from-amber-800/70 to-[#241507] px-2 py-1 text-[8.5px] font-black text-amber-100 hover:border-yellow-300 cursor-pointer whitespace-nowrap shadow-xs"
                    >
                      🧵 Снасти
                    </button>
                  </div>
                </div>

                {/* 2.1. Rod Experience Progress Bar — Golden Papyrus Meter (GPU scaleX) */}
                {(() => {
                  const curRodExp = fishingState.rodExp || 0;
                  const reqRodExp = getRodExpRequiredForNextLevel(equippedRod.level);
                  const isMaxLvl = equippedRod.level >= 5;
                  const rodExpPct = isMaxLvl
                    ? 100
                    : Math.min(100, Math.round((curRodExp / Math.max(1, reqRodExp)) * 100));

                  return (
                    <div className="rounded-lg border border-amber-500/40 bg-[#120b05] p-1.5 space-y-1 shadow-inner">
                      <div className="flex items-center justify-between text-[8px] font-black tabular-nums">
                        <span className="text-amber-300 flex items-center gap-1">
                          <span>⚡ Мастерство удилища:</span>
                          <span className="text-amber-100">
                            {isMaxLvl ? 'МАКС. УРОВЕНЬ' : `${curRodExp} / ${reqRodExp} EXP`}
                          </span>
                        </span>
                        <span className={isMaxLvl ? 'text-yellow-300' : 'text-emerald-300'}>
                          {isMaxLvl ? '★ УР. 5' : `${rodExpPct}%`}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black border border-amber-700/50">
                        <div
                          className="h-full w-full origin-left will-change-transform bg-gradient-to-r from-amber-600 via-yellow-400 to-emerald-400 transition-transform duration-300"
                          style={{ transform: `scaleX(${(rodExpPct / 100).toFixed(3)})` }}
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
                        ? 'border-amber-400/85 bg-gradient-to-br from-[#2e1a09] via-[#1c1007] to-[#0f0803] shadow-[0_3px_12px_rgba(217,119,6,0.3)] hover:border-yellow-300'
                        : 'border-dashed border-amber-600/45 bg-gradient-to-br from-[#1c120a] to-[#0a0502] hover:border-amber-400'
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
                          <div className="flex items-center justify-between text-[7px] text-amber-100/80 font-bold tabular-nums">
                            <span>Прочность:</span>
                            <span className="text-amber-300">
                              {fishingState.equippedLine.durability}/
                              {fishingState.equippedLine.maxDurability}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-950 border border-amber-500/40">
                            <div
                              className="h-full w-full origin-left will-change-transform bg-gradient-to-r from-amber-500 to-yellow-300 transition-transform duration-200"
                              style={{
                                transform: `scaleX(${Math.min(
                                  1,
                                  Math.max(
                                    0,
                                    fishingState.equippedLine.durability /
                                      Math.max(1, fishingState.equippedLine.maxDurability)
                                  )
                                ).toFixed(3)})`
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
                        ? 'border-amber-400/85 bg-gradient-to-br from-[#2e1a09] via-[#1c1007] to-[#0f0803] shadow-[0_3px_12px_rgba(217,119,6,0.3)] hover:border-yellow-300'
                        : 'border-dashed border-amber-600/45 bg-gradient-to-br from-[#1c120a] to-[#0a0502] hover:border-amber-400'
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
                          <div className="flex items-center justify-between text-[7px] text-amber-100/80 font-bold tabular-nums">
                            <span>Прочность:</span>
                            <span className="text-amber-300">
                              {fishingState.equippedHook.durability}/
                              {fishingState.equippedHook.maxDurability}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-950 border border-amber-500/40">
                            <div
                              className="h-full w-full origin-left will-change-transform bg-gradient-to-r from-amber-500 to-yellow-300 transition-transform duration-200"
                              style={{
                                transform: `scaleX(${Math.min(
                                  1,
                                  Math.max(
                                    0,
                                    fishingState.equippedHook.durability /
                                      Math.max(1, fishingState.equippedHook.maxDurability)
                                  )
                                ).toFixed(3)})`
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

                {/* Quick Bait Selector Buttons — Carved Papyrus Tablets */}
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                  <button
                    type="button"
                    onClick={() => handleSelectBait(null)}
                    className={`shrink-0 rounded-md border px-2 py-0.5 text-[8.5px] font-bold cursor-pointer ${
                      !activeBait
                        ? 'border-amber-400 bg-amber-950/90 text-amber-200 shadow-xs'
                        : 'border-amber-900/40 bg-[#120b05] text-amber-200/60'
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
                            ? 'border-amber-300 bg-gradient-to-b from-amber-700 to-amber-950 text-amber-100 shadow-xs'
                            : count > 0
                            ? 'border-amber-800/50 bg-[#160e07] text-amber-100/90 hover:border-amber-400/60'
                            : 'border-stone-800/70 bg-[#0d0804]/50 text-stone-500 opacity-55 cursor-not-allowed'
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
              <div className="rounded-xl border-2 border-amber-500/50 bg-gradient-to-b from-[#1f140a] via-[#121622] to-[#0b0e17] p-2.5 space-y-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(253,224,71,0.2)]">
                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
                  <span className="flex items-center gap-1 text-amber-200">
                    <span>🌊</span>
                    <span>Карта глубин Нила и зоны заброса</span>
                  </span>
                  <span className="text-amber-300 text-[8px] tabular-nums">
                    Глубина: {activeDepthZoneObj.depthMeters}
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
                            ? 'border-2 border-amber-300 bg-gradient-to-b from-amber-800/80 via-[#241608] to-[#120b04] text-white shadow-[0_0_14px_rgba(251,191,36,0.4)]'
                            : 'border-amber-900/45 bg-[#120d08]/90 text-amber-100/80 hover:border-amber-400/60'
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

              {/* 3. Cinematic Nile River Viewport + Time-of-Day Switcher + Sandstorm VFX + Docked Nilometer Tension Gauge */}
              <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/85 bg-[#090d16] shadow-[0_0_28px_rgba(245,158,11,0.28),inset_0_0_18px_rgba(0,0,0,0.85)]">
                {/* Read-Only Atmospheric Status Bar synchronized with character system time */}
                <div className="flex flex-wrap items-center justify-between gap-1 border-b border-amber-500/40 bg-gradient-to-r from-[#1f1308] via-[#140d06] to-[#1f1308] px-2.5 py-1 text-[8px]">
                  <span className="font-black uppercase tracking-wider text-amber-200 flex items-center gap-1.5">
                    <span>
                      {isSandstormActive
                        ? '🌪️ Песчаная буря Нила (Видимость снижена)'
                        : activeTimeOfDay === 'morning'
                        ? `🌅 ${dynamicSkyProfile.phaseLabel}`
                        : activeTimeOfDay === 'day'
                        ? `☀️ ${dynamicSkyProfile.phaseLabel}`
                        : activeTimeOfDay === 'sunset'
                        ? `🌇 ${dynamicSkyProfile.phaseLabel}`
                        : `🌙 ${dynamicSkyProfile.phaseLabel}`}
                    </span>
                    <span className="rounded border border-amber-400/40 bg-black/50 px-1.5 py-0.2 text-[7.5px] font-bold text-amber-300">
                      ⏱️ {characterSystemTimeLabel}
                    </span>
                  </span>
                  <span className="text-[7.5px] font-bold text-amber-300/80">
                    {activeWeatherInfo.weather.icon} {activeWeatherInfo.weather.name}
                  </span>
                </div>

                {/* Unobstructed Water & Tackle Canvas Area (No Bottom Overlays Blocking Rod/Line/Bobber) */}
                <div className="relative overflow-hidden">
                  {/* Dynamic Sunrise/Sunset Sky Glow Overlay synchronized with Character System Time */}
                  <div
                    className={`pointer-events-none absolute top-0 left-0 right-0 z-12 h-[72px] transition-all duration-1000 ${dynamicSkyProfile.cssTopBannerClass}`}
                    aria-hidden="true"
                  />
                  {/* Procedural Lightweight CSS/SVG Water Wave Layers (GPU transform only, zero lag) */}
                  <svg
                    viewBox="0 0 400 70"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute bottom-0 left-0 h-[126px] w-[112%] -left-[6%] opacity-35 will-change-transform animate-[pulse_4s_ease-in-out_infinite]"
                  >
                    <path
                      d="M0,18 Q50,6 100,18 T200,18 T300,18 T400,18 L400,70 L0,70 Z"
                      fill="rgba(56, 189, 248, 0.14)"
                    />
                    <path
                      d="M0,34 Q65,22 130,34 T260,34 T390,34 L400,70 L0,70 Z"
                      fill="rgba(251, 191, 36, 0.11)"
                    />
                  </svg>

                  <canvas
                    ref={canvasRef}
                    width={390}
                    height={225}
                    className="relative z-10 block h-[225px] w-full select-none pointer-events-none"
                  />

                  {/* Subtle Atmospheric Sandstorm Haze Veil (Reduces background visibility slightly while keeping glowing bobber & line sharp) */}
                  {isSandstormActive && (
                    <div
                      className="pointer-events-none absolute inset-0 z-15 bg-gradient-to-br from-amber-500/18 via-orange-700/12 to-yellow-900/20 mix-blend-screen"
                      aria-hidden="true"
                    />
                  )}

                  {/* Top Overlay Status Banner — Compact Carved Papyrus Plaque at Very Top */}
                  <div className="pointer-events-none absolute top-1.5 left-2 right-2 z-20 flex items-center justify-between gap-1.5">
                    <div
                      className={`w-full rounded-lg border px-2.5 py-1 text-[9px] font-bold shadow-md ${
                        phase === 'escaped'
                          ? 'border-rose-400/90 bg-rose-950/90 text-rose-100'
                          : phase === 'reeling' && isFishThrashing
                          ? 'border-red-400 bg-red-950/90 text-red-100 animate-pulse'
                          : phase === 'bite'
                          ? 'border-amber-300 bg-amber-950/90 text-amber-100 animate-pulse'
                          : 'border-amber-400/55 bg-[#140d06]/80 text-amber-100'
                      }`}
                    >
                      {statusBanner}
                    </div>
                  </div>

                  {/* Catch Extraction Water Splash & Golden Radiance VFX Overlay */}
                  {catchSplashVfx && catchSplashVfx.active && (
                    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden animate-fade-in">
                      <div
                        className={`absolute inset-0 ${
                          catchSplashVfx.isGolden
                            ? 'bg-[radial-gradient(circle_at_center,rgba(253,224,71,0.52)_0%,rgba(245,158,11,0.26)_45%,transparent_75%)]'
                            : 'bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.38)_0%,rgba(253,224,71,0.18)_45%,transparent_72%)]'
                        } animate-pulse`}
                      />
                      <div
                        className={`relative rounded-2xl border-2 px-4 py-2 text-center shadow-[0_0_35px_rgba(251,191,36,0.85)] ${
                          catchSplashVfx.isGolden
                            ? 'border-yellow-200 bg-gradient-to-b from-amber-600/95 via-[#2e1805]/95 to-[#140a02]/95 text-yellow-100'
                            : 'border-amber-300 bg-gradient-to-b from-[#2b1a09]/95 to-[#120b04]/95 text-amber-100'
                        }`}
                      >
                        <div className="text-[11px] font-black uppercase tracking-wider drop-shadow">
                          💦 {catchSplashVfx.title} ✨
                        </div>
                        <div className="text-[9.5px] font-extrabold text-amber-200 mt-0.5">
                          {catchSplashVfx.subtitle}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Docked Instrument Panel BELOW Canvas (Never blocks Rod, Line, or Bobber; GPU scaleX transforms) */}
                {((phase === 'waiting' || phase === 'nibble') && waitTimeTotalMs > 0) ||
                phase === 'bite' ||
                phase === 'reeling' ? (
                  <div className="border-t-2 border-amber-500/60 bg-gradient-to-b from-[#1e1207] via-[#140c05] to-[#0c0703] px-2.5 py-2">
                    {/* 1) Bite Waiting Timer (GPU scaleX) */}
                    {(phase === 'waiting' || phase === 'nibble') && waitTimeTotalMs > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-[9px] font-black text-amber-100 mb-1 tabular-nums">
                          <span>
                            {phase === 'nibble'
                              ? '〰️ Рыба пробует наживку (поплавок и кончик удилища светятся)...'
                              : '⏳ Ожидание поклёвки... Следите за светящимся поплавком'}
                          </span>
                          <span ref={waitTimerTextDomRef} className="text-amber-300">
                            {(waitTimeLeftMs / 1000).toFixed(1)} сек
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-black border border-amber-500/45">
                          <div
                            ref={waitBarFillDomRef}
                            className="h-full w-full origin-left will-change-transform bg-gradient-to-r from-amber-600 via-yellow-400 to-emerald-400"
                            style={{
                              transform: `scaleX(${Math.min(
                                1,
                                Math.max(
                                  0,
                                  (waitTimeTotalMs - waitTimeLeftMs) / Math.max(1, waitTimeTotalMs)
                                )
                              ).toFixed(3)})`
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* 2) Bite Reaction Window Bar (GPU scaleX) */}
                    {phase === 'bite' && (
                      <div>
                        <div className="flex items-center justify-between text-[9.5px] font-black text-yellow-200 mb-1 tabular-nums">
                          <span>⚡ ПОПЛАВОК НЫРНУЛ! ЖМИТЕ «ПОДСЕЧЬ» СПРАВА!</span>
                          <span ref={biteTimerTextDomRef}>
                            {(biteTimeLeftMs / 1000).toFixed(1)} сек
                          </span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-black border border-amber-400/60">
                          <div
                            ref={biteBarFillDomRef}
                            className="h-full w-full origin-left will-change-transform bg-gradient-to-r from-red-500 via-amber-400 to-yellow-200"
                            style={{
                              transform: `scaleX(${Math.min(
                                1,
                                Math.max(0, biteTimeLeftMs / 3000)
                              ).toFixed(3)})`
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* 3) Real-Time Reeling Distance & Ancient Egyptian Nilometer Line Tension Gauge (GPU scaleX) */}
                    {phase === 'reeling' && (
                      <div className="space-y-1.5">
                        {/* Bar 1: Fish Distance / Reel Progress with Fish Runner */}
                        <div>
                          <div className="flex items-center justify-between text-[8.5px] font-black tabular-nums mb-0.5">
                            <span className="text-amber-200">
                              🐟 ПОДТЯГИВАНИЕ УЛОВА К БЕРЕГУ (100% = В САДОК)
                            </span>
                            <span ref={reelPctTextDomRef} className="text-yellow-300">
                              {reelProgress}%
                            </span>
                          </div>
                          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[#090603] border border-amber-500/55 shadow-inner">
                            <div
                              ref={reelBarFillDomRef}
                              className="h-full w-full origin-left will-change-transform bg-gradient-to-r from-amber-600 via-yellow-400 to-emerald-400"
                              style={{
                                transform: `scaleX(${Math.min(
                                  1,
                                  Math.max(0, reelProgress / 100)
                                ).toFixed(3)})`
                              }}
                            />
                            <div
                              ref={reelFishTrackDomRef}
                              className="pointer-events-none absolute inset-0 will-change-transform"
                              style={{
                                transform: `translate3d(${Math.min(
                                  95,
                                  Math.max(3, reelProgress)
                                ).toFixed(1)}%, 0, 0)`
                              }}
                            >
                              <span className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 text-[9px] leading-none drop-shadow">
                                🐟
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Bar 2: Egyptian Golden Nilometer Line Tension Gauge */}
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
                                : '💦 РЫБА ПРИТИХЛА — КРУТИТЕ КАТУШКУ В ЗОЛОТОЙ ЗОНЕ!'}
                            </span>
                            <span
                              ref={tensionPctTextDomRef}
                              className={
                                lineTension >= 78
                                  ? 'text-red-400 font-black'
                                  : 'text-yellow-300 font-black'
                              }
                            >
                              {lineTension}%
                            </span>
                          </div>
                          <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-[#090502] border-2 border-amber-500/70 shadow-inner">
                            {/* Optimal Sacred Emerald/Gold Zone (25% - 75%) */}
                            <div
                              className="absolute inset-y-0 bg-emerald-500/25 border-x-2 border-amber-300/80"
                              style={{ left: '25%', width: '50%' }}
                            />
                            {/* Danger Ruby Overload Zone (78% - 100%) */}
                            <div
                              className="absolute inset-y-0 bg-red-600/30 border-l-2 border-red-400/80"
                              style={{ left: '78%', width: '22%' }}
                            />
                            {/* Active Tension Fill (GPU scaleX) */}
                            <div
                              ref={tensionBarFillDomRef}
                              className={`h-full w-full origin-left will-change-transform ${
                                lineTension >= 78
                                  ? 'bg-gradient-to-r from-amber-500 via-orange-600 to-red-600'
                                  : lineTension >= 55
                                  ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-yellow-300'
                                  : 'bg-gradient-to-r from-amber-700 via-amber-500 to-emerald-400'
                              }`}
                              style={{
                                transform: `scaleX(${Math.min(
                                  1,
                                  Math.max(0, lineTension / 100)
                                ).toFixed(3)})`
                              }}
                            />
                            {/* Golden Needle Pointer (GPU translate3d) */}
                            <div
                              ref={tensionMarkerTrackDomRef}
                              className="pointer-events-none absolute inset-0 will-change-transform"
                              style={{
                                transform: `translate3d(${Math.min(
                                  99,
                                  Math.max(1, lineTension)
                                ).toFixed(1)}%, 0, 0)`
                              }}
                            >
                              <div className="absolute top-0 bottom-0 left-0 w-1.5 -translate-x-1/2 bg-yellow-100 border-x border-amber-600 shadow-[0_0_8px_#fde047]" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* 4. Physically Separated Dual-Zone Fishing Controls — Sculpted Pharaoh Gold & Stone Tablets */}
              <div className="grid grid-cols-12 gap-2 items-stretch">
                {/* LEFT ZONE (5 cols): Cast Rod / Sell Keepnet / Cast Status ONLY */}
                <div className="col-span-5 flex">
                  {phase === 'idle' || phase === 'caught' || phase === 'escaped' ? (
                    isKeepnetFull ? (
                      <button
                        type="button"
                        onClick={handleSellKeepnetCatch}
                        className="w-full rounded-xl border-2 border-yellow-200 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 px-2 py-2.5 text-[10.5px] font-black uppercase tracking-wide text-slate-950 shadow-[0_4px_16px_rgba(245,158,11,0.5),inset_0_1px_0_#fff] hover:brightness-110 active:scale-[0.98] cursor-pointer"
                      >
                        🪣 Продать улов (+{keepnetTotals.gold}🪙)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartCast}
                        disabled={hero.energy < (fishingConfig.energyPerCast || 2)}
                        className="w-full rounded-xl border-2 border-amber-300 bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-700 px-2.5 py-2.5 text-[11px] font-black uppercase tracking-wide text-slate-950 shadow-[0_4px_18px_rgba(245,158,11,0.45),inset_0_1px_0_rgba(255,255,255,0.65)] hover:brightness-110 active:scale-[0.98] disabled:opacity-45 cursor-pointer"
                      >
                        🎣 Забросить (-{fishingConfig.energyPerCast || 2} ⚡)
                      </button>
                    )
                  ) : (
                    <div className="w-full flex flex-col items-center justify-center rounded-xl border-2 border-amber-600/45 bg-gradient-to-b from-[#21150a] to-[#110a04] px-2 py-2 text-center select-none shadow-inner">
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-300">
                        {phase === 'casting'
                          ? '🎣 Заброс снасти...'
                          : phase === 'reeling'
                          ? '🐟 Вываживание'
                          : '🌊 Снасть в водах Нила'}
                      </span>
                      <span className="text-[8px] text-amber-200/60 mt-0.5">
                        Защита от случайного перезаброса
                      </span>
                    </div>
                  )}
                </div>

                {/* RIGHT ZONE (7 cols): Hook Bite / Interactive Reel Tension Controls ONLY */}
                <div className="col-span-7 flex">
                  {phase === 'idle' || phase === 'caught' || phase === 'escaped' || phase === 'casting' ? (
                    <div className="w-full flex items-center justify-center rounded-xl border-2 border-amber-800/40 bg-gradient-to-b from-[#1a1108] to-[#0f0904] px-3 py-2.5 text-center text-[9.5px] font-bold text-amber-200/60 select-none shadow-inner">
                      {phase === 'casting'
                        ? 'Поплавок летит в воды Нила...'
                        : 'Нажмите «Забросить» на золотой плите слева'}
                    </div>
                  ) : phase === 'waiting' || phase === 'nibble' ? (
                    <div className="w-full flex items-center justify-between gap-2 rounded-xl border-2 border-amber-500/50 bg-gradient-to-b from-[#23160a] to-[#120b05] px-3 py-2 select-none shadow-inner">
                      <div className="text-left">
                        <div className="text-[9.5px] font-black uppercase text-amber-200">
                          {phase === 'nibble' ? '〰️ Поплавок дрожит...' : '⏳ Ждите поклёвки...'}
                        </div>
                        <div className="text-[8px] text-amber-100/70">
                          Кнопка подсечки вспыхнет при клёве
                        </div>
                      </div>
                      <span
                        ref={waitRightTimerDomRef}
                        className="rounded-lg border border-amber-500/50 bg-[#0d0804] px-2 py-1 text-[9px] font-black text-amber-300 tabular-nums"
                      >
                        {(waitTimeLeftMs / 1000).toFixed(1)}с
                      </span>
                    </div>
                  ) : phase === 'bite' ? (
                    <button
                      type="button"
                      onClick={handleHookFish}
                      className="w-full animate-bounce rounded-xl border-2 border-yellow-200 bg-gradient-to-b from-yellow-300 via-amber-500 to-orange-600 px-3 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-[0_0_24px_rgba(251,191,36,0.75),inset_0_1px_0_#fff] active:scale-95 cursor-pointer"
                    >
                      <span ref={biteBtnTimerDomRef}>
                        ⚡ ПОДСЕЧЬ СЕЙЧАС! ({(biteTimeLeftMs / 1000).toFixed(1)}с)
                      </span>
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
                            ? 'border-amber-400 bg-gradient-to-b from-amber-800 via-[#2b1606] to-[#170b02] text-amber-100 shadow-inner'
                            : 'border-yellow-200 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 text-slate-950 shadow-[0_0_18px_rgba(245,158,11,0.55),inset_0_1px_0_#fff]'
                        }`}
                      >
                        {isHoldingReel ? '🔄 ПОДМОТКА КАТУШКИ...' : '🎣 КРУТИТЬ КАТУШКУ'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSlackLineImpulse}
                        className="flex-1 select-none rounded-xl border-2 border-amber-500/70 bg-gradient-to-b from-[#291a0b] to-[#130b04] px-1.5 py-2.5 text-[9.5px] font-black uppercase text-amber-200 hover:border-amber-300 active:scale-95 cursor-pointer shadow-md"
                      >
                        ✋ Стравить
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Escaped Fish Alert Card */}
              {phase === 'escaped' && escapeReason && (
                <div className="rounded-xl border-2 border-rose-500/80 bg-gradient-to-b from-rose-950/80 to-[#1a0609] p-2.5 text-[10.5px] font-bold text-rose-100 flex items-center gap-2.5 shadow-lg">
                  <span className="text-2xl">💨</span>
                  <div>
                    <div className="font-black uppercase text-rose-300">Рыба сорвалась!</div>
                    <div className="text-[9.5px] text-rose-100/90 mt-0.5">{escapeReason}</div>
                  </div>
                </div>
              )}

              {/* Last Caught Result Showcase Card — Golden Pharaoh Tablet with Glow */}
              {lastOutcome && phase === 'caught' && (
                <div className="rounded-xl border-2 border-amber-300 bg-gradient-to-b from-[#2b1a09] via-[#170e05] to-[#0e0803] p-2.5 shadow-[0_0_24px_rgba(251,191,36,0.35),inset_0_1px_0_rgba(254,240,138,0.4)]">
                  {lastOutcome.type === 'fish' ? (
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-14 w-18 shrink-0 items-center justify-center rounded-xl border-2 border-amber-400/70 bg-[#0d0804] p-1 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
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
                        <div className="truncate text-xs font-black text-amber-100 mt-0.5">
                          {lastOutcome.fish.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-extrabold tabular-nums">
                          <span className="text-sky-200">⚖️ {lastOutcome.weightKg} кг</span>
                          <span className="text-amber-200">🪣 В садок ({keepnetFishList.length}/{keepnetCapacity})</span>
                          <span className="text-yellow-300">Оценка: +{lastOutcome.goldEarned} 🪙</span>
                          {lastOutcome.crystalsEarned > 0 && (
                            <span className="text-cyan-300">+{lastOutcome.crystalsEarned} 💎</span>
                          )}
                          <span className="text-purple-300">+{lastOutcome.expEarned} ✨ EXP</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-amber-300 bg-amber-950/70 text-2xl shadow-[0_0_18px_rgba(251,191,36,0.5)]">
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
              <div className="rounded-xl border-2 border-amber-500/55 bg-gradient-to-b from-[#23160a] via-[#150e06] to-[#0d0804] p-2.5 space-y-2 shadow-[0_6px_16px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(253,224,71,0.2)]">
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
