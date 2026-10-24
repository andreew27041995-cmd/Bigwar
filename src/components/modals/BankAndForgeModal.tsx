import React, { useState } from 'react';
import { HeroState, GameItem, EquippedGear, GameFeatureFlags, BankPackageConfig } from '../../types/game';
import { getPremiumConfig, getBankPackages } from '../../utils/shopConfig';
import { GoldCoinIcon, CrystalIcon } from '../CurrencyIcon';

interface BankAndForgeModalProps {
  hero: HeroState;
  equipped?: EquippedGear;
  inventory?: GameItem[];
  onClose: () => void;
  onAddCrystals?: (amount: number, packageName: string, priceUsd: number) => void;
  onExchangeGoldToCrystals: (goldAmount: number, crystalGain: number) => void;
  onForgeItem?: (newItem: GameItem, costGold: number, costCrystals: number) => void;
  onBuyPremium?: (currency?: 'crystals' | 'gold') => void;
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
          {/* 💎 Покупка кристаллов в Банке */}
          <div className="rounded-xl border-2 border-cyan-500/50 bg-gradient-to-b from-cyan-950/35 via-slate-900 to-slate-950 p-3 space-y-2.5 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
            <div className="flex items-center justify-between gap-2 border-b border-cyan-500/20 pb-2">
              <div className="flex items-center gap-1.5">
                <CrystalIcon size="md" />
                <div>
                  <div className="text-xs font-black text-cyan-300 uppercase tracking-wide">
                    Банк Кристаллов
                  </div>
                  <div className="text-[9.5px] text-slate-300">
                    Выберите пакет кристаллов для пополнения баланса
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
                          ? 'border-cyan-300 bg-gradient-to-b from-cyan-900/60 to-slate-900 shadow-[0_0_16px_rgba(34,211,238,0.4)] scale-[1.01]'
                          : 'border-cyan-500/35 bg-slate-950/90 hover:border-cyan-400/80 hover:bg-slate-900'
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
                            if (showToast) {
                              showToast(
                                `💎 Выбран пакет: ${pack.crystals} кристаллов за ${pack.priceUsd}$`
                              );
                            }
                          }}
                          className="rounded-lg bg-gradient-to-r from-cyan-500 to-sky-500 px-2.5 py-1 text-[9.5px] font-black text-slate-950 shadow hover:from-cyan-400 hover:to-sky-400 active:scale-95 cursor-pointer"
                        >
                          Купить
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selected Package Checkout / Instructions Box */}
            {selectedPack && (
              <div className="rounded-xl border border-cyan-400/70 bg-slate-950/95 p-3 space-y-2 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-cyan-300">
                    <CrystalIcon size="sm" />
                    <span>
                      Выбран пакет: {selectedPack.crystals.toLocaleString('ru-RU')} кристаллов —{' '}
                      <span className="text-emerald-300">{selectedPack.priceUsd}$</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPack(null)}
                    className="text-xs font-bold text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="text-[10px] text-slate-200 leading-relaxed bg-slate-900/90 rounded-lg border border-slate-800 p-2">
                  {bankInstructions}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  {bankPaymentUrl ? (
                    <div className="text-[9.5px] text-cyan-300 font-bold break-all">
                      🔗 Реквизиты / Ссылка: <span className="text-white select-all">{bankPaymentUrl}</span>
                    </div>
                  ) : (
                    <span className="text-[9px] text-slate-400">
                      Ваш игровой ник для зачисления: <strong className="text-amber-300">{hero.nick || 'Игрок'}</strong>
                    </span>
                  )}

                  {isAdminUser && onAddCrystals && (
                    <button
                      type="button"
                      onClick={() => {
                        const total = selectedPack.crystals + Number(selectedPack.bonusCrystals || 0);
                        onAddCrystals(
                          total,
                          `${selectedPack.crystals} кристаллов (${selectedPack.priceUsd}$)`,
                          selectedPack.priceUsd
                        );
                        setSelectedPack(null);
                      }}
                      className="rounded-lg border border-emerald-400 bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-[10px] font-black text-white shadow cursor-pointer"
                    >
                      ⚡ Начислить пакет (Тест Админа: +{selectedPack.crystals} 💎)
                    </button>
                  )}
                </div>
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
