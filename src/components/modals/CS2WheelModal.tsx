import React, { useState, useRef, useEffect } from 'react';
import { HeroState, GameItem, WheelWinnerEntry, ItemQualityKey, NpcTemplate, GameFeatureFlags } from '../../types/game';
import { playSpinTickSound, playLootSound, playLevelUpSound } from '../../utils/audio';
import { generateItem, getQualityConfig, getRouletteResetInfo } from '../../utils/gameData';
import {
  RoulettePrizeConfig,
  DEFAULT_ROULETTE_PRIZES,
  getRoulettePrizes,
  syncRoulettePrizesFromSupabase
} from '../../utils/rouletteConfig';
import { CharacterSkinTemplate, getShopSkins, getGameFeatureFlags } from '../../utils/shopConfig';
import { getNpcTemplates, DEFAULT_NPC_TEMPLATES } from '../../utils/npcCompanion';
import CharacterAvatar from '../CharacterAvatar';
import {
  AnubisDiceGameView,
  ClassicRouletteGameView,
  ScarabFightsTotalizatorView,
  ScarabTournamentGameView,
  GamblingTransactionPayload
} from './GamblingGamesSubViews';

const MAX_VIP_GOLD_SPINS_PER_DAY = 3;
const MAX_CRYSTAL_SPINS_PER_DAY = 3;

interface CS2WheelModalProps {
  currentUser?: string | null;
  hero: HeroState;
  shopSkins?: CharacterSkinTemplate[];
  wheelWinners?: WheelWinnerEntry[];
  wheelDisabled?: boolean;
  crystalSpinCost?: number;
  featureFlags?: GameFeatureFlags;
  onClose: () => void;
  onRewardReceived: (reward: {
    text: string;
    item?: GameItem;
    gold?: number;
    crystals?: number;
    skinId?: string;
    skinDurationDays?: number;
    skinTemplate?: CharacterSkinTemplate;
    npcTemplate?: NpcTemplate;
    winnerEntry?: WheelWinnerEntry;
  }) => void;
  onWinnerLogged?: (winner: WheelWinnerEntry) => void;
  onSpinStarted?: (mode: 'free' | 'crystals' | 'gold', timestamp: number, todayKey: string) => void;
  onSpinCompleted?: (timestamp: number, spinType: 'free' | 'crystals' | 'gold_vip' | string) => void;
  onDeductCrystals?: (amount: number) => void;
  onDeductGold?: (amount: number) => void;
  onInspectPlayer?: (nick: string) => void;
  onGamblingTransaction?: (tx: GamblingTransactionPayload) => void;
}

interface TapeItem {
  id: string;
  name: string;
  icon: string;
  type: 'item' | 'gold' | 'crystals' | 'jackpot' | 'skin' | 'npc';
  amount?: number;
  quality: ItemQualityKey;
  skinId?: string;
  skinDurationDays?: number;
  minLevel?: number;
}

const BASE_TAPE_POOL: TapeItem[] = [
  { id: 't_g1', name: '100 Золота', icon: '🪙', type: 'gold', amount: 100, quality: 'common' },
  { id: 't_g2', name: '250 Золота', icon: '💰', type: 'gold', amount: 250, quality: 'rare' },
  { id: 't_c1', name: '5 Кристаллов', icon: '💎', type: 'crystals', amount: 5, quality: 'rare' },
  { id: 't_c2', name: '20 Кристаллов', icon: '💎', type: 'crystals', amount: 20, quality: 'epic' },
  { id: 't_w1', name: 'Клинок Анубиса', icon: '⚔️', type: 'item', quality: 'rare' },
  { id: 't_a1', name: 'Доспех Фараона', icon: '🛡️', type: 'item', quality: 'epic' },
  { id: 't_r1', name: 'Кольцо Ра', icon: '💍', type: 'item', quality: 'legendary' },
  { id: 't_jp', name: '300 💎 ДЖЕКПОТ', icon: '👑', type: 'jackpot', amount: 300, quality: 'legendary' }
];

export const CS2WheelModal: React.FC<CS2WheelModalProps> = ({
  currentUser,
  hero,
  shopSkins,
  wheelWinners = [],
  wheelDisabled = false,
  crystalSpinCost,
  featureFlags,
  onClose,
  onRewardReceived,
  onWinnerLogged,
  onSpinStarted,
  onSpinCompleted,
  onDeductCrystals,
  onDeductGold,
  onInspectPlayer,
  onGamblingTransaction
}) => {
  const flags = featureFlags || getGameFeatureFlags();
  const [activeGameTab, setActiveGameTab] = useState<'wheel' | 'dice' | 'roulette' | 'scarabs' | 'tournament'>('wheel');
  const [spinning, setSpinning] = useState(false);
  const spinningLockRef = useRef(false);
  const [prizesList, setPrizesList] = useState<RoulettePrizeConfig[]>(() => getRoulettePrizes());
  const [currentTime, setCurrentTime] = useState(Date.now());
  const tapeRef = useRef<HTMLDivElement>(null);
  const allSkins = shopSkins || getShopSkins();
  const allNpcTemplates = getNpcTemplates();
  const playerLvl = Math.max(1, Number(hero.level || (hero as any).lvl || 1));

  // Sync prizes from Supabase on mount
  useEffect(() => {
    syncRoulettePrizesFromSupabase().then((p) => {
      if (Array.isArray(p) && p.length > 0) {
        setPrizesList(p);
      }
    });
  }, []);

  function prizeToTapeItem(p: RoulettePrizeConfig, idx: number): TapeItem {
    if (p.type === 'npc') {
      const npcTpl =
        allNpcTemplates.find((t) => t.id === p.npcTemplateId) ||
        p.npcTemplate ||
        DEFAULT_NPC_TEMPLATES[0];
      return {
        id: `tape_${idx}_${p.id}_${Math.random()}`,
        name: npcTpl?.name || p.name || 'Страж NPC',
        icon: npcTpl?.icon || p.icon || '🤖',
        type: 'npc',
        quality: p.quality || 'legendary',
        minLevel: p.minLevel ?? 15
      };
    }
    if (p.type === 'skin') {
      const skin = allSkins.find((s) => s.id === p.skinId) || p.skinTemplate;
      return {
        id: `tape_${idx}_${p.id}_${Math.random()}`,
        name: skin?.name || p.name,
        icon: skin?.avatarUrl || skin?.icon || p.icon,
        type: 'skin',
        quality: skin?.quality || p.quality,
        skinId: skin?.id || p.skinId || `skin_rp_${p.id}`,
        skinDurationDays: 0,
        minLevel: p.minLevel ?? 1
      };
    }
    return {
      id: `tape_${idx}_${p.id}_${Math.random()}`,
      name: p.name,
      icon: p.icon,
      type: p.type === 'jackpot' ? 'jackpot' : p.type === 'crystals' ? 'crystals' : p.type === 'gold' ? 'gold' : 'item',
      amount: p.amount,
      quality: p.quality,
      minLevel: p.minLevel ?? 1
    };
  }

  function generateTape(pool: RoulettePrizeConfig[]): TapeItem[] {
    const list: TapeItem[] = [];
    const active = pool.filter((p) => p.enabled !== false);
    const usePool = active.length > 0 ? active : DEFAULT_ROULETTE_PRIZES;
    for (let i = 0; i < 45; i++) {
      const template = usePool[Math.floor(Math.random() * usePool.length)];
      list.push(prizeToTapeItem(template, i));
    }
    return list;
  }

  const [tapeItems, setTapeItems] = useState<TapeItem[]>(() => generateTape(getRoulettePrizes()));
  const [lastWon, setLastWon] = useState<string | null>(null);

  // Live timer tick for 24-hour countdown & VIP check
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isPremiumActive = Boolean(
    hero.isPremium && hero.premiumUntil && hero.premiumUntil > currentTime
  );

  const { lastReset0001, nextReset0001, todayKey } = getRouletteResetInfo(currentTime);

  const lastSpinTime = hero.lastWheelSpinTime || 0;
  const isSameSpinDay = hero.dailyWheelSpinsDate === todayKey;

  // Guaranteed daily free spin(s) for every player (at least 1 per day, resetting at 00:01)
  const maxFreeSpinsPerDay = Math.max(1, Number(flags.rouletteFreeSpinsPerDay ?? 1));
  const usedFreeSpinsToday = isSameSpinDay
    ? Math.max(hero.dailyFreeWheelSpins || 0, lastSpinTime >= lastReset0001 ? 1 : 0)
    : lastSpinTime >= lastReset0001
    ? 1
    : 0;
  const remainingFreeSpinsToday = Math.max(0, maxFreeSpinsPerDay - usedFreeSpinsToday);
  const isFreeSpinAvailable = remainingFreeSpinsToday > 0;
  const msUntilNextFree = Math.max(0, nextReset0001 - currentTime);

  // Configurable spin currencies, prices, and daily attempt limits
  const spinCurrencyMode: 'gold' | 'crystals' | 'both' = flags.rouletteSpinCurrency || 'both';
  const goldVipOnly = Boolean(flags.rouletteGoldVipOnly ?? false);
  const vipUnlimited = flags.rouletteVipUnlimitedSpins !== false;

  const allowCrystalSpins = spinCurrencyMode === 'crystals' || spinCurrencyMode === 'both';
  const allowGoldSpins =
    (spinCurrencyMode === 'gold' || spinCurrencyMode === 'both') &&
    (!goldVipOnly || isPremiumActive);

  const crystalCost = isPremiumActive
    ? Math.max(1, Number(flags.rouletteVipSpinCostCrystals ?? 30))
    : Math.max(1, Number(flags.rouletteSpinCostCrystals ?? crystalSpinCost ?? 50));

  const goldCost = isPremiumActive
    ? Math.max(1, Number(flags.rouletteVipSpinCostGold ?? flags.rouletteSpinCostGold ?? 1000))
    : Math.max(1, Number(flags.rouletteSpinCostGold ?? 1000));

  const maxGoldSpinsPerDay = Math.max(0, Number(flags.rouletteDailyGoldSpinsLimit ?? MAX_VIP_GOLD_SPINS_PER_DAY));
  const maxCrystalSpinsPerDay = Math.max(0, Number(flags.rouletteDailyCrystalSpinsLimit ?? MAX_CRYSTAL_SPINS_PER_DAY));

  const isGoldUnlimited = maxGoldSpinsPerDay === 0 || (isPremiumActive && vipUnlimited);
  const isCrystalUnlimited = maxCrystalSpinsPerDay === 0 || (isPremiumActive && vipUnlimited);

  const usedGoldSpinsToday = isSameSpinDay ? Math.max(0, hero.dailyGoldWheelSpins || 0) : 0;
  const usedCrystalSpinsToday = isSameSpinDay ? Math.max(0, hero.dailyCrystalWheelSpins || 0) : 0;

  const remainingGoldSpinsToday = isGoldUnlimited
    ? 999999
    : Math.max(0, maxGoldSpinsPerDay - usedGoldSpinsToday);
  const remainingCrystalSpinsToday = isCrystalUnlimited
    ? 999999
    : Math.max(0, maxCrystalSpinsPerDay - usedCrystalSpinsToday);

  const rouletteTitle = (flags.rouletteTitle || 'Древний Египетский Кейс').trim();

  const hoursLeft = Math.floor(msUntilNextFree / (1000 * 60 * 60));
  const minutesLeft = Math.floor((msUntilNextFree % (1000 * 60 * 60)) / (1000 * 60));
  const secondsLeft = Math.floor((msUntilNextFree % (1000 * 60)) / 1000);
  const countdownFormatted = `${String(hoursLeft).padStart(2, '0')}:${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;

  const pendingRewardRef = useRef<{
    reward: {
      text: string;
      item?: GameItem;
      gold?: number;
      crystals?: number;
      skinId?: string;
      skinDurationDays?: number;
      skinTemplate?: CharacterSkinTemplate;
      npcTemplate?: NpcTemplate;
      winnerEntry?: WheelWinnerEntry;
    };
    finishMode: string;
  } | null>(null);

  // If modal unmounts while spinning, ensure the already-determined reward is still delivered
  useEffect(() => {
    return () => {
      if (pendingRewardRef.current) {
        const pending = pendingRewardRef.current;
        pendingRewardRef.current = null;
        onRewardReceived(pending.reward);
        if (pending.reward.winnerEntry && onWinnerLogged) {
          onWinnerLogged(pending.reward.winnerEntry);
        }
        if (onSpinCompleted) {
          onSpinCompleted(Date.now(), pending.finishMode);
        }
      }
    };
  }, []);

  const handleSpin = (mode: 'free' | 'crystals' | 'gold') => {
    if (spinning || spinningLockRef.current || wheelDisabled) return;
    if (mode === 'free' && !isFreeSpinAvailable) return;

    if (mode === 'crystals') {
      if (!allowCrystalSpins) return;
      if (hero.crystals < crystalCost) return;
      if (!isCrystalUnlimited && remainingCrystalSpinsToday <= 0) return;
    }
    if (mode === 'gold') {
      if (!allowGoldSpins) return;
      if (hero.gold < goldCost) return;
      if (!isGoldUnlimited && remainingGoldSpinsToday <= 0) return;
    }

    spinningLockRef.current = true;
    setSpinning(true);
    setLastWon(null);

    const spinNow = Date.now();
    // Immediately deduct currency & persist daily spin usage
    if (mode === 'crystals') {
      if (onDeductCrystals) onDeductCrystals(crystalCost);
    } else if (mode === 'gold') {
      if (onDeductGold) onDeductGold(goldCost);
    }

    if (onSpinStarted) {
      onSpinStarted(mode, spinNow, todayKey);
    }

    const activePrizes = prizesList.filter((p) => p.enabled !== false);
    const pool = activePrizes.length > 0 ? activePrizes : DEFAULT_ROULETTE_PRIZES;

    // Filter eligible prizes by character's current level (e.g. NPC requires level 15 by default)
    const eligibleByLevel = pool.filter((p) => {
      const reqLvl = Math.max(1, Number(p.minLevel ?? (p.type === 'npc' ? 15 : 1)));
      return playerLvl >= reqLvl;
    });
    const rollPool = eligibleByLevel.length > 0 ? eligibleByLevel : pool;

    // Generate fresh tape with winner at index 35
    const newTape = generateTape(pool);

    // Determine winner based on odds (weights / dropChancePct) with boost for active Premium
    const mult = isPremiumActive ? 1.5 : 1.0;
    const weightedPool = rollPool.map((p: RoulettePrizeConfig) => {
      const isHigh =
        p.type === 'npc' ||
        p.type === 'skin' ||
        p.type === 'jackpot' ||
        p.quality === 'legendary' ||
        p.quality === 'epic';
      const baseWeight = Math.max(0.01, Number(p.weight ?? p.dropChancePct ?? 1));
      return {
        prize: p,
        weight: Math.max(0.01, baseWeight * (isHigh ? mult : 1.0))
      };
    });
    const totalWeight = weightedPool.reduce(
      (acc: number, it: { prize: RoulettePrizeConfig; weight: number }) => acc + it.weight,
      0
    );
    let rand = Math.random() * totalWeight;
    let chosen = weightedPool[0].prize;
    for (const item of weightedPool) {
      if (rand < item.weight) {
        chosen = item.prize;
        break;
      }
      rand -= item.weight;
    }

    const playerNick = currentUser || 'Игрок';
    const timeStr = new Date(spinNow).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    let preparedReward: {
      text: string;
      item?: GameItem;
      gold?: number;
      crystals?: number;
      skinId?: string;
      skinDurationDays?: number;
      skinTemplate?: CharacterSkinTemplate;
      npcTemplate?: NpcTemplate;
      winnerEntry: WheelWinnerEntry;
    };
    let winner: TapeItem = prizeToTapeItem(chosen, 35);
    let displayWonName = winner.name;

    if (chosen.type === 'npc') {
      const baseNpc =
        allNpcTemplates.find((t) => t.id === chosen.npcTemplateId) ||
        chosen.npcTemplate ||
        DEFAULT_NPC_TEMPLATES[0];
      const npcName = baseNpc?.name || chosen.name || 'Автономный Страж Пирамиды';
      const npcIcon = baseNpc?.icon || chosen.icon || '🤖';
      const npcQual = chosen.quality || 'legendary';
      const resolvedNpcTpl: NpcTemplate = baseNpc
        ? {
            ...baseNpc,
            name: npcName,
            icon: npcIcon,
            minLevel: Math.max(1, Number(chosen.minLevel ?? baseNpc.minLevel ?? 15))
          }
        : {
            ...DEFAULT_NPC_TEMPLATES[0],
            id: chosen.npcTemplateId || `npc_rp_${chosen.id}`,
            name: npcName,
            icon: npcIcon,
            minLevel: Math.max(1, Number(chosen.minLevel ?? 15)),
            enabled: true
          };

      const winnerEntry: WheelWinnerEntry = {
        id: `ww_${spinNow}_${Math.random().toString(36).slice(2, 6)}`,
        nick: playerNick,
        isPremium: isPremiumActive,
        prizeName: `🤖 Страж NPC «${npcName}» (НАВСЕГДА)`,
        prizeIcon: npcIcon,
        quality: npcQual,
        prizeQuality: npcQual,
        timestamp: spinNow,
        timeStr
      };
      displayWonName = `🤖 ${npcName} (НАВСЕГДА)`;
      winner = {
        id: `win_npc_${chosen.id}`,
        name: displayWonName,
        icon: npcIcon,
        type: 'npc',
        quality: npcQual,
        minLevel: resolvedNpcTpl.minLevel
      };
      preparedReward = {
        text: `🤖 ДЖЕКПОТ РУЛЕТКИ! Вы выиграли автономного Стража NPC «${npcName}» НАВСЕГДА!`,
        npcTemplate: resolvedNpcTpl,
        winnerEntry
      };
    } else if (chosen.type === 'skin') {
      const baseSkin = allSkins.find((s) => s.id === chosen.skinId) || chosen.skinTemplate;
      const resolvedSkinId = baseSkin?.id || chosen.skinId || `skin_rp_${chosen.id}`;
      const rawSkinName = String(baseSkin?.name || chosen.name || 'Эксклюзивный Облик')
        .replace(/^(🎭\s*)?(Скин\s*:?\s*)+/i, '')
        .replace(/\s*\(НАВСЕГДА\)\s*/i, '')
        .trim();
      const skinName = rawSkinName || 'Эксклюзивный Облик';
      const skinImg = baseSkin?.avatarUrl || baseSkin?.icon || chosen.icon || '🎭';
      const skinQual = baseSkin?.quality || chosen.quality || 'legendary';
      const permanentSkinTemplate: CharacterSkinTemplate = baseSkin
        ? {
            ...baseSkin,
            id: resolvedSkinId,
            name: skinName,
            icon: skinImg,
            avatarUrl: skinImg,
            quality: skinQual,
            isTemporary: false,
            durationDays: 0
          }
        : {
            id: resolvedSkinId,
            name: skinName,
            icon: skinImg,
            avatarUrl: skinImg,
            quality: skinQual,
            lvl: 1,
            priceGold: 0,
            priceCrystals: 50,
            currency: 'crystals',
            hpBonus: 50,
            dmgBonus: 15,
            strBonus: 2,
            agiBonus: 2,
            vitBonus: 2,
            dodgeBonus: 3,
            energyBonus: 20,
            goldBonusPct: 5,
            expBonusPct: 5,
            bagBonus: 10,
            isExclusive: true,
            isTemporary: false,
            durationDays: 0,
            enabled: true
          };

      const winnerEntry: WheelWinnerEntry = {
        id: `ww_${spinNow}_${Math.random().toString(36).slice(2, 6)}`,
        nick: playerNick,
        isPremium: isPremiumActive,
        prizeName: `🎭 Скин «${skinName}» (НАВСЕГДА)`,
        prizeIcon: skinImg,
        quality: skinQual,
        prizeQuality: skinQual,
        timestamp: spinNow,
        timeStr
      };
      displayWonName = `🎭 Скин «${skinName}» (НАВСЕГДА)`;
      winner = {
        id: `win_skin_${chosen.id}`,
        name: displayWonName,
        icon: skinImg,
        type: 'skin',
        quality: skinQual,
        skinId: resolvedSkinId,
        skinDurationDays: 0
      };
      preparedReward = {
        text: `🎭 ВЫ ВЫИГРАЛИ СКИН ПЕРСОНАЖА! Скин «${skinName}» навсегда добавлен в вашу коллекцию!`,
        skinId: resolvedSkinId,
        skinDurationDays: 0,
        skinTemplate: permanentSkinTemplate,
        winnerEntry
      };
    } else if (chosen.type === 'jackpot') {
      const amt = chosen.amount || 300;
      const winnerEntry: WheelWinnerEntry = {
        id: `ww_${spinNow}_${Math.random().toString(36).slice(2, 6)}`,
        nick: playerNick,
        isPremium: isPremiumActive,
        prizeName: chosen.name,
        prizeIcon: chosen.icon,
        quality: chosen.quality,
        prizeQuality: chosen.quality,
        timestamp: spinNow,
        timeStr
      };
      preparedReward = {
        text: `👑 ДЖЕКПОТ! Вы выиграли +${amt} 💎 кристаллов!`,
        crystals: amt,
        winnerEntry
      };
    } else if (chosen.type === 'crystals') {
      const amt = chosen.amount || 20;
      const winnerEntry: WheelWinnerEntry = {
        id: `ww_${spinNow}_${Math.random().toString(36).slice(2, 6)}`,
        nick: playerNick,
        isPremium: isPremiumActive,
        prizeName: chosen.name,
        prizeIcon: chosen.icon,
        quality: chosen.quality,
        prizeQuality: chosen.quality,
        timestamp: spinNow,
        timeStr
      };
      preparedReward = {
        text: `💎 Вы выиграли +${amt} кристаллов!`,
        crystals: amt,
        winnerEntry
      };
    } else if (chosen.type === 'gold') {
      const amt = chosen.amount || 250;
      const winnerEntry: WheelWinnerEntry = {
        id: `ww_${spinNow}_${Math.random().toString(36).slice(2, 6)}`,
        nick: playerNick,
        isPremium: isPremiumActive,
        prizeName: chosen.name,
        prizeIcon: chosen.icon,
        quality: chosen.quality,
        prizeQuality: chosen.quality,
        timestamp: spinNow,
        timeStr
      };
      preparedReward = {
        text: `🪙 Вы выиграли +${amt} золота!`,
        gold: amt,
        winnerEntry
      };
    } else {
      const dropItem = generateItem(hero.level, true);
      dropItem.quality = chosen.quality;
      displayWonName = `${dropItem.name} (${dropItem.lvl} ур.)`;
      winner = {
        id: `win_item_${chosen.id}`,
        name: dropItem.name,
        icon: dropItem.icon,
        type: 'item',
        quality: dropItem.quality
      };
      const winnerEntry: WheelWinnerEntry = {
        id: `ww_${spinNow}_${Math.random().toString(36).slice(2, 6)}`,
        nick: playerNick,
        isPremium: isPremiumActive,
        prizeName: displayWonName,
        prizeIcon: dropItem.icon,
        quality: dropItem.quality,
        prizeQuality: dropItem.quality,
        timestamp: spinNow,
        timeStr
      };
      preparedReward = {
        text: `🎁 Вы выиграли вещь: ${dropItem.icon} ${dropItem.name}!`,
        item: dropItem,
        winnerEntry
      };
    }

    const finishMode = mode === 'gold' ? 'gold_vip' : mode;
    pendingRewardRef.current = {
      reward: preparedReward,
      finishMode
    };

    const WIN_INDEX = 35;
    newTape[WIN_INDEX] = winner;
    setTapeItems(newTape);

    // Reset tape position
    if (tapeRef.current) {
      tapeRef.current.style.transition = 'none';
      tapeRef.current.style.transform = 'translateX(0px)';
    }

    // Audio tick interval
    let tickCount = 0;
    const tickInterval = setInterval(() => {
      tickCount++;
      playSpinTickSound();
      if (tickCount > 28) clearInterval(tickInterval);
    }, 110);

    // Animate tape
    setTimeout(() => {
      if (tapeRef.current) {
        const cardWidth = 76;
        const targetOffset = -(WIN_INDEX * cardWidth - 140 + (Math.random() * 30 - 15));
        tapeRef.current.style.transition = 'transform 3.8s cubic-bezier(0.12, 0.8, 0.15, 1)';
        tapeRef.current.style.transform = `translateX(${targetOffset}px)`;
      }
    }, 50);

    // Completion callback
    setTimeout(() => {
      clearInterval(tickInterval);
      spinningLockRef.current = false;
      setSpinning(false);

      if (!pendingRewardRef.current) return;
      const delivered = pendingRewardRef.current;
      pendingRewardRef.current = null;

      if (winner.type === 'jackpot') {
        playLevelUpSound();
      } else {
        playLootSound();
      }
      setLastWon(displayWonName);

      onRewardReceived(delivered.reward);
      if (onGamblingTransaction) {
        onGamblingTransaction({
          gameName: 'Колесо удачи',
          spentGold: mode === 'gold' ? goldCost : 0,
          wonGold: delivered.reward.gold || 0,
          spentCrystals: mode === 'crystals' ? crystalCost : 0,
          wonCrystals: delivered.reward.crystals || 0
        });
      }
      if (delivered.reward.winnerEntry && onWinnerLogged) {
        onWinnerLogged(delivered.reward.winnerEntry);
      }
      if (onSpinCompleted) {
        onSpinCompleted(Date.now(), delivered.finishMode);
      }
    }, 4000);
  };

  const defaultTransactionFallback = (tx: GamblingTransactionPayload) => {
    if (onGamblingTransaction) {
      onGamblingTransaction(tx);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-slate-950/95 p-3 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-black text-amber-400">
            🎰 Азартные игры Пирамиды
          </span>
          <span className="rounded bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
            🪙 {hero.gold.toLocaleString()} • 💎 {hero.crystals.toLocaleString()}
          </span>
        </div>
        <button
          onClick={() => {
            if (!spinning) onClose();
          }}
          disabled={spinning}
          className="text-base font-bold text-red-400 hover:text-red-300 disabled:opacity-40 cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Personal Gambling Stats Banner (visible in Gambling Hall & on Character Profiles) */}
      <div className="mt-2 rounded-xl border border-amber-500/35 bg-slate-900/90 px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[9.5px]">
        <div className="flex items-center gap-1.5 font-bold text-slate-300">
          <span>📊 Ваша статистика азартных игр (видна всем в профиле):</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-black">
          <span className="text-rose-300">
            Потрачено: {(hero.gamblingSpentGold || 0).toLocaleString()} 🪙 / {(hero.gamblingSpentCrystals || 0).toLocaleString()} 💎
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-300">
            Выиграно: {(hero.gamblingWonGold || 0).toLocaleString()} 🪙 / {(hero.gamblingWonCrystals || 0).toLocaleString()} 💎
          </span>
        </div>
      </div>

      {/* 5 Game Tabs Navigation */}
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-1.5 shrink-0">
        {[
          { id: 'wheel' as const, label: '🎡 Колесо удачи', sub: 'Призы и Джекпот' },
          { id: 'dice' as const, label: '🎲 Кости Анубиса', sub: 'Прогноз 2–12 (до x32)' },
          { id: 'roulette' as const, label: '🎯 Рулетка (1–36)', sub: 'Числа и цвет (до x36)' },
          { id: 'scarabs' as const, label: '🪲 Бои Скарабеев', sub: 'Тотализатор арен' },
          { id: 'tournament' as const, label: '🏆 Турнир скарабеев', sub: 'Свой боец и кубок' }
        ].map((t) => {
          const active = activeGameTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              disabled={spinning}
              onClick={() => setActiveGameTab(t.id)}
              className={`rounded-xl border px-2 py-1.5 text-left transition-all cursor-pointer ${
                active
                  ? 'border-amber-400 bg-gradient-to-r from-amber-500/25 to-purple-900/40 text-white shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="text-[10px] sm:text-[10.5px] font-black text-amber-300 leading-tight">{t.label}</div>
              <div className="text-[8px] text-slate-400 leading-tight mt-0.5">{t.sub}</div>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto pt-2.5 space-y-3">
        {activeGameTab === 'dice' && (
          <AnubisDiceGameView
            hero={hero}
            currentUser={currentUser}
            onGamblingTransaction={defaultTransactionFallback}
          />
        )}

        {activeGameTab === 'roulette' && (
          <ClassicRouletteGameView
            hero={hero}
            currentUser={currentUser}
            onGamblingTransaction={defaultTransactionFallback}
          />
        )}

        {activeGameTab === 'scarabs' && (
          <ScarabFightsTotalizatorView
            hero={hero}
            currentUser={currentUser}
            onGamblingTransaction={defaultTransactionFallback}
          />
        )}

        {activeGameTab === 'tournament' && (
          <ScarabTournamentGameView
            hero={hero}
            currentUser={currentUser}
            onGamblingTransaction={defaultTransactionFallback}
          />
        )}

        {activeGameTab === 'wheel' && (
          <>
        {/* Roulette Box */}
        <div className="relative rounded-xl border-2 border-amber-500/80 bg-slate-900 p-3 shadow-[0_0_25px_rgba(245,158,11,0.2)]">
          <div className="mb-2 text-center text-xs font-bold text-amber-300">
            {rouletteTitle}
          </div>

          {/* Center pointer */}
          <div className="relative overflow-hidden rounded-lg border border-slate-700 bg-slate-950 p-2">
            <div className="absolute top-0 bottom-0 left-1/2 z-20 w-0.5 -translate-x-1/2 bg-red-500 shadow-[0_0_10px_#ef4444]" />
            <div className="absolute -top-1 left-1/2 z-20 -translate-x-1/2 border-x-4 border-t-6 border-x-transparent border-t-red-500" />
            <div className="absolute -bottom-1 left-1/2 z-20 -translate-x-1/2 border-x-4 border-b-6 border-x-transparent border-b-red-500" />

            {/* Scrolling tape */}
            <div className="h-20 overflow-hidden">
              <div ref={tapeRef} className="flex gap-1.5 will-change-transform">
                {tapeItems.map((it) => {
                  const q = getQualityConfig(it.quality);
                  return (
                    <div
                      key={it.id}
                      className="flex h-20 w-[70px] shrink-0 flex-col items-center justify-center rounded border-b-4 bg-slate-800/90 p-1 shadow"
                      style={{ borderBottomColor: q.color }}
                    >
                      {it.type === 'skin' ? (
                        <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded bg-slate-950 p-0.5 border border-purple-400/50">
                          <CharacterAvatar avatar={it.icon} nick={it.name} size="xs" className="object-contain" />
                          {it.skinDurationDays && it.skinDurationDays > 0 ? (
                            <span className="absolute bottom-0 right-0 bg-amber-500 text-[6px] font-black text-slate-950 px-0.5 rounded-tl leading-none">
                              {it.skinDurationDays}д
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-2xl">{it.icon}</div>
                      )}
                      <div className="mt-1 line-clamp-1 text-center text-[8px] font-bold text-slate-200">
                        {it.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Status info */}
          <div className="mt-2.5 text-center space-y-1">
            {lastWon ? (
              <div className="text-xs font-bold text-emerald-400 animate-pulse">
                🎉 Выигрыш: {lastWon}!
              </div>
            ) : isFreeSpinAvailable ? (
              <div className="rounded bg-emerald-500/20 border border-emerald-500/40 p-1 text-[10px] font-bold text-emerald-300 animate-pulse">
                ✨ Доступно бесплатное вращение на сегодня ({remainingFreeSpinsToday} из {maxFreeSpinsPerDay})!
              </div>
            ) : (
              <div className="rounded bg-amber-500/10 border border-amber-500/30 p-1 text-[10px] text-slate-300">
                ⏳ Бесплатное вращение использовано ({usedFreeSpinsToday}/{maxFreeSpinsPerDay}). Сброс через:{' '}
                <span className="font-mono font-bold text-amber-400">{countdownFormatted}</span>
              </div>
            )}
            {isPremiumActive && (
              <div className="text-[9px] font-bold text-yellow-400">
                👑 VIP Активен: шанс призов х2{' '}
                {vipUnlimited ? '• Прокруты БЕЗ СУТОЧНЫХ ЛИМИТОВ ' : ''}• Цена:{' '}
                {allowCrystalSpins ? `${crystalCost} 💎` : ''}
                {allowCrystalSpins && allowGoldSpins ? ' / ' : ''}
                {allowGoldSpins ? `${goldCost} 🪙` : ''}
              </div>
            )}
          </div>

          {/* Spin buttons */}
          <div className="mt-2.5 space-y-2">
            {wheelDisabled ? (
              <div className="rounded-lg border-2 border-red-500/60 bg-red-950/50 p-4 text-center space-y-1">
                <div className="text-xl">⛔</div>
                <div className="text-xs font-bold text-red-300">Рулетка временно закрыта</div>
                <div className="text-[10px] text-slate-300">
                  В связи с глобальным обновлением игры рулетка временно недоступна.
                </div>
              </div>
            ) : (
              <>
                {/* 1. Guaranteed Daily Free Spin Button */}
                {isFreeSpinAvailable ? (
                  <button
                    type="button"
                    onClick={() => handleSpin('free')}
                    disabled={spinning}
                    className="w-full rounded-lg bg-gradient-to-r from-emerald-500 via-amber-400 to-yellow-500 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-[0_0_15px_rgba(234,179,8,0.7)] hover:brightness-110 active:scale-95 disabled:opacity-50 animate-pulse cursor-pointer"
                  >
                    {spinning
                      ? 'Крутим рулетку...'
                      : maxFreeSpinsPerDay > 1
                      ? `🎰 Крутить Бесплатно (Осталось: ${remainingFreeSpinsToday}/${maxFreeSpinsPerDay} на сегодня)`
                      : '🎰 Крутить Бесплатно (1 раз в сутки каждому)'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 py-1.5 text-[10px] font-bold text-slate-400 opacity-60 cursor-not-allowed"
                  >
                    ⏳ Бесплатно использовано ({usedFreeSpinsToday}/{maxFreeSpinsPerDay}) • Сброс через {countdownFormatted}
                  </button>
                )}

                {/* 2. Paid Spin for Crystals (if enabled in Admin: 'crystals' or 'both') */}
                {allowCrystalSpins && (
                  <button
                    type="button"
                    onClick={() => handleSpin('crystals')}
                    disabled={
                      spinning ||
                      hero.crystals < crystalCost ||
                      (!isCrystalUnlimited && remainingCrystalSpinsToday <= 0)
                    }
                    className="w-full rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 py-2 text-[10.5px] font-bold text-white shadow hover:from-sky-500 hover:to-indigo-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {spinning
                      ? 'Крутим рулетку...'
                      : !isCrystalUnlimited && remainingCrystalSpinsToday <= 0
                      ? `⛔ Лимит прокруток за кристаллы исчерпан (${maxCrystalSpinsPerDay}/${maxCrystalSpinsPerDay} в день)`
                      : isCrystalUnlimited
                      ? `💎 Крутить за ${crystalCost} 💎 (БЕЗ ЛИМИТОВ) [У вас: ${hero.crystals} 💎]`
                      : `💎 Крутить за ${crystalCost} 💎 (Попыток: ${remainingCrystalSpinsToday}/${maxCrystalSpinsPerDay} в день) [У вас: ${hero.crystals} 💎]`}
                  </button>
                )}

                {/* 3. Paid Spin for Gold (if enabled in Admin: 'gold' or 'both') */}
                {allowGoldSpins && (
                  <button
                    type="button"
                    onClick={() => handleSpin('gold')}
                    disabled={
                      spinning ||
                      hero.gold < goldCost ||
                      (!isGoldUnlimited && remainingGoldSpinsToday <= 0)
                    }
                    className="w-full rounded-lg border-2 border-yellow-300/80 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-600 py-2 text-[10.5px] font-black uppercase tracking-wider text-slate-950 shadow-[0_0_16px_rgba(250,204,21,0.45)] hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {spinning
                      ? 'Крутим рулетку...'
                      : !isGoldUnlimited && remainingGoldSpinsToday <= 0
                      ? `⛔ Лимит прокруток за золото исчерпан (${maxGoldSpinsPerDay}/${maxGoldSpinsPerDay} в день)`
                      : isGoldUnlimited
                      ? `🪙 Крутить за ${goldCost} 🪙 (БЕЗ ЛИМИТОВ) [У вас: ${hero.gold} 🪙]`
                      : `🪙 Крутить за ${goldCost} 🪙 (Попыток: ${remainingGoldSpinsToday}/${maxGoldSpinsPerDay} в день) [У вас: ${hero.gold} 🪙]`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* REAL-TIME VISUAL LOG OF LAST 10 WINS UNDER THE WHEEL */}
        <div className="rounded-xl border border-amber-500/40 bg-slate-900/90 p-2.5 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold text-amber-400">
                🏆 Последние 10 выигрышей в рулетке
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <span className="text-[8.5px] font-bold text-amber-300/90">
              Показано: {Math.min(10, wheelWinners.length)} из 10
            </span>
          </div>

          {wheelWinners.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 py-4 text-center text-[9.5px] text-slate-400">
              Пока никто не крутил колесо рулетки сегодня. Испытайте удачу первым!
            </div>
          ) : (
            <div className="space-y-1">
              {/* Table Header: Время | Имя игрока | Название приза */}
              <div className="grid grid-cols-12 items-center px-2 py-1 rounded bg-slate-950/80 border border-slate-800/80 text-[8.5px] font-black uppercase tracking-wider text-slate-400">
                <div className="col-span-2">🕒 Время</div>
                <div className="col-span-4">👤 Имя игрока</div>
                <div className="col-span-6 text-right">🎁 Название приза</div>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1 pr-0.5">
                {wheelWinners.slice(0, 10).map((win, idx) => {
                  const q = getQualityConfig(win.quality);
                  const rawIcon = String(win.prizeIcon || '🎁').trim();
                  const isImageIcon =
                    /^(https?:\/\/|\/|data:image\/)/i.test(rawIcon) ||
                    /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(rawIcon);
                  const safeTextIcon = !isImageIcon && rawIcon.length <= 10 ? rawIcon : '🎭';
                  const cleanPrizeName = String(win.prizeName || 'Ценный приз')
                    .replace(/https?:\/\/\S+/gi, '')
                    .replace(/data:image\/\S+/gi, '')
                    .replace(/\/assets\/\S+/gi, '')
                    .replace(/Скин\s+«\s*Скин:\s*/gi, 'Скин «')
                    .trim();
                  return (
                    <div
                      key={win.id || `${win.nick}_${win.timestamp}_${idx}`}
                      className="grid grid-cols-12 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/90 px-2 py-1.5 text-[9.5px] hover:border-amber-500/40 transition-colors"
                      style={{ borderLeftWidth: '3px', borderLeftColor: q.color }}
                    >
                      {/* Время */}
                      <div className="col-span-2 font-mono text-[8.5px] font-bold text-slate-400">
                        {win.timeStr || new Date(win.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>

                      {/* Имя игрока */}
                      <div className="col-span-4 min-w-0 flex items-center gap-1">
                        <span
                          onClick={() => onInspectPlayer && onInspectPlayer(win.nick)}
                          className={`font-extrabold truncate ${
                            onInspectPlayer ? 'cursor-pointer hover:underline' : ''
                          } ${win.isPremium ? 'text-yellow-300' : 'text-amber-300'}`}
                          title={win.nick}
                        >
                          {win.isPremium ? '👑 ' : ''}
                          {win.nick}
                        </span>
                      </div>

                      {/* Название приза */}
                      <div className="col-span-6 min-w-0 flex items-center justify-end gap-1.5 text-right">
                        {isImageIcon ? (
                          <div className="h-5 w-5 shrink-0 overflow-hidden rounded border border-amber-500/40 bg-slate-900">
                            <CharacterAvatar avatar={rawIcon} className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <span className="text-sm shrink-0 leading-none">{safeTextIcon}</span>
                        )}
                        <span
                          className="font-extrabold truncate text-[9.5px]"
                          style={{ color: q.color }}
                          title={cleanPrizeName}
                        >
                          {cleanPrizeName}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Possible drops legend */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-[10px] space-y-1">
          <div className="font-semibold text-amber-400">
            Возможные призы {isPremiumActive ? '(👑 Шансы х2 с VIP)' : ''}:
          </div>
          {(() => {
            const activePool = prizesList.filter((p) => p.enabled !== false);
            const totalW = activePool.reduce((sum, p) => sum + Math.max(0.01, Number(p.weight || 1)), 0);
            const npcPrizes = activePool.filter((p) => p.type === 'npc');
            return npcPrizes.map((np) => {
              const reqLvl = Math.max(1, Number(np.minLevel ?? 15));
              const pct =
                totalW > 0
                  ? ((Math.max(0.01, Number(np.weight || 1)) / totalW) * 100).toFixed(1)
                  : String(np.dropChancePct ?? 1);
              const unlockedForMe = playerLvl >= reqLvl;
              return (
                <div
                  key={np.id}
                  className="flex items-center justify-between rounded bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 text-emerald-300 font-bold"
                >
                  <span>
                    {np.icon || '🤖'} {np.name} (НАВСЕГДА){' '}
                    <span className={unlockedForMe ? 'text-emerald-400' : 'text-amber-300'}>
                      [с {reqLvl} ур.]
                    </span>
                  </span>
                  <span>{pct}%</span>
                </div>
              );
            });
          })()}
          <div className="flex justify-between text-yellow-300">
            <span>👑 300 💎 ДЖЕКПОТ / Легендарные кольца</span>
            <span>{isPremiumActive ? '5% (х2 VIP)' : '2.5%'}</span>
          </div>
          <div className="flex justify-between text-purple-300">
            <span>🛡️ Эпическая броня / 15-20 Кристаллов</span>
            <span>{isPremiumActive ? '24% (х2 VIP)' : '12%'}</span>
          </div>
          <div className="flex justify-between text-sky-300">
            <span>⚔️ Редкое оружие / 250 Золота</span>
            <span>25%</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>🪙 100-200 Золота / Обычные вещи</span>
            <span>{isPremiumActive ? '46%' : '60.5%'}</span>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
};


