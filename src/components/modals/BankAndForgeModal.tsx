import React, { useState } from 'react';
import { HeroState, GameItem, EquippedGear, GameFeatureFlags, BankPackageConfig, CrystalOrder } from '../../types/game';
import { getPremiumConfig, getBankPackages } from '../../utils/shopConfig';
import { GoldCoinIcon, CrystalIcon } from '../CurrencyIcon';
import { createCrystalOrder, parseTelegramContact } from '../../utils/crystalOrders';

interface BankAndForgeModalProps {
  hero: HeroState;
  equipped?: EquippedGear;
  inventory?: GameItem[];
  onClose: () => void;
  onAddCrystals?: (amount: number, packageName: string, priceUsd: number) => void;
  onExchangeGoldToCrystals: (goldAmount: number, crystalGain: number) => void;
  onForgeItem?: (newItem: GameItem, costGold: number, costCrystals: number) => void;
  onBuyPremium?: (currency?: 'crystals' | 'gold') => void;
  onOpenMail?: () => void;
  showToast?: (msg: string) => void;
  exchangeDisabled?: boolean;
  premiumDisabled?: boolean;
  featureFlags?: GameFeatureFlags;
}

export const BankAndForgeModal: React.FC<BankAndForgeModalProps> = ({
  hero,
  onClose,
  onAddCrystals,
  onExchangeGoldToCrystals,
  onBuyPremium,
  onOpenMail,
  showToast,
  exchangeDisabled = false,
  premiumDisabled = false,
  featureFlags
}) => {
  const [exchangeBanner, setExchangeBanner] = useState<{
    success: boolean;
    text: string;
    ts: number;
  } | null>(null);
  const [selectedPack, setSelectedPack] = useState<BankPackageConfig | null>(null);

  // Crystal Order Form states
  const [telegramContact, setTelegramContact] = useState<string>(() => {
    try {
      return localStorage.getItem('pyramid_player_telegram') || '';
    } catch (e) {
      return '';
    }
  });
  const [orderQuantity, setOrderQuantity] = useState<number>(100);
  const [orderPriceUsd, setOrderPriceUsd] = useState<number>(1);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [submittedOrder, setSubmittedOrder] = useState<CrystalOrder | null>(null);

  const premCfg = getPremiumConfig(featureFlags);
  const isPremDisabled = premiumDisabled || !premCfg.enabled;
  const isPremActive = Boolean(hero.isPremium && hero.premiumUntil && hero.premiumUntil > Date.now());
  const remainingPremMinutes =
    isPremActive && hero.premiumUntil
      ? Math.max(0, Math.ceil((hero.premiumUntil - Date.now()) / 60000))
      : 0;

  const bankPurchaseOpen = featureFlags?.bankPurchaseEnabled !== false;
  const bankPackages = getBankPackages(featureFlags).filter((p) => p.enabled !== false);
  const bankInstructions =
    featureFlags?.bankPaymentInstructions ||
    'Для покупки кристаллов выберите нужный пакет и свяжитесь с Администратором в чате или по указанным реквизитам.';
  const bankPaymentUrl = featureFlags?.bankPaymentUrl || '';

  const crystalToGoldRate = Math.max(1, Number(featureFlags?.crystalToGoldRate || 1000));
  const goldToCrystalRate = Math.max(1, Number(featureFlags?.goldToCrystalRate || 2000));
  const crystalLimitMax = Math.max(1, Number(featureFlags?.dailyCrystalToGoldLimit || 3));
  const goldLimitMax = Math.max(1, Number(featureFlags?.dailyGoldToCrystalLimit || 3));
  const isCrystalToGoldOpen = featureFlags?.crystalToGoldEnabled !== false;
  const isGoldToCrystalOpen = featureFlags?.goldToCrystalEnabled !== false;
  const isAdminUser =
    hero.role === 'admin' ||
    Number((hero as any).is_admin) === 1 ||
    String(hero.nick || '').trim().toLowerCase() === 'redblack';

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-slate-950/95 p-3 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <span className="text-xs sm:text-sm font-black text-cyan-300 flex items-center gap-1.5">
          <span>🏦</span>
          <span>Банк Кристаллов и Биржа Валют</span>
        </span>
        <button onClick={onClose} className="text-base font-bold text-red-400 hover:text-red-300">
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pt-2.5 space-y-3 pr-0.5">
        {/* Player Balance Strip */}
        <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-[10px]">
          <span className="text-slate-400">Ваши ресурсы:</span>
          <div className="flex items-center gap-3.5 font-extrabold">
            <span className="inline-flex items-center gap-1 text-amber-300">
              <GoldCoinIcon size="sm" />
              <span>{hero.gold.toLocaleString('ru-RU')} Золота</span>
            </span>
            <span className="inline-flex items-center gap-1 text-cyan-300">
              <CrystalIcon size="sm" />
              <span>{hero.crystals.toLocaleString('ru-RU')} Кристаллов</span>
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {/* 👑 Информационный блок: Покупка кристаллов через Администратора */}
          <div className="rounded-xl border-2 border-amber-500/60 bg-gradient-to-r from-amber-950/50 via-slate-900 to-amber-950/40 p-3 space-y-2 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <div className="flex items-center gap-2 border-b border-amber-500/30 pb-1.5">
              <span className="text-lg">👑</span>
              <div>
                <div className="text-xs font-black text-amber-300 uppercase tracking-wide">
                  Покупка кристаллов через Администратора
                </div>
                <div className="text-[9px] text-amber-200/80">
                  Безопасное пополнение баланса кристаллов для вашего персонажа
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-200 leading-relaxed">
              Покупка кристаллов осуществляется <b>только через официального Администратора</b>. Выберите подходящий пакет и нажмите кнопку <b className="text-amber-300">«Заказать»</b>. Откроется карточка с данными вашего персонажа, которую необходимо передать Администратору для оплаты и зачисления кристаллов.
            </p>
          </div>

          {/* 💎 Банк Кристаллов */}
          <div className="rounded-xl border-2 border-cyan-500/50 bg-gradient-to-b from-cyan-950/35 via-slate-900 to-slate-950 p-3 space-y-2.5 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
            <div className="flex items-center justify-between gap-2 border-b border-cyan-500/20 pb-2">
              <div className="flex items-center gap-1.5">
                <CrystalIcon size="md" />
                <div>
                  <div className="text-xs font-black text-cyan-300 uppercase tracking-wide">
                    Банк Кристаллов
                  </div>
                  <div className="text-[9.5px] text-slate-300">
                    Выберите пакет кристаллов для оформления заказа
                  </div>
                </div>
              </div>
              <span className="rounded-full border border-cyan-400/50 bg-cyan-950/80 px-2.5 py-0.5 text-[9px] font-black text-cyan-200">
                USD ($)
              </span>
            </div>

            {!bankPurchaseOpen ? (
              <div className="rounded-lg border border-amber-500/50 bg-amber-950/40 p-3 text-center text-[10.5px] font-bold text-amber-300">
                ⚠️ Покупка кристаллов временно приостановлена администратором
              </div>
            ) : bankPackages.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-center text-[10px] text-slate-400">
                Пакеты кристаллов пока не добавлены в Редакторе Банка.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {bankPackages.map((pack) => {
                  const isSelected = selectedPack?.id === pack.id;
                  const totalCrystals = pack.crystals + Number(pack.bonusCrystals || 0);
                  return (
                    <div
                      key={pack.id}
                      onClick={() => setSelectedPack(pack)}
                      className={`group relative flex flex-col justify-between rounded-xl border p-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-400 bg-gradient-to-b from-amber-950/60 to-slate-900 shadow-[0_0_16px_rgba(245,158,11,0.4)] scale-[1.01]'
                          : 'border-cyan-500/35 bg-slate-950/90 hover:border-amber-400/80 hover:bg-slate-900'
                      }`}
                    >
                      {Number(pack.bonusCrystals || 0) > 0 && (
                        <span className="absolute -top-2 right-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-600 px-1.5 py-0.2 text-[7.5px] font-black text-white shadow">
                          +{pack.bonusCrystals} БОНУС
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-950/60 shadow-inner">
                          <CrystalIcon size="md" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-cyan-200 leading-tight">
                            {pack.crystals.toLocaleString('ru-RU')} 💎
                          </div>
                          <div className="text-[8.5px] text-slate-400 truncate">
                            {pack.label || `${totalCrystals} кристаллов`}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
                        <span className="text-xs font-black text-emerald-300">
                          {pack.priceUsd}$
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPack(pack);
                            setOrderQuantity(pack.crystals);
                            setOrderPriceUsd(pack.priceUsd);
                            setSubmittedOrder(null);
                          }}
                          className="rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-2.5 py-1 text-[9.5px] font-black text-slate-950 shadow hover:from-amber-400 hover:to-yellow-400 active:scale-95 cursor-pointer"
                        >
                          Заказать
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Карточка оформления заказа: Персонаж, Telegram, Количество кристаллов и Отправка заказа */}
            {selectedPack && (
              <div className="rounded-xl border-2 border-amber-400 bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 p-3.5 space-y-3 shadow-[0_0_25px_rgba(245,158,11,0.25)] animate-in fade-in">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-300 uppercase tracking-wide">
                    <span>📦</span>
                    <span>Оформление заказа кристаллов</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPack(null);
                      setSubmittedOrder(null);
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800/60 cursor-pointer"
                  >
                    ✕ Закрыть
                  </button>
                </div>

                {submittedOrder ? (
                  /* Результат успешной отправки заказа */
                  <div className="space-y-3 text-center py-2 animate-in fade-in">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-950 border-2 border-emerald-400 text-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                      ✅
                    </div>
                    <div>
                      <div className="text-sm font-black text-emerald-300">
                        Заказ #{submittedOrder.id} успешно отправлен!
                      </div>
                      <div className="text-xs text-amber-300 font-bold mt-1">
                        {submittedOrder.crystals.toLocaleString('ru-RU')} 💎 Кристаллов ({submittedOrder.priceUsd}$ USD)
                      </div>
                      <div className="text-[10px] text-slate-300 mt-1 max-w-sm mx-auto">
                        Заявка поступила в <b>«Почту заказов» Администратора</b>. Администратор свяжется с вами в Telegram: <b className="text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">{submittedOrder.telegramContact}</b> для подтверждения оплаты и зачислит кристаллы на вашего персонажа.
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      {onOpenMail && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenMail();
                          }}
                          className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-3.5 py-2 text-xs font-black text-white shadow hover:from-sky-400 hover:to-blue-500 active:scale-95 cursor-pointer"
                        >
                          📩 Перейти в мои сообщения
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          const orderText = `Заказ кристаллов в игре «Пирамида: Войны»:\nНомер: #${submittedOrder.id}\nПерсонаж: ${hero.nick || 'Игрок'}\nУровень: ${hero.level}\nПакет: ${submittedOrder.crystals} 💎 кристаллов\nСумма: ${submittedOrder.priceUsd}$\nTelegram: ${submittedOrder.telegramContact}\nДата: ${new Date(submittedOrder.createdAt).toLocaleString('ru-RU')}`;
                          navigator.clipboard.writeText(orderText).then(() => {
                            if (showToast) showToast('📋 Данные заказа скопированы!');
                          });
                        }}
                        className="rounded-lg border border-amber-500/50 bg-amber-500/20 hover:bg-amber-500/30 px-3 py-2 text-xs font-bold text-amber-300 cursor-pointer"
                      >
                        📋 Скопировать данные заказа
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSubmittedOrder(null);
                        }}
                        className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-300 cursor-pointer"
                      >
                        Оформить ещё заказ
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Форма оформления заказа */
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const cleanTg = telegramContact.trim();
                      if (!cleanTg) {
                        if (showToast) showToast('⚠️ Укажите ваш Telegram для связи!');
                        return;
                      }
                      if (orderQuantity <= 0) {
                        if (showToast) showToast('⚠️ Укажите количество кристаллов!');
                        return;
                      }

                      setIsSubmittingOrder(true);
                      try {
                        localStorage.setItem('pyramid_player_telegram', cleanTg);
                        const order = await createCrystalOrder({
                          playerNick: hero.nick || 'Игрок',
                          playerLevel: hero.level,
                          playerClan: hero.clanTag ? `[${hero.clanTag}] ${hero.clanName || ''}` : undefined,
                          playerAvatar: hero.avatar,
                          telegramContact: cleanTg,
                          crystals: orderQuantity,
                          bonusCrystals: selectedPack.bonusCrystals || 0,
                          priceUsd: orderPriceUsd
                        });
                        setSubmittedOrder(order);
                        if (showToast) {
                          showToast(`✅ Заказ на ${orderQuantity} 💎 отправлен в Почту заказов Администратора!`);
                        }
                      } catch (err: any) {
                        if (showToast) showToast(`❌ Ошибка отправки заказа: ${err?.message || 'сбой сети'}`);
                      } finally {
                        setIsSubmittingOrder(false);
                      }
                    }}
                    className="space-y-3"
                  >
                    {/* Поясняющая подсказка */}
                    <div className="text-[10px] text-amber-200/90 bg-amber-950/30 border border-amber-500/30 rounded-lg p-2 leading-relaxed">
                      Укажите свой <b>Telegram для связи</b> и <b>количество кристаллов</b>. После отправки заказ поступит в отдельную <b>«Почту заказов» Администратора</b>.
                    </div>

                    {/* Блок персонажа (по центру в полный рост с данными) */}
                    <div className="flex flex-col sm:flex-row items-center gap-3.5 rounded-xl border border-amber-500/40 bg-slate-950/90 p-3">
                      {/* Персонаж в полный рост */}
                      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-amber-400/70 bg-gradient-to-b from-amber-900/30 to-black p-1.5 shadow-[0_0_15px_rgba(245,158,11,0.3)] overflow-hidden">
                        {hero.avatar && (hero.avatar.startsWith('data:') || hero.avatar.startsWith('http') || hero.avatar.startsWith('/')) ? (
                          <img
                            src={hero.avatar}
                            alt={hero.nick || 'Персонаж'}
                            className="h-full w-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]"
                          />
                        ) : (
                          <span className="text-4xl filter drop-shadow">{hero.avatar || '🧙‍♂️'}</span>
                        )}
                        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[7.5px] font-black text-amber-300">
                          Ур.{hero.level}
                        </span>
                      </div>

                      {/* Данные персонажа */}
                      <div className="flex-1 space-y-1 text-center sm:text-left min-w-0">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                          <span className="text-sm font-black text-white">{hero.nick || 'Игрок'}</span>
                          <span className="rounded bg-amber-500/20 border border-amber-400/60 px-1.5 py-0.2 text-[8.5px] font-black text-amber-300">
                            Уровень {hero.level}
                          </span>
                          {hero.clanTag && (
                            <span className="rounded bg-purple-950 border border-purple-500/50 px-1.5 py-0.2 text-[8.5px] font-black text-purple-300">
                              [{hero.clanTag}] {hero.clanName}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-300">
                          Текущий баланс: <span className="font-bold text-cyan-300">{hero.crystals.toLocaleString('ru-RU')} 💎</span> | <span className="font-bold text-amber-300">{hero.gold.toLocaleString('ru-RU')} 🪙</span>
                        </div>
                        <div className="text-[9.5px] text-emerald-300 font-semibold">
                          К начислению: <b>{orderQuantity.toLocaleString('ru-RU')} 💎 Кристаллов</b> {Number(selectedPack.bonusCrystals || 0) > 0 ? `(+${selectedPack.bonusCrystals} бонус)` : ''}
                        </div>
                        <div className="text-[9.5px] text-slate-300">
                          Сумма к оплате: <b className="text-emerald-400 text-xs font-black">{orderPriceUsd}$ USD</b>
                        </div>
                      </div>
                    </div>

                    {/* Выбор пакета / количества кристаллов */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-amber-300 flex items-center justify-between">
                        <span>💎 Количество кристаллов:</span>
                        <span className="text-emerald-400 font-black">{orderQuantity} 💎 = {orderPriceUsd}$</span>
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {bankPackages.map((p) => {
                          const isSel = orderQuantity === p.crystals;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setOrderQuantity(p.crystals);
                                setOrderPriceUsd(p.priceUsd);
                                setSelectedPack(p);
                              }}
                              className={`rounded-lg px-2 py-1 text-[9px] font-bold border transition-all cursor-pointer ${
                                isSel
                                  ? 'border-cyan-400 bg-cyan-950/80 text-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.4)]'
                                  : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              {p.crystals.toLocaleString('ru-RU')} 💎 ({p.priceUsd}$)
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Поле: Укажите свой Telegram для связи */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-sky-300 flex items-center gap-1">
                        <span>✈️</span>
                        <span>Укажите свой Telegram для связи:</span>
                        <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={telegramContact}
                          onChange={(e) => setTelegramContact(e.target.value)}
                          placeholder="@username или номер телефона (+7/380...)"
                          className="w-full rounded-lg border-2 border-sky-500/50 bg-slate-950 px-3 py-2 text-xs font-bold text-white placeholder-slate-500 outline-none focus:border-sky-400 focus:shadow-[0_0_12px_rgba(56,189,248,0.3)]"
                        />
                      </div>
                      <div className="text-[8.5px] text-slate-400">
                        Администратор напишет вам в этот Telegram для передачи реквизитов и зачисления кристаллов.
                      </div>
                    </div>

                    {/* Описание покупки через Администратора */}
                    <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2.5 space-y-1 text-[9.5px] text-slate-200">
                      <div className="font-bold text-amber-300 flex items-center gap-1">
                        <span>👑</span>
                        <span>Покупка кристаллов через Администратора:</span>
                      </div>
                      <div>{bankInstructions}</div>
                      {bankPaymentUrl && (
                        <div className="pt-0.5 text-[9px] text-cyan-300 font-bold break-all">
                          🔗 Реквизиты: <span className="text-white select-all">{bankPaymentUrl}</span>
                        </div>
                      )}
                    </div>

                    {/* Кнопка «Отправить заказ» */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={isSubmittingOrder || !telegramContact.trim()}
                        className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-400 hover:from-amber-400 hover:to-yellow-300 py-2.5 px-4 text-xs font-black text-slate-950 shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer text-center flex items-center justify-center gap-2"
                      >
                        {isSubmittingOrder ? (
                          <>
                            <span className="animate-spin">⏳</span>
                            <span>Отправка заказа...</span>
                          </>
                        ) : (
                          <>
                            <span>📨</span>
                            <span>Отправить заказ</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPack(null)}
                        className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2.5 text-xs font-bold text-slate-300 cursor-pointer"
                      >
                        Отмена
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Premium Status Section */}
          <div className="rounded-lg border border-yellow-500/50 bg-yellow-950/20 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold text-yellow-300">
                  👑 Премиум-статус ({premCfg.durationHours} ч.)
                </div>
                <div className="text-[9px] text-slate-300">
                  {isPremDisabled ? (
                    <span className="text-red-400 font-bold">
                      ⛔ Работа Премиума временно приостановлена
                    </span>
                  ) : isPremActive && remainingPremMinutes > 0 ? (
                    <span className="text-emerald-400 font-bold">
                      ✅ Активен! Осталось: {Math.floor(remainingPremMinutes / 60)}ч {remainingPremMinutes % 60}мин
                    </span>
                  ) : (
                    `Не активен. Дает +${premCfg.goldBonusPct}% золота, +${premCfg.expBonusPct}% опыта, x${premCfg.regenMultiplier} регенерацию и все VIP-бонусы!`
                  )}
                </div>
              </div>
              {onBuyPremium && !isPremDisabled && (
                <button
                  onClick={() => onBuyPremium('crystals')}
                  disabled={hero.crystals < premCfg.priceCrystals}
                  className="shrink-0 rounded bg-gradient-to-r from-yellow-500 to-amber-500 px-3 py-1 text-[10px] font-extrabold text-slate-950 hover:from-yellow-400 hover:to-amber-400 disabled:opacity-40 cursor-pointer"
                >
                  {premCfg.priceCrystals} 💎 Купить
                </button>
              )}
            </div>
          </div>

          {exchangeDisabled ? (
            <div className="rounded-lg border-2 border-red-500/50 bg-red-950/40 p-4 text-center space-y-1.5">
              <div className="text-sm">⛔</div>
              <div className="text-xs font-bold text-red-300">
                Обмен валют временно закрыт
              </div>
              <div className="text-[9.5px] text-slate-300">
                В данный момент функция обмена валют в обменнике закрыта администратором.
              </div>
            </div>
          ) : (
            (() => {
              const todayKey = new Date().toISOString().slice(0, 10);
              const heroGold = Number(hero.gold || 0);
              const heroCrystals = Number(hero.crystals || 0);

              const usedCrystalExchangeToday =
                hero.dailyCrystalToGoldDate === todayKey
                  ? Math.max(0, Number(hero.dailyCrystalToGoldCount || 0))
                  : 0;
              const remainingCrystalExchange = Math.max(0, crystalLimitMax - usedCrystalExchangeToday);
              const isCrystalLimitReached = usedCrystalExchangeToday >= crystalLimitMax;
              const canExchangeCrystalToGold =
                isCrystalToGoldOpen && heroCrystals >= 1 && !isCrystalLimitReached;

              const usedGoldExchangeToday =
                hero.dailyGoldToCrystalDate === todayKey
                  ? Math.max(0, Number(hero.dailyGoldToCrystalCount || 0))
                  : 0;
              const remainingGoldExchange = Math.max(0, goldLimitMax - usedGoldExchangeToday);
              const isGoldLimitReached = usedGoldExchangeToday >= goldLimitMax;
              const canExchangeGoldToCrystal =
                isGoldToCrystalOpen && heroGold >= goldToCrystalRate && !isGoldLimitReached;

              const handleCrystalToGoldClick = () => {
                if (!isCrystalToGoldOpen) {
                  const msg = '⛔ Обмен кристаллов на золото временно закрыт администратором.';
                  setExchangeBanner({ success: false, text: msg, ts: Date.now() });
                  if (showToast) showToast(msg);
                  return;
                }
                if (isCrystalLimitReached) {
                  const msg = `⛔ Лимит исчерпан (${crystalLimitMax}/${crystalLimitMax})! Обмен кристаллов на золото доступен ${crystalLimitMax} раз в сутки.`;
                  setExchangeBanner({ success: false, text: msg, ts: Date.now() });
                  if (showToast) showToast(msg);
                  return;
                }
                if (heroCrystals < 1) {
                  const msg = `❌ Недостаточно кристаллов для обмена! Нужно 1 💎 (у вас ${heroCrystals} 💎).`;
                  setExchangeBanner({ success: false, text: msg, ts: Date.now() });
                  if (showToast) showToast(msg);
                  return;
                }
                onExchangeGoldToCrystals(-crystalToGoldRate, 1);
                setExchangeBanner({
                  success: true,
                  text: `✅ Обмен выполнен: 1 💎 ➔ +${crystalToGoldRate.toLocaleString('ru-RU')} 🪙 Золота! (Использовано ${usedCrystalExchangeToday + 1}/${crystalLimitMax} сегодня)`,
                  ts: Date.now()
                });
              };

              const handleGoldToCrystalClick = () => {
                if (!isGoldToCrystalOpen) {
                  const msg = '⛔ Обмен золота на кристаллы временно закрыт администратором.';
                  setExchangeBanner({ success: false, text: msg, ts: Date.now() });
                  if (showToast) showToast(msg);
                  return;
                }
                if (isGoldLimitReached) {
                  const msg = `⛔ Лимит исчерпан (${goldLimitMax}/${goldLimitMax})! Обмен золота на кристаллы доступен ${goldLimitMax} раз в сутки.`;
                  setExchangeBanner({ success: false, text: msg, ts: Date.now() });
                  if (showToast) showToast(msg);
                  return;
                }
                if (heroGold < goldToCrystalRate) {
                  const msg = `❌ Недостаточно золота для обмена! Нужно ${goldToCrystalRate.toLocaleString('ru-RU')} 🪙 (у вас ${heroGold} 🪙).`;
                  setExchangeBanner({ success: false, text: msg, ts: Date.now() });
                  if (showToast) showToast(msg);
                  return;
                }
                onExchangeGoldToCrystals(goldToCrystalRate, -1);
                setExchangeBanner({
                  success: true,
                  text: `✅ Обмен выполнен: ${goldToCrystalRate.toLocaleString('ru-RU')} 🪙 ➔ +1 💎 Кристалл! (Использовано ${usedGoldExchangeToday + 1}/${goldLimitMax} сегодня)`,
                  ts: Date.now()
                });
              };

              return (
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-400">
                      🔄 Внутриигровой обменник валют:
                    </span>
                    <span className="text-[8.5px] font-bold text-cyan-300">
                      Лимиты: {crystalLimitMax} и {goldLimitMax} в сутки
                    </span>
                  </div>

                  {exchangeBanner && (
                    <div
                      key={exchangeBanner.ts}
                      className={`rounded-md border px-2.5 py-1.5 text-[9.5px] font-bold ${
                        exchangeBanner.success
                          ? 'border-emerald-500/60 bg-emerald-950/60 text-emerald-300'
                          : 'border-red-500/60 bg-red-950/60 text-red-300'
                      }`}
                    >
                      {exchangeBanner.text}
                    </div>
                  )}

                  {/* 1 Crystal -> X Gold */}
                  <div className="flex items-center justify-between text-[10px] border-b border-slate-800 pb-2.5 gap-2">
                    <div>
                      <div className="text-slate-200 font-semibold flex items-center gap-1">
                        <span>1</span>
                        <CrystalIcon size="xs" />
                        <span>Кристалл ➔ {crystalToGoldRate.toLocaleString('ru-RU')}</span>
                        <GoldCoinIcon size="xs" />
                        <span>Золота</span>
                      </div>
                      <div className="text-[8.5px]">
                        {!isCrystalToGoldOpen ? (
                          <span className="text-red-400 font-bold">
                            🔒 Направление временно закрыто
                          </span>
                        ) : isCrystalLimitReached ? (
                          <span className="text-red-400 font-bold">
                            ⛔ Лимит исчерпан ({crystalLimitMax}/{crystalLimitMax}). Сброс завтра.
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold">
                            💎➔🪙 Доступно сегодня: <strong>{remainingCrystalExchange} из {crystalLimitMax}</strong> раз
                            {heroCrystals < 1 && (
                              <span className="ml-1 text-amber-300">(нужен 1 💎)</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCrystalToGoldClick}
                      className={`shrink-0 rounded px-3 py-1.5 font-bold transition-all active:scale-95 cursor-pointer ${
                        canExchangeCrystalToGold
                          ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.35)]'
                          : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {!isCrystalToGoldOpen
                        ? '🔒 Закрыто'
                        : isCrystalLimitReached
                        ? `Лимит (${crystalLimitMax}/${crystalLimitMax})`
                        : `Обменять (${usedCrystalExchangeToday}/${crystalLimitMax})`}
                    </button>
                  </div>

                  {/* Y Gold -> 1 Crystal */}
                  <div className="flex items-center justify-between text-[10px] gap-2">
                    <div>
                      <div className="text-slate-200 font-semibold flex items-center gap-1">
                        <span>{goldToCrystalRate.toLocaleString('ru-RU')}</span>
                        <GoldCoinIcon size="xs" />
                        <span>Золота ➔ 1</span>
                        <CrystalIcon size="xs" />
                        <span>Кристалл</span>
                      </div>
                      <div className="text-[8.5px]">
                        {!isGoldToCrystalOpen ? (
                          <span className="text-red-400 font-bold">
                            🔒 Направление временно закрыто
                          </span>
                        ) : isGoldLimitReached ? (
                          <span className="text-red-400 font-bold">
                            ⛔ Лимит исчерпан ({goldLimitMax}/{goldLimitMax}). Сброс завтра.
                          </span>
                        ) : (
                          <span className="text-cyan-300 font-bold">
                            🪙➔💎 Доступно сегодня: <strong>{remainingGoldExchange} из {goldLimitMax}</strong> раз
                            {heroGold < goldToCrystalRate && (
                              <span className="ml-1 text-amber-300">(нужно {goldToCrystalRate.toLocaleString('ru-RU')} 🪙)</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGoldToCrystalClick}
                      className={`shrink-0 rounded px-3 py-1.5 font-bold transition-all active:scale-95 cursor-pointer ${
                        canExchangeGoldToCrystal
                          ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.35)]'
                          : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {!isGoldToCrystalOpen
                        ? '🔒 Закрыто'
                        : isGoldLimitReached
                        ? `Лимит (${goldLimitMax}/${goldLimitMax})`
                        : `Обменять (${usedGoldExchangeToday}/${goldLimitMax})`}
                    </button>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
};
