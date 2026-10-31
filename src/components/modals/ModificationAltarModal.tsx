import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  HeroState,
  GameItem,
  EquippedGear,
  ShopItemTemplate,
  ItemSlot,
  GameFeatureFlags
} from '../../types/game';
import { SLOT_INFO, getQualityConfig } from '../../utils/gameData';
import {
  DEFAULT_ALTAR_CLASS_CHANCE_PER_RELIC,
  isRelicItem,
  isTransportItem
} from '../../utils/shopConfig';
import { ItemIcon } from '../ItemIcon';
import { GoldCoinIcon, CrystalIcon } from '../CurrencyIcon';
import {
  playCoinSound,
  playLevelUpSound,
  playAttackSound
} from '../../utils/audio';

export const MAX_MODIFICATION_CLASS = 10;
export const MODIFICATION_BONUS_PER_CLASS_PCT = 5; // +5% per class, up to +50% at Class 10
export const MAX_SACRIFICE_SLOTS = 50;

export function getItemModClass(item?: GameItem | null): number {
  if (!item) return 0;
  return Math.max(0, Math.min(MAX_MODIFICATION_CLASS, Math.floor(Number(item.modificationClass || 0))));
}

export function extractBaseStatsBeforeMod(
  item: GameItem,
  bonusPerClassPct: number = MODIFICATION_BONUS_PER_CLASS_PCT
): NonNullable<GameItem['baseStatsBeforeMod']> {
  if (item.baseStatsBeforeMod) {
    return { ...item.baseStatsBeforeMod };
  }
  const curClass = getItemModClass(item);
  const divisor = 1 + curClass * (Math.max(1, bonusPerClassPct) / 100);

  const unscale = (val?: number) => {
    const num = Math.max(0, Number(val || 0));
    if (num <= 0) return 0;
    if (curClass <= 0) return num;
    return Math.max(1, Math.round(num / divisor));
  };

  return {
    dmg: unscale(item.dmg ?? item.dmgBonus),
    hp: unscale(item.hp ?? item.hpBonus),
    dodgeBonus: unscale(item.dodgeBonus),
    energyBonus: unscale(item.energyBonus),
    goldBonusPct: unscale(item.goldBonusPct),
    expBonusPct: unscale(item.expBonusPct),
    str: unscale(item.str ?? item.strBonus),
    agi: unscale(item.agi ?? item.agiBonus),
    vit: unscale(item.vit ?? item.vitBonus)
  };
}

export function computeStatsForModificationClass(
  item: GameItem,
  targetClass: number,
  bonusPerClassPct: number = MODIFICATION_BONUS_PER_CLASS_PCT
): NonNullable<GameItem['baseStatsBeforeMod']> {
  const clampedClass = Math.max(0, Math.min(MAX_MODIFICATION_CLASS, Math.floor(targetClass)));
  const base = extractBaseStatsBeforeMod(item, bonusPerClassPct);
  if (clampedClass <= 0) {
    return { ...base };
  }
  const mult = 1 + clampedClass * (Math.max(1, bonusPerClassPct) / 100); // e.g. 1.05 .. 1.50

  const scaleStat = (baseVal?: number) => {
    const v = Math.max(0, Number(baseVal || 0));
    if (v <= 0) return 0;
    const scaled = Math.round(v * mult);
    return Math.max(v + clampedClass, scaled);
  };

  return {
    dmg: scaleStat(base.dmg),
    hp: scaleStat(base.hp),
    dodgeBonus: scaleStat(base.dodgeBonus),
    energyBonus: scaleStat(base.energyBonus),
    goldBonusPct: scaleStat(base.goldBonusPct),
    expBonusPct: scaleStat(base.expBonusPct),
    str: scaleStat(base.str),
    agi: scaleStat(base.agi),
    vit: scaleStat(base.vit)
  };
}

export function applyModificationClassToItem(
  item: GameItem,
  newClass: number,
  bonusPerClassPct: number = MODIFICATION_BONUS_PER_CLASS_PCT
): GameItem {
  const clampedClass = Math.max(0, Math.min(MAX_MODIFICATION_CLASS, Math.floor(newClass)));
  const baseStats = extractBaseStatsBeforeMod(item, bonusPerClassPct);
  const nextStats = computeStatsForModificationClass(
    { ...item, baseStatsBeforeMod: baseStats },
    clampedClass,
    bonusPerClassPct
  );

  return {
    ...item,
    modificationClass: clampedClass,
    baseStatsBeforeMod: baseStats,
    dmg: nextStats.dmg,
    hp: nextStats.hp,
    dodgeBonus: nextStats.dodgeBonus || 0,
    energyBonus: nextStats.energyBonus || 0,
    goldBonusPct: nextStats.goldBonusPct || 0,
    expBonusPct: nextStats.expBonusPct || 0,
    str: nextStats.str || 0,
    agi: nextStats.agi || 0,
    vit: nextStats.vit || 0,
    ...(item.dmgBonus !== undefined ? { dmgBonus: nextStats.dmg } : {}),
    ...(item.hpBonus !== undefined ? { hpBonus: nextStats.hp } : {}),
    ...(item.strBonus !== undefined ? { strBonus: nextStats.str || 0 } : {}),
    ...(item.agiBonus !== undefined ? { agiBonus: nextStats.agi || 0 } : {}),
    ...(item.vitBonus !== undefined ? { vitBonus: nextStats.vit || 0 } : {})
  };
}

/**
 * Checks whether an inventory item is a valid sacrificial Relic for the Modification Altar.
 * Regular equipment items can NO LONGER be used as sacrifice fodder — only Relics dropped in Pyramids!
 */
export function isShopMaterialEligible(
  item: GameItem,
  _shopCatalog: ShopItemTemplate[] = [],
  targetItemId?: string | null
): boolean {
  if (!item) return false;
  if (targetItemId && item.id === targetItemId) return false;
  if (item.rent || item.isClanRented || item.isElixirLot) return false;
  return isRelicItem(item);
}

/**
 * Calculates how much % success chance a single sacrificial Relic contributes
 * toward upgrading `targetItem` to `nextClass` (1..10), scaled for up to 50 Relics.
 */
export function calculateSingleSacrificeChanceContribution(
  targetItem: GameItem,
  sacrificeItem: GameItem,
  _shopCatalog: ShopItemTemplate[] = [],
  customClassChanceTable?: number[]
): number {
  const curClass = getItemModClass(targetItem);
  if (curClass >= MAX_MODIFICATION_CLASS) return 0;
  const nextClass = curClass + 1; // 1..10

  const table =
    Array.isArray(customClassChanceTable) && customClassChanceTable.length >= 10
      ? customClassChanceTable
      : DEFAULT_ALTAR_CLASS_CHANCE_PER_RELIC;

  // Base % per 1 standard relic for nextClass (index nextClass - 1)
  // Default table for 50-slot altar: [2.0, 1.8, 1.6, 1.4, 1.2, 1.0, 0.85, 0.7, 0.55, 0.4]
  const basePerRelic = Math.max(0.1, Number(table[nextClass - 1] ?? 1.0));

  // Relic power multiplier (1.0 for Tier 1 relic, 1.35 for Tier 2, 1.75 for Tier 3, 2.25 for Boss Relic)
  const relicPower = Math.max(0.5, Math.min(3.5, Number(sacrificeItem.relicPower || 1)));

  // Slight level scaling if target item is high level vs relic tier
  const targetLvl = Math.max(1, Number(targetItem.lvl || 1));
  const relicLvl = Math.max(1, Number(sacrificeItem.lvl || 1));
  const lvlFactor = Math.min(1.25, Math.max(0.75, 1 + (relicLvl - targetLvl) * 0.02));

  const rawContribution = basePerRelic * relicPower * lvlFactor;
  return Math.max(0.1, Number(rawContribution.toFixed(2)));
}

interface ModificationAltarModalProps {
  hero: HeroState;
  equipped: EquippedGear;
  inventory: GameItem[];
  shopItems?: ShopItemTemplate[];
  shopCatalog?: ShopItemTemplate[];
  featureFlags?: GameFeatureFlags;
  initialTargetItemId?: string | null;
  onClose: () => void;
  showToast?: (msg: string) => void;
  onExecuteModification: (payload: {
    targetItemId: string;
    isEquippedSlot?: ItemSlot | null;
    sacrificeItemIds: string[];
    chancePct: number;
    rolledPct: number;
    succeeded: boolean;
    newClass: number;
    updatedItem: GameItem;
  }) => void;
  onQuickBuyShopSacrifice?: (template: ShopItemTemplate) => GameItem | null;
}

export const ModificationAltarModal: React.FC<ModificationAltarModalProps> = ({
  hero,
  equipped,
  inventory,
  shopItems,
  shopCatalog,
  featureFlags,
  initialTargetItemId = null,
  onClose,
  onExecuteModification
}) => {
  const maxSacrificeSlots = Math.max(
    1,
    Math.min(100, Number(featureFlags?.altarMaxSacrificeItems ?? MAX_SACRIFICE_SLOTS))
  );
  const bonusPerClassPct = Math.max(
    1,
    Math.min(25, Number(featureFlags?.altarBonusPerClassPct ?? MODIFICATION_BONUS_PER_CLASS_PCT))
  );
  const customChanceTable = useMemo(() => {
    if (
      Array.isArray(featureFlags?.altarClassChancePerRelic) &&
      featureFlags!.altarClassChancePerRelic!.length >= 10
    ) {
      return featureFlags!.altarClassChancePerRelic!;
    }
    return DEFAULT_ALTAR_CLASS_CHANCE_PER_RELIC;
  }, [featureFlags?.altarClassChancePerRelic]);

  const resolvedShopItems = useMemo<ShopItemTemplate[]>(() => {
    if (Array.isArray(shopItems)) return shopItems;
    if (Array.isArray(shopCatalog)) return shopCatalog;
    return [];
  }, [shopItems, shopCatalog]);

  const safeInventory = useMemo<GameItem[]>(() => {
    return Array.isArray(inventory) ? inventory : [];
  }, [inventory]);

  // All player equipment items eligible to be placed on the Top Altar (equipped + inventory, excluding Relics & Transports)
  const allTargetCandidates = useMemo(() => {
    const list: { item: GameItem; isEquipped: boolean; equippedSlot?: ItemSlot }[] = [];
    const safeEq = equipped || ({} as EquippedGear);
    (Object.keys(safeEq) as ItemSlot[]).forEach((slot) => {
      const eqItem = safeEq[slot];
      if (eqItem && !eqItem.rent && !eqItem.isClanRented && !isRelicItem(eqItem) && !isTransportItem(eqItem)) {
        list.push({ item: eqItem, isEquipped: true, equippedSlot: slot });
      }
    });
    safeInventory.forEach((invItem) => {
      if (
        invItem &&
        !invItem.rent &&
        !invItem.isClanRented &&
        !invItem.isElixirLot &&
        !isRelicItem(invItem) &&
        !isTransportItem(invItem)
      ) {
        list.push({ item: invItem, isEquipped: false });
      }
    });
    return list;
  }, [equipped, safeInventory]);

  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(() => {
    if (initialTargetItemId && allTargetCandidates.some((c) => c.item.id === initialTargetItemId)) {
      return initialTargetItemId;
    }
    return allTargetCandidates[0]?.item.id || null;
  });

  const [sacrificeIds, setSacrificeIds] = useState<string[]>([]);
  const [pickerMode, setPickerMode] = useState<'none' | 'target' | 'sacrifice'>('none');

  // Wheel / Circular Gauge Spin State
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [wheelRotationDeg, setWheelRotationDeg] = useState<number>(0);
  const [lastResult, setLastResult] = useState<{
    succeeded: boolean;
    rolledPct: number;
    chancePct: number;
    prevClass: number;
    newClass: number;
    itemName: string;
    burnedCount: number;
  } | null>(null);

  const spinTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) {
        window.clearTimeout(spinTimeoutRef.current);
      }
    };
  }, []);

  // Selected Target Item in Top Slot («Алтарь»)
  const selectedTargetEntry = useMemo(() => {
    if (!selectedTargetId) return null;
    return allTargetCandidates.find((c) => c.item.id === selectedTargetId) || null;
  }, [allTargetCandidates, selectedTargetId]);

  const targetItem = selectedTargetEntry?.item || null;
  const currentModClass = getItemModClass(targetItem);
  const isMaxClass = currentModClass >= MAX_MODIFICATION_CLASS;
  const nextModClass = Math.min(MAX_MODIFICATION_CLASS, currentModClass + 1);

  // Eligible Sacrifice Relics from Inventory (ONLY Relics dropped in Pyramids)
  const eligibleSacrificeInventory = useMemo(() => {
    return safeInventory.filter((it) => isShopMaterialEligible(it, resolvedShopItems, selectedTargetId));
  }, [safeInventory, resolvedShopItems, selectedTargetId]);

  // Keep sacrificeIds valid if inventory or maxSacrificeSlots changes
  useEffect(() => {
    setSacrificeIds((prev) =>
      (Array.isArray(prev) ? prev : [])
        .filter(
          (id) =>
            id !== selectedTargetId &&
            eligibleSacrificeInventory.some((it) => it.id === id)
        )
        .slice(0, maxSacrificeSlots)
    );
  }, [selectedTargetId, eligibleSacrificeInventory, maxSacrificeSlots]);

  const selectedSacrificeItems = useMemo(() => {
    return (Array.isArray(sacrificeIds) ? sacrificeIds : [])
      .map((id) => eligibleSacrificeInventory.find((it) => it.id === id))
      .filter((it): it is GameItem => Boolean(it));
  }, [sacrificeIds, eligibleSacrificeInventory]);

  // Calculate Total Success Chance (0% .. 100%)
  const totalChancePct = useMemo(() => {
    if (!targetItem || isMaxClass || selectedSacrificeItems.length === 0) return 0;
    const sum = selectedSacrificeItems.reduce(
      (acc, sac) =>
        acc + calculateSingleSacrificeChanceContribution(targetItem, sac, resolvedShopItems, customChanceTable),
      0
    );
    return Math.max(0.5, Math.min(100, Number(sum.toFixed(1))));
  }, [targetItem, isMaxClass, selectedSacrificeItems, resolvedShopItems, customChanceTable]);

  // Current vs Next Class Stats Preview
  const statsPreview = useMemo(() => {
    if (!targetItem) return null;
    const curStats = computeStatsForModificationClass(targetItem, currentModClass, bonusPerClassPct);
    const nextStats = computeStatsForModificationClass(targetItem, nextModClass, bonusPerClassPct);
    const rows: { label: string; icon: string; cur: number; next: number; suffix?: string; color: string }[] = [];

    if (curStats.dmg > 0 || nextStats.dmg > 0) {
      rows.push({ label: 'Урон', icon: '⚔️', cur: curStats.dmg, next: nextStats.dmg, color: 'text-rose-300' });
    }
    if (curStats.hp > 0 || nextStats.hp > 0) {
      rows.push({ label: 'Здоровье', icon: '❤️', cur: curStats.hp, next: nextStats.hp, color: 'text-emerald-300' });
    }
    if ((curStats.dodgeBonus || 0) > 0 || (nextStats.dodgeBonus || 0) > 0) {
      rows.push({
        label: 'Уклонение',
        icon: '💨',
        cur: curStats.dodgeBonus || 0,
        next: nextStats.dodgeBonus || 0,
        suffix: '%',
        color: 'text-sky-300'
      });
    }
    if ((curStats.energyBonus || 0) > 0 || (nextStats.energyBonus || 0) > 0) {
      rows.push({
        label: 'Энергия',
        icon: '⚡',
        cur: curStats.energyBonus || 0,
        next: nextStats.energyBonus || 0,
        color: 'text-cyan-300'
      });
    }
    if ((curStats.goldBonusPct || 0) > 0 || (nextStats.goldBonusPct || 0) > 0) {
      rows.push({
        label: 'Золото',
        icon: '🪙',
        cur: curStats.goldBonusPct || 0,
        next: nextStats.goldBonusPct || 0,
        suffix: '%',
        color: 'text-amber-300'
      });
    }
    if ((curStats.expBonusPct || 0) > 0 || (nextStats.expBonusPct || 0) > 0) {
      rows.push({
        label: 'Опыт',
        icon: '✨',
        cur: curStats.expBonusPct || 0,
        next: nextStats.expBonusPct || 0,
        suffix: '%',
        color: 'text-purple-300'
      });
    }
    if ((curStats.str || 0) > 0 || (nextStats.str || 0) > 0) {
      rows.push({ label: 'Сила', icon: '💪', cur: curStats.str || 0, next: nextStats.str || 0, color: 'text-orange-300' });
    }
    if ((curStats.agi || 0) > 0 || (nextStats.agi || 0) > 0) {
      rows.push({ label: 'Ловкость', icon: '🏹', cur: curStats.agi || 0, next: nextStats.agi || 0, color: 'text-teal-300' });
    }
    if ((curStats.vit || 0) > 0 || (nextStats.vit || 0) > 0) {
      rows.push({ label: 'Живучесть', icon: '🛡️', cur: curStats.vit || 0, next: nextStats.vit || 0, color: 'text-pink-300' });
    }

    return rows;
  }, [targetItem, currentModClass, nextModClass, bonusPerClassPct]);

  const handleToggleSacrificeItem = (itemId: string) => {
    if (isSpinning) return;
    setLastResult(null);
    setSacrificeIds((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      }
      if (prev.length >= maxSacrificeSlots) {
        return prev;
      }
      return [...prev, itemId];
    });
  };

  const handleSetSacrificeCount = (desiredCount: number) => {
    if (isSpinning || !targetItem || isMaxClass) return;
    setLastResult(null);
    const clamped = Math.max(
      0,
      Math.min(maxSacrificeSlots, eligibleSacrificeInventory.length, Math.floor(desiredCount))
    );
    const sorted = [...eligibleSacrificeInventory].sort(
      (a, b) => Number(b.relicPower || 1) - Number(a.relicPower || 1)
    );
    setSacrificeIds(sorted.slice(0, clamped).map((it) => it.id));
  };

  const handleAddBatchRelics = (addCount: number) => {
    if (isSpinning || !targetItem || isMaxClass) return;
    setLastResult(null);
    setSacrificeIds((prev) => {
      const remaining = eligibleSacrificeInventory.filter((it) => !prev.includes(it.id));
      const canAdd = Math.max(0, Math.min(addCount, maxSacrificeSlots - prev.length, remaining.length));
      if (canAdd <= 0) return prev;
      return [...prev, ...remaining.slice(0, canAdd).map((it) => it.id)];
    });
  };

  const handleAutoFillSacrifice = () => {
    if (isSpinning || !targetItem || isMaxClass) return;
    setLastResult(null);
    const sorted = [...eligibleSacrificeInventory].sort(
      (a, b) => Number(b.relicPower || 1) - Number(a.relicPower || 1)
    );
    const picked: string[] = [];
    let runningChance = 0;
    for (const candidate of sorted) {
      if (picked.length >= maxSacrificeSlots) break;
      if (runningChance >= 100) break;
      picked.push(candidate.id);
      runningChance += calculateSingleSacrificeChanceContribution(
        targetItem,
        candidate,
        resolvedShopItems,
        customChanceTable
      );
    }
    setSacrificeIds(picked);
  };

  const handleStartModification = () => {
    if (
      isSpinning ||
      !targetItem ||
      isMaxClass ||
      selectedSacrificeItems.length === 0 ||
      totalChancePct <= 0
    ) {
      return;
    }

    setLastResult(null);
    setPickerMode('none');
    setIsSpinning(true);
    playCoinSound();

    const chance = totalChancePct;
    const rawRoll = Math.random() * 100;
    const succeeded = rawRoll < chance;
    const rolledPctDisplay = Math.min(100, Math.max(0.1, Number(rawRoll.toFixed(1))));

    const landingPointOnWheelDeg = succeeded
      ? Math.max(2, Math.min(chance * 3.6 - 2, (rawRoll / Math.max(0.5, chance)) * (chance * 3.6)))
      : Math.max(
          chance * 3.6 + 3,
          Math.min(357, chance * 3.6 + ((rawRoll - chance) / Math.max(0.5, 100 - chance)) * ((100 - chance) * 3.6))
        );

    const baseFullSpins = (Math.floor(wheelRotationDeg / 360) + 6) * 360;
    const nextWheelRotation = baseFullSpins + (360 - landingPointOnWheelDeg);
    setWheelRotationDeg(nextWheelRotation);

    const prevCls = currentModClass;
    const nextCls = succeeded ? Math.min(MAX_MODIFICATION_CLASS, prevCls + 1) : prevCls;
    const updatedTargetItem = succeeded
      ? applyModificationClassToItem(targetItem, nextCls, bonusPerClassPct)
      : { ...targetItem };
    const burnedIds = [...sacrificeIds];

    spinTimeoutRef.current = window.setTimeout(() => {
      setIsSpinning(false);
      if (succeeded) {
        playLevelUpSound();
      } else {
        playAttackSound();
      }

      setLastResult({
        succeeded,
        rolledPct: rolledPctDisplay,
        chancePct: chance,
        prevClass: prevCls,
        newClass: nextCls,
        itemName: targetItem.name,
        burnedCount: burnedIds.length
      });

      setSacrificeIds([]);

      onExecuteModification({
        targetItemId: targetItem.id,
        isEquippedSlot: selectedTargetEntry?.isEquipped ? selectedTargetEntry.equippedSlot : null,
        sacrificeItemIds: burnedIds,
        chancePct: chance,
        rolledPct: rolledPctDisplay,
        succeeded,
        newClass: nextCls,
        updatedItem: updatedTargetItem
      });
    }, 2750);
  };

  // SVG Circular Gauge Constants
  const radius = 82;
  const circumference = 2 * Math.PI * radius;
  const successStrokeDash = (totalChancePct / 100) * circumference;

  const gaugeNeonColor =
    totalChancePct >= 75
      ? '#00f5d4'
      : totalChancePct >= 40
      ? '#a855f7'
      : totalChancePct > 0
      ? '#f43f5e'
      : '#334155';

  const maxTotalPct = MAX_MODIFICATION_CLASS * bonusPerClassPct;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 backdrop-blur-md select-none">
      <div
        className="relative flex h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border-2 border-cyan-500/70 text-slate-100 shadow-[0_0_45px_rgba(6,182,212,0.35)]"
        style={{
          background:
            'radial-gradient(circle at 50% 38%, rgba(88, 28, 135, 0.32) 0%, rgba(8, 15, 32, 0.96) 58%, rgba(3, 6, 14, 1) 100%)'
        }}
      >
        {/* Top Neon Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/40 bg-slate-950/90 px-3.5 py-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-400/70 bg-cyan-950/80 text-lg shadow-[0_0_12px_rgba(34,211,238,0.5)]">
              🔮
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-serif text-xs sm:text-sm font-black uppercase tracking-wider text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
                Алтарь Модификации (по Реликвиям)
              </h2>
              <p className="truncate text-[9.5px] text-purple-200/80">
                До {maxSacrificeSlots} реликвий • 10 классов • +{bonusPerClassPct}% за класс (до +{maxTotalPct}%)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-2 py-1 text-[10px] font-black">
              <span className="inline-flex items-center gap-1 text-amber-300">
                <GoldCoinIcon size="sm" />
                <span>{hero.gold.toLocaleString('ru-RU')}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-cyan-300">
                <CrystalIcon size="sm" />
                <span>{hero.crystals.toLocaleString('ru-RU')}</span>
              </span>
            </div>
            <button
              onClick={onClose}
              disabled={isSpinning}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/60 bg-rose-950/70 text-xs font-bold text-rose-200 hover:bg-rose-800 active:scale-95 disabled:opacity-40 cursor-pointer"
              title="Закрыть Алтарь"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Altar Workspace */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* ================= 1. ВЕРХНИЙ СЛОТ («АЛТАРЬ») ================= */}
          <div className="rounded-2xl border border-cyan-500/50 bg-slate-950/85 p-3 shadow-[inset_0_0_25px_rgba(6,182,212,0.12)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
                  Верхний слот • Модифицируемая Амуниция
                </span>
              </div>
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => setPickerMode(pickerMode === 'target' ? 'none' : 'target')}
                className="rounded-lg border border-cyan-400/60 bg-cyan-950/80 hover:bg-cyan-900 px-2.5 py-1 text-[9.5px] font-black text-cyan-200 shadow active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                {pickerMode === 'target' ? '▲ Скрыть список' : '🔄 Сменить предмет'}
              </button>
            </div>

            {targetItem ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-3 rounded-xl border border-cyan-500/40 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-2.5">
                  <div
                    onClick={() => !isSpinning && setPickerMode(pickerMode === 'target' ? 'none' : 'target')}
                    className="relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 bg-slate-950 p-1 shadow-[0_0_18px_rgba(34,211,238,0.35)]"
                    style={{
                      borderColor: getQualityConfig(targetItem.quality || 'common').color
                    }}
                  >
                    <ItemIcon
                      icon={targetItem.icon}
                      alt={targetItem.name}
                      slot={targetItem.slot}
                      modificationClass={currentModClass}
                    />
                    <span className="absolute -top-2 -right-2 rounded-md border border-cyan-300 bg-gradient-to-r from-cyan-500 to-indigo-600 px-1.5 py-0.2 text-[9px] font-black text-white shadow-[0_0_10px_rgba(34,211,238,0.8)] flex items-center gap-1">
                      {currentModClass > 0 && (
                        <span className="text-amber-300 font-black">{'⭐'.repeat(currentModClass)}</span>
                      )}
                      <span>М{currentModClass}</span>
                    </span>
                    {selectedTargetEntry?.isEquipped && (
                      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-emerald-600 px-1 text-[7.5px] font-black text-white uppercase">
                        Надето
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="truncate text-xs sm:text-sm font-black"
                        style={{ color: getQualityConfig(targetItem.quality || 'common').color }}
                      >
                        {targetItem.name}
                      </span>
                      {currentModClass > 0 && (
                        <span
                          className="text-amber-400 font-black tracking-tight text-xs sm:text-sm drop-shadow-[0_0_6px_rgba(250,204,21,0.8)] select-none"
                          title={`Модификация: ${currentModClass}/10 звёзд`}
                        >
                          {'⭐'.repeat(currentModClass)}
                        </span>
                      )}
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                        {targetItem.lvl} ур.
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9.5px] font-black">
                        <span className="text-slate-300 flex items-center gap-1 flex-wrap">
                          <span>Класс:</span>
                          <strong className="text-cyan-300">
                            {currentModClass} / {MAX_MODIFICATION_CLASS}
                          </strong>
                          {currentModClass > 0 && (
                            <span className="text-amber-400 font-black">
                              {'⭐'.repeat(currentModClass)}
                            </span>
                          )}
                          <span className="text-emerald-400">
                            (+{currentModClass * bonusPerClassPct}% к статам)
                          </span>
                        </span>
                        {!isMaxClass && (
                          <span className="text-amber-300">
                            След.: М{nextModClass} (+{nextModClass * bonusPerClassPct}%)
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-10 gap-1">
                        {Array.from({ length: MAX_MODIFICATION_CLASS }, (_, i) => i + 1).map((cls) => {
                          const achieved = cls <= currentModClass;
                          const isNext = cls === currentModClass + 1 && !isMaxClass;
                          return (
                            <div
                              key={cls}
                              className={`h-2 rounded-sm border transition-all ${
                                achieved
                                  ? 'border-cyan-300 bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]'
                                  : isNext
                                  ? 'border-purple-400/80 bg-purple-500/35 animate-pulse'
                                  : 'border-slate-800 bg-slate-900'
                              }`}
                              title={`Класс ${cls} (+${cls * bonusPerClassPct}% ко всем статам)`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {statsPreview && statsPreview.length > 0 && (
                  <div className="rounded-xl border border-slate-800/90 bg-black/50 p-2">
                    <div className="mb-1 flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400 px-1">
                      <span>Характеристики предмета</span>
                      <span>
                        {isMaxClass
                          ? `👑 Достигнут максимум (+${maxTotalPct}%)`
                          : `При успехе (М${currentModClass} ➔ М${nextModClass}): +${nextModClass * bonusPerClassPct}%`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {statsPreview.map((st, i) => {
                        const diff = Math.max(0, st.next - st.cur);
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/80 px-2 py-1 text-[10px]"
                          >
                            <span className="text-slate-300 font-bold truncate">
                              {st.icon} {st.label}:
                            </span>
                            <span className="font-black tabular-nums ml-1 shrink-0">
                              <span className={st.color}>
                                +{st.cur}
                                {st.suffix || ''}
                              </span>
                              {!isMaxClass && (
                                <span className="text-emerald-400 ml-1">
                                  ➔ +{st.next}
                                  {st.suffix || ''} {diff > 0 ? `(▲+${diff})` : ''}
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-cyan-500/40 bg-slate-900/50 p-4 text-center text-xs text-slate-400">
                У вас пока нет экипировки для помещения на Алтарь. Купите или выбейте оружие/броню!
              </div>
            )}

            {/* Target Item Selector Drawer */}
            {pickerMode === 'target' && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-cyan-500/50 bg-slate-950 p-2 space-y-1.5">
                <div className="text-[9.5px] font-black uppercase tracking-wider text-cyan-300 px-1">
                  Выберите экипировку для модификации ({allTargetCandidates.length}):
                </div>
                {allTargetCandidates.map(({ item, isEquipped }) => {
                  const modCls = getItemModClass(item);
                  const isSelected = item.id === selectedTargetId;
                  const q = getQualityConfig(item.quality || 'common');
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedTargetId(item.id);
                        setPickerMode('none');
                        setLastResult(null);
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border p-2 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-950/60 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                          : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 shrink-0 rounded-lg border border-slate-700 bg-slate-950 p-0.5 flex items-center justify-center">
                          <ItemIcon icon={item.icon} alt={item.name} slot={item.slot} modificationClass={modCls} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black truncate" style={{ color: q.color }}>
                              {item.name}
                            </span>
                            {modCls > 0 && (
                              <span className="text-amber-400 font-black text-[10px] tracking-tight">
                                {'⭐'.repeat(modCls)}
                              </span>
                            )}
                            <span className="rounded bg-cyan-950 border border-cyan-500/50 px-1 text-[8.5px] font-black text-cyan-300">
                              М{modCls}/10 (+{modCls * bonusPerClassPct}%)
                            </span>

                            {isEquipped && (
                              <span className="rounded bg-emerald-950 border border-emerald-500/50 px-1 text-[8px] font-bold text-emerald-300">
                                Надето
                              </span>
                            )}
                          </div>
                          <div className="text-[9.5px] text-slate-400">
                            {SLOT_INFO[item.slot]?.name || 'Предмет'} • {item.lvl} ур. • ⚔️+{item.dmg || 0} ❤️+{item.hp || 0}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md bg-cyan-500/20 border border-cyan-400/50 px-2 py-1 text-[9px] font-black text-cyan-200">
                        {isSelected ? 'На Алтаре' : 'Выбрать'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ================= 2. ЦЕНТРАЛЬНАЯ ЧАСТЬ (КРУГОВАЯ ШКАЛА СО СТРЕЛКОЙ СВЕРХУ) ================= */}
          <div className="relative flex flex-col items-center justify-center rounded-2xl border border-purple-500/50 bg-gradient-to-b from-[#0b0f24] via-[#090b16] to-[#0d091c] py-3.5 px-3 shadow-[inset_0_0_35px_rgba(168,85,247,0.18)]">
            <div
              className="pointer-events-none absolute h-44 w-44 rounded-full blur-2xl opacity-35 transition-colors duration-500"
              style={{ backgroundColor: gaugeNeonColor }}
            />

            <div className="relative z-20 -mb-2.5 flex flex-col items-center">
              <div className="rounded-full border border-cyan-300/80 bg-slate-950 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]">
                Указатель Алтаря
              </div>
              <div
                className="text-2xl leading-none text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,1)]"
                style={{ filter: 'drop-shadow(0 0 8px #00f5d4)' }}
              >
                ▼
              </div>
            </div>

            <div className="relative flex h-52 w-52 items-center justify-center">
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 220 220">
                <circle
                  cx="110"
                  cy="110"
                  r="102"
                  fill="none"
                  stroke="rgba(139, 92, 246, 0.28)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                {Array.from({ length: 36 }).map((_, idx) => {
                  const angle = idx * 10;
                  const isMajor = idx % 3 === 0;
                  return (
                    <line
                      key={idx}
                      x1="110"
                      y1={isMajor ? '6' : '9'}
                      x2="110"
                      y2={isMajor ? '14' : '13'}
                      stroke={idx === 0 ? '#00f5d4' : isMajor ? 'rgba(34,211,238,0.55)' : 'rgba(148,163,184,0.25)'}
                      strokeWidth={isMajor ? '2' : '1'}
                      transform={`rotate(${angle} 110 110)`}
                    />
                  );
                })}
              </svg>

              <div
                className="relative h-full w-full flex items-center justify-center"
                style={{
                  transform: `rotate(${wheelRotationDeg}deg)`,
                  transition: isSpinning
                    ? 'transform 2.7s cubic-bezier(0.14, 0.88, 0.18, 1)'
                    : 'transform 0.4s ease-out'
                }}
              >
                <svg className="h-full w-full -rotate-90" viewBox="0 0 220 220">
                  <defs>
                    <linearGradient id="altarSuccessGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00f5d4" />
                      <stop offset="55%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                    <linearGradient id="altarFailGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#331028" />
                      <stop offset="100%" stopColor="#1e1b38" />
                    </linearGradient>
                  </defs>

                  <circle
                    cx="110"
                    cy="110"
                    r={radius}
                    fill="none"
                    stroke="url(#altarFailGrad)"
                    strokeWidth="18"
                  />

                  <circle
                    cx="110"
                    cy="110"
                    r={radius}
                    fill="none"
                    stroke="url(#altarSuccessGrad)"
                    strokeWidth="18"
                    strokeDasharray={`${successStrokeDash} ${circumference}`}
                    strokeLinecap={totalChancePct > 0 && totalChancePct < 100 ? 'butt' : 'round'}
                    style={{
                      filter:
                        totalChancePct > 0
                          ? 'drop-shadow(0 0 10px rgba(0, 245, 212, 0.65))'
                          : 'none',
                      transition: isSpinning ? 'none' : 'stroke-dasharray 0.35s ease'
                    }}
                  />

                  <circle
                    cx="110"
                    cy="110"
                    r="68"
                    fill="none"
                    stroke="rgba(34, 211, 238, 0.3)"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>

              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <span className="text-[9px] font-black uppercase tracking-widest text-purple-300/90">
                  {isSpinning ? '⚡ Вращение...' : `Реликвий: ${selectedSacrificeItems.length}/${maxSacrificeSlots}`}
                </span>
                <div
                  className="font-mono text-2xl sm:text-3xl font-black tracking-tight tabular-nums my-0.5"
                  style={{
                    color: gaugeNeonColor,
                    textShadow: `0 0 18px ${gaugeNeonColor}88`
                  }}
                >
                  {isMaxClass ? 'MAX' : `${totalChancePct}%`}
                </div>
                {targetItem && !isMaxClass && (
                  <div className="rounded-full border border-cyan-500/40 bg-slate-950/90 px-2.5 py-0.5 text-[9px] font-black text-cyan-200 shadow">
                    М{currentModClass} ➔ М{nextModClass} (+{nextModClass * bonusPerClassPct}%)
                  </div>
                )}
                {targetItem && isMaxClass && (
                  <div className="rounded-full border border-amber-400/60 bg-amber-950/90 px-2.5 py-0.5 text-[9px] font-black text-amber-300">
                    👑 10 КЛАСС (+{maxTotalPct}%)
                  </div>
                )}
              </div>
            </div>

            {lastResult && !isSpinning && (
              <div
                className={`mt-2 w-full rounded-xl border-2 p-2.5 text-center shadow-lg transition-all ${
                  lastResult.succeeded
                    ? 'border-emerald-400 bg-emerald-950/80 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                    : 'border-rose-500 bg-rose-950/80 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                }`}
              >
                <div className="text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-1.5 flex-wrap">
                  {lastResult.succeeded ? (
                    <>
                      <span>✨ МОДИФИКАЦИЯ УСПЕШНА!</span>
                      <span className="text-amber-300 font-black">{'⭐'.repeat(lastResult.newClass)}</span>
                      <span>КЛАСС М{lastResult.newClass} (+{lastResult.newClass * bonusPerClassPct}%)</span>
                    </>
                  ) : (
                    '💥 МОДИФИКАЦИЯ НЕ УДАЛАСЬ! РЕЛИКВИИ СГОРЕЛИ'
                  )}
                </div>
                <div className="text-[10px] mt-0.5 opacity-90">
                  {lastResult.succeeded
                    ? `«${lastResult.itemName} ${'⭐'.repeat(lastResult.newClass)}» успешно усилен до ${lastResult.newClass}-го класса (1..10 звёзд)! Все характеристики выросли до +${
                        lastResult.newClass * bonusPerClassPct
                      }%.`
                    : `Выпало значение вне сектора успеха (шанс был ${lastResult.chancePct}%). Израсходовано реликвий: ${lastResult.burnedCount} шт. Предмет на Алтаре сохранён (М${lastResult.prevClass}).`}
                </div>

              </div>
            )}
          </div>

          {/* ================= 3. НИЖНИЙ СЛОТ («ЖЕРТВА / РЕЛИКВИИ ДО 50 ШТ.») ================= */}
          <div className="rounded-2xl border border-purple-500/50 bg-slate-950/90 p-3 shadow-[inset_0_0_25px_rgba(168,85,247,0.12)] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">
                  Алтарь Реликвий • Вместимость: {selectedSacrificeItems.length} / {maxSacrificeSlots} шт.
                </span>
              </div>
              <span className="rounded bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 text-[9px] font-black text-amber-300">
                🏺 В сумке реликвий: {eligibleSacrificeInventory.length} шт.
              </span>
            </div>

            {/* Quick Batch Controls & Slider for up to 50 Relics */}
            {!isMaxClass && (
              <div className="rounded-xl border border-purple-500/35 bg-slate-900/90 p-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-[9.5px] font-bold text-slate-300">
                    Быстрая закладка реликвий (до {maxSacrificeSlots} шт.):
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      disabled={isSpinning || eligibleSacrificeInventory.length === 0}
                      onClick={() => handleAddBatchRelics(1)}
                      className="rounded border border-purple-400/50 bg-purple-950/80 hover:bg-purple-800 px-2 py-0.5 text-[9px] font-black text-purple-200 active:scale-95 disabled:opacity-40 cursor-pointer"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      disabled={isSpinning || eligibleSacrificeInventory.length === 0}
                      onClick={() => handleAddBatchRelics(5)}
                      className="rounded border border-purple-400/50 bg-purple-950/80 hover:bg-purple-800 px-2 py-0.5 text-[9px] font-black text-purple-200 active:scale-95 disabled:opacity-40 cursor-pointer"
                    >
                      +5
                    </button>
                    <button
                      type="button"
                      disabled={isSpinning || eligibleSacrificeInventory.length === 0}
                      onClick={() => handleAddBatchRelics(10)}
                      className="rounded border border-purple-400/50 bg-purple-950/80 hover:bg-purple-800 px-2 py-0.5 text-[9px] font-black text-purple-200 active:scale-95 disabled:opacity-40 cursor-pointer"
                    >
                      +10
                    </button>
                    <button
                      type="button"
                      disabled={isSpinning || eligibleSacrificeInventory.length === 0}
                      onClick={() => handleAddBatchRelics(25)}
                      className="rounded border border-purple-400/50 bg-purple-950/80 hover:bg-purple-800 px-2 py-0.5 text-[9px] font-black text-purple-200 active:scale-95 disabled:opacity-40 cursor-pointer"
                    >
                      +25
                    </button>
                    <button
                      type="button"
                      disabled={isSpinning || eligibleSacrificeInventory.length === 0}
                      onClick={handleAutoFillSacrifice}
                      className="rounded border border-emerald-500/60 bg-emerald-950/80 hover:bg-emerald-900 px-2 py-0.5 text-[9px] font-black text-emerald-200 active:scale-95 disabled:opacity-40 cursor-pointer"
                    >
                      ⚡ Макс ({Math.min(maxSacrificeSlots, eligibleSacrificeInventory.length)})
                    </button>
                    {selectedSacrificeItems.length > 0 && (
                      <button
                        type="button"
                        disabled={isSpinning}
                        onClick={() => setSacrificeIds([])}
                        className="rounded border border-rose-500/60 bg-rose-950/80 hover:bg-rose-900 px-2 py-0.5 text-[9px] font-black text-rose-200 active:scale-95 disabled:opacity-40 cursor-pointer"
                      >
                        🗑️ Сброс
                      </button>
                    )}
                  </div>
                </div>

                {eligibleSacrificeInventory.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-slate-400">0</span>
                    <input
                      type="range"
                      min={0}
                      max={Math.min(maxSacrificeSlots, eligibleSacrificeInventory.length)}
                      value={selectedSacrificeItems.length}
                      disabled={isSpinning}
                      onChange={(e) => handleSetSacrificeCount(Number(e.target.value))}
                      className="flex-1 accent-purple-500 cursor-pointer"
                    />
                    <span className="text-[9.5px] font-mono font-black text-purple-300">
                      {selectedSacrificeItems.length}/{Math.min(maxSacrificeSlots, eligibleSacrificeInventory.length)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 50 Sacrifice Slots Compact Scrollable Grid (10 columns x 5 rows) */}
            <div className="max-h-48 overflow-y-auto pr-0.5">
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
                {Array.from({ length: maxSacrificeSlots }).map((_, slotIdx) => {
                  const sacItem = selectedSacrificeItems[slotIdx] || null;
                  const contribPct =
                    sacItem && targetItem
                      ? calculateSingleSacrificeChanceContribution(
                          targetItem,
                          sacItem,
                          resolvedShopItems,
                          customChanceTable
                        )
                      : 0;
                  return (
                    <div
                      key={slotIdx}
                      onClick={() => {
                        if (isSpinning) return;
                        if (sacItem) {
                          handleToggleSacrificeItem(sacItem.id);
                        } else {
                          setPickerMode('sacrifice');
                        }
                      }}
                      className={`relative flex h-11 flex-col items-center justify-center rounded-lg border p-0.5 transition-all cursor-pointer ${
                        sacItem
                          ? 'border-purple-400 bg-purple-950/60 shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                          : 'border-dashed border-slate-800 bg-slate-900/50 hover:border-purple-500/50'
                      }`}
                      title={
                        sacItem
                          ? `${sacItem.name} (+${contribPct}% к шансу) — нажмите, чтобы убрать`
                          : `Слот реликвии #${slotIdx + 1} (нажмите, чтобы выбрать Реликвию из Сумки)`
                      }
                    >
                      {sacItem ? (
                        <>
                          <div className="h-5 w-5 overflow-hidden flex items-center justify-center">
                            <ItemIcon icon={sacItem.icon || '🏺'} alt={sacItem.name} />
                          </div>
                          <span className="mt-0.5 rounded bg-emerald-950/90 px-0.5 text-[7px] font-black text-emerald-300 leading-none">
                            +{contribPct}%
                          </span>
                        </>
                      ) : (
                        <span className="text-[8px] font-mono text-slate-600">#{slotIdx + 1}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Button to pick specific Relics from Bag */}
            <button
              type="button"
              disabled={isSpinning || isMaxClass}
              onClick={() => setPickerMode(pickerMode === 'sacrifice' ? 'none' : 'sacrifice')}
              className={`w-full rounded-xl border py-1.5 px-2 text-[10px] font-black transition-all cursor-pointer ${
                pickerMode === 'sacrifice'
                  ? 'border-purple-400 bg-purple-600 text-white shadow'
                  : 'border-purple-500/50 bg-purple-950/60 text-purple-200 hover:bg-purple-900/70'
              }`}
            >
              🏺 Выбрать Реликвии из Сумки вручную ({eligibleSacrificeInventory.length} шт.)
            </button>

            {/* Bag Relic Selector */}
            {pickerMode === 'sacrifice' && (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-purple-500/50 bg-slate-950 p-2 space-y-1.5">
                <div className="text-[9.5px] font-black uppercase tracking-wider text-purple-300 px-1">
                  Доступные Реликвии из вашей Сумки (добываются из монстров в Пирамидах):
                </div>
                {eligibleSacrificeInventory.length === 0 ? (
                  <div className="p-3 text-center text-[10.5px] text-slate-400">
                    В вашей сумке пока нет Реликвий 🏺. Реликвии выпадают в боях против монстров внутри Пирамид (базовый шанс {featureFlags?.relicDropChancePct ?? 3}%)! Обычные вещи в качестве жертвы больше не используются.
                  </div>
                ) : (
                  eligibleSacrificeInventory.map((sacItem) => {
                    const isPicked = sacrificeIds.includes(sacItem.id);
                    const contrib = targetItem
                      ? calculateSingleSacrificeChanceContribution(
                          targetItem,
                          sacItem,
                          resolvedShopItems,
                          customChanceTable
                        )
                      : 0;
                    const q = getQualityConfig(sacItem.quality || 'epic');
                    return (
                      <button
                        key={sacItem.id}
                        type="button"
                        onClick={() => handleToggleSacrificeItem(sacItem.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg border p-2 text-left transition-all cursor-pointer ${
                          isPicked
                            ? 'border-purple-400 bg-purple-950/65 shadow'
                            : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-8 w-8 shrink-0 rounded-lg border border-slate-700 bg-slate-950 p-0.5 flex items-center justify-center">
                            <ItemIcon icon={sacItem.icon || '🏺'} alt={sacItem.name} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black truncate" style={{ color: q.color }}>
                              {sacItem.name}
                            </div>
                            <div className="text-[9.5px] text-slate-400">
                              Сила реликвии: x{sacItem.relicPower || 1} • Даёт{' '}
                              <strong className="text-emerald-300">+{contrib}% к шансу</strong>
                            </div>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-2 py-1 text-[9.5px] font-black ${
                            isPicked
                              ? 'bg-rose-600 text-white'
                              : 'bg-purple-600/30 border border-purple-400/50 text-purple-200'
                          }`}
                        >
                          {isPicked ? '✕ Убрать' : `➕ +${contrib}%`}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Relic Rule Explanation */}
            <div className="rounded-xl border border-amber-500/40 bg-amber-950/25 px-2.5 py-2 text-[9.5px] text-amber-200/90 leading-snug space-y-0.5">
              <div>
                🏺 <strong>Крафт по Реликвиям (до {maxSacrificeSlots} шт.):</strong> В Алтаре используются исключительно <strong>Реликвии</strong> (обычные вещи в качестве жертвы больше не используются).
              </div>
              <div>
                ⚔️ <strong>Добыча Реликвий:</strong> Выбиваются в боях против монстров внутри Пирамид (базовый шанс выпадения — <strong>{featureFlags?.relicDropChancePct ?? 3}%</strong>). При попытке модификации заложенные реликвии расходуются, а модифицируемая амуниция в верхнем слоте никогда не разрушается!
              </div>
            </div>
          </div>
        </div>

        {/* Footer Launch Action Button */}
        <div className="border-t border-cyan-500/40 bg-slate-950 px-3.5 py-2.5 shrink-0">
          <button
            type="button"
            disabled={
              isSpinning ||
              !targetItem ||
              isMaxClass ||
              selectedSacrificeItems.length === 0 ||
              totalChancePct <= 0
            }
            onClick={handleStartModification}
            className="w-full rounded-xl border-2 border-cyan-300 bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wider text-white shadow-[0_0_25px_rgba(34,211,238,0.5)] hover:brightness-110 active:scale-98 disabled:opacity-40 disabled:shadow-none cursor-pointer transition-all"
          >
            {isSpinning
              ? '🔮 ШКАЛА АЛТАРЯ ВРАЩАЕТСЯ...'
              : isMaxClass
              ? `👑 ДОСТИГНУТ МАКСИМАЛЬНЫЙ 10 КЛАСС (+${maxTotalPct}%)`
              : selectedSacrificeItems.length === 0
              ? '🏺 ЗАЛОЖИТЕ РЕЛИКВИИ В СЛОТЫ АЛТАРЯ (ДО 50 ШТ.)'
              : `⚡ МОДИФИЦИРОВАТЬ ДО М${nextModClass} (+${nextModClass * bonusPerClassPct}%) • ШАНС ${totalChancePct}% (${selectedSacrificeItems.length} рел.)`}
          </button>
        </div>
      </div>
    </div>
  );
};
