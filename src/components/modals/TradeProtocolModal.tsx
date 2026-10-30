import React, { useState, useEffect } from 'react';
import { TradeProtocolEntry, HeroState, GameItem } from '../../types/game';
import { getQualityConfig } from '../../utils/gameData';
import { ItemIcon } from '../ItemIcon';

interface TradeProtocolModalProps {
  hero: HeroState;
  tradeProtocol: TradeProtocolEntry[];
  inventory?: GameItem[];
  onReclaimRentItem?: (item: GameItem) => void;
  onClose: () => void;
  onClearHistory?: () => void;
}

export const TradeProtocolModal: React.FC<TradeProtocolModalProps> = ({
  tradeProtocol,
  inventory = [],
  onReclaimRentItem,
  onClose
}) => {
  const [filter, setFilter] = useState<'all' | 'rent' | 'trade' | 'purchase' | 'referral'>('all');
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const repScore = tradeProtocol.length * 10;

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Items currently rented out (either active or expired waiting to be reclaimed into bag)
  const rentedItems = React.useMemo(() => {
    return (Array.isArray(inventory) ? inventory : []).filter((it) => Boolean(it && it.rent));
  }, [inventory]);

  const expiredRentedCount = React.useMemo(() => {
    return rentedItems.filter((it) => it.rent && nowTick >= it.rent.until).length;
  }, [rentedItems, nowTick]);

  const formatRemainingRent = (until: number) => {
    const diffMs = until - nowTick;
    if (diffMs <= 0) return 'Срок истёк';
    const totalSec = Math.ceil(diffMs / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) return `${hrs}ч ${mins}м`;
    if (mins > 0) return `${mins}м ${secs}с`;
    return `${secs}с`;
  };

  // Match a protocol entry with a currently rented item in inventory (if not yet reclaimed)
  const findRentedItemForEntry = (entry: TradeProtocolEntry): GameItem | undefined => {
    if (entry.type !== 'rent_out' || entry.reclaimed) return undefined;
    if (entry.itemId) {
      return rentedItems.find((it) => it.id === entry.itemId);
    }
    if (entry.itemSnapshot?.name) {
      return rentedItems.find(
        (it) =>
          it.name === entry.itemSnapshot?.name &&
          (!entry.targetNick ||
            it.rent?.to.trim().toLowerCase() === entry.targetNick.trim().toLowerCase())
      );
    }
    return undefined;
  };

  const filteredProtocol = tradeProtocol.filter((e) => {
    if (filter === 'rent') return e.type === 'rent_out' || e.type === 'rent_return';
    if (filter === 'purchase') return e.type === 'purchase';
    if (filter === 'referral') return e.type === 'referral_bonus';
    if (filter === 'trade') return e.type !== 'purchase' && e.type !== 'referral_bonus';
    return true;
  });

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-slate-950/95 p-3 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-400">📜 Протокол Сделок & Аренда</span>
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
            {filteredProtocol.length} записей
          </span>
          {expiredRentedCount > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[8.5px] font-black text-slate-950 animate-pulse shadow-[0_0_10px_#f59e0b]">
              ⏳ Истекла аренда: {expiredRentedCount}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-base font-bold text-red-400 hover:text-red-300">
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-2 flex gap-1">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 rounded py-1 text-[9px] font-bold ${
            filter === 'all'
              ? 'bg-emerald-500 text-slate-950'
              : 'border border-slate-800 bg-slate-900 text-slate-300'
          }`}
        >
          Все ({tradeProtocol.length})
        </button>
        <button
          onClick={() => setFilter('rent')}
          className={`relative flex-1 rounded py-1 text-[9px] font-bold ${
            filter === 'rent'
              ? 'bg-yellow-500 text-slate-950'
              : expiredRentedCount > 0
              ? 'border border-amber-400 bg-amber-950/60 text-amber-200'
              : 'border border-slate-800 bg-slate-900 text-slate-300'
          }`}
        >
          🤝 Аренда {rentedItems.length > 0 ? `(${rentedItems.length})` : ''}
          {expiredRentedCount > 0 && (
            <span className="ml-1 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-600 px-1 text-[7.5px] font-black text-white animate-bounce">
              !
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter('trade')}
          className={`flex-1 rounded py-1 text-[9px] font-bold ${
            filter === 'trade'
              ? 'bg-amber-500 text-slate-950'
              : 'border border-slate-800 bg-slate-900 text-slate-300'
          }`}
        >
          Сделки
        </button>
        <button
          onClick={() => setFilter('purchase')}
          className={`flex-1 rounded py-1 text-[9px] font-bold ${
            filter === 'purchase'
              ? 'bg-cyan-500 text-slate-950'
              : 'border border-slate-800 bg-slate-900 text-slate-300'
          }`}
        >
          💳 Покупки
        </button>
        <button
          onClick={() => setFilter('referral')}
          className={`flex-1 rounded py-1 text-[9px] font-bold ${
            filter === 'referral'
              ? 'bg-purple-500 text-white'
              : 'border border-slate-800 bg-slate-900 text-slate-300'
          }`}
        >
          🎁 Рефералы
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pt-3 space-y-3">
        {/* Trust badge */}
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-2.5 shadow">
          <div>
            <div className="text-[10px] text-slate-300">Авторитет в сделках:</div>
            <div className="text-sm font-bold text-amber-300">
              ⭐ {repScore} очков репутации
            </div>
          </div>
          <div className="rounded bg-emerald-600/30 px-2 py-1 text-[9px] font-semibold text-emerald-300 border border-emerald-500/30">
            Проверенный торговец
          </div>
        </div>

        {/* Active & Expired Rentals Block — Instant Reclaim into Bag */}
        {rentedItems.length > 0 && (filter === 'all' || filter === 'rent' || filter === 'trade') && (
          <div className="rounded-xl border-2 border-amber-500/70 bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 p-2.5 space-y-2 shadow-[0_0_16px_rgba(245,158,11,0.2)]">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🤝</span>
                <span className="text-[11px] font-black uppercase tracking-wide text-amber-300">
                  Ваши предметы в аренде ({rentedItems.length})
                </span>
              </div>
              {expiredRentedCount > 0 && (
                <span className="rounded bg-emerald-500/20 border border-emerald-400/60 px-1.5 py-0.5 text-[8.5px] font-extrabold text-emerald-300">
                  Готово к возврату: {expiredRentedCount}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {rentedItems.map((item) => {
                const rent = item.rent!;
                const isExpired = nowTick >= rent.until;
                const q = getQualityConfig(item.quality || 'common');
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border p-2 transition-all ${
                      isExpired
                        ? 'border-emerald-400 bg-emerald-950/35 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                        : 'border-amber-500/40 bg-slate-900/90'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-slate-950 p-0.5 overflow-hidden text-lg"
                        style={{ borderColor: q.color }}
                      >
                        <ItemIcon icon={item.icon} alt={item.name} slot={item.slot} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-extrabold truncate" style={{ color: q.color }}>
                            {item.name}
                          </span>
                          <span className="text-[9px] text-amber-400 font-bold">({item.lvl} ур.)</span>
                        </div>
                        <div className="text-[9.5px] text-slate-300">
                          Арендатор: <strong className="text-amber-300">{rent.to}</strong> •{' '}
                          {isExpired ? (
                            <span className="font-extrabold text-emerald-400">
                              ⏳ Срок аренды истёк!
                            </span>
                          ) : (
                            <span className="text-yellow-300">
                              ⏱️ Осталось: <strong>{formatRemainingRent(rent.until)}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {onReclaimRentItem && (
                      <button
                        type="button"
                        onClick={() => onReclaimRentItem(item)}
                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[9.5px] font-black transition-all active:scale-95 cursor-pointer ${
                          isExpired
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.5)] hover:from-emerald-400 hover:to-teal-400 animate-pulse'
                            : 'border border-amber-400/70 bg-amber-600/80 text-white hover:bg-amber-500'
                        }`}
                      >
                        {isExpired ? '🎒 Забрать в сумку' : '↩️ Забрать в сумку'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* History records */}
        <div className="space-y-2">
          {filteredProtocol.length === 0 ? (
            <div className="rounded border border-dashed border-slate-700 p-8 text-center text-[11px] text-slate-400">
              В данном разделе пока нет записей.
            </div>
          ) : (
            filteredProtocol.map((entry) => {
              const isGoldTransfer = entry.type === 'gold_transfer';
              const isItemTransfer = entry.type === 'transfer_out' || entry.type === 'transfer_in';
              const matchedRentedItem = findRentedItemForEntry(entry);
              const isRentExpired = Boolean(
                matchedRentedItem?.rent && nowTick >= matchedRentedItem.rent.until
              );

              let cardStyle = 'border-slate-800 bg-slate-900/80';
              let badgeColor = 'bg-slate-700 text-slate-300';
              let badgeText = 'Сделка';

              if (isGoldTransfer) {
                cardStyle = 'border-amber-400/80 bg-gradient-to-r from-amber-950/40 to-slate-900 shadow-[0_0_12px_rgba(245,158,11,0.2)]';
                badgeColor = 'bg-amber-500 text-slate-950 font-extrabold';
                badgeText = '🪙 ПЕРЕДАЧА ЗОЛОТА';
              } else if (isItemTransfer) {
                cardStyle = 'border-sky-500/40 bg-slate-900/90';
                badgeColor = 'bg-sky-500/20 text-sky-300 border border-sky-500/40';
                badgeText = '📦 Передача предмета';
              } else if (entry.type === 'rent_out') {
                if (isRentExpired) {
                  cardStyle = 'border-emerald-400/80 bg-gradient-to-r from-emerald-950/40 to-slate-900 shadow-[0_0_12px_rgba(16,185,129,0.2)]';
                  badgeColor = 'bg-emerald-500 text-slate-950 font-extrabold';
                  badgeText = '⏳ АРЕНДА ИСТЕКЛА';
                } else {
                  cardStyle = 'border-yellow-500/40 bg-slate-900/90';
                  badgeColor = 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40';
                  badgeText = '🤝 Аренда';
                }
              } else if (entry.type === 'rent_return') {
                cardStyle = 'border-purple-500/40 bg-slate-900/90';
                badgeColor = 'bg-purple-500/20 text-purple-300 border border-purple-500/40';
                badgeText = '✅ Возврат аренды';
              } else if (entry.type === 'auction_list') {
                badgeColor = 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40';
                badgeText = 'Аукцион';
              } else if (entry.type === 'auction_buy') {
                cardStyle = 'border-emerald-500/40 bg-slate-900/90';
                badgeColor = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
                badgeText = 'Покупка';
              } else if (entry.type === 'purchase') {
                cardStyle = 'border-cyan-500/60 bg-gradient-to-r from-cyan-950/50 to-slate-900 shadow-[0_0_12px_rgba(6,182,212,0.25)]';
                badgeColor = 'bg-cyan-500 text-slate-950 font-extrabold';
                badgeText = '💳 ПОКУПКА';
              } else if (entry.type === 'referral_bonus') {
                cardStyle = 'border-purple-500/60 bg-gradient-to-r from-purple-950/50 to-slate-900 shadow-[0_0_12px_rgba(168,85,247,0.25)]';
                badgeColor = 'bg-purple-500 text-white font-extrabold';
                badgeText = '🎁 РЕФЕРАЛ';
              }

              return (
                <div
                  key={entry.id}
                  className={`rounded-lg border p-2.5 text-[10px] transition-all ${cardStyle}`}
                >
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[8px] tracking-wide ${badgeColor}`}>
                        {badgeText}
                      </span>
                      {entry.type === 'rent_out' && matchedRentedItem?.rent && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${
                            isRentExpired
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                              : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {isRentExpired
                            ? 'Готов к возврату в сумку'
                            : `Осталось: ${formatRemainingRent(matchedRentedItem.rent.until)}`}
                        </span>
                      )}
                      {entry.type === 'rent_out' && !matchedRentedItem && (
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-400">
                          ✓ Возвращён в сумку
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] font-mono text-slate-400">{entry.dateStr}</span>
                  </div>

                  {isGoldTransfer ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-200">
                          Получатель: <span className="font-bold text-amber-300">{entry.targetNick || 'Игрок'}</span>
                        </span>
                        <span className="font-extrabold text-amber-400 text-xs">
                          +{entry.amount} 🪙
                        </span>
                      </div>
                      <div className="rounded bg-black/40 p-1.5 text-slate-200 border-l-2 border-amber-400">
                        {entry.description}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-slate-200 leading-snug flex-1">{entry.description}</div>
                      {matchedRentedItem && onReclaimRentItem && (
                        <button
                          type="button"
                          onClick={() => onReclaimRentItem(matchedRentedItem)}
                          className={`shrink-0 rounded-md px-2.5 py-1.5 text-[9px] font-black transition-all active:scale-95 cursor-pointer ${
                            isRentExpired
                              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.45)]'
                              : 'bg-amber-600 text-white hover:bg-amber-500'
                          }`}
                        >
                          🎒 Забрать в сумку
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
