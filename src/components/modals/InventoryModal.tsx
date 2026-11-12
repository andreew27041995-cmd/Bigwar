import React, { useState } from 'react';
import { HeroState, EquippedGear, GameItem } from '../../types/game';
import { SLOT_INFO, getQualityConfig, getItemStats } from '../../utils/gameData';
import {
  getItemSellRefund,
  getItemDefaultMaxDurability,
  canRepairItem,
  isItemPermanentlyBroken,
  isCustomCreatedItem,
  canTransferCustomItem,
  canAuctionItem,
  REPAIR_COST_GOLD,
  isRelicItem,
  isTransportItem,
  formatTravelTimeText
} from '../../utils/shopConfig';
import { ItemIcon } from '../ItemIcon';
import { ELIXIR_EN_IMG, ELIXIR_HP_IMG, ELIXIR_EXP_IMG } from '../../utils/elixirAssets';

interface InventoryModalProps {
  hero: HeroState;
  equipped?: EquippedGear;
  inventory?: GameItem[];
  onClose: () => void;
  onUsePotion?: (type: 'hp' | 'en' | 'exp') => void;
  onEquipItem?: (id: string) => void;
  onEquip?: (item: GameItem) => void;
  onRepairItem?: (item: GameItem) => void;
  onRepair?: (item: GameItem) => void;
  onRepairAll?: () => void;
  onOpenTransfer?: (item: GameItem) => void;
  onOpenRent?: (item: GameItem) => void;
  onOpenAuction?: (item: GameItem) => void;
  onReturnRentEarly?: (item: GameItem) => void;
  onSellItem?: (item: GameItem) => void;
  onSell?: (item: GameItem) => void;
  onQuickSellCommon?: () => void;
  onOpenCreateItem?: () => void;
  onOpenAltar?: (item?: GameItem) => void;
  onOpenNpcBag?: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  hero,
  inventory: propInventory,
  onClose,
  onUsePotion,
  onEquipItem,
  onEquip,
  onRepairItem,
  onRepair,
  onRepairAll,
  onOpenTransfer,
  onOpenRent,
  onOpenAuction,
  onReturnRentEarly,
  onSellItem,
  onSell,
  onQuickSellCommon,
  onOpenCreateItem,
  onOpenAltar,
  onOpenNpcBag
}) => {
  const [itemToSell, setItemToSell] = useState<GameItem | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [filter, setFilter] = useState<'all' | 'weapons' | 'armors' | 'broken'>('all');
  const [sortBy, setSortBy] = useState<
    | 'default'
    | 'quality_desc'
    | 'quality_asc'
    | 'level_desc'
    | 'level_asc'
    | 'durability_desc'
    | 'durability_asc'
  >('default');

  const QUALITY_RANK: Record<string, number> = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
    mythic: 6
  };

  const items: GameItem[] = Array.isArray(propInventory)
    ? propInventory
    : Array.isArray((hero as any).inventory)
    ? (hero as any).inventory
    : [];

  const heroLvl = Math.max(1, Number(hero.level || (hero as any).lvl || 1));
  const effectiveBagCapacity = Math.max(20, Number(hero.bagCapacity || 100));

  const filteredItems = items
    .filter((it) => {
      const slot = it.slot || (it as any).type || 'weapon';
      const maxDur = Math.max(1, Number(it.maxDurability ?? getItemDefaultMaxDurability(it)));
      const curDur = Math.max(0, Math.min(maxDur, Number(it.durability ?? maxDur)));
      if (filter === 'weapons') return slot === 'weapon';
      if (filter === 'armors') return slot !== 'weapon';
      if (filter === 'broken') return curDur < maxDur;
      return true;
    })
    .slice()
    .sort((a, b) => {
      if (sortBy === 'default') return 0;

      const qA = QUALITY_RANK[a.quality || 'common'] || 1;
      const qB = QUALITY_RANK[b.quality || 'common'] || 1;
      const lvlA = Number(a.lvl || 1);
      const lvlB = Number(b.lvl || 1);

      const maxDurA = Math.max(1, Number(a.maxDurability ?? getItemDefaultMaxDurability(a)));
      const curDurA = Math.max(0, Math.min(maxDurA, Number(a.durability ?? maxDurA)));
      const pctDurA = curDurA / maxDurA;

      const maxDurB = Math.max(1, Number(b.maxDurability ?? getItemDefaultMaxDurability(b)));
      const curDurB = Math.max(0, Math.min(maxDurB, Number(b.durability ?? maxDurB)));
      const pctDurB = curDurB / maxDurB;

      if (sortBy === 'quality_desc') return qB - qA || lvlB - lvlA;
      if (sortBy === 'quality_asc') return qA - qB || lvlA - lvlB;
      if (sortBy === 'level_desc') return lvlB - lvlA || qB - qA;
      if (sortBy === 'level_asc') return lvlA - lvlB || qA - qB;
      if (sortBy === 'durability_desc') return pctDurB - pctDurA || curDurB - curDurA;
      if (sortBy === 'durability_asc') return pctDurA - pctDurB || curDurA - curDurB;
      return 0;
    });

  const playerIronOre = Math.max(0, Number(hero.portResources?.iron_ore || 0));
  const playerHardenedSteel = Math.max(0, Number(hero.portResources?.hardened_steel || 0));

  const repairableItems = items.filter(
    (it) => it && canRepairItem(it) && !it.rent && !it.isClanRented
  );
  const totalRepairAllCost = repairableItems.length * REPAIR_COST_GOLD;
  const totalIronNeeded = repairableItems.filter((it) => Number(it.lvl || 1) < 15).length;
  const totalSteelNeeded = repairableItems.filter((it) => Number(it.lvl || 1) >= 15).length;
  const canAffordRepairAll =
    hero.gold >= totalRepairAllCost &&
    playerIronOre >= totalIronNeeded &&
    playerHardenedSteel >= totalSteelNeeded;

  const commonSellableItems = items.filter(
    (it) =>
      it &&
      (it.quality || 'common') === 'common' &&
      !it.rent &&
      !it.isClanRented &&
      !(it as any).clanStorageId &&
      !isCustomCreatedItem(it)
  );
  const commonSellTotals = commonSellableItems.reduce(
    (acc, it) => {
      const ref = getItemSellRefund(it);
      acc.gold += ref.gold || 0;
      acc.crystals += ref.crystals || 0;
      return acc;
    },
    { gold: 0, crystals: 0 }
  );

  const requestConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; danger?: boolean }
  ) => {
    setPendingConfirm({
      title,
      message,
      confirmText: options?.confirmText || '✅ Подтвердить',
      danger: options?.danger ?? false,
      onConfirm
    });
  };

  const handleEquip = (item: GameItem) => {
    requestConfirm(
      '⚡ Надеть предмет',
      `Вы уверены, что хотите надеть предмет «${item.name}» (${item.lvl} ур.) на персонажа?`,
      () => {
        if (onEquipItem) onEquipItem(item.id);
        else if (onEquip) onEquip(item);
      },
      { confirmText: '⚡ Да, надеть' }
    );
  };

  const handleRepair = (item: GameItem) => {
    const maxDur = Math.max(1, Number(item.maxDurability ?? getItemDefaultMaxDurability(item)));
    const needsSteel = Number(item.lvl || 1) >= 15;
    const matLabel = needsSteel ? '1 🔩 Закаленная сталь' : '1 ⛏️ Железная руда';
    requestConfirm(
      '🔨 Ремонт предмета (Ресурсы Порта)',
      `Отремонтировать предмет «${item.name}» (${item.lvl} ур.) за ${REPAIR_COST_GOLD} 🪙 золота + ${matLabel} (прочность станет ${maxDur - 1}/${maxDur - 1})?`,
      () => {
        if (onRepairItem) onRepairItem(item);
        else if (onRepair) onRepair(item);
      },
      { confirmText: `🔨 Починить (${REPAIR_COST_GOLD} 🪙 + ${matLabel})` }
    );
  };

  const handleRepairAllClick = () => {
    if (repairableItems.length === 0) return;
    const matsDesc = [
      totalIronNeeded > 0 ? `${totalIronNeeded} ⛏️ Железной руды` : '',
      totalSteelNeeded > 0 ? `${totalSteelNeeded} 🔩 Закаленной стали` : ''
    ]
      .filter(Boolean)
      .join(' и ');
    requestConfirm(
      '🔨 Починить все предметы',
      `Вы уверены, что хотите отремонтировать все повреждённые предметы (${repairableItems.length} шт.) за ${totalRepairAllCost} 🪙 золота${matsDesc ? ` + ${matsDesc}` : ''}?`,
      () => {
        if (onRepairAll) {
          onRepairAll();
        } else {
          repairableItems.forEach((it) => {
            if (onRepairItem) onRepairItem(it);
            else if (onRepair) onRepair(it);
          });
        }
      },
      { confirmText: `🔨 Починить всё (${totalRepairAllCost} 🪙)` }
    );
  };

  const handleQuickSellCommonClick = () => {
    if (commonSellableItems.length === 0) return;
    requestConfirm(
      '⚡ Быстрая продажа обычных вещей',
      `Продать все обычные (Common) предметы из сумки (${commonSellableItems.length} шт.) за +${commonSellTotals.gold} 🪙 золота?`,
      () => {
        if (onQuickSellCommon) {
          onQuickSellCommon();
        } else {
          commonSellableItems.forEach((it) => {
            if (onSellItem) onSellItem(it);
            else if (onSell) onSell(it);
          });
        }
      },
      { confirmText: `⚡ Продать (${commonSellableItems.length} шт.)`, danger: true }
    );
  };

  const handleSellConfirm = (item: GameItem) => {
    if (onSellItem) onSellItem(item);
    else if (onSell) onSell(item);
    setItemToSell(null);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-slate-950/95 p-3 text-white">
      {itemToSell && (() => {
        const sellRefund = getItemSellRefund(itemToSell);
        const q = getQualityConfig(itemToSell.quality || 'common');
        const slotKey = (itemToSell.slot || (itemToSell as any).type || 'weapon') as keyof typeof SLOT_INFO;
        const slotInfo = SLOT_INFO[slotKey] || SLOT_INFO.weapon;
        const stats = getItemStats(itemToSell);
        const maxDur = Math.max(1, Number(itemToSell.maxDurability ?? getItemDefaultMaxDurability(itemToSell)));
        const curDur = Math.max(0, Math.min(maxDur, Number(itemToSell.durability ?? maxDur)));
        const isCustom = isCustomCreatedItem(itemToSell);
        const isRareOrHigher =
          isCustom ||
          (itemToSell.quality && itemToSell.quality !== 'common') ||
          Number(itemToSell.lvl || 1) >= 4 ||
          sellRefund.gold >= 200 ||
          sellRefund.crystals > 0;

        return (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs">
            <div
              className="w-full max-w-sm rounded-2xl border-2 bg-slate-900 p-4 text-left shadow-2xl space-y-3"
              style={{ borderColor: isRareOrHigher ? '#ef4444' : '#475569' }}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <span>{isRareOrHigher ? '⚠️ Продажа ценного предмета' : '⚖️ Подтверждение продажи'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setItemToSell(null)}
                  className="text-sm font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Item Preview Card */}
              <div
                className="flex items-center gap-3 rounded-xl border bg-slate-950/90 p-2.5"
                style={{ borderColor: q.color }}
              >
                {(() => {
                  const durPct = Math.max(0, Math.min(100, Math.round((curDur / maxDur) * 100)));
                  const isCritical = curDur <= 0 || durPct < 15;
                  const isLow = !isCritical && durPct <= 30;
                  const isMid = !isCritical && !isLow && durPct <= 60;
                  const barColor = isCritical || isLow ? '#ef4444' : isMid ? '#f59e0b' : '#10b981';
                  return (
                    <div
                      className="flex flex-col items-center gap-1 shrink-0"
                      title={`Прочность: ${curDur}/${maxDur} (${durPct}%)${isCritical ? ' — КРИТИЧЕСКИЙ ИЗНОС!' : ''}`}
                    >
                      <div className="w-12 h-12 rounded-lg border border-amber-500/40 bg-slate-900 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                        <ItemIcon
                          icon={itemToSell.icon}
                          alt={itemToSell.name}
                          slot={slotKey as any}
                          modificationClass={itemToSell.modificationClass}
                        />
                      </div>
                      <div className={`w-12 h-1.5 rounded-full bg-slate-950 border overflow-hidden p-[1px] transition-colors duration-300 ${isCritical ? 'border-red-500/90' : 'border-slate-700/90'}`}>
                        <div
                          className={`h-full rounded-full durability-progress-fill ${
                            isCritical
                              ? 'animate-critical-durability'
                              : isLow
                              ? 'shadow-[0_0_5px_rgba(239,68,68,0.85)]'
                              : isMid
                              ? 'shadow-[0_0_4px_rgba(245,158,11,0.65)]'
                              : 'shadow-[0_0_4px_rgba(16,185,129,0.65)]'
                          }`}
                          style={{
                            width: `${curDur <= 0 ? 100 : Math.max(12, durPct)}%`,
                            backgroundColor: barColor
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="text-xs font-black truncate flex items-center gap-1" style={{ color: q.color }}>
                    <span className="truncate">{itemToSell.name}</span>
                    {Number(itemToSell.modificationClass || 0) > 0 && (
                      <span className="text-amber-400 font-black text-[10px] shrink-0" title={`Модификация: ${itemToSell.modificationClass}/10 звёзд`}>
                        {'⭐'.repeat(Math.min(10, Number(itemToSell.modificationClass)))}
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-300 flex items-center gap-1.5 flex-wrap">
                    <span>{slotInfo.name}</span>
                    <span>•</span>
                    <span className="text-amber-300 font-bold">{itemToSell.lvl} ур.</span>
                    <span>•</span>
                    <span className="font-bold" style={{ color: q.color }}>
                      {isCustom ? '⚒️ Созданный' : q.name}
                    </span>
                  </div>
                  <div className="text-[9.5px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                    <span>🔧 Прочность: {curDur}/{maxDur}</span>
                    {stats.dmg > 0 && <span className="text-red-300 font-bold">⚔️ +{stats.dmg}</span>}
                    {stats.hp > 0 && <span className="text-emerald-300 font-bold">❤️ +{stats.hp}</span>}
                    {stats.dodgeBonus > 0 && <span className="text-sky-300 font-bold">💨 +{stats.dodgeBonus}%</span>}
                    {stats.energyBonus > 0 && <span className="text-cyan-300 font-bold">⚡ +{stats.energyBonus}</span>}
                  </div>
                </div>
              </div>

              {/* Rare / Valuable Warning Banner */}
              {isRareOrHigher ? (
                <div className="rounded-xl border border-red-500/70 bg-red-950/60 p-2.5 text-[10.5px] text-red-200 leading-snug">
                  <div className="font-black text-red-300 mb-0.5">
                    🛑 Внимание: ценный / редкий предмет!
                  </div>
                  Вы собираетесь продать ценный предмет{' '}
                  <strong style={{ color: q.color }}>«{itemToSell.name}» ({isCustom ? 'Созданный' : q.name}, {itemToSell.lvl} ур.)</strong>. После подтверждения предмет исчезнет навсегда и вернуть его будет нельзя!
                </div>
              ) : (
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-2 text-[10.5px] text-slate-300">
                  Вы уверены, что хотите продать этот предмет торговцу? После продажи вернуть вещь будет нельзя.
                </div>
              )}

              {/* Refund Summary */}
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/25 p-2.5 text-center text-xs">
                {sellRefund.isCustom ? (
                  <span className="font-bold text-emerald-300">
                    Возврат 70% от затрат на создание:{' '}
                    <strong className="text-sm text-emerald-200">{sellRefund.label}</strong>
                  </span>
                ) : (
                  <span className="font-bold text-amber-300">
                    Выручка от продажи (30% стоимости):{' '}
                    <strong className="text-sm text-amber-200">{sellRefund.label}</strong>
                  </span>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setItemToSell(null)}
                  className="flex-1 rounded-xl border border-slate-600 bg-slate-800 py-2 text-xs font-extrabold text-slate-200 hover:bg-slate-700 active:scale-95 cursor-pointer"
                >
                  ✕ Отмена
                </button>
                <button
                  type="button"
                  onClick={() => handleSellConfirm(itemToSell)}
                  className="flex-1 rounded-xl border border-red-400/60 bg-gradient-to-r from-red-600 to-rose-600 py-2 text-xs font-black text-white shadow-lg hover:from-red-500 hover:to-rose-500 active:scale-95 cursor-pointer"
                >
                  {isRareOrHigher ? `⚠️ Да, продать (${sellRefund.label})` : `💰 Продать (${sellRefund.label})`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div className="flex flex-col gap-1 border-b border-slate-700 pb-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-amber-400">
            🎒 Сумка ({items.length}/{effectiveBagCapacity}) • 🪙 {hero.gold.toLocaleString()} • 💎 {hero.crystals.toLocaleString()}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleRepairAllClick}
              disabled={repairableItems.length === 0 || !canAffordRepairAll}
              className={`rounded border px-2 py-0.5 text-[10px] font-extrabold transition-all ${
                repairableItems.length > 0 && canAffordRepairAll
                  ? 'border-amber-400 bg-amber-950/90 text-amber-200 hover:bg-amber-900 cursor-pointer shadow-[0_0_8px_rgba(245,158,11,0.35)]'
                  : 'border-slate-700 bg-slate-900/70 text-slate-500 cursor-not-allowed opacity-60'
              }`}
              title={
                repairableItems.length === 0
                  ? 'Все предметы в сумке имеют 100% прочности'
                  : !canAffordRepairAll
                  ? `Недостаточно золота! Требуется ${totalRepairAllCost} 🪙`
                  : `Починить все повреждённые предметы (${repairableItems.length} шт.) за ${totalRepairAllCost} 🪙`
              }
            >
              🔨 Починить всё{repairableItems.length > 0 ? ` (${repairableItems.length} шт. • ${totalRepairAllCost} 🪙)` : ' (0 🪙)'}
            </button>
            <button
              type="button"
              onClick={handleQuickSellCommonClick}
              disabled={commonSellableItems.length === 0}
              className={`rounded border px-2 py-0.5 text-[10px] font-extrabold transition-all ${
                commonSellableItems.length > 0
                  ? 'border-yellow-400 bg-yellow-950/90 text-yellow-200 hover:bg-yellow-900 cursor-pointer shadow-[0_0_8px_rgba(234,179,8,0.35)] active:scale-95'
                  : 'border-slate-700 bg-slate-900/70 text-slate-500 cursor-not-allowed opacity-60'
              }`}
              title={
                commonSellableItems.length === 0
                  ? 'В сумке нет обычных (Common) предметов для быстрой продажи'
                  : `Мгновенно продать все предметы обычного качества (${commonSellableItems.length} шт.) за +${commonSellTotals.gold} 🪙`
              }
            >
              ⚡ Быстрая продажа
              {commonSellableItems.length > 0
                ? ` (${commonSellableItems.length} об. • +${commonSellTotals.gold} 🪙)`
                : ' (0 об.)'}
            </button>
            {onOpenNpcBag && (
              <button
                onClick={onOpenNpcBag}
                className="rounded border border-emerald-400 bg-emerald-950/80 hover:bg-emerald-900 px-2 py-0.5 text-[10px] font-extrabold text-emerald-200 cursor-pointer shadow"
                title="Открыть рюкзак автономного Стража NPC"
              >
                🤖 Рюкзак NPC
              </button>
            )}
            <button onClick={onClose} className="text-base font-bold text-red-400 hover:text-red-300">
              ✕
            </button>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span>
            Ремонт: <strong className="text-amber-300">{REPAIR_COST_GOLD} 🪙</strong> +{' '}
            <strong className="text-cyan-300">1 ⛏️ Железная руда (1–10 ур.)</strong> /{' '}
            <strong className="text-fuchsia-300">1 🔩 Закаленная сталь (15–20 ур.)</strong>
          </span>
          <span>•</span>
          <span>
            У вас: <strong className="text-cyan-300">⛏️ Руда: {playerIronOre} шт.</strong> /{' '}
            <strong className="text-fuchsia-300">🔩 Сталь: {playerHardenedSteel} шт.</strong>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-2 space-y-2.5">
        {/* Potions / Elixirs Row */}
        {onUsePotion && (
          <div className="grid grid-cols-3 gap-1.5">
            <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-slate-900 p-1.5 gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <img
                  src={ELIXIR_HP_IMG}
                  alt="Эликсир Жизни"
                  className="h-6 w-6 shrink-0 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                />
                <div className="min-w-0">
                  <div className="text-[9.5px] font-bold text-red-300 truncate">Эликсир Жизни</div>
                  <div className="text-[8px] text-slate-400">+50 HP · {hero.hpPotions} шт</div>
                </div>
              </div>
              <button
                onClick={() =>
                  requestConfirm(
                    '🧪 Использовать Эликсир Жизни',
                    'Выпить Эликсир Жизни (+50 ❤️ HP)?',
                    () => onUsePotion('hp'),
                    { confirmText: '🧪 Выпить (+50 HP)' }
                  )
                }
                disabled={hero.hpPotions <= 0 || hero.hp >= hero.maxHp}
                className="shrink-0 rounded bg-red-600 px-2 py-1 text-[9px] font-bold text-white hover:bg-red-500 disabled:opacity-40"
              >
                Пить
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-sky-500/30 bg-slate-900 p-1.5 gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <img
                  src={ELIXIR_EN_IMG}
                  alt="Эликсир Энергии"
                  className="h-6 w-6 shrink-0 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                />
                <div className="min-w-0">
                  <div className="text-[9.5px] font-bold text-sky-300 truncate">Эликсир Энергии</div>
                  <div className="text-[8px] text-slate-400">+20 EN · {hero.enPotions} шт</div>
                </div>
              </div>
              <button
                onClick={() =>
                  requestConfirm(
                    '⚡ Использовать Эликсир Энергии',
                    'Выпить Эликсир Энергии (+20 ⚡ энергии)?',
                    () => onUsePotion('en'),
                    { confirmText: '⚡ Выпить (+20 EN)' }
                  )
                }
                disabled={hero.enPotions <= 0 || hero.energy >= hero.maxEnergy}
                className="shrink-0 rounded bg-sky-600 px-2 py-1 text-[9px] font-bold text-white hover:bg-sky-500 disabled:opacity-40"
              >
                Пить
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-purple-500/40 bg-slate-900 p-1.5 gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <img
                  src={ELIXIR_EXP_IMG}
                  alt="Эликсир Опыта"
                  className="h-6 w-6 shrink-0 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                />
                <div className="min-w-0">
                  <div className="text-[9.5px] font-bold text-purple-300 truncate">Эликсир Опыта</div>
                  <div className="text-[8px] text-slate-400">+25% (30м) · {hero.expPotions || 0} шт</div>
                </div>
              </div>
              <button
                onClick={() =>
                  requestConfirm(
                    '✨ Использовать Эликсир Опыта',
                    'Активировать Эликсир Опыта (+25% к опыту на 30 минут)?',
                    () => onUsePotion('exp'),
                    { confirmText: '✨ Выпить (+25% EXP)' }
                  )
                }
                disabled={Number(hero.expPotions || 0) <= 0}
                className="shrink-0 rounded bg-purple-600 px-2 py-1 text-[9px] font-bold text-white hover:bg-purple-500 disabled:opacity-40"
              >
                Пить
              </button>
            </div>
          </div>
        )}

        {/* Filter & Sort Bar */}
        <div className="flex flex-col sm:flex-row gap-1.5 items-stretch sm:items-center">
          <div className="flex flex-1 gap-1">
            {(
              [
                { id: 'all', label: 'Все' },
                { id: 'weapons', label: 'Оружие' },
                { id: 'armors', label: 'Экипировка' },
                { id: 'broken', label: 'Требует ремонта' }
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`flex-1 rounded border py-1 text-[10px] font-bold transition-colors cursor-pointer ${
                  filter === tab.id
                    ? 'border-amber-400 bg-amber-500 text-slate-950'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-2 py-0.5">
            <span className="text-[9.5px] font-bold text-slate-400 shrink-0">↕ Сортировка:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-900 text-[10px] font-bold text-amber-300 outline-none cursor-pointer py-0.5 flex-1 sm:flex-initial"
            >
              <option value="default">По умолчанию</option>
              <option value="quality_desc">✨ Качество (лучшие ↓)</option>
              <option value="quality_asc">✨ Качество (обычные ↑)</option>
              <option value="level_desc">⬆️ Уровень (выс. → низ.)</option>
              <option value="level_asc">⬇️ Уровень (низ. → выс.)</option>
              <option value="durability_desc">🔧 Прочность (целые ↓)</option>
              <option value="durability_asc">🔧 Прочность (повреждённые ↑)</option>
            </select>
          </div>
        </div>

        {/* Items List */}
        {filteredItems.length === 0 ? (
          <div className="rounded border border-dashed border-slate-700 p-6 text-center text-[11px] text-slate-400">
            В сумке нет предметов в этой категории. Загляните во вкладку «🛒 Магазин»!
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item, idx) => {
              const q = getQualityConfig(item.quality || 'common');
              const slotKey = (item.slot || (item as any).type || 'weapon') as keyof typeof SLOT_INFO;
              const slotInfo = SLOT_INFO[slotKey] || SLOT_INFO.weapon;
              const isClanRented = Boolean(item.isClanRented);
              const isClanCreated = Boolean(item.isClanCreated);
              const isPersonalRentedOut = Boolean(item.rent);
              const isRented = isPersonalRentedOut || isClanRented || isClanCreated;
              const isNotInOwnerClan =
                (isClanCreated || isClanRented) &&
                (!hero.clanId || (item.clanOwnerId ? item.clanOwnerId !== hero.clanId : false));
              const remainingMinutes = item.rent
                ? Math.max(0, Math.ceil((item.rent.until - Date.now()) / 60000))
                : 0;
              const stats = getItemStats(item);
              const maxDur = Math.max(1, Number(item.maxDurability ?? getItemDefaultMaxDurability(item)));
              const curDur = Math.max(0, Math.min(maxDur, Number(item.durability ?? maxDur)));
              const permanentlyBroken = isItemPermanentlyBroken(item);
              const repairable = canRepairItem(item);
              const sellRefund = getItemSellRefund(item);
              const isCustom = isCustomCreatedItem(item);
              const canTransfer = canTransferCustomItem(item) && !isClanRented && !isClanCreated;
              const canAuction = canAuctionItem(item) && !isClanRented && !isClanCreated;
              const ownerDisplayNick = item.ownerNick || item.creatorNick || hero.nick || 'Игрок';
              const clanDisplayName = item.clanOwnerName || hero.clanName || 'Клан';

              const durPct = Math.max(0, Math.min(100, Math.round((curDur / maxDur) * 100)));
              const isDurCritical = permanentlyBroken || curDur <= 0 || durPct < 15;
              const isDurLow = !isDurCritical && durPct <= 30;
              const isDurMid = !isDurCritical && !isDurLow && durPct <= 60;
              const durBarColor = isDurCritical || isDurLow ? '#ef4444' : isDurMid ? '#f59e0b' : '#10b981';

              return (
                <div
                  key={`${item.id}_${idx}`}
                  className="rounded-lg border bg-slate-900/90 p-2.5 shadow transition-all"
                  style={{
                    borderColor: permanentlyBroken
                      ? '#ef4444'
                      : curDur === 0
                      ? '#f59e0b'
                      : q.color
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex flex-col items-center gap-1 shrink-0"
                        title={`Прочность: ${curDur}/${maxDur} (${durPct}%)${isDurCritical ? ' — КРИТИЧЕСКАЯ ПРОЧНОСТЬ (<15%)!' : ''}`}
                      >
                        <span className="text-2xl bg-slate-950/80 w-10 h-10 rounded-lg flex items-center justify-center border border-amber-500/40 shrink-0 overflow-hidden p-0.5">
                          <ItemIcon
                            icon={item.icon}
                            alt={item.name}
                            slot={slotKey as any}
                            modificationClass={item.modificationClass}
                          />
                        </span>
                        {/* Small colored durability progress bar below item icon with smooth color transition & critical <15% red blink */}
                        <div className={`w-10 h-1.5 rounded-full bg-slate-950 border overflow-hidden p-[1px] transition-colors duration-300 ${isDurCritical ? 'border-red-500/90' : 'border-slate-700/90'}`}>
                          <div
                            className={`h-full rounded-full durability-progress-fill ${
                              isDurCritical
                                ? 'animate-critical-durability'
                                : isDurLow
                                ? 'shadow-[0_0_5px_rgba(239,68,68,0.85)]'
                                : isDurMid
                                ? 'shadow-[0_0_4px_rgba(245,158,11,0.65)]'
                                : 'shadow-[0_0_4px_rgba(16,185,129,0.65)]'
                            }`}
                            style={{
                              width: `${curDur <= 0 ? 100 : Math.max(12, durPct)}%`,
                              backgroundColor: durBarColor
                            }}
                          />
                        </div>
                        <span
                          className={`text-[8px] font-black leading-none tabular-nums transition-colors duration-300 ${
                            isDurCritical
                              ? 'text-red-400 animate-pulse'
                              : isDurLow
                              ? 'text-red-400'
                              : isDurMid
                              ? 'text-amber-300'
                              : 'text-emerald-400'
                          }`}
                        >
                          {curDur}/{maxDur}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5 flex-wrap" style={{ color: q.color }}>
                          <span>{item.name}</span>
                          {Number(item.modificationClass || 0) > 0 && (
                            <span
                              className="text-amber-400 font-black tracking-tight text-[11px] leading-none drop-shadow-[0_0_6px_rgba(250,204,21,0.7)] select-none"
                              title={`Алтарь модификации: ${item.modificationClass}/10 звёзд (+${Number(item.modificationClass) * 5}% к характеристикам)`}
                            >
                              {'⭐'.repeat(Math.min(10, Number(item.modificationClass)))}
                            </span>
                          )}
                          <span className="text-[10px] text-amber-400">({item.lvl} ур.)</span>
                          {Number(item.modificationClass || 0) > 0 && (
                            <span className="rounded bg-fuchsia-950 border border-fuchsia-400/80 px-1.5 py-0.5 text-[9px] font-black text-fuchsia-200 shadow-[0_0_8px_rgba(217,70,239,0.45)]">
                              🔮 М{item.modificationClass} (+{Number(item.modificationClass) * 5}%)
                            </span>
                          )}

                          {isClanCreated ? (
                            <span className="rounded bg-amber-950 border border-amber-400/80 px-1.5 py-0.5 text-[9px] font-black text-amber-200">
                              🏰 Клановая вещь
                            </span>
                          ) : isCustom ? (
                            <span className="rounded bg-cyan-950 border border-cyan-500/50 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">
                              ⚒️ Создано
                            </span>
                          ) : null}
                          {isClanRented && (
                            <span className="rounded bg-sky-950 border border-sky-400/70 px-1.5 py-0.5 text-[9px] font-black text-sky-200">
                              🏷️ Склад клана
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {isTransportItem(item) ? 'Транспорт' : slotInfo.name}
                          {stats.hp > 0 && (
                            <span className="text-emerald-400 font-semibold"> • ❤️ +{stats.hp} HP</span>
                          )}
                          {stats.dmg > 0 && (
                            <span className="text-red-400 font-semibold"> • ⚔️ +{stats.dmg} урона</span>
                          )}
                          {(item.str ?? 0) > 0 && (
                            <span className="text-orange-400 font-semibold"> • 💪 +{item.str} Силы</span>
                          )}
                          {(item.agi ?? 0) > 0 && (
                            <span className="text-sky-300 font-semibold"> • 💨 +{item.agi} Ловк.</span>
                          )}
                          {(item.vit ?? 0) > 0 && (
                            <span className="text-emerald-300 font-semibold"> • 🛡️ +{item.vit} Жив.</span>
                          )}
                          {stats.dodgeBonus > 0 && (
                            <span className="text-sky-400 font-semibold"> • 💨 +{stats.dodgeBonus}% укл.</span>
                          )}
                          {stats.energyBonus > 0 && (
                            <span className="text-cyan-400 font-semibold"> • ⚡ +{stats.energyBonus} энергии</span>
                          )}
                          {stats.goldBonusPct > 0 && (
                            <span className="text-yellow-400 font-semibold"> • 💰 +{stats.goldBonusPct}% золота</span>
                          )}
                          {stats.expBonusPct > 0 && (
                            <span className="text-purple-400 font-semibold"> • ✨ +{stats.expBonusPct}% опыта</span>
                          )}
                        </div>

                        {/* Ownership & Transferability description banner */}
                        {(isClanCreated || isCustom) && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {isClanCreated ? (
                              <span className="inline-flex items-center gap-1 rounded border border-amber-400/60 bg-amber-950/80 px-2 py-0.5 text-[9.5px] font-extrabold text-amber-200">
                                🏰 Создано кланом {clanDisplayName} и принадлежит клану
                              </span>
                            ) : (
                              <>
                                <span className="inline-flex items-center gap-1 rounded border border-cyan-500/50 bg-cyan-950/70 px-2 py-0.5 text-[9.5px] font-extrabold text-cyan-200">
                                  👤 Принадлежит игроку {ownerDisplayNick}
                                </span>
                                {canTransfer && (
                                  <span className="inline-flex items-center gap-1 rounded border border-emerald-400/60 bg-emerald-950/80 px-2 py-0.5 text-[9.5px] font-extrabold text-emerald-200">
                                    🤝 Эту вещь можно передать
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* Durability & Custom status badges */}
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                              permanentlyBroken
                                ? 'bg-red-950/80 border-red-500 text-red-300'
                                : curDur === 0
                                ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                                : 'bg-slate-800 border-slate-600 text-slate-200'
                            }`}
                          >
                            🔧 Прочность: {curDur}/{maxDur}
                          </span>
                          {isRelicItem(item) && (
                            <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded border bg-purple-950/90 border-purple-400/60 text-purple-200">
                              🏺 Реликвия Алтаря (Сила x{item.relicPower || 1})
                            </span>
                          )}
                          {isTransportItem(item) && (
                            <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded border bg-cyan-950/90 border-cyan-400/60 text-cyan-200">
                              🚤 Транспорт • Путь до Порта: {formatTravelTimeText(item.travelTimeSec || 600)}
                            </span>
                          )}
                          {isCustom && !isClanCreated && (
                            <>
                              {!canTransfer && (
                                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded border bg-amber-950/70 border-amber-500/50 text-amber-300">
                                  🔒 Только сам носишь
                                </span>
                              )}
                              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded border bg-slate-950 border-slate-700 text-slate-400">
                                🚫 Без аукциона
                              </span>
                            </>
                          )}
                          {permanentlyBroken && (
                            <span className="text-[9.5px] font-bold text-red-400">
                              💥 Сломан до 0/1 (ремонт и надевание недоступны, только продажа)
                            </span>
                          )}
                          {!permanentlyBroken && curDur === 0 && (
                            <span className="text-[9.5px] font-bold text-amber-300">
                              ⚠️ Сломан (0/{maxDur}). Отремонтируйте за {REPAIR_COST_GOLD} 🪙 (станет {maxDur - 1}/{maxDur - 1})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rent status callout */}
                  {isPersonalRentedOut && item.rent && onReturnRentEarly && (
                    <div
                      className={`mt-2 flex items-center justify-between rounded border px-2 py-1 text-[9px] ${
                        remainingMinutes <= 0
                          ? 'border-emerald-400/70 bg-emerald-950/35 text-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                          : 'border-amber-500/30 bg-amber-950/20 text-amber-200'
                      }`}
                    >
                      <div>
                        Арендатор: <span className="font-bold text-amber-400">{item.rent.to}</span>{' '}
                        {remainingMinutes <= 0 ? (
                          <span className="font-extrabold text-emerald-400">
                            (⏳ срок аренды истёк!)
                          </span>
                        ) : (
                          <span>(осталось ~{remainingMinutes}м)</span>
                        )}
                      </div>
                      <button
                        onClick={() => onReturnRentEarly(item)}
                        className={`rounded px-2 py-0.5 text-[8.5px] font-black transition-all active:scale-95 ${
                          remainingMinutes <= 0
                            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 animate-pulse'
                            : 'bg-amber-600/60 text-white hover:bg-amber-600'
                        }`}
                      >
                        {remainingMinutes <= 0 ? '🎒 Забрать в сумку' : 'Забрать досрочно'}
                      </button>
                    </div>
                  )}

                  {/* Actions under item */}
                  <div className="mt-2.5 flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-800">
                    {!permanentlyBroken && !isRelicItem(item) && (
                      <button
                        onClick={() => handleEquip(item)}
                        disabled={isPersonalRentedOut || isNotInOwnerClan || item.lvl > heroLvl || curDur <= 0}
                        className="flex-1 min-w-[90px] rounded bg-emerald-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-500 active:scale-95 disabled:opacity-30 cursor-pointer"
                        title={
                          isNotInOwnerClan
                            ? `Только для соклановцев клана «${clanDisplayName}»`
                            : curDur <= 0
                            ? 'Сначала отремонтируйте предмет'
                            : item.lvl > heroLvl
                            ? `Требуется ${item.lvl} уровень`
                            : isTransportItem(item)
                            ? 'Надеть транспорт в слот персонажа'
                            : 'Надеть на персонажа'
                        }
                      >
                        {isNotInOwnerClan
                          ? `⛔ Только для клана ${clanDisplayName}`
                          : curDur <= 0
                          ? '🔧 Нужен ремонт'
                          : item.lvl > heroLvl
                          ? `Нужен ${item.lvl} ур.`
                          : isTransportItem(item)
                          ? '🚤 Надеть в слот транспорта'
                          : '⚡ Надеть'}
                      </button>
                    )}

                    {repairable && (() => {
                      const needsSteel = Number(item.lvl || 1) >= 15;
                      const hasMat = needsSteel ? playerHardenedSteel >= 1 : playerIronOre >= 1;
                      const matShort = needsSteel ? '1 🔩 Сталь' : '1 ⛏️ Руда';
                      return (
                        <button
                          onClick={() => handleRepair(item)}
                          disabled={isPersonalRentedOut || hero.gold < REPAIR_COST_GOLD || !hasMat}
                          className="flex-1 min-w-[140px] rounded bg-amber-500 px-2.5 py-1.5 text-[10px] font-extrabold text-slate-950 hover:bg-amber-400 active:scale-95 disabled:opacity-40 cursor-pointer"
                          title={`Отремонтировать за ${REPAIR_COST_GOLD} золота + ${matShort} из Порта (прочность станет ${maxDur - 1}/${maxDur - 1})`}
                        >
                          🔨 Ремонт ({REPAIR_COST_GOLD} 🪙 + {matShort} → {maxDur - 1}/{maxDur - 1})
                        </button>
                      );
                    })()}

                    {!permanentlyBroken && onOpenRent && !isClanCreated && !isClanRented && (
                      <button
                        onClick={() => onOpenRent(item)}
                        disabled={isRented}
                        className="rounded bg-amber-950/80 border border-amber-500/40 px-2 py-1.5 text-[10px] font-bold text-amber-200 hover:bg-amber-900 active:scale-95 disabled:opacity-30"
                        title="Сдать предмет в аренду другому игроку"
                      >
                        🤝 В аренду
                      </button>
                    )}

                    {!permanentlyBroken && onOpenTransfer && !isClanCreated && !isClanRented && (
                      canTransfer ? (
                        <button
                          onClick={() => onOpenTransfer(item)}
                          disabled={isRented}
                          className="rounded bg-sky-950/80 border border-sky-500/40 px-2 py-1.5 text-[10px] font-bold text-sky-200 hover:bg-sky-900 active:scale-95 disabled:opacity-30"
                          title="Передать предмет другому игроку"
                        >
                          📦 Передать
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-[9.5px] font-bold text-slate-500 opacity-70 cursor-not-allowed"
                          title="При создании не была выбрана галочка «Можно передавать» — предмет нельзя передать (только носить самому, сдать в аренду или продать за 70%)"
                        >
                          🔒 Нельзя передать
                        </button>
                      )
                    )}

                    {!permanentlyBroken && onOpenAuction && canAuction && (
                      <button
                        onClick={() => onOpenAuction(item)}
                        disabled={isRented}
                        className="rounded bg-yellow-950/80 border border-yellow-500/40 px-2 py-1.5 text-[10px] font-bold text-yellow-200 hover:bg-yellow-900 active:scale-95 disabled:opacity-30"
                        title="Выставить предмет на аукцион"
                      >
                        🏛️ На аукцион
                      </button>
                    )}

                    {!isClanCreated && !isClanRented && (
                      <button
                        onClick={() => setItemToSell(item)}
                        disabled={isRented}
                        className="rounded bg-red-950/80 border border-red-500/40 px-2.5 py-1.5 text-[10px] font-bold text-red-200 hover:bg-red-900 active:scale-95 disabled:opacity-30"
                        title={
                          sellRefund.isCustom
                            ? 'Продать созданную вещь (возврат 70% от затрат)'
                            : 'Продать за 30% стоимости'
                        }
                      >
                        💰 Продать {sellRefund.isCustom ? '70% ' : ''}({sellRefund.label})
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pendingConfirm && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border-2 border-amber-400 bg-slate-950 p-4 shadow-2xl space-y-3">
            <div className="text-sm font-black text-amber-300 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{pendingConfirm.title}</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">{pendingConfirm.message}</p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const fn = pendingConfirm.onConfirm;
                  setPendingConfirm(null);
                  fn();
                }}
                className={`flex-1 rounded-xl py-2 text-xs font-black text-white shadow transition-all cursor-pointer ${
                  pendingConfirm.danger
                    ? 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500'
                }`}
              >
                {pendingConfirm.confirmText || '✅ Подтвердить'}
              </button>
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
