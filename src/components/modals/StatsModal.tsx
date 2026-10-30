import React from 'react';
import { HeroState, EquippedGear } from '../../types/game';
import { EXP_TABLE, MAX_LEVEL, calculateHeroStatsBreakdown } from '../../utils/gameData';

interface StatsModalProps {
  hero: HeroState;
  equipped?: EquippedGear;
  onAllocateStat?: (stat: 'str' | 'agi' | 'vit') => void;
  onUpgradeStat?: (stat: 'str' | 'agi' | 'vit') => void;
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  hero,
  equipped,
  onAllocateStat,
  onUpgradeStat,
  onClose
}) => {
  const handleStatClick = (stat: 'str' | 'agi' | 'vit') => {
    if (onAllocateStat) onAllocateStat(stat);
    else if (onUpgradeStat) onUpgradeStat(stat);
  };

  const heroLvl = Math.max(1, Number(hero.level || (hero as any).lvl || 1));
  const stats = calculateHeroStatsBreakdown(hero, equipped);
  const expNeeded = EXP_TABLE[heroLvl] || 1000;

  return (
    <div className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col p-4 overflow-y-auto text-white">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-yellow-600/30">
        <h2 className="text-base font-bold text-amber-400">📊 Характеристики Персонажа</h2>
        <button onClick={onClose} className="text-red-400 hover:text-red-300 text-lg font-bold">✕</button>
      </div>

      {/* Очки характеристик */}
      <div className="bg-gradient-to-r from-yellow-900/40 to-amber-900/20 border border-yellow-500/40 rounded-xl p-3 mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-yellow-400">Свободные очки характеристик</div>
          <div className="text-[10px] text-slate-400">Дается +1 стат за каждый новый уровень</div>
        </div>
        <div className="text-xl font-extrabold text-yellow-400 bg-black/60 px-3.5 py-1 rounded-lg border border-yellow-500/50">
          {hero.statPoints}
        </div>
      </div>

      {/* Прокачка статов */}
      <div className="space-y-2.5 mb-5">
        <div className="bg-slate-900 border border-red-500/30 p-3 rounded-xl flex items-center justify-between gap-2">
          <div>
            <div className="font-bold text-red-400 text-xs flex items-center gap-1.5">
              ⚔️ Сила: <span className="text-white">{stats.strPoints}</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Бонус к урону: <span className="text-red-300 font-bold">+{stats.strDamage} урон</span> (1 очко = +15, далее +10 за очко)
            </div>
          </div>
          <button
            disabled={hero.statPoints <= 0}
            onClick={() => handleStatClick('str')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all shrink-0 ${
              hero.statPoints > 0
                ? 'bg-red-600 hover:bg-red-500 text-white shadow cursor-pointer active:scale-95'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            +1 Сила
          </button>
        </div>

        <div className="bg-slate-900 border border-sky-500/30 p-3 rounded-xl flex items-center justify-between gap-2">
          <div>
            <div className="font-bold text-sky-400 text-xs flex items-center gap-1.5">
              🛡️ Ловкость: <span className="text-white">{stats.agiPoints}</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Шанс уклонения: <span className="text-sky-300 font-bold">{stats.baseDodgePct}%</span> (1 очко = 10%, далее +1% за очко)
            </div>
          </div>
          <button
            disabled={hero.statPoints <= 0}
            onClick={() => handleStatClick('agi')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all shrink-0 ${
              hero.statPoints > 0
                ? 'bg-sky-600 hover:bg-sky-500 text-white shadow cursor-pointer active:scale-95'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            +1 Ловк.
          </button>
        </div>

        <div className="bg-slate-900 border border-emerald-500/30 p-3 rounded-xl flex items-center justify-between gap-2">
          <div>
            <div className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
              ❤️ Мудрость: <span className="text-white">{stats.vitPoints}</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Здоровье: <span className="text-emerald-300 font-bold">{stats.baseHp} HP</span> (база 250 HP, +50 HP за очко)
            </div>
          </div>
          <button
            disabled={hero.statPoints <= 0}
            onClick={() => handleStatClick('vit')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all shrink-0 ${
              hero.statPoints > 0
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow cursor-pointer active:scale-95'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            +1 Мудр.
          </button>
        </div>
      </div>

      {/* Сводка боевых параметров и бонусов экипировки */}
      <h3 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2">
        Итоговая статистика (с учетом экипировки)
      </h3>
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
        <div className="flex justify-between border-b border-slate-800 pb-1.5">
          <span className="text-slate-400">Уровень:</span>
          <span className="font-bold text-white">{heroLvl} / {MAX_LEVEL}</span>
        </div>
        <div className="flex justify-between border-b border-slate-800 pb-1.5">
          <span className="text-slate-400">Опыт:</span>
          <span className="font-bold text-purple-400">
            {heroLvl >= MAX_LEVEL ? 'МАКСИМУМ' : `${hero.exp.toLocaleString()} / ${expNeeded.toLocaleString()}`}
          </span>
        </div>
        <div className="flex justify-between border-b border-slate-800 pb-1.5">
          <span className="text-slate-400">Общий урон:</span>
          <span className="font-bold text-orange-400">
            ⚔️ {stats.totalDmg}{' '}
            <span className="text-[10px] text-slate-400">
              (сила {stats.strDamage} + экип. {stats.gearDmg}{hero.bonusDmg ? ` + зелья ${hero.bonusDmg}` : ''})
            </span>
          </span>
        </div>
        <div className="flex justify-between border-b border-slate-800 pb-1.5">
          <span className="text-slate-400">Макс. здоровье (HP):</span>
          <span className="font-bold text-red-400">
            ❤️ {hero.hp} / {stats.totalMaxHp}{' '}
            <span className="text-[10px] text-slate-400">
              (мудрость {stats.baseHp} + экип. {stats.gearHp}{hero.bonusHp ? ` + зелья ${hero.bonusHp}` : ''})
            </span>
          </span>
        </div>
        <div className="flex justify-between border-b border-slate-800 pb-1.5">
          <span className="text-slate-400">Шанс уклонения:</span>
          <span className="font-bold text-emerald-400">
            💨 {stats.totalDodgePct}%{' '}
            <span className="text-[10px] text-slate-400">
              (ловкость {stats.baseDodgePct}% + экип. {stats.gearDodge}%)
            </span>
          </span>
        </div>
        <div className="flex justify-between border-b border-slate-800 pb-1.5">
          <span className="text-slate-400">Энергия:</span>
          <span className="font-bold text-cyan-400">
            ⚡ {hero.energy} / {stats.totalMaxEnergy}{' '}
            <span className="text-[10px] text-slate-400">(база 100 + штаны {stats.gearEnergy})</span>
          </span>
        </div>
        <div className="flex justify-between border-b border-slate-800 pb-1.5">
          <span className="text-slate-400">Трата энергии:</span>
          <span className="font-bold text-slate-200 text-[11px]">
            Перемещение: <strong className="text-cyan-300">1 ⚡</strong> • Удар по монстру: <strong className="text-cyan-300">3 ⚡</strong>
          </span>
        </div>
        <div className="flex justify-between border-b border-slate-800 pb-1.5">
          <span className="text-slate-400">Бонус к золоту (перчатки):</span>
          <span className="font-bold text-yellow-400">💰 +{stats.gearGoldPct}%</span>
        </div>
        <div className="flex justify-between border-b border-slate-800 pb-1.5">
          <span className="text-slate-400">Бонус к опыту (кольцо):</span>
          <span className="font-bold text-purple-400">✨ +{stats.gearExpPct}%</span>
        </div>
        <div className="flex justify-between border-b border-slate-800 pb-1.5">
          <span className="text-slate-400">Убито монстров:</span>
          <span className="font-bold text-yellow-500">💀 {hero.mobsKilled}</span>
        </div>
        <div className="flex justify-between border-b border-slate-800 pb-1.5">
          <span className="text-slate-400">Побед в PvP:</span>
          <span className="font-bold text-red-500">⚔️ {hero.pvpKills}</span>
        </div>
        <div className="flex justify-between border-b border-slate-800 pb-1.5">
          <span className="text-slate-400">Смертей:</span>
          <span className="font-bold text-slate-400">🪦 {hero.deaths}</span>
        </div>
        <div className="flex justify-between border-b border-slate-800 pb-1.5">
          <span className="text-slate-400">Потрачено в азартных играх:</span>
          <span className="font-bold text-rose-400">
            🎰 {(hero.gamblingSpentGold || 0).toLocaleString()} 🪙 / {(hero.gamblingSpentCrystals || 0).toLocaleString()} 💎
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Выиграно в азартных играх:</span>
          <span className="font-bold text-emerald-400">
            🏆 {(hero.gamblingWonGold || 0).toLocaleString()} 🪙 / {(hero.gamblingWonCrystals || 0).toLocaleString()} 💎
          </span>
        </div>
      </div>
    </div>
  );
};
