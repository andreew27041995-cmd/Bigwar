import React, { useState, useEffect } from 'react';
import { CrystalOrder } from '../../types/game';
import {
  getCachedCrystalOrders,
  subscribeToCrystalOrders,
  initCrystalOrdersSync,
  updateCrystalOrderStatus,
  deleteCrystalOrder,
  parseTelegramContact
} from '../../utils/crystalOrders';

interface CrystalOrdersMailboxProps {
  adminNick?: string;
  showToast?: (msg: string) => void;
  compact?: boolean;
}

export const CrystalOrdersMailbox: React.FC<CrystalOrdersMailboxProps> = ({
  adminNick = 'Администратор',
  showToast,
  compact = false
}) => {
  const [orders, setOrders] = useState<CrystalOrder[]>(() => getCachedCrystalOrders());
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  useEffect(() => {
    initCrystalOrdersSync().then((initial) => {
      if (initial && initial.length > 0) {
        setOrders(initial);
      }
    });

    const unsubscribe = subscribeToCrystalOrders((latest) => {
      setOrders([...latest]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const completedCount = orders.filter((o) => o.status === 'completed').length;
  const rejectedCount = orders.filter((o) => o.status === 'rejected').length;

  const filteredOrders = orders.filter((o) => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchNick = o.playerNick.toLowerCase().includes(q);
      const matchTg = o.telegramContact.toLowerCase().includes(q);
      const matchId = o.id.toLowerCase().includes(q);
      if (!matchNick && !matchTg && !matchId) return false;
    }
    return true;
  });

  const totalPendingCrystals = orders
    .filter((o) => o.status === 'pending')
    .reduce((sum, o) => sum + o.crystals + (o.bonusCrystals || 0), 0);

  const totalPendingUsd = orders
    .filter((o) => o.status === 'pending')
    .reduce((sum, o) => sum + o.priceUsd, 0);

  const handleFulfillOrder = async (order: CrystalOrder) => {
    if (processingOrderId) return;
    setProcessingOrderId(order.id);
    try {
      const res = await updateCrystalOrderStatus(order.id, 'completed', adminNick);
      if (res.success) {
        if (showToast) {
          showToast(
            `✅ Заказ #${order.id} выполнен! Начислено ${order.crystals} 💎 игроку ${order.playerNick}.`
          );
        }
      } else {
        if (showToast) showToast(`❌ Ошибка: ${res.error || 'не удалось выполнить заказ'}`);
      }
    } catch (e: any) {
      if (showToast) showToast(`❌ Ошибка: ${e?.message || 'сбой операции'}`);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleRejectOrder = async (order: CrystalOrder) => {
    if (processingOrderId) return;
    setProcessingOrderId(order.id);
    try {
      const res = await updateCrystalOrderStatus(
        order.id,
        'rejected',
        adminNick,
        'Отклонено администратором'
      );
      if (res.success) {
        if (showToast) showToast(`Заказ #${order.id} отклонён`);
      }
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (processingOrderId) return;
    setProcessingOrderId(orderId);
    try {
      await deleteCrystalOrder(orderId);
      if (showToast) showToast('🗑️ Заказ удалён из почты');
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleCopyTelegram = (tg: string) => {
    const parsed = parseTelegramContact(tg);
    const textToCopy = parsed.display || tg;
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        if (showToast) showToast(`📋 Telegram ${textToCopy} скопирован в буфер обмена`);
      })
      .catch(() => {
        if (showToast) showToast(`Telegram: ${textToCopy}`);
      });
  };

  return (
    <div className="space-y-3">
      {/* Header & Stats Banner */}
      <div className="rounded-xl border-2 border-amber-500/50 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 p-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">📦</span>
            <div>
              <div className="text-sm font-black text-amber-300 uppercase tracking-wide">
                Почта заказов кристаллов (Администратор)
              </div>
              <div className="text-[10px] text-slate-300">
                Заказы игроков на покупку кристаллов через Telegram
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              initCrystalOrdersSync();
              if (showToast) showToast('🔄 Заказы синхронизированы с базой');
            }}
            className="rounded-lg border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/30 active:scale-95 cursor-pointer"
          >
            🔄 Синхронизировать
          </button>
        </div>

        {/* Counter cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center text-xs">
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-1.5">
            <div className="text-[9px] text-amber-300 font-bold">Ожидают связи</div>
            <div className="text-sm font-black text-amber-400">{pendingCount} шт.</div>
          </div>
          <div className="rounded-lg border border-cyan-500/40 bg-cyan-950/30 p-1.5">
            <div className="text-[9px] text-cyan-300 font-bold">Кристаллов к начислению</div>
            <div className="text-sm font-black text-cyan-300">
              {totalPendingCrystals.toLocaleString('ru-RU')} 💎
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-1.5">
            <div className="text-[9px] text-emerald-300 font-bold">Ожидаемая сумма</div>
            <div className="text-sm font-black text-emerald-400">{totalPendingUsd}$ USD</div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-1.5">
            <div className="text-[9px] text-slate-400 font-bold">Всего обработано</div>
            <div className="text-sm font-black text-slate-200">
              {completedCount} / {orders.length}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-lg px-2.5 py-1 border transition-all ${
              filter === 'all'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            Все ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`rounded-lg px-2.5 py-1 border transition-all ${
              filter === 'pending'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow'
                : 'bg-amber-950/40 text-amber-300 border-amber-500/30 hover:bg-amber-900/40'
            }`}
          >
            ⏳ Ожидают ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('completed')}
            className={`rounded-lg px-2.5 py-1 border transition-all ${
              filter === 'completed'
                ? 'bg-emerald-600 text-white border-emerald-400 font-black shadow'
                : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/40'
            }`}
          >
            ✅ Выполнены ({completedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('rejected')}
            className={`rounded-lg px-2.5 py-1 border transition-all ${
              filter === 'rejected'
                ? 'bg-rose-600 text-white border-rose-400 font-black shadow'
                : 'bg-rose-950/40 text-rose-300 border-rose-500/30 hover:bg-rose-900/40'
            }`}
          >
            ❌ Отклонённые ({rejectedCount})
          </button>
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по нику или Telegram..."
          className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] text-white outline-none focus:border-amber-400 w-full sm:w-56"
        />
      </div>

      {/* Orders List */}
      <div className={`space-y-2.5 overflow-y-auto ${compact ? 'max-h-[380px]' : 'max-h-[520px]'} pr-1`}>
        {filteredOrders.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-4 text-center text-xs text-slate-400">
            <span className="text-3xl mb-1.5">📭</span>
            <span className="font-bold text-slate-300">Заказов в этом разделе нет</span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              Когда игрок нажмёт «Заказать» в Банке и отправит заявку, она мгновенно появится здесь!
            </span>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const parsedTg = parseTelegramContact(order.telegramContact);
            const isProcessing = processingOrderId === order.id;

            return (
              <div
                key={order.id}
                className={`rounded-xl border-2 p-3 space-y-2.5 transition-all shadow-md ${
                  order.status === 'pending'
                    ? 'border-amber-400/80 bg-gradient-to-b from-amber-950/30 via-slate-900 to-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                    : order.status === 'completed'
                    ? 'border-emerald-500/50 bg-gradient-to-b from-emerald-950/20 via-slate-900 to-slate-950'
                    : 'border-slate-800 bg-slate-950/80 opacity-75'
                }`}
              >
                {/* Header: ID, Status, Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-amber-300">{order.id}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide ${
                        order.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/60 animate-pulse'
                          : order.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/60'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-400/60'
                      }`}
                    >
                      {order.status === 'pending'
                        ? '⏳ Ожидает оплаты'
                        : order.status === 'completed'
                        ? '✅ Начислено и выполнено'
                        : '❌ Отклонён'}
                    </span>
                  </div>

                  <div className="text-[9px] text-slate-400">
                    {new Date(order.createdAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>

                {/* Main Card Content */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Player info & Character skin */}
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-amber-400/60 bg-gradient-to-b from-amber-900/30 to-black p-1 shadow">
                      {order.playerAvatar &&
                      (order.playerAvatar.startsWith('data:') ||
                        order.playerAvatar.startsWith('http') ||
                        order.playerAvatar.startsWith('/')) ? (
                        <img
                          src={order.playerAvatar}
                          alt={order.playerNick}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-2xl">{order.playerAvatar || '🧙‍♂️'}</span>
                      )}
                      <span className="absolute -bottom-1 -right-1 rounded bg-black/90 px-1 text-[7px] font-black text-amber-300 border border-amber-500/40">
                        Ур.{order.playerLevel}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white">{order.playerNick}</span>
                        {order.playerClan && (
                          <span className="rounded bg-purple-950 border border-purple-500/40 px-1 py-0.2 text-[8px] font-bold text-purple-300">
                            {order.playerClan}
                          </span>
                        )}
                      </div>
                      <div className="text-[9.5px] text-slate-400">
                        Уровень персонажа: <b className="text-amber-300">{order.playerLevel}</b>
                      </div>
                    </div>
                  </div>

                  {/* Package & Price */}
                  <div className="rounded-lg border border-cyan-500/30 bg-slate-900/80 p-2 text-center sm:text-right min-w-[140px]">
                    <div className="text-xs font-black text-cyan-300">
                      {order.crystals.toLocaleString('ru-RU')} 💎 Кристаллов
                    </div>
                    {Number(order.bonusCrystals || 0) > 0 && (
                      <div className="text-[8.5px] font-bold text-emerald-400">
                        +{order.bonusCrystals} 💎 бонус
                      </div>
                    )}
                    <div className="text-[10px] text-slate-300 mt-0.5">
                      К оплате: <b className="text-emerald-400 text-xs font-black">{order.priceUsd}$ USD</b>
                    </div>
                  </div>
                </div>

                {/* Telegram Contact Box */}
                <div className="rounded-lg border border-sky-500/40 bg-sky-950/20 p-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-sky-400 font-bold">✈️ Telegram для связи:</span>
                    <span className="font-black text-white select-all bg-sky-950/80 px-2 py-0.5 rounded border border-sky-500/30">
                      {parsedTg.display || order.telegramContact}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {parsedTg.link && (
                      <a
                        href={parsedTg.link}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded bg-sky-600 hover:bg-sky-500 px-2 py-1 text-[9px] font-black text-white active:scale-95 shadow cursor-pointer flex items-center gap-1"
                      >
                        <span>💬</span>
                        <span>Написать в TG</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopyTelegram(order.telegramContact)}
                      className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[9px] font-bold text-slate-200 active:scale-95 cursor-pointer"
                    >
                      📋 Скопировать
                    </button>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-850">
                  <div className="text-[8.5px] text-slate-400">
                    {order.completedBy && (
                      <span>
                        Обработал: <b className="text-amber-300">{order.completedBy}</b>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {order.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleFulfillOrder(order)}
                          className="rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 px-3 py-1.5 text-[10px] font-black text-white shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          {isProcessing ? '⏳ Начисление...' : '💎 Зачислить кристаллы (Выполнить)'}
                        </button>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleRejectOrder(order)}
                          className="rounded-lg border border-rose-500/50 bg-rose-950/40 hover:bg-rose-900/60 px-2.5 py-1.5 text-[10px] font-bold text-rose-300 active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          ❌ Отклонить
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleDeleteOrder(order.id)}
                      className="rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 px-2 py-1.5 text-[10px] font-bold text-slate-400 hover:text-rose-400 active:scale-95 cursor-pointer"
                      title="Удалить заказ"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
