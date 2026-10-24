import React, { useState, useEffect } from 'react';
import { HeroState, GameFeatureFlags } from '../../types/game';
import { getPremiumConfig } from '../../utils/shopConfig';

interface PremiumModalProps {
  hero: HeroState;
  onClose: () => void;
  onBuyPremium: (currency?: 'crystals' | 'gold') => void;
  premiumDisabled?: boolean;
  featureFlags?: GameFeatureFlags;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({
  hero,
  onClose,
  onBuyPremium,
  premiumDisabled = false,
  featureFlags
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const cfg = getPremiumConfig(featureFlags);
  const isDisabled = premiumDisabled || !cfg.enabled;

  const isPrem = Boolean(hero.isPremium && hero.premiumUntil && hero.premiumUntil > now);
  const remainingMs = isPrem && hero.premiumUntil ? Math.max(0, hero.premiumUntil - now) : 0;
  const hours = Math.floor(remainingMs / 3600000);
  const minutes = Math.floor((remainingMs % 3600000) / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-slate-950/95 p-3 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <span className="text-xs font-bold text-yellow-400">
          👑 Премиум VIP Статус ({cfg.durationHours} ч.)
        </span>
        <button onClick={onClose} className="text-base font-bold text-red-400 hover:text-red-300">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pt-3 space-y-3">
        {/* VIP Banner */}
        <div className="rounded-xl border-2 border-yellow-500/80 bg-gradient-to-b from-yellow-950/40 via-slate-900 to-slate-900 p-4 text-center shadow-[0_0_20px_rgba(234,179,8,0.2)]">
          <div className="text-3xl">👑</div>
          <div className="mt-1 text-sm font-extrabold text-yellow-400 uppercase tracking-widest">
            PHARAOH VIP PASS ({cfg.durationHours} ЧАСОВ)
          </div>
          <div className="mt-1.5 text-[10px] text-slate-300">
            {isPrem ? (
              <span className="inline-block rounded-md border border-emerald-500/50 bg-emerald-950/60 px-2.5 py-1 font-mono font-bold text-emerald-300">
                ✅ АКТИВЕН! Осталось: {String(hours).padStart(2, '0')}ч : {String(minutes).padStart(2, '0')}м : {String(seconds).padStart(2, '0')}с
              </span>
            ) : (
              `Покупается на ${cfg.durationHours} ч. По истечении времени бонусы автоматически отключаются.`
            )}
          </div>
        </div>

        {/* Dynamic Benefits list configured by Admin */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-3 text-[10px] space-y-2">
          <div className="font-bold text-amber-300">
            ✨ Все активные бонусы Премиума (на {cfg.durationHours} ч.):
          </div>

          {cfg.crownEnabled && (
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-sm">👑</span>
              <span>Золотая корона рядом с ником и уровнем (в чате, рейтинге и профиле)</span>
            </div>
          )}
          {cfg.goldBonusPct > 0 && (
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-sm">🪙</span>
              <span>
                Бонус к золоту с монстров: <strong className="text-yellow-300">+{cfg.goldBonusPct}%</strong>
              </span>
            </div>
          )}
          {cfg.expBonusPct > 0 && (
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-sm">✨</span>
              <span>
                Бонус к опыту в боях: <strong className="text-purple-300">+{cfg.expBonusPct}%</strong>
              </span>
            </div>
          )}
          {cfg.hpBonus > 0 && (
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-sm">❤️</span>
              <span>
                Дополнительное здоровье: <strong className="text-red-300">+{cfg.hpBonus} HP</strong>
              </span>
            </div>
          )}
          {cfg.dmgBonus > 0 && (
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-sm">⚔️</span>
              <span>
                Дополнительный урон: <strong className="text-orange-300">+{cfg.dmgBonus} урона</strong>
              </span>
            </div>
          )}
          {cfg.strBonus > 0 && (
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-sm">💪</span>
              <span>
                Бонус к Силе: <strong className="text-rose-300">+{cfg.strBonus}</strong>
              </span>
            </div>
          )}
          {cfg.agiBonus > 0 && (
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-sm">🤸</span>
              <span>
                Бонус к Ловкости: <strong className="text-teal-300">+{cfg.agiBonus}</strong>
              </span>
            </div>
          )}
          {cfg.vitBonus > 0 && (
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-sm">🩸</span>
              <span>
                Бонус к Живучести: <strong className="text-pink-300">+{cfg.vitBonus}</strong>
              </span>
            </div>
          )}
          {cfg.dodgeBonus > 0 && (
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-sm">💨</span>
              <span>
                Бонус к Уклонению: <strong className="text-emerald-300">+{cfg.dodgeBonus}%</strong>
              </span>
            </div>
          )}
          {cfg.energyBonus > 0 && (
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-sm">🔋</span>
              <span>
                Макс. энергия: <strong className="text-cyan-300">+{cfg.energyBonus} энергии</strong>
              </span>
            </div>
          )}
          {cfg.bagBonus > 0 && (
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-sm">🎒</span>
              <span>
                Расширение вместимости сумки: <strong className="text-emerald-300">+{cfg.bagBonus} слотов</strong>
              </span>
            </div>
          )}
          {cfg.regenMultiplier > 1 && (
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-sm">⚡</span>
              <span>
                Ускорение восстановления <strong className="text-sky-300">HP и Энергии в {cfg.regenMultiplier} раза (x{cfg.regenMultiplier})</strong>
              </span>
            </div>
          )}
          {cfg.wheelMultiplier > 1 && (
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-sm">🎰</span>
              <span>
                Шанс выигрыша в «Рулетке везения» увеличен в <strong className="text-yellow-300">{cfg.wheelMultiplier} раза (х{cfg.wheelMultiplier})</strong>
              </span>
            </div>
          )}
          {cfg.goldWheelEnabled && (
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-sm">🪙</span>
              <span>
                Эксклюзивная кнопка в рулетке: <strong className="text-amber-300">«Крутить за золото» (1 000 🪙)</strong>
              </span>
            </div>
          )}
          {cfg.lootBonusPct > 0 && (
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-sm">🎁</span>
              <span>
                Шанс выпадения редких вещей с боссов: <strong className="text-amber-300">+{cfg.lootBonusPct}%</strong>
              </span>
            </div>
          )}
        </div>

        {/* Buy buttons */}
        <div className="pt-1 space-y-2">
          {isDisabled ? (
            <div className="rounded-lg border-2 border-red-500/60 bg-red-950/50 p-3 text-center">
              <div className="text-xs font-bold text-red-300">
                ⛔ Работа Премиума временно приостановлена
              </div>
              <div className="mt-1 text-[9px] text-slate-300">
                Функция временно отключена Администрацией в настройках Премиума.
              </div>
            </div>
          ) : (
            <>
              {(cfg.currency === 'crystals' || cfg.currency === 'both') && (
                <button
                  onClick={() => onBuyPremium('crystals')}
                  disabled={hero.crystals < cfg.priceCrystals}
                  className="w-full rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 py-2.5 text-xs font-extrabold uppercase tracking-wide text-slate-950 shadow hover:from-yellow-400 hover:to-amber-400 active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  {isPrem
                    ? `👑 Продлить VIP на +${cfg.durationHours} ч. (${cfg.priceCrystals} 💎)`
                    : `👑 Купить Премиум за ${cfg.priceCrystals} 💎 на ${cfg.durationHours} ч.`}
                </button>
              )}
              {(cfg.currency === 'gold' || cfg.currency === 'both') && (
                <button
                  onClick={() => onBuyPremium('gold')}
                  disabled={hero.gold < cfg.priceGold}
                  className="w-full rounded-lg border border-amber-400 bg-amber-950/80 py-2 text-xs font-extrabold uppercase tracking-wide text-amber-200 shadow hover:bg-amber-900 active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  {isPrem
                    ? `🪙 Продлить VIP на +${cfg.durationHours} ч. (${cfg.priceGold.toLocaleString()} 🪙)`
                    : `🪙 Купить Премиум за ${cfg.priceGold.toLocaleString()} 🪙 на ${cfg.durationHours} ч.`}
                </button>
              )}
              <div className="mt-1 text-center text-[9px] text-slate-400">
                У вас в наличии: <span className="text-cyan-400 font-bold">{hero.crystals} 💎</span> ·{' '}
                <span className="text-yellow-400 font-bold">{hero.gold.toLocaleString()} 🪙</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
