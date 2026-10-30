import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  HeroState,
  GameItem,
  EquippedGear,
  ShopItemTemplate,
  ItemSlot
} from '../../types/game';
import { SLOT_INFO, getQualityConfig } from '../../utils/gameData';
import {
  getItemDefaultMaxDurability,
  isCustomCreatedItem
} from '../../utils/shopConfig';
import { ItemIcon } from '../ItemIcon';
import { GoldCoinIcon, CrystalIcon } from '../CurrencyIcon';
import {
  playCoinSound,
  playLootSound,
  playLevelUpSound,
  playAttackSound
} from '../../utils/audio';

export const MAX_MODIFICATION_CLASS = 10;
export const MODIFICATION_BONUS_PER_CLASS_PCT = 5; // +5% per class, up to +50% at Class 10
export const MAX_SACRIFICE_SLOTS = 6;

export function getItemModClass(item?: GameItem | null): number {
  if (!item) return 0;
  return Math.max(0, Math.min(MAX_MODIFICATION_CLASS, Math.floor(Number(item.modificationClass || 0))));
}

export function extractBaseStatsBeforeMod(item: GameItem): NonNullable<GameItem['baseStatsBeforeMod']> {
  if (item.baseStatsBeforeMod) {
    return { ...item.baseStatsBeforeMod };
  }
  const curClass = getItemModClass(item);
  const divisor = 1 + curClass * (MODIFICATION_BONUS_PER_CLASS_PCT / 100);

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
  targetClass: number
): NonNullable<GameItem['baseStatsBeforeMod']> {
  const clampedClass = Math.max(0, Math.min(MAX_MODIFICATION_CLASS, Math.floor(targetClass)));
  const base = extractBaseStatsBeforeMod(item);
  if (clampedClass <= 0) {
    return { ...base };
  }
  const mult = 1 + clampedClass * (MODIFICATION_BONUS_PER_CLASS_PCT / 100); // e.g. 1.05 .. 1.50

  const scaleStat = (baseVal?: number) => {
    const v = Math.max(0, Number(baseVal || 0));
    if (v <= 0) return 0;
    // Apply +5% per class (+50% at class 10); ensure every class gives a visible integer boost if base is small
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

export function applyModificationClassToItem(item: GameItem, newClass: number): GameItem {
  const clampedClass = Math.max(0, Math.min(MAX_MODIFICATION_CLASS, Math.floor(newClass)));
  const baseStats = extractBaseStatsBeforeMod(item);
  const nextStats = computeStatsForModificationClass(
    { ...item, baseStatsBeforeMod: baseStats },
    clampedClass
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
 * Checks whether an inventory item is a valid sacrificial material (sold in the game shop).
 */
export function isShopMaterialEligible(
  item: GameItem,
  shopCatalog: ShopItemTemplate[],
  targetItemId?: string | null
): boolean {
  if (!item) return false;
  if (targetItemId && item.id === targetItemId) return false;
  if (item.rent || item.isClanRented || item.isElixirLot) return false;
  if (isCustomCreatedItem(item)) return false;

  // Check if item originates from or matches any item sold in the shop catalog
  if (item.shopTemplateId || item.origin === 'shop') return true;
  const cleanName = String(item.name || '').trim().toLowerCase();
  const matchesCatalog = shopCatalog.some(
    (tmpl) =>
      tmpl.id === item.shopTemplateId ||
      String(tmpl.name || '').trim().toLowerCase() === cleanName ||
      tmpl.slot === item.slot
  );
  return matchesCatalog;
}

/**
 * Calculates how much % success chance a single sacrificial shop item contributes
 * toward upgrading `targetItem` to `nextClass` (1..10).
 */
export function calculateSingleSacrificeChanceContribution(
  targetItem: GameItem,
  sacrificeItem: GameItem,
  shopCatalog: ShopItemTemplate[]
): number {
  const curClass = getItemModClass(targetItem);
  if (curClass >= MAX_MODIFICATION_CLASS) return 0;
  const nextClass = curClass + 1; // 1..10

  const findPrice = (it: GameItem) => {
    if (it.price && it.price > 0) return Number(it.price);
    const match = shopCatalog.find(
      (s) =>
        s.id === it.shopTemplateId ||
        s.name.trim().toLowerCase() === String(it.name || '').trim().toLowerCase()
    );
    if (match && match.price > 0) return Number(match.price);
    return Math.max(30, Number(it.lvl || 1) * 28);
  };

  const targetVal = Math.max(25, findPrice(targetItem));
  const sacVal = Math.max(20, findPrice(sacrificeItem));
  const targetLvl = Math.max(1, Number(targetItem.lvl || 1));
  const sacLvl = Math.max(1, Number(sacrificeItem.lvl || 1));

  // Ratio of sacrifice item value & level vs target item
  const valueRatio = Math.min(2.4, Math.max(0.22, sacVal / targetVal));
  const lvlRatio = Math.min(1.8, Math.max(0.35, sacLvl / targetLvl));
  const combinedRatio = valueRatio * 0.65 + lvlRatio * 0.35;

  // Base chance per 1 equivalent shop item at each class (Class 1 is easiest, Class 10 is hardest)
  const classBaseTable: Record<number, number> = {
    1: 65,
    2: 55,
    3: 46,
    4: 38,
    5: 32,
    6: 26,
    7: 22,
    8: 18,
    9: 15,
    10: 12
  };
  const baseForClass = classBaseTable[nextClass] ?? 20;

  // Bonus if the sacrifice item itself already has modification classes
  const sacModBonus = 1 + getItemModClass(sacrificeItem) * 0.12;

  const rawContribution = baseForClass * combinedRatio * sacModBonus;
  return Math.max(4, Math.min(95, Math.round(rawContribution)));
}

interface ModificationAltarModalProps {
  hero: HeroState;
  equipped: EquippedGear;
  inventory: GameItem[];
  shopItems: ShopItemTemplate[];
  initialTargetItemId?: string | null;
  onClose: () => void;
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
  initialTargetItemId = null,
  onClose,
  onExecuteModification,
  onQuickBuyShopSacrifice
}) => {
  // All player items eligible to be placed on the Top Altar (equipped + inventory)
  const allTargetCandidates = useMemo(() => {
    const list: { item: GameItem; isEquipped: boolean; equippedSlot?: ItemSlot }[] = [];
    (Object.keys(equipped) as ItemSlot[]).forEach((slot) => {
      const eqItem = equipped[slot];
      if (eqItem && !eqItem.rent && !eqItem.isClanRented) {
        list.push({ item: eqItem, isEquipped: true, equippedSlot: slot });
      }
    });
    inventory.forEach((invItem) => {
      if (invItem && !invItem.rent && !invItem.isClanRented && !invItem.isElixirLot) {
        list.push({ item: invItem, isEquipped: false });
      }
    });
    return list;
  }, [equipped, inventory]);

  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(() => {
    if (initialTargetItemId && allTargetCandidates.some((c) => c.item.id === initialTargetItemId)) {
      return initialTargetItemId;
    }
    return allTargetCandidates[0]?.item.id || null;
  });

  const [sacrificeIds, setSacrificeIds] = useState<string[]>([]);
  const [pickerMode, setPickerMode] = useState<'none' | 'target' | 'sacrifice' | 'quick_shop'>('none');

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

  // Eligible Sacrifice Items from Inventory (Sold in Game Shop, not currently selected as target)
  const eligibleSacrificeInventory = useMemo(() => {
    return inventory.filter((it) => isShopMaterialEligible(it, shopItems, selectedTargetId));
  }, [inventory, shopItems, selectedTargetId]);

  // Keep sacrificeIds valid if inventory changes
  useEffect(() => {
    setSacrificeIds((prev) =>
      prev.filter(
        (id) =>
          id !== selectedTargetId &&
          eligibleSacrificeInventory.some((it) => it.id === id)
      )
    );
  }, [selectedTargetId, eligibleSacrificeInventory]);

  const selectedSacrificeItems = useMemo(() => {
    return sacrificeIds
      .map((id) => eligibleSacrificeInventory.find((it) => it.id === id))
      .filter((it): it is GameItem => Boolean(it));
  }, [sacrificeIds, eligibleSacrificeInventory]);

  // Calculate Total Success Chance (0% .. 100%)
  const totalChancePct = useMemo(() => {
    if (!targetItem || isMaxClass || selectedSacrificeItems.length === 0) return 0;
    const sum = selectedSacrificeItems.reduce(
      (acc, sac) => acc + calculateSingleSacrificeChanceContribution(targetItem, sac, shopItems),
      0
    );
    return Math.max(1, Math.min(100, sum));
  }, [targetItem, isMaxClass, selectedSacrificeItems, shopItems]);

  // Current vs Next Class Stats Preview
  const statsPreview = useMemo(() => {
    if (!targetItem) return null;
    const curStats = computeStatsForModificationClass(targetItem, currentModClass);
    const nextStats = computeStatsForModificationClass(targetItem, nextModClass);
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
  }, [targetItem, currentModClass, nextModClass]);

  const handleToggleSacrificeItem = (itemId: string) => {
    if (isSpinning) return;
    setLastResult(null);
    setSacrificeIds((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      }
      if (prev.length >= MAX_SACRIFICE_SLOTS) {
        return prev;
      }
      return [...prev, itemId];
    });
  };

  const handleAutoFillSacrifice = () => {
    if (isSpinning || !targetItem || isMaxClass) return;
    setLastResult(null);
    const sorted = [...eligibleSacrificeInventory].sort(
      (a, b) => Number(a.price || a.lvl * 25) - Number(b.price || b.lvl * 25)
    );
    const picked: string[] = [];
    let runningChance = 0;
    for (const candidate of sorted) {
      if (picked.length >= MAX_SACRIFICE_SLOTS) break;
      if (runningChance >= 100) break;
      picked.push(candidate.id);
      runningChance += calculateSingleSacrificeChanceContribution(targetItem, candidate, shopItems);
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
    // Roll 0.00 .. 99.99
    const rawRoll = Math.random() * 100;
    const succeeded = rawRoll < chance;
    const rolledPctDisplay = Math.min(100, Math.max(1, Math.ceil(rawRoll)));

    // Visual circular gauge math:
    // On the SVG circle, the green/cyan Success sector starts at 0 deg (12 o'clock) and spans clockwise to `chance * 3.6` deg.
    // The red Failure sector spans clockwise from `chance * 3.6` deg to `360` deg.
    // For a point at angle `alpha` on the wheel to land directly under the top pointer arrow (0 deg / 12 o'clock),
    // we rotate the wheel clockwise by `360 - alpha` (plus full spins).
    const landingPointOnWheelDeg = succeeded
      ? Math.max(4, Math.min(chance * 3.6 - 4, (rawRoll / Math.max(1, chance)) * (chance * 3.6)))
      : Math.max(
          chance * 3.6 + 5,
          Math.min(355, chance * 3.6 + ((rawRoll - chance) / Math.max(1, 100 - chance)) * ((100 - chance) * 3.6))
        );

    const baseFullSpins = (Math.floor(wheelRotationDeg / 360) + 6) * 360;
    const nextWheelRotation = baseFullSpins + (360 - landingPointOnWheelDeg);
    setWheelRotationDeg(nextWheelRotation);

    const prevCls = currentModClass;
    const nextCls = succeeded ? Math.min(MAX_MODIFICATION_CLASS, prevCls + 1) : prevCls;
    const updatedTargetItem = succeeded
      ? applyModificationClassToItem(targetItem, nextCls)
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
      ? '#00f5d4' // bright neon cyan-emerald
      : totalChancePct >= 40
      ? '#a855f7' // electric neon purple
      : totalChancePct > 0
      ? '#f43f5e' // neon crimson-magenta
      : '#334155';

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
                Алтарь Модификации
              </h2>
              <p className="truncate text-[9.5px] text-purple-200/80">
                10 классов улучшения • +5% ко всем статам за класс (до +50%)
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
                  Верхний слот • Алтарь Улучшения
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
                  {/* Target Item Icon with Modification Class Badge */}
                  <div
                    onClick={() => !isSpinning && setPickerMode(pickerMode === 'target' ? 'none' : 'target')}
                    className="relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 bg-slate-950 p-1 shadow-[0_0_18px_rgba(34,211,238,0.35)]"
                    style={{
                      borderColor: getQualityConfig(targetItem.quality || 'common').color
                    }}
                  >
                    <ItemIcon icon={targetItem.icon} alt={targetItem.name} slot={targetItem.slot} />
                    <span className="absolute -top-2 -right-2 rounded-md border border-cyan-300 bg-gradient-to-r from-cyan-500 to-indigo-600 px-1.5 py-0.2 text-[9px] font-black text-white shadow-[0_0_10px_rgba(34,211,238,0.8)]">
                      М{currentModClass}
                    </span>
                    {selectedTargetEntry?.isEquipped && (
                      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-emerald-600 px-1 text-[7.5px] font-black text-white uppercase">
                        Надето
                      </span>
                    )}
                  </div>

                  {/* Target Item Info & Class Progress Bar */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="truncate text-xs sm:text-sm font-black"
                        style={{ color: getQualityConfig(targetItem.quality || 'common').color }}
                      >
                        {targetItem.name}
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                        {targetItem.lvl} ур.
                      </span>
                    </div>

                    {/* 10 Modification Classes Segmented Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9.5px] font-black">
                        <span className="text-slate-300">
                          Класс модификации:{' '}
                          <strong className="text-cyan-300">
                            {currentModClass} / {MAX_MODIFICATION_CLASS}
                          </strong>{' '}
                          <span className="text-emerald-400">
                            (+{currentModClass * MODIFICATION_BONUS_PER_CLASS_PCT}% к статам)
                          </span>
                        </span>
                        {!isMaxClass && (
                          <span className="text-amber-300">
                            След.: М{nextModClass} (+{nextModClass * MODIFICATION_BONUS_PER_CLASS_PCT}%)
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
                              title={`Класс ${cls} (+${cls * 5}% ко всем статам)`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stat Upgrade Preview Table (+5% per class) */}
                {statsPreview && statsPreview.length > 0 && (
                  <div className="rounded-xl border border-slate-800/90 bg-black/50 p-2">
                    <div className="mb-1 flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400 px-1">
                      <span>Характеристики предмета</span>
                      <span>
                        {isMaxClass
                          ? '👑 Достигнут максимум (+50%)'
                          : `При успехе (М${currentModClass} ➔ М${nextModClass}): +${nextModClass * 5}%`}
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
                У вас пока нет экипировки для помещения на Алтарь. Купите оружие или броню в Магазине!
              </div>
            )}

            {/* Target Item Selector Drawer */}
            {pickerMode === 'target' && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-cyan-500/50 bg-slate-950 p-2 space-y-1.5">
                <div className="text-[9.5px] font-black uppercase tracking-wider text-cyan-300 px-1">
                  Выберите предмет для помещения на Алтарь ({allTargetCandidates.length}):
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
                          <ItemIcon icon={item.icon} alt={item.name} slot={item.slot} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black truncate" style={{ color: q.color }}>
                              {item.name}
                            </span>
                            <span className="rounded bg-cyan-950 border border-cyan-500/50 px-1 text-[8.5px] font-black text-cyan-300">
                              М{modCls}/10 (+{modCls * 5}%)
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
          <div className="relative flex flex-col items-center justify-center rounded-2xl border border-purple-500/50 bg-gradient-to-b from-[#0b0f24] via-[#090b16] to-[#0d091c] py-4 px-3 shadow-[inset_0_0_35px_rgba(168,85,247,0.18)]">
            {/* Ambient Neon Glow */}
            <div
              className="pointer-events-none absolute h-48 w-48 rounded-full blur-2xl opacity-35 transition-colors duration-500"
              style={{ backgroundColor: gaugeNeonColor }}
            />

            {/* Top Fixed Pointer Arrow (▼ at 12 o'clock) */}
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

            {/* Circular Gauge + Rotating Ring */}
            <div className="relative flex h-56 w-56 items-center justify-center">
              {/* Outer Static Neon Ring & Degree Ticks */}
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

              {/* Rotatable Wheel with Success Arc & Failure Arc */}
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

                  {/* Background / Failure Track */}
                  <circle
                    cx="110"
                    cy="110"
                    r={radius}
                    fill="none"
                    stroke="url(#altarFailGrad)"
                    strokeWidth="18"
                  />

                  {/* Glowing Success Sector Arc (starts at 12 o'clock due to -rotate-90) */}
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

                  {/* Inner Neon Rim */}
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

              {/* Center Stationary Readout Hub */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <span className="text-[9px] font-black uppercase tracking-widest text-purple-300/90">
                  {isSpinning ? '⚡ Вращение...' : 'Шанс успеха'}
                </span>
                <div
                  className="font-mono text-3xl sm:text-4xl font-black tracking-tight tabular-nums my-0.5"
                  style={{
                    color: gaugeNeonColor,
                    textShadow: `0 0 18px ${gaugeNeonColor}88`
                  }}
                >
                  {isMaxClass ? 'MAX' : `${totalChancePct}%`}
                </div>
                {targetItem && !isMaxClass && (
                  <div className="rounded-full border border-cyan-500/40 bg-slate-950/90 px-2.5 py-0.5 text-[9px] font-black text-cyan-200 shadow">
                    М{currentModClass} ➔ М{nextModClass} (+{nextModClass * 5}%)
                  </div>
                )}
                {targetItem && isMaxClass && (
                  <div className="rounded-full border border-amber-400/60 bg-amber-950/90 px-2.5 py-0.5 text-[9px] font-black text-amber-300">
                    👑 10 КЛАСС (+50%)
                  </div>
                )}
              </div>
            </div>

            {/* Spin Result Banner */}
            {lastResult && !isSpinning && (
              <div
                className={`mt-2 w-full rounded-xl border-2 p-2.5 text-center shadow-lg transition-all ${
                  lastResult.succeeded
                    ? 'border-emerald-400 bg-emerald-950/80 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                    : 'border-rose-500 bg-rose-950/80 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                }`}
              >
                <div className="text-xs sm:text-sm font-black uppercase tracking-wider">
                  {lastResult.succeeded
                    ? `✨ МОДИФИКАЦИЯ УСПЕШНА! КЛАСС М${lastResult.newClass} (+${lastResult.newClass * 5}%)`
                    : '💥 МОДИФИКАЦИЯ НЕ УДАЛАСЬ! ЖЕРТВА СГОРЕЛА'}
                </div>
                <div className="text-[10px] mt-0.5 opacity-90">
                  {lastResult.succeeded
                    ? `«${lastResult.itemName}» усилен до ${lastResult.newClass}-го класса! Все характеристики выросли до +${
                        lastResult.newClass * 5
                      }%.`
                    : `Выпало значение вне сектора успеха (шанс был ${lastResult.chancePct}%). Израсходовано материалов: ${lastResult.burnedCount} шт. Предмет на Алтаре сохранён (М${lastResult.prevClass}).`}
                </div>
              </div>
            )}
          </div>

          {/* ================= 3. НИЖНИЙ СЛОТ («ЖЕРТВА / МАТЕРИАЛЫ») ================= */}
          <div className="rounded-2xl border border-purple-500/50 bg-slate-950/90 p-3 shadow-[inset_0_0_25px_rgba(168,85,247,0.12)] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">
                  Нижний слот • Жертва / Материалы ({selectedSacrificeItems.length}/{MAX_SACRIFICE_SLOTS})
                </span>
              </div>

              <div className="flex items-center gap-1">
                {eligibleSacrificeInventory.length > 0 && !isMaxClass && (
                  <button
                    type="button"
                    disabled={isSpinning}
                    onClick={handleAutoFillSacrifice}
                    className="rounded-lg border border-emerald-500/50 bg-emerald-950/70 hover:bg-emerald-900 px-2 py-1 text-[9px] font-black text-emerald-200 active:scale-95 disabled:opacity-40 cursor-pointer"
                  >
                    ⚡ Авто-подбор
                  </button>
                )}
                {selectedSacrificeItems.length > 0 && (
                  <button
                    type="button"
                    disabled={isSpinning}
                    onClick={() => setSacrificeIds([])}
                    className="rounded-lg border border-rose-500/50 bg-rose-950/70 hover:bg-rose-900 px-2 py-1 text-[9px] font-black text-rose-200 active:scale-95 disabled:opacity-40 cursor-pointer"
                  >
                    🗑️ Очистить
                  </button>
                )}
              </div>
            </div>

            {/* 6 Sacrifice Slots Grid */}
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: MAX_SACRIFICE_SLOTS }).map((_, slotIdx) => {
                const sacItem = selectedSacrificeItems[slotIdx] || null;
                const contribPct =
                  sacItem && targetItem
                    ? calculateSingleSacrificeChanceContribution(targetItem, sacItem, shopItems)
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
                    className={`relative flex h-14 flex-col items-center justify-center rounded-xl border-2 p-1 transition-all cursor-pointer ${
                      sacItem
                        ? 'border-purple-400 bg-purple-950/50 shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                        : 'border-dashed border-slate-700 bg-slate-900/60 hover:border-purple-500/60'
                    }`}
                    title={
                      sacItem
                        ? `${sacItem.name} (+${contribPct}% к шансу) — нажмите, чтобы убрать`
                        : 'Добавить предмет из магазина в качестве жертвы'
                    }
                  >
                    {sacItem ? (
                      <>
                        <div className="h-8 w-8 overflow-hidden flex items-center justify-center">
                          <ItemIcon icon={sacItem.icon} alt={sacItem.name} slot={sacItem.slot} />
                        </div>
                        <span className="mt-0.5 rounded bg-emerald-950/90 border border-emerald-400/50 px-1 text-[8px] font-black text-emerald-300 leading-none">
                          +{contribPct}%
                        </span>
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[8px] font-black text-white shadow">
                          ✕
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-slate-500">➕</span>
                        <span className="text-[7.5px] font-bold text-slate-500">Жертва</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Buttons to pick from Bag or Quick-Buy from Shop */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={isSpinning || isMaxClass}
                onClick={() => setPickerMode(pickerMode === 'sacrifice' ? 'none' : 'sacrifice')}
                className={`rounded-xl border py-1.5 px-2 text-[10px] font-black transition-all cursor-pointer ${
                  pickerMode === 'sacrifice'
                    ? 'border-purple-400 bg-purple-600 text-white shadow'
                    : 'border-purple-500/50 bg-purple-950/60 text-purple-200 hover:bg-purple-900/70'
                }`}
              >
                🎒 Выбрать из Сумки ({eligibleSacrificeInventory.length})
              </button>

              {onQuickBuyShopSacrifice && (
                <button
                  type="button"
                  disabled={isSpinning || isMaxClass}
                  onClick={() => setPickerMode(pickerMode === 'quick_shop' ? 'none' : 'quick_shop')}
                  className={`rounded-xl border py-1.5 px-2 text-[10px] font-black transition-all cursor-pointer ${
                    pickerMode === 'quick_shop'
                      ? 'border-amber-400 bg-amber-500 text-slate-950 shadow'
                      : 'border-amber-500/50 bg-amber-950/60 text-amber-200 hover:bg-amber-900/70'
                  }`}
                >
                  🛒 Купить материал в Магазине
                </button>
              )}
            </div>

            {/* Bag Sacrifice Selector */}
            {pickerMode === 'sacrifice' && (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-purple-500/50 bg-slate-950 p-2 space-y-1.5">
                <div className="text-[9.5px] font-black uppercase tracking-wider text-purple-300 px-1">
                  Доступные материалы из вашей Сумки (предметы из магазина):
                </div>
                {eligibleSacrificeInventory.length === 0 ? (
                  <div className="p-3 text-center text-[10.5px] text-slate-400">
                    В вашей сумке нет свободных предметов из магазина для жертвы. Нажмите «🛒 Купить материал в Магазине» справа!
                  </div>
                ) : (
                  eligibleSacrificeInventory.map((sacItem) => {
                    const isPicked = sacrificeIds.includes(sacItem.id);
                    const contrib = targetItem
                      ? calculateSingleSacrificeChanceContribution(targetItem, sacItem, shopItems)
                      : 0;
                    const q = getQualityConfig(sacItem.quality || 'common');
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
                            <ItemIcon icon={sacItem.icon} alt={sacItem.name} slot={sacItem.slot} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black truncate" style={{ color: q.color }}>
                              {sacItem.name} ({sacItem.lvl} ур.)
                            </div>
                            <div className="text-[9.5px] text-slate-400">
                              Цена в магазине: {sacItem.price || sacItem.lvl * 30} 🪙 • Даёт{' '}
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

            {/* Quick Shop Material Buyer right inside the Altar */}
            {pickerMode === 'quick_shop' && onQuickBuyShopSacrifice && (
              <div className="max-h-52 overflow-y-auto rounded-xl border border-amber-500/50 bg-slate-950 p-2 space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-300">
                    🛒 Купить предмет из Магазина сразу в слот Жертвы:
                  </span>
                  <span className="text-[9.5px] font-black text-amber-300">
                    Баланс: {hero.gold.toLocaleString('ru-RU')} 🪙
                  </span>
                </div>
                {shopItems
                  .filter((s) => s.enabled !== false)
                  .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
                  .map((tmpl) => {
                    const tempItem: GameItem = {
                      id: tmpl.id,
                      shopTemplateId: tmpl.id,
                      name: tmpl.name,
                      slot: tmpl.slot,
                      icon: tmpl.icon,
                      quality: tmpl.quality,
                      lvl: tmpl.lvl,
                      dmg: tmpl.dmg,
                      hp: tmpl.hp,
                      price: tmpl.price,
                      origin: 'shop'
                    };
                    const contrib = targetItem
                      ? calculateSingleSacrificeChanceContribution(targetItem, tempItem, shopItems)
                      : 0;
                    const canAfford = hero.gold >= tmpl.price;
                    return (
                      <div
                        key={tmpl.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/85 p-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-8 w-8 shrink-0 rounded-lg border border-slate-700 bg-slate-950 p-0.5 flex items-center justify-center">
                            <ItemIcon icon={tmpl.icon} alt={tmpl.name} slot={tmpl.slot} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-black text-white truncate">
                              {tmpl.name} ({tmpl.lvl} ур.)
                            </div>
                            <div className="text-[9.5px] text-slate-400">
                              Шанс на Алтаре: <strong className="text-emerald-300">+{contrib}%</strong> • Цена:{' '}
                              <strong className="text-amber-300">{tmpl.price} 🪙</strong>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!canAfford || sacrificeIds.length >= MAX_SACRIFICE_SLOTS}
                          onClick={() => {
                            const bought = onQuickBuyShopSacrifice(tmpl);
                            if (bought && sacrificeIds.length < MAX_SACRIFICE_SLOTS) {
                              setSacrificeIds((prev) => [...prev, bought.id]);
                            }
                          }}
                          className="shrink-0 rounded-lg border border-amber-400/70 bg-gradient-to-r from-amber-500 to-yellow-500 px-2.5 py-1 text-[9.5px] font-black text-slate-950 shadow hover:brightness-110 active:scale-95 disabled:opacity-40 cursor-pointer"
                        >
                          Купить (+{contrib}%)
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Burn Warning Rule */}
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-2.5 py-2 text-[9.5px] text-rose-200/90 leading-snug">
              🔥 <strong>Правило Алтаря:</strong> В качестве жертвы принимаются любые предметы из игрового магазина. При неудачной модификации <strong>жертва (расходные материалы) сгорает целиком</strong>, а улучшаемый предмет в верхнем слоте остаётся целым.
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
              ? '👑 ДОСТИГНУТ МАКСИМАЛЬНЫЙ 10 КЛАСС (+50%)'
              : selectedSacrificeItems.length === 0
              ? '➕ ДОБАВЬТЕ МАТЕРИАЛЫ В СЛОТ ЖЕРТВЫ'
              : `⚡ МОДИФИЦИРОВАТЬ ДО М${nextModClass} (+${nextModClass * 5}%) • ШАНС ${totalChancePct}%`}
          </button>
        </div>
      </div>
    </div>
  );
};
