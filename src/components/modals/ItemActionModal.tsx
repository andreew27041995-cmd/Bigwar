import React, { useState } from 'react';
import { GameItem, FriendEntry } from '../../types/game';
import { getQualityConfig } from '../../utils/gameData';
import { canAuctionItem, canTransferCustomItem } from '../../utils/shopConfig';
import { ItemIcon } from '../ItemIcon';

interface ItemActionModalProps {
  item: GameItem | null;
  mode: 'transfer' | 'rent' | 'auction' | null;
  friends: FriendEntry[];
  onClose: () => void;
  onConfirmTransfer: (itemId: string, targetNick: string) => void;
  onConfirmRent: (itemId: string, targetNick: string, hours: number, price: number) => void;
  onConfirmAuction: (itemId: string, startPrice: number, buyoutPrice: number) => void;
}

export const ItemActionModal: React.FC<ItemActionModalProps> = ({
  item,
  mode,
  friends,
  onClose,
  onConfirmTransfer,
  onConfirmRent,
  onConfirmAuction
}) => {
  if (!item || !mode) return null;

  const quality = getQualityConfig(item.quality);
  const [targetNick, setTargetNick] = useState('');
  const [rentHours, setRentHours] = useState(2);
  const [rentPrice, setRentPrice] = useState(100);
  const [auctionStart, setAuctionStart] = useState(100);
  const [auctionBuyout, setAuctionBuyout] = useState(250);
  const [errorMsg, setErrorMsg] = useState('');

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canTransferCustomItem(item)) {
      setErrorMsg('Это созданное оружие нельзя передавать (при создании не выбрана галочка передачи)!');
      return;
    }
    const cleanNick = targetNick.trim();
    if (!cleanNick) {
      setErrorMsg('Введите ник игрока!');
      return;
    }
    // self check handled by server/transfer logic
    onConfirmTransfer(item.id, cleanNick);
    onClose();
  };

  const handleRentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = targetNick.trim();
    if (!cleanNick) {
      setErrorMsg('Введите ник арендатора!');
      return;
    }
    // self check handled by server/rent logic
    if (rentHours < 1 || rentHours > 72) {
      setErrorMsg('Время аренды от 1 до 72 часов!');
      return;
    }
    if (rentPrice < 10) {
      setErrorMsg('Минимальная цена аренды 10 золота!');
      return;
    }
    onConfirmRent(item.id, cleanNick, rentHours, rentPrice);
    onClose();
  };

  const handleAuctionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAuctionItem(item)) {
      setErrorMsg('Созданное оружие нельзя продать на аукционе! Его можно только продать (за 70%), сдать в аренду или носить самому.');
      return;
    }
    if (auctionStart < 10) {
      setErrorMsg('Начальная цена минимум 10 золота!');
      return;
    }
    if (auctionBuyout < auctionStart) {
      setErrorMsg('Цена выкупа не может быть ниже начальной цены!');
      return;
    }
    onConfirmAuction(item.id, auctionStart, auctionBuyout);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded-lg border-2 border-amber-500/80 bg-slate-900 p-4 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 pb-2">
          <div className="text-xs font-bold text-amber-400">
            {mode === 'transfer' && '📦 Передача предмета'}
            {mode === 'rent' && '🤝 Сдача предмета в аренду'}
            {mode === 'auction' && '🏛️ Выставить на аукцион'}
          </div>
          <button
            onClick={onClose}
            className="text-base font-bold text-red-400 hover:text-red-300"
          >
            ✕
          </button>
        </div>

        {/* Item preview */}
        <div
          className="my-3 flex items-center gap-3 rounded border p-2.5"
          style={{ borderColor: quality.color, backgroundColor: 'rgba(15, 23, 42, 0.7)' }}
        >
          <div className="text-2xl w-10 h-10 bg-slate-950 rounded-lg flex items-center justify-center border border-slate-700 shrink-0 overflow-hidden p-0.5">
            <ItemIcon icon={item.icon} alt={item.name} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold" style={{ color: quality.color }}>
              {item.name}
            </div>
            <div className="text-[10px] text-slate-400">
              {quality.name} • Ур.{item.lvl}
              {item.dmg > 0 && ` • +${item.dmg} Урон`}
              {item.hp > 0 && ` • +${item.hp} HP`}
              {(item.str || 0) > 0 && ` • +${item.str} Сила`}
              {(item.agi || 0) > 0 && ` • +${item.agi}% Ловк`}
              {(item.vit || 0) > 0 && ` • +${item.vit} Жив`}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-2 rounded bg-red-900/60 p-1.5 text-center text-[10px] font-semibold text-red-300">
            {errorMsg}
          </div>
        )}

        {/* TRANSFER FORM */}
        {mode === 'transfer' && (
          <form onSubmit={handleTransferSubmit} className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-300">Ник получателя:</label>
              <input
                type="text"
                value={targetNick}
                onChange={(e) => {
                  setTargetNick(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Введите никнейм игрока..."
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 p-2 text-xs text-white outline-none focus:border-amber-400"
                autoFocus
              />
            </div>

            {/* Quick friend select */}
            {friends.length > 0 && (
              <div>
                <div className="mb-1 text-[9px] text-slate-400">Выбрать из друзей:</div>
                <div className="flex flex-wrap gap-1">
                  {friends.map((f) => (
                    <button
                      key={f.nick}
                      type="button"
                      onClick={() => {
                        setTargetNick(f.nick);
                        setErrorMsg('');
                      }}
                      className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[9px] text-amber-200 hover:border-amber-400"
                    >
                      {f.avatar} {f.nick}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                className="w-full rounded bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-500 active:scale-95"
              >
                Отправить игроку
              </button>
            </div>
          </form>
        )}

        {/* RENT FORM */}
        {mode === 'rent' && (
          <form onSubmit={handleRentSubmit} className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-300">Ник арендатора:</label>
              <input
                type="text"
                value={targetNick}
                onChange={(e) => {
                  setTargetNick(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Ник игрока"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 p-2 text-xs text-white outline-none focus:border-amber-400"
                autoFocus
              />
            </div>

            {friends.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {friends.map((f) => (
                  <button
                    key={f.nick}
                    type="button"
                    onClick={() => {
                      setTargetNick(f.nick);
                      setErrorMsg('');
                    }}
                    className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] text-amber-200"
                  >
                    {f.avatar} {f.nick}
                  </button>
                ))}
              </div>
            )}

            <div>
              <label className="text-[10px] text-slate-300">Срок аренды (часов):</label>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {[1, 2, 4, 8, 12, 24].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setRentHours(h)}
                    className={`rounded border p-1 text-[10px] font-bold ${
                      rentHours === h
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-slate-700 bg-slate-800 text-slate-400'
                    }`}
                  >
                    {h} ч.
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-300">
                Плата за аренду (вы получите сразу):
              </label>
              <div className="relative mt-1">
                <input
                  type="number"
                  min={10}
                  step={10}
                  value={rentPrice}
                  onChange={(e) => setRentPrice(Math.max(10, parseInt(e.target.value) || 0))}
                  className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-xs text-amber-300 outline-none focus:border-amber-400"
                />
                <span className="absolute right-2 top-2 text-xs">🪙</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full rounded bg-amber-600 py-2 text-xs font-bold text-white hover:bg-amber-500 active:scale-95"
              >
                Оформить аренду (+{rentPrice}🪙)
              </button>
            </div>
          </form>
        )}

        {/* AUCTION FORM */}
        {mode === 'auction' && (
          <form onSubmit={handleAuctionSubmit} className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-300">Стартовая ставка (🪙):</label>
              <input
                type="number"
                min={10}
                step={10}
                value={auctionStart}
                onChange={(e) => setAuctionStart(Math.max(10, parseInt(e.target.value) || 0))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 p-2 text-xs text-amber-300 outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-300">Цена немедленного выкупа (🪙):</label>
              <input
                type="number"
                min={auctionStart}
                step={10}
                value={auctionBuyout}
                onChange={(e) => setAuctionBuyout(Math.max(auctionStart, parseInt(e.target.value) || 0))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 p-2 text-xs text-amber-300 outline-none focus:border-amber-400"
              />
            </div>

            <div className="text-[9px] text-slate-400">
              ℹ️ Лот будет размещен на рынке. Другие игроки смогут делать ставки или сразу выкупить.
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full rounded bg-yellow-600 py-2 text-xs font-bold text-slate-950 hover:bg-yellow-500 active:scale-95"
              >
                Выставить на аукцион
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
