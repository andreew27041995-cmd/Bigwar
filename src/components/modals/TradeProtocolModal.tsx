import React, { useState } from 'react';
import { TradeProtocolEntry, HeroState } from '../../types/game';

interface TradeProtocolModalProps {
  hero: HeroState;
  tradeProtocol: TradeProtocolEntry[];
  onClose: () => void;
  onClearHistory?: () => void;
}

export const TradeProtocolModal: React.FC<TradeProtocolModalProps> = ({
  tradeProtocol,
  onClose
}) => {
  const [filter, setFilter] = useState<'all' | 'trade' | 'purchase' | 'referral'>('all');
  const repScore = tradeProtocol.length * 10;

  const filteredProtocol = tradeProtocol.filter((e) => {
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
          <span className="text-xs font-bold text-emerald-400">📜 Протокол & Покупки</span>
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
            {filteredProtocol.length} записей
          </span>
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
              const isRent = entry.type === 'rent_out' || entry.type === 'rent_return';

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
                cardStyle = 'border-yellow-500/40 bg-slate-900/90';
                badgeColor = 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40';
                badgeText = '🤝 Аренда';
              } else if (entry.type === 'rent_return') {
                badgeColor = 'bg-purple-500/20 text-purple-300 border border-purple-500/40';
                badgeText = 'Возврат аренды';
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
                    <span className={`rounded px-1.5 py-0.5 text-[8px] tracking-wide ${badgeColor}`}>
                      {badgeText}
                    </span>
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
                    <div className="text-slate-200 leading-snug">{entry.description}</div>
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
