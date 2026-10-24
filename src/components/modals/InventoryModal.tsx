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
  REPAIR_COST_GOLD
} from '../../utils/shopConfig';
import { ItemIcon } from '../ItemIcon';

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
  onOpenTransfer?: (item: GameItem) => void;
  onOpenRent?: (item: GameItem) => void;
  onOpenAuction?: (item: GameItem) => void;
  onReturnRentEarly?: (item: GameItem) => void;
  onSellItem?: (item: GameItem) => void;
  onSell?: (item: GameItem) => void;
  onOpenCreateItem?: () => void;
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
  onOpenTransfer,
  onOpenRent,
  onOpenAuction,
  onReturnRentEarly,
  onSellItem,
  onSell,
  onOpenCreateItem
}) => {
  const [itemToSell, setItemToSell] = useState<GameItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'weapons' | 'armors' | 'broken'>('all');

  const items: GameItem[] = Array.isArray(propInventory)
    ? propInventory
    : Array.isArray((hero as any).inventory)
    ? (hero as any).inventory
    : [];

  const heroLvl = Math.max(1, Number(hero.level || (hero as any).lvl || 1));
  const effectiveBagCapacity = Math.max(20, Number(hero.bagCapacity || 100));

  const filteredItems = items.filter((it) => {
    const slot = it.slot || (it as any).type || 'weapon';
    const maxDur = Math.max(1, Number(it.maxDurability ?? getItemDefaultMaxDurability(it.lvl)));
    const curDur = Math.max(0, Math.min(maxDur, Number(it.durability ?? maxDur)));
    if (filter === 'weapons') return slot === 'weapon';
    if (filter === 'armors') return slot !== 'weapon';
    if (filter === 'broken') return curDur < maxDur;
    return true;
  });

  const handleEquip = (item: GameItem) => {
    if (onEquipItem) onEquipItem(item.id);
    else if (onEquip) onEquip(item);
  };

  const handleRepair = (item: GameItem) => {
    if (onRepairItem) onRepairItem(item);
    else if (onRepair) onRepair(item);
  };

  const handleSellConfirm = (item: GameItem) => {
    if (onSellItem) onSellItem(item);
    else if (onSell) onSell(item);
    setItemToSell(null);
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-slate-950/95 p-3 text-white">
      {itemToSell && (() => {
        const sellRefund = getItemSellRefund(itemToSell);
        return (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-4 text-center">
              <div className="mb-4 text-sm font-bold text-slate-200">
                Продать предмет «{itemToSell.name}»?
                <br />
                {sellRefund.isCustom ? (
                  <span className="text-emerald-400">
                    Вы получите 70% от затрат на создание: {sellRefund.label}
                  </span>
                ) : (
                  <span className="text-amber-400">
                    Вы получите 30% стоимости: {sellRefund.label} золота
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSellConfirm(itemToSell)}
                  className="flex-1 rounded bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-500"
                >
                  Продать ({sellRefund.label})
                </button>
                <button
                  onClick={() => setItemToSell(null)}
                  className="flex-1 rounded bg-slate-700 py-2 text-sm font-bold text-white hover:bg-slate-600"
                >
                  Отмена
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
          <div className="flex items-center gap-2">
            {onOpenCreateItem && (
              <button
                onClick={onOpenCreateItem}
                className="rounded border border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 px-2 py-0.5 text-[10px] font-extrabold text-cyan-200 cursor-pointer"
              >
                ⚒️ Создать оружие
              </button>
            )}
            <button onClick={onClose} className="text-base font-bold text-red-400 hover:text-red-300">
              ✕
            </button>
          </div>
        </div>
        <div className="text-[10px] text-slate-400">
          Ремонт: <strong className="text-amber-300">{REPAIR_COST_GOLD} 🪙</strong> • Продажа обычных вещей: <strong className="text-amber-300">30%</strong> • Продажа своих созданных вещей: <strong className="text-emerald-300">70% от затрат</strong>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-2 space-y-2.5">
        {/* Potions / Elixirs Row */}
        {onUsePotion && (
          <div className="grid grid-cols-3 gap-1.5">
            <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-slate-900 p-1.5 gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-base shrink-0">🧪</span>
                <div className="min-w-0">
                  <div className="text-[9.5px] font-bold text-red-300 truncate">Зелье HP</div>
                  <div className="text-[8px] text-slate-400">+50 HP · {hero.hpPotions} шт</div>
                </div>
              </div>
              <button
                onClick={() => onUsePotion('hp')}
                disabled={hero.hpPotions <= 0 || hero.hp >= hero.maxHp}
                className="shrink-0 rounded bg-red-600 px-2 py-1 text-[9px] font-bold text-white hover:bg-red-500 disabled:opacity-40"
              >
                Пить
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-sky-500/30 bg-slate-900 p-1.5 gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-base shrink-0">⚡</span>
                <div className="min-w-0">
                  <div className="text-[9.5px] font-bold text-sky-300 truncate">Зелье EN</div>
                  <div className="text-[8px] text-slate-400">+20 EN · {hero.enPotions} шт</div>
                </div>
              </div>
              <button
                onClick={() => onUsePotion('en')}
                disabled={hero.enPotions <= 0 || hero.energy >= hero.maxEnergy}
                className="shrink-0 rounded bg-sky-600 px-2 py-1 text-[9px] font-bold text-white hover:bg-sky-500 disabled:opacity-40"
              >
                Пить
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-purple-500/40 bg-slate-900 p-1.5 gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-base shrink-0">✨</span>
                <div className="min-w-0">
                  <div className="text-[9.5px] font-bold text-purple-300 truncate">Эликсир Опыта</div>
                  <div className="text-[8px] text-slate-400">+25% (30м) · {hero.expPotions || 0} шт</div>
                </div>
              </div>
              <button
                onClick={() => onUsePotion('exp')}
                disabled={Number(hero.expPotions || 0) <= 0}
                className="shrink-0 rounded bg-purple-600 px-2 py-1 text-[9px] font-bold text-white hover:bg-purple-500 disabled:opacity-40"
              >
                Пить
              </button>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex gap-1">
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
              className={`flex-1 rounded border py-1 text-[10px] font-bold transition-colors ${
                filter === tab.id
                  ? 'border-amber-400 bg-amber-500 text-slate-950'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Items List */}
        {filteredItems.length === 0 ? (
          <div className="rounded border border-dashed border-slate-700 p-6 text-center text-[11px] text-slate-400">
            В сумке нет предметов в этой категории. Загляните во вкладку «🛒 Магазин»!
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item) => {
              const q = getQualityConfig(item.quality || 'common');
              const slotKey = (item.slot || (item as any).type || 'weapon') as keyof typeof SLOT_INFO;
              const slotInfo = SLOT_INFO[slotKey] || SLOT_INFO.weapon;
              const isClanRented = Boolean(item.isClanRented);
              const isRented = Boolean(item.rent) || isClanRented;
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
              const canTransfer = canTransferCustomItem(item) && !isClanRented;
              const canAuction = canAuctionItem(item) && !isClanRented;

              return (
                <div
                  key={item.id}
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
                      <span className="text-2xl bg-slate-950/80 w-10 h-10 rounded-lg flex items-center justify-center border border-slate-700 shrink-0 overflow-hidden p-0.5">
                        <ItemIcon icon={item.icon} alt={item.name} />
                      </span>
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5 flex-wrap" style={{ color: q.color }}>
                          <span>{item.name}</span>
                          <span className="text-[10px] text-amber-400">({item.lvl} ур.)</span>
                          {isCustom && (
                            <span className="rounded bg-cyan-950 border border-cyan-500/50 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">
                              ⚒️ Создано
                            </span>
                          )}
                          {isClanRented && (
                            <span className="rounded bg-sky-950 border border-sky-400/70 px-1.5 py-0.5 text-[9px] font-black text-sky-200">
                              🏷️ Аренда со склада клана
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {slotInfo.name}
                          {stats.hp > 0 && (
                            <span className="text-emerald-400 font-semibold"> • ❤️ +{stats.hp} HP</span>
                          )}
                          {stats.dmg > 0 && (
                            <span className="text-red-400 font-semibold"> • ⚔️ +{stats.dmg} урона</span>
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
                          {isCustom && (
                            <>
                              <span
                                className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${
                                  canTransfer
                                    ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                                    : 'bg-amber-950/70 border-amber-500/50 text-amber-300'
                                }`}
                              >
                                {canTransfer ? '🤝 Можно передавать' : '🔒 Только сам носишь'}
                              </span>
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
                  {isRented && item.rent && onReturnRentEarly && (
                    <div className="mt-2 flex items-center justify-between rounded border border-amber-500/30 bg-amber-950/20 px-2 py-1 text-[9px] text-amber-200">
                      <div>
                        Арендатор: <span className="font-bold text-amber-400">{item.rent.to}</span>{' '}
                        (осталось ~{remainingMinutes}м)
                      </div>
                      <button
                        onClick={() => onReturnRentEarly(item)}
                        className="rounded bg-amber-600/60 px-1.5 py-0.5 text-[8px] font-bold text-white hover:bg-amber-600"
                      >
                        Забрать досрочно
                      </button>
                    </div>
                  )}

                  {/* Actions under item */}
                  <div className="mt-2.5 flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-800">
                    {!permanentlyBroken && (
                      <button
                        onClick={() => handleEquip(item)}
                        disabled={isRented || item.lvl > heroLvl || curDur <= 0}
                        className="flex-1 min-w-[90px] rounded bg-emerald-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-500 active:scale-95 disabled:opacity-30"
                        title={
                          curDur <= 0
                            ? 'Сначала отремонтируйте предмет'
                            : item.lvl > heroLvl
                            ? `Требуется ${item.lvl} уровень`
                            : 'Надеть на персонажа'
                        }
                      >
                        {curDur <= 0
                          ? '🔧 Нужен ремонт'
                          : item.lvl > heroLvl
                          ? `Нужен ${item.lvl} ур.`
                          : '⚡ Надеть'}
                      </button>
                    )}

                    {repairable && (
                      <button
                        onClick={() => handleRepair(item)}
                        disabled={isRented || hero.gold < REPAIR_COST_GOLD}
                        className="flex-1 min-w-[120px] rounded bg-amber-500 px-2.5 py-1.5 text-[10px] font-extrabold text-slate-950 hover:bg-amber-400 active:scale-95 disabled:opacity-40"
                        title={`Отремонтировать за ${REPAIR_COST_GOLD} золота (прочность станет ${maxDur - 1}/${maxDur - 1})`}
                      >
                        🔨 Ремонтировать ({REPAIR_COST_GOLD} 🪙 → {maxDur - 1}/{maxDur - 1})
                      </button>
                    )}

                    {!permanentlyBroken && onOpenRent && (
                      <button
                        onClick={() => onOpenRent(item)}
                        disabled={isRented}
                        className="rounded bg-amber-950/80 border border-amber-500/40 px-2 py-1.5 text-[10px] font-bold text-amber-200 hover:bg-amber-900 active:scale-95 disabled:opacity-30"
                        title="Сдать предмет в аренду другому игроку"
                      >
                        🤝 В аренду
                      </button>
                    )}

                    {!permanentlyBroken && onOpenTransfer && (
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
