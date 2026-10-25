import React, { useState, useEffect } from 'react';
import { HeroState, FriendEntry } from '../../types/game';

interface DirectTransferModalProps {
  hero: HeroState;
  friends: FriendEntry[];
  prefillNick?: string;
  onClose: () => void;
  onExecuteTransfer: (targetNick: string, goldAmount: number, description: string) => void;
}

const PRESET_COMMENTS = [
  'Подарок другу 🎁',
  'За помощь в бою ⚔️',
  'Возврат долга 🤝',
  'Оплата услуг 💼',
  'На прокачку снаряжения 🛡️'
];

export const DirectTransferModal: React.FC<DirectTransferModalProps> = ({
  hero,
  friends,
  prefillNick = '',
  onClose,
  onExecuteTransfer
}) => {
  const [nick, setNick] = useState(prefillNick);
  const [amount, setAmount] = useState(50);
  const [description, setDescription] = useState('Подарок другу 🎁');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (prefillNick) {
      setNick(prefillNick);
    }
  }, [prefillNick]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = nick.trim();
    if (!cleanNick) {
      setErrorMsg('Укажите ник получателя!');
      return;
    }
    if (hero.nick && cleanNick.toLowerCase() === hero.nick.toLowerCase()) {
      setErrorMsg('Нельзя переводить золото самому себе!');
      return;
    }
    if (amount <= 0) {
      setErrorMsg('Сумма перевода должна быть больше нуля!');
      return;
    }
    if (amount > hero.gold) {
      setErrorMsg(`Недостаточно золота! У вас всего ${hero.gold} 🪙`);
      return;
    }

    const cleanDesc = description.trim() || 'Перевод золота';
    onExecuteTransfer(cleanNick, amount, cleanDesc);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-slate-950/95 p-3 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <span className="text-xs font-bold text-amber-400">🤝 Передача Золота Игроку</span>
        <button onClick={onClose} className="text-base font-bold text-red-400 hover:text-red-300">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pt-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-2.5 text-[11px] text-amber-200">
            Перевод будет мгновенно зафиксирован в <b>Протоколе Сделок</b> с вашим описанием и суммой!
          </div>

          {errorMsg && (
            <div className="rounded bg-red-900/70 p-2 text-center text-[10px] font-semibold text-red-200">
              {errorMsg}
            </div>
          )}

          {/* Nick input */}
          <div>
            <label className="text-[10px] font-semibold text-slate-300">Ник получателя:</label>
            <input
              type="text"
              value={nick}
              onChange={(e) => {
                setNick(e.target.value);
                setErrorMsg('');
              }}
              placeholder="Введите никнейм игрока..."
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 p-2 text-xs text-white outline-none focus:border-amber-400"
              autoFocus={!prefillNick}
            />

            {/* Quick friend select chips */}
            {friends.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="text-[9px] text-slate-400 self-center">Друзья:</span>
                {friends.map((f) => (
                  <button
                    key={f.nick}
                    type="button"
                    onClick={() => {
                      setNick(f.nick);
                      setErrorMsg('');
                    }}
                    className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${
                      nick === f.nick
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {f.avatar} {f.nick}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Amount input */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-300">
              <span className="font-semibold">Сумма золота:</span>
              <span className="text-amber-400 font-bold">У вас: {hero.gold} 🪙</span>
            </div>
            <div className="relative mt-1">
              <input
                type="number"
                min={1}
                max={hero.gold}
                value={amount}
                onChange={(e) => {
                  setAmount(Math.max(1, parseInt(e.target.value) || 0));
                  setErrorMsg('');
                }}
                className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-xs text-amber-300 outline-none focus:border-amber-400"
              />
              <span className="absolute right-2 top-2 text-xs">🪙</span>
            </div>

            {/* Quick amount chips */}
            <div className="mt-1.5 flex gap-1.5">
              {[25, 50, 100, 250].map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setAmount(quick)}
                  disabled={hero.gold < quick}
                  className={`flex-1 rounded border py-1 text-[10px] font-bold ${
                    amount === quick
                      ? 'border-amber-400 bg-amber-500 text-slate-950'
                      : 'border-slate-700 bg-slate-800 text-amber-300 hover:border-amber-500'
                  } disabled:opacity-30`}
                >
                  {quick} 🪙
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount(hero.gold)}
                disabled={hero.gold <= 0}
                className="rounded border border-amber-500/60 bg-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/30 disabled:opacity-30"
              >
                ВСЁ ({hero.gold})
              </button>
            </div>
          </div>

          {/* Description / Comment input */}
          <div>
            <label className="text-[10px] font-semibold text-slate-300">
              Описание перевода (отобразится в протоколе):
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Введите цель или причину перевода..."
              maxLength={80}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 p-2 text-xs text-white outline-none focus:border-amber-400"
            />

            {/* Quick preset comments */}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {PRESET_COMMENTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDescription(preset)}
                  className={`rounded border px-1.5 py-0.5 text-[8px] transition-colors ${
                    description === preset
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={hero.gold <= 0}
              className="w-full rounded bg-gradient-to-r from-amber-600 to-yellow-600 py-2.5 text-xs font-bold text-white shadow-lg hover:from-amber-500 hover:to-yellow-500 active:scale-95 disabled:opacity-40"
            >
              Отправить {amount} 🪙 игроку {nick || '...'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
