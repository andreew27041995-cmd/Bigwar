import React, { useState, useEffect } from 'react';
import { GameFeatureFlags } from '../types/game';
import { getPremiumConfig } from '../utils/shopConfig';

interface ActiveVipBonusesBlockProps {
  isPremium: boolean;
  premiumUntil?: number;
  isOwnProfile?: boolean;
  onOpenPremium?: () => void;
  featureFlags?: GameFeatureFlags;
}

export const ActiveVipBonusesBlock: React.FC<ActiveVipBonusesBlockProps> = ({
  isPremium,
  premiumUntil = 0,
  isOwnProfile = false,
  onOpenPremium,
  featureFlags
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const cfg = getPremiumConfig(featureFlags);
  const hasActiveVip = Boolean(isPremium && premiumUntil && premiumUntil > now);
  const remainingMs = Math.max(0, (premiumUntil || 0) - now);

  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

  const formattedTimer = `${String(hours).padStart(2, '0')}ч ${String(minutes).padStart(2, '0')}м ${String(seconds).padStart(2, '0')}с`;

  return (
    <div className="rounded-xl border border-yellow-500/50 bg-gradient-to-b from-yellow-950/40 via-slate-900 to-slate-950 p-3 shadow-lg space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-yellow-500/30 pb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">👑</span>
          <span className="text-[11px] font-extrabold text-amber-300">
            Активные бонусы / Премиум (VIP)
          </span>
        </div>
        <span
          className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase ${
            hasActiveVip
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}
        >
          {hasActiveVip ? '✅ АКТИВЕН' : 'НЕ АКТИВЕН'}
        </span>
      </div>

      {hasActiveVip ? (
        <div className="space-y-2">
          {/* Countdown timer strip */}
          <div className="flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-950/50 px-2.5 py-1.5 text-[9.5px]">
            <span className="text-amber-200/90 font-bold">⏱️ Время до окончания:</span>
            <span className="font-mono text-xs font-black text-amber-300 tabular-nums">
              {formattedTimer}
            </span>
          </div>

          {/* Active Bonuses List */}
          <div className="space-y-1 text-[9px] text-slate-200">
            {cfg.goldBonusPct > 0 && (
              <div className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>
                  <strong className="text-amber-300">Золото с монстров:</strong> +{cfg.goldBonusPct}%
                </span>
              </div>
            )}
            {cfg.expBonusPct > 0 && (
              <div className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>
                  <strong className="text-amber-300">Опыт в боях:</strong> +{cfg.expBonusPct}%
                </span>
              </div>
            )}
            {(cfg.hpBonus > 0 || cfg.dmgBonus > 0 || cfg.dodgeBonus > 0 || cfg.energyBonus > 0) && (
              <div className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>
                  <strong className="text-amber-300">Боевые параметры:</strong>{' '}
                  {[
                    cfg.hpBonus > 0 ? `+${cfg.hpBonus} HP` : '',
                    cfg.dmgBonus > 0 ? `+${cfg.dmgBonus} урон` : '',
                    cfg.dodgeBonus > 0 ? `+${cfg.dodgeBonus}% уклон.` : '',
                    cfg.energyBonus > 0 ? `+${cfg.energyBonus} энерг.` : ''
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
            {(cfg.strBonus > 0 || cfg.agiBonus > 0 || cfg.vitBonus > 0) && (
              <div className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>
                  <strong className="text-amber-300">Характеристики:</strong>{' '}
                  {[
                    cfg.strBonus > 0 ? `+${cfg.strBonus} Сила` : '',
                    cfg.agiBonus > 0 ? `+${cfg.agiBonus} Ловк.` : '',
                    cfg.vitBonus > 0 ? `+${cfg.vitBonus} Живуч.` : ''
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
            {cfg.bagBonus > 0 && (
              <div className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>
                  <strong className="text-amber-300">Вместимость сумки:</strong> +{cfg.bagBonus} ячеек
                </span>
              </div>
            )}
            {cfg.regenMultiplier > 1 && (
              <div className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>
                  <strong className="text-amber-300">Регенерация HP и Энергии:</strong> ускорена в {cfg.regenMultiplier} раза (x{cfg.regenMultiplier})
                </span>
              </div>
            )}
            {(cfg.wheelMultiplier > 1 || cfg.goldWheelEnabled) && (
              <div className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>
                  <strong className="text-amber-300">Рулетка Везения:</strong>{' '}
                  {cfg.wheelMultiplier > 1 ? `х${cfg.wheelMultiplier} шанс редких наград` : ''}
                  {cfg.goldWheelEnabled ? ' · вращения за золото' : ''}
                </span>
              </div>
            )}
            {cfg.crownEnabled && (
              <div className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>
                  <strong className="text-amber-300">Золотой статус:</strong> корона 👑 возле ника
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-center py-1">
          <p className="text-[9px] text-slate-400 leading-snug">
            {isOwnProfile
              ? `У вас нет активного Премиума. Активируйте VIP на ${cfg.durationHours} ч. за ${cfg.priceCrystals} 💎, чтобы получить +${cfg.goldBonusPct}% золота, +${cfg.expBonusPct}% опыта и все VIP-бонусы!`
              : 'У данного игрока нет активного Премиум-статуса.'}
          </p>
          {isOwnProfile && onOpenPremium && (
            <button
              onClick={onOpenPremium}
              className="w-full rounded-lg bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-600 py-1.5 text-[10px] font-extrabold uppercase text-slate-950 shadow hover:brightness-110 active:scale-95 cursor-pointer"
            >
              👑 Активировать Премиум ({cfg.priceCrystals} 💎 на {cfg.durationHours}ч)
            </button>
          )}
        </div>
      )}
    </div>
  );
};
