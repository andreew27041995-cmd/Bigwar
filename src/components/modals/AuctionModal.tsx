import React, { useState } from 'react';
import { MarketLot, GameItem, HeroState } from '../../types/game';
import { getQualityConfig, SLOT_INFO } from '../../utils/gameData';
import { ItemIcon } from '../ItemIcon';

interface AuctionModalProps {
  currentUser?: string | null;
  hero: HeroState;
  market: MarketLot[];
  inventory: GameItem[];
  onClose: () => void;
  onBuyoutLot: (lot: MarketLot) => void;
  onBidLot: (lot: MarketLot) => void;
  onCancelLot: (lot: MarketLot) => void;
  onOpenInventoryToList: () => void;
  onBuyElixir?: (type: 'hp' | 'en' | 'exp', quantity: number) => void;
  onSellElixir?: (type: 'hp' | 'en' | 'exp', quantity: number) => void;
  onListElixirLot?: (
    type: 'hp' | 'en' | 'exp',
    quantity: number,
    startPrice: number,
    buyoutPrice: number
  ) => void;
}

export const AuctionModal: React.FC<AuctionModalProps> = ({
  currentUser,
  hero,
  market,
  onClose,
  onBuyoutLot,
  onBidLot,
  onCancelLot,
  onOpenInventoryToList,
  onBuyElixir,
  onSellElixir,
  onListElixirLot
}) => {
  const [tab, setTab] = useState<'all' | 'my'>('all');
  const [selectedSlot, setSelectedSlot] = useState<string>('all');
  const [selectedQuality, setSelectedQuality] = useState<string>('all');

  // Form for listing Elixirs on the Auction
  const [showListElixirPanel, setShowListElixirPanel] = useState(false);
  const [lotElixirType, setLotElixirType] = useState<'hp' | 'en' | 'exp'>('hp');
  const [lotElixirQty, setLotElixirQty] = useState<number>(1);
  const [lotElixirStartPrice, setLotElixirStartPrice] = useState<number>(80);
  const [lotElixirBuyoutPrice, setLotElixirBuyoutPrice] = useState<number>(100);

  const myNickLower = (currentUser || '').toLowerCase();
  const myLots = market.filter((l) => l.seller.toLowerCase() === myNickLower);
  const baseLots = tab === 'my' ? myLots : market;

  const filteredLots = baseLots.filter((lot) => {
    if (selectedSlot === 'elixir') {
      if (!lot.item.isElixirLot) return false;
    } else if (selectedSlot !== 'all') {
      if (lot.item.isElixirLot || lot.item.slot !== selectedSlot) return false;
    }
    if (selectedQuality !== 'all' && lot.item.quality !== selectedQuality) return false;
    return true;
  });

  const heroGold = Number(hero.gold || 0);
  const heroCrystals = Number(hero.crystals || 0);
  const heroHpPotions = Number(hero.hpPotions || 0);
  const heroEnPotions = Number(hero.enPotions || 0);
  const heroExpPotions = Number(hero.expPotions || 0);

  const availableLotElixirCount =
    lotElixirType === 'hp'
      ? heroHpPotions
      : lotElixirType === 'en'
      ? heroEnPotions
      : heroExpPotions;

  const handleSubmitElixirLot = () => {
    if (!onListElixirLot) return;
    const qty = Math.max(1, Math.floor(lotElixirQty));
    const start = Math.max(1, Math.floor(lotElixirStartPrice));
    const buyout = Math.max(start, Math.floor(lotElixirBuyoutPrice));
    onListElixirLot(lotElixirType, qty, start, buyout);
    setShowListElixirPanel(false);
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-slate-950/95 p-3 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-amber-400">🏛️ Торговый Рынок и Аукцион</span>
          <span className="text-[9.5px] font-semibold text-amber-300">
            🪙 {heroGold} золота · <span className="text-cyan-300">💎 {heroCrystals} кр.</span>
          </span>
        </div>
        <button onClick={onClose} className="text-base font-bold text-red-400 hover:text-red-300">
          ✕
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 pt-2">
        {/* Unlimited Elixir Shop on Auction (Buy & Sell Elixirs) */}
        {onBuyElixir && (
          <div className="rounded-lg border border-emerald-500/50 bg-gradient-to-b from-emerald-950/40 via-slate-900 to-slate-900 p-2 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
              <span className="text-[10px] font-extrabold text-emerald-300">
                🧪 Лавка Эликсиров Аукциона (Покупка и Продажа)
              </span>
              <span className="text-[8.5px] font-bold text-slate-300">
                У вас: <strong className="text-red-300">❤️ {heroHpPotions} шт.</strong> ·{' '}
                <strong className="text-sky-300">⚡ {heroEnPotions} шт.</strong> ·{' '}
                <strong className="text-purple-300">✨ {heroExpPotions} шт.</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {/* Health Elixir: Buy 100 Gold / Sell 50 Gold */}
              <div className="flex flex-col justify-between rounded border border-red-500/40 bg-slate-950/80 px-2 py-1.5 gap-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-red-300">
                      🧪 Эликсир Здоровья (+50 HP)
                    </div>
                    <div className="text-[8px] text-slate-400">
                      Купить: <strong className="text-amber-400">100🪙</strong> · Продать:{' '}
                      <strong className="text-emerald-400">+50🪙</strong>
                    </div>
                  </div>
                  <span className="rounded bg-red-950/80 border border-red-500/40 px-1.5 py-0.5 text-[8.5px] font-black text-red-200">
                    В наличии: {heroHpPotions}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onBuyElixir('hp', 1)}
                      className={`rounded px-2 py-1 text-[8.5px] font-extrabold transition-all active:scale-95 cursor-pointer ${
                        heroGold >= 100
                          ? 'bg-red-600 text-white hover:bg-red-500 shadow'
                          : 'bg-slate-800 border border-slate-700 text-slate-400'
                      }`}
                    >
                      Купить 1 (100🪙)
                    </button>
                    <button
                      type="button"
                      onClick={() => onBuyElixir('hp', 5)}
                      className={`rounded px-1.5 py-1 text-[8px] font-bold transition-all active:scale-95 cursor-pointer ${
                        heroGold >= 500
                          ? 'bg-red-900/80 border border-red-500/60 text-red-200 hover:bg-red-800'
                          : 'bg-slate-800 border border-slate-700 text-slate-500'
                      }`}
                    >
                      x5
                    </button>
                  </div>
                  {onSellElixir && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={heroHpPotions < 1}
                        onClick={() => onSellElixir('hp', 1)}
                        className="rounded border border-amber-500/60 bg-amber-950/70 px-2 py-1 text-[8.5px] font-extrabold text-amber-300 hover:bg-amber-900 disabled:opacity-35 active:scale-95"
                      >
                        Продать 1 (+50🪙)
                      </button>
                      {heroHpPotions >= 5 && (
                        <button
                          type="button"
                          onClick={() => onSellElixir('hp', 5)}
                          className="rounded border border-amber-500/50 bg-amber-900/60 px-1.5 py-1 text-[8px] font-bold text-amber-200 hover:bg-amber-800 active:scale-95"
                        >
                          x5
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Energy Elixir: Buy 100 Gold / Sell 50 Gold */}
              <div className="flex flex-col justify-between rounded border border-sky-500/40 bg-slate-950/80 px-2 py-1.5 gap-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-sky-300">
                      ⚡ Эликсир Энергии (+20 EN)
                    </div>
                    <div className="text-[8px] text-slate-400">
                      Купить: <strong className="text-amber-400">100🪙</strong> · Продать:{' '}
                      <strong className="text-emerald-400">+50🪙</strong>
                    </div>
                  </div>
                  <span className="rounded bg-sky-950/80 border border-sky-500/40 px-1.5 py-0.5 text-[8.5px] font-black text-sky-200">
                    В наличии: {heroEnPotions}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onBuyElixir('en', 1)}
                      className={`rounded px-2 py-1 text-[8.5px] font-extrabold transition-all active:scale-95 cursor-pointer ${
                        heroGold >= 100
                          ? 'bg-sky-600 text-white hover:bg-sky-500 shadow'
                          : 'bg-slate-800 border border-slate-700 text-slate-400'
                      }`}
                    >
                      Купить 1 (100🪙)
                    </button>
                    <button
                      type="button"
                      onClick={() => onBuyElixir('en', 5)}
                      className={`rounded px-1.5 py-1 text-[8px] font-bold transition-all active:scale-95 cursor-pointer ${
                        heroGold >= 500
                          ? 'bg-sky-900/80 border border-sky-500/60 text-sky-200 hover:bg-sky-800'
                          : 'bg-slate-800 border border-slate-700 text-slate-500'
                      }`}
                    >
                      x5
                    </button>
                  </div>
                  {onSellElixir && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={heroEnPotions < 1}
                        onClick={() => onSellElixir('en', 1)}
                        className="rounded border border-amber-500/60 bg-amber-950/70 px-2 py-1 text-[8.5px] font-extrabold text-amber-300 hover:bg-amber-900 disabled:opacity-35 active:scale-95"
                      >
                        Продать 1 (+50🪙)
                      </button>
                      {heroEnPotions >= 5 && (
                        <button
                          type="button"
                          onClick={() => onSellElixir('en', 5)}
                          className="rounded border border-amber-500/50 bg-amber-900/60 px-1.5 py-1 text-[8px] font-bold text-amber-200 hover:bg-amber-800 active:scale-95"
                        >
                          x5
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Experience Elixir: Buy 3 Crystals / Sell 2 Crystals */}
              <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between rounded border border-purple-500/50 bg-gradient-to-r from-purple-950/60 via-slate-950/90 to-slate-950/90 px-2.5 py-1.5 gap-2">
                <div>
                  <div className="text-[10px] font-extrabold text-purple-300">
                    ✨ Эликсир Опыта (+25% к опыту на 30 мин)
                  </div>
                  <div className="text-[8px] text-slate-300">
                    Купить: <strong className="text-cyan-300">3 💎</strong> за 1 шт. · Продать:{' '}
                    <strong className="text-cyan-300">+2 💎</strong> за 1 шт.
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={() => onBuyElixir('exp', 1)}
                    className={`rounded px-2 py-1 text-[8.5px] font-extrabold transition-all active:scale-95 cursor-pointer ${
                      heroCrystals >= 3
                        ? 'bg-purple-600 text-white hover:bg-purple-500 shadow'
                        : 'bg-slate-800 border border-slate-700 text-slate-400'
                    }`}
                  >
                    Купить 1шт (3💎)
                  </button>
                  <button
                    type="button"
                    onClick={() => onBuyElixir('exp', 5)}
                    className={`rounded px-1.5 py-1 text-[8px] font-bold transition-all active:scale-95 cursor-pointer ${
                      heroCrystals >= 15
                        ? 'bg-purple-900/80 border border-purple-500/60 text-purple-200 hover:bg-purple-800'
                        : 'bg-slate-800 border border-slate-700 text-slate-500'
                    }`}
                  >
                    x5 (15💎)
                  </button>
                  {onSellElixir && (
                    <button
                      type="button"
                      disabled={heroExpPotions < 1}
                      onClick={() => onSellElixir('exp', 1)}
                      className="rounded border border-cyan-400/60 bg-cyan-950/70 px-2 py-1 text-[8.5px] font-extrabold text-cyan-200 hover:bg-cyan-900 disabled:opacity-35 active:scale-95"
                    >
                      Продать 1шт (+2💎)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs & Quick Actions (List Equipment OR List Elixirs on Player Market) */}
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex gap-1">
            <button
              onClick={() => setTab('all')}
              className={`rounded px-2.5 py-1 text-[10px] font-bold ${
                tab === 'all'
                  ? 'bg-amber-500 text-slate-950'
                  : 'border border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              Все лоты ({market.length})
            </button>
            <button
              onClick={() => setTab('my')}
              className={`rounded px-2.5 py-1 text-[10px] font-bold ${
                tab === 'my'
                  ? 'bg-amber-500 text-slate-950'
                  : 'border border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              Мои лоты ({myLots.length})
            </button>
          </div>

          <div className="flex items-center gap-1">
            {onListElixirLot && (
              <button
                type="button"
                onClick={() => setShowListElixirPanel((prev) => !prev)}
                className="rounded border border-emerald-500/60 bg-emerald-600/30 px-2 py-1 text-[9px] font-extrabold text-emerald-300 hover:bg-emerald-600/40"
              >
                🧪 + Выставить эликсиры
              </button>
            )}
            <button
              onClick={onOpenInventoryToList}
              className="rounded border border-yellow-500/50 bg-yellow-600/30 px-2 py-1 text-[9px] font-bold text-yellow-300 hover:bg-yellow-600/40"
            >
              ⚔️ + Выставить вещь
            </button>
          </div>
        </div>

        {/* Collapsible Panel: List Elixirs as Auction Lot for other players */}
        {showListElixirPanel && onListElixirLot && (
          <div className="rounded-xl border-2 border-emerald-500/60 bg-slate-900/95 p-2.5 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-emerald-300">
                🧪 Выставить партию эликсиров на торги игрокам
              </span>
              <button
                type="button"
                onClick={() => setShowListElixirPanel(false)}
                className="text-xs font-bold text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setLotElixirType('hp');
                  setLotElixirStartPrice(80);
                  setLotElixirBuyoutPrice(100);
                }}
                className={`rounded-lg border p-1.5 text-center text-[9px] font-bold ${
                  lotElixirType === 'hp'
                    ? 'border-red-400 bg-red-900/50 text-red-200'
                    : 'border-slate-800 bg-slate-950 text-slate-400'
                }`}
              >
                🧪 Здоровье ({heroHpPotions} шт.)
              </button>
              <button
                type="button"
                onClick={() => {
                  setLotElixirType('en');
                  setLotElixirStartPrice(80);
                  setLotElixirBuyoutPrice(100);
                }}
                className={`rounded-lg border p-1.5 text-center text-[9px] font-bold ${
                  lotElixirType === 'en'
                    ? 'border-sky-400 bg-sky-900/50 text-sky-200'
                    : 'border-slate-800 bg-slate-950 text-slate-400'
                }`}
              >
                ⚡ Энергия ({heroEnPotions} шт.)
              </button>
              <button
                type="button"
                onClick={() => {
                  setLotElixirType('exp');
                  setLotElixirStartPrice(250);
                  setLotElixirBuyoutPrice(350);
                }}
                className={`rounded-lg border p-1.5 text-center text-[9px] font-bold ${
                  lotElixirType === 'exp'
                    ? 'border-purple-400 bg-purple-900/50 text-purple-200'
                    : 'border-slate-800 bg-slate-950 text-slate-400'
                }`}
              >
                ✨ Опыт ({heroExpPotions} шт.)
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[8px] font-bold text-slate-400 mb-0.5">
                  Количество (макс. {availableLotElixirCount}):
                </label>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, availableLotElixirCount)}
                  value={lotElixirQty}
                  onChange={(e) =>
                    setLotElixirQty(
                      Math.max(1, Math.min(Math.max(1, availableLotElixirCount), Number(e.target.value) || 1))
                    )
                  }
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[8px] font-bold text-slate-400 mb-0.5">
                  Стартовая цена (🪙):
                </label>
                <input
                  type="number"
                  min={1}
                  value={lotElixirStartPrice}
                  onChange={(e) => setLotElixirStartPrice(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold text-amber-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-[8px] font-bold text-slate-400 mb-0.5">
                  Цена выкупа (🪙):
                </label>
                <input
                  type="number"
                  min={1}
                  value={lotElixirBuyoutPrice}
                  onChange={(e) => setLotElixirBuyoutPrice(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold text-yellow-300 outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={availableLotElixirCount < 1 || lotElixirQty < 1}
              onClick={handleSubmitElixirLot}
              className="w-full rounded-lg bg-emerald-600 py-1.5 text-[10px] font-black uppercase text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              🏛️ Выставить {lotElixirQty} шт. на Аукцион (Выкуп: {lotElixirBuyoutPrice} 🪙)
            </button>
          </div>
        )}

        {/* Filters Bar: Class / Slot & Rarity */}
        <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 p-1.5">
          <div>
            <label className="block text-[8px] uppercase tracking-wider text-slate-400 mb-0.5">
              Тип предмета:
            </label>
            <select
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-800 p-1 text-[9px] text-white outline-none"
            >
              <option value="all">Все типы</option>
              <option value="elixir">🧪 Эликсиры</option>
              <option value="weapon">⚔️ Оружие</option>
              <option value="armor">🛡️ Броня</option>
              <option value="pants">👖 Штаны</option>
              <option value="boots">👟 Сапоги</option>
              <option value="gloves">🧤 Перчатки</option>
              <option value="ring">💍 Кольца</option>
            </select>
          </div>

          <div>
            <label className="block text-[8px] uppercase tracking-wider text-slate-400 mb-0.5">
              Редкость:
            </label>
            <select
              value={selectedQuality}
              onChange={(e) => setSelectedQuality(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-800 p-1 text-[9px] text-white outline-none"
            >
              <option value="all">Все редкости</option>
              <option value="common">⚪ Обычное</option>
              <option value="rare">🔵 Редкое</option>
              <option value="epic">🟣 Эпическое</option>
              <option value="legendary">🟡 Легендарное</option>
            </select>
          </div>
        </div>

        {/* Lots List */}
        <div className="space-y-2 pb-2">
          {filteredLots.length === 0 ? (
            <div className="rounded border border-dashed border-slate-700 p-6 text-center text-[11px] text-slate-400">
              {tab === 'my'
                ? 'У вас пока нет активных лотов на аукционе.'
                : market.length === 0
                ? 'На рынке пока нет лотов. Вы можете выставить экипировку или эликсиры на продажу!'
                : 'Нет лотов, соответствующих выбранным фильтрам.'}
            </div>
          ) : (
            filteredLots.map((lot) => {
              const q = getQualityConfig(lot.item.quality);
              const slotInfo = SLOT_INFO[lot.item.slot];
              const isMyLot = lot.seller.toLowerCase() === myNickLower;
              const nextBid = Math.max(
                lot.start,
                lot.currentBid + Math.ceil(lot.currentBid * 0.1) || 5
              );
              const canAffordBid = hero.gold >= nextBid;
              const canAffordBuyout = hero.gold >= lot.buyout;
              const isElixir = Boolean(lot.item.isElixirLot);

              return (
                <div
                  key={lot.id}
                  className="rounded-lg border bg-slate-900/90 p-2.5 shadow transition-all"
                  style={{ borderColor: isElixir ? '#10b981' : q.color }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl w-10 h-10 bg-slate-950 rounded-lg flex items-center justify-center border border-slate-700 shrink-0 overflow-hidden p-0.5">
                        <ItemIcon icon={lot.item.icon} alt={lot.item.name} />
                      </span>
                      <div>
                        <div
                          className="text-xs font-bold"
                          style={{ color: isElixir ? '#34d399' : q.color }}
                        >
                          {lot.item.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {isElixir
                            ? `Партия эликсиров: ${lot.item.elixirQty || 1} шт.`
                            : `${q.name} • Ур.${lot.item.lvl} • ${slotInfo?.name || 'Экипировка'}`}
                        </div>

                        {/* Item Stats Badges */}
                        {!isElixir && (
                          <div className="mt-1 flex flex-wrap gap-1 text-[9px]">
                            {lot.item.dmg > 0 && (
                              <span className="rounded bg-red-950/60 border border-red-500/30 px-1 py-0.2 text-red-300 font-semibold">
                                +{lot.item.dmg} Урон
                              </span>
                            )}
                            {lot.item.hp > 0 && (
                              <span className="rounded bg-emerald-950/60 border border-emerald-500/30 px-1 py-0.2 text-emerald-300 font-semibold">
                                +{lot.item.hp} HP
                              </span>
                            )}
                            {(lot.item.str || 0) > 0 && (
                              <span className="rounded bg-amber-950/60 border border-amber-500/30 px-1 py-0.2 text-amber-300 font-semibold">
                                +{lot.item.str} Сила
                              </span>
                            )}
                            {(lot.item.agi || 0) > 0 && (
                              <span className="rounded bg-sky-950/60 border border-sky-500/30 px-1 py-0.2 text-sky-300 font-semibold">
                                +{lot.item.agi}% Ловк
                              </span>
                            )}
                            {(lot.item.vit || 0) > 0 && (
                              <span className="rounded bg-green-950/60 border border-green-500/30 px-1 py-0.2 text-green-300 font-semibold">
                                +{lot.item.vit} Жив
                              </span>
                            )}
                          </div>
                        )}

                        <div className="mt-1 text-[9px] text-slate-400">
                          Продавец:{' '}
                          <span className={isMyLot ? 'font-bold text-amber-300' : 'text-slate-200'}>
                            {lot.seller} {isMyLot ? '(Вы)' : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400">
                        Ставка: <span className="font-bold text-amber-300">{lot.currentBid} 🪙</span>
                      </div>
                      <div className="text-xs font-bold text-yellow-400">
                        Выкуп: {lot.buyout} 🪙
                      </div>
                      {lot.highestBidder && (
                        <div className="text-[8px] text-slate-400">
                          Лидер: {lot.highestBidder}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-slate-800 pt-1.5">
                    {isMyLot ? (
                      <button
                        onClick={() => onCancelLot(lot)}
                        className="rounded bg-red-600/80 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-red-600 active:scale-95"
                      >
                        Снять с продажи
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => onBidLot(lot)}
                          disabled={!canAffordBid}
                          className="rounded border border-amber-500/60 bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/30 disabled:opacity-30 active:scale-95"
                        >
                          Ставка {nextBid} 🪙
                        </button>

                        <button
                          onClick={() => onBuyoutLot(lot)}
                          disabled={!canAffordBuyout}
                          className="rounded bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-emerald-500 disabled:opacity-30 active:scale-95"
                        >
                          Выкупить ({lot.buyout} 🪙)
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
