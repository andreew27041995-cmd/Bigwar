import React, { useState } from 'react';
import { getClanSyndicateRankByLevel } from '../utils/clanStorage';

interface ClanRankEpauletteProps {
  rankLevel?: number;
  level?: number;
  pts?: number;
  size?: 'sm' | 'md' | 'lg';
  badgeEquipped?: boolean;
  className?: string;
  showLabel?: boolean;
}

/**
 * Программный SVG-генератор пиксель-арт плашек Погон (15 воинских званий в стиле Gwars).
 * Размеры:
 * - sm: 28x14px (в списках, шапке, логах боев 7х7, протоколах работы и секторе)
 * - md: 42x21px (в таблицах Военторга и Админ-панели)
 * - lg: 56x28px (внутри Профиля персонажа)
 */
export const ClanRankEpaulette: React.FC<ClanRankEpauletteProps> = ({
  rankLevel,
  level,
  pts,
  size = 'sm',
  badgeEquipped = true,
  className = '',
  showLabel = false
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const clampedLvl = Math.max(1, Math.min(15, Math.floor(Number(rankLevel ?? level) || 1)));
  const rankMeta = getClanSyndicateRankByLevel(clampedLvl);

  const widthPx = size === 'lg' ? 56 : size === 'md' ? 42 : 28;
  const heightPx = size === 'lg' ? 28 : size === 'md' ? 21 : 14;

  const isMarshal = clampedLvl === 15;
  const bgFill = isMarshal ? '#5a1818' : '#2b3a26';
  const borderStroke = isMarshal ? '#ffd700' : '#c8a858';

  const displayPts = typeof pts === 'number' ? pts : (rankMeta.requiredPts ?? rankMeta.reqPts ?? 0);
  const rankTitle = rankMeta.title || rankMeta.name || `Звание #${clampedLvl}`;
  const bonusSummaryText =
    rankMeta.bonusSummary ||
    rankMeta.perkDescription ||
    `+${rankMeta.vitBonus} Выносл. (+${rankMeta.hpBonusPct}% HP), +${rankMeta.strBonus} Силы (+${rankMeta.dmgBonusPct}% Урона), +${rankMeta.armorBonusPct}% Брони, +${rankMeta.cargoWeightBonus} вес`;

  const tooltipText = `Звание: ${rankTitle} (${displayPts.toLocaleString('ru-RU')} PTS) | Бонусы: ${bonusSummaryText}${
    rankMeta.perkName ? ` | Перк: ${rankMeta.perkName} (${rankMeta.perkDescription})` : ''
  }${!badgeEquipped ? ' [Знак клана снят — бонусы неактивны]' : ''}`;

  // Вспомогательная 5-конечная звезда в координатах viewBox 56x28
  const renderStar = (cx: number, cy: number, rOuter: number, fill = '#ffd700', stroke = '#92400e') => {
    const rInner = rOuter * 0.44;
    const ptsArr: string[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? rOuter : rInner;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      ptsArr.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return (
      <polygon
        key={`star_${cx}_${cy}`}
        points={ptsArr.join(' ')}
        fill={fill}
        stroke={stroke}
        strokeWidth="0.6"
      />
    );
  };

  const renderInsignia = () => {
    switch (clampedLvl) {
      case 1:
        // 1. Рядовой (Солдат): чистый зеленый погон без лычек
        return null;
      case 2:
        // 2. Старший солдат: 1 узкая вертикальная золотая лычка
        return <rect x="14" y="2.5" width="3.2" height="23" fill="#eab308" stroke="#713f12" strokeWidth="0.5" />;
      case 3:
        // 3. Младший сержант: 2 узкие золотые лычки
        return (
          <>
            <rect x="12" y="2.5" width="3" height="23" fill="#eab308" stroke="#713f12" strokeWidth="0.5" />
            <rect x="18" y="2.5" width="3" height="23" fill="#eab308" stroke="#713f12" strokeWidth="0.5" />
          </>
        );
      case 4:
        // 4. Сержант: 3 узкие золотые лычки
        return (
          <>
            <rect x="10" y="2.5" width="2.8" height="23" fill="#eab308" stroke="#713f12" strokeWidth="0.5" />
            <rect x="15.5" y="2.5" width="2.8" height="23" fill="#eab308" stroke="#713f12" strokeWidth="0.5" />
            <rect x="21" y="2.5" width="2.8" height="23" fill="#eab308" stroke="#713f12" strokeWidth="0.5" />
          </>
        );
      case 5:
        // 5. Старший сержант: 1 широкая золотая лычка
        return <rect x="12" y="2.5" width="7.5" height="23" fill="#facc15" stroke="#713f12" strokeWidth="0.6" />;
      case 6:
        // 6. Старшина: 1 широкая продольная золотая полоса вдоль погона (Т-образная)
        return (
          <>
            <rect x="8" y="2.5" width="4.5" height="23" fill="#facc15" stroke="#713f12" strokeWidth="0.5" />
            <rect x="8" y="11" width="40" height="6" fill="#facc15" stroke="#713f12" strokeWidth="0.5" />
          </>
        );
      case 7:
        // 7. Прапорщик: 2 маленькие серебряные/золотые звездочки в ряд (★★)
        return (
          <>
            {renderStar(19, 14, 4.2, '#fef08a', '#854d0e')}
            {renderStar(33, 14, 4.2, '#fef08a', '#854d0e')}
          </>
        );
      case 8:
        // 8. Младший лейтенант: 1 продольный красный просвет + 1 маленькая золотая звездочка (★)
        return (
          <>
            <rect x="3" y="12.5" width="50" height="3" fill="#dc2626" />
            {renderStar(26, 14, 4.3)}
          </>
        );
      case 9:
        // 9. Лейтенант: 1 просвет + 2 маленькие золотые звездочки (★★)
        return (
          <>
            <rect x="3" y="12.5" width="50" height="3" fill="#dc2626" />
            {renderStar(18, 8.5, 4.1)}
            {renderStar(18, 19.5, 4.1)}
          </>
        );
      case 10:
        // 10. Старший лейтенант: 1 просвет + 3 маленькие золотые звездочки (★★★)
        return (
          <>
            <rect x="3" y="12.5" width="50" height="3" fill="#dc2626" />
            {renderStar(16, 8.5, 4.0)}
            {renderStar(16, 19.5, 4.0)}
            {renderStar(29, 14, 4.0)}
          </>
        );
      case 11:
        // 11. Капитан: 1 просвет + 4 маленькие золотые звездочки (★★★★)
        return (
          <>
            <rect x="3" y="12.5" width="50" height="3" fill="#dc2626" />
            {renderStar(14, 8.5, 3.8)}
            {renderStar(14, 19.5, 3.8)}
            {renderStar(25, 14, 3.8)}
            {renderStar(36, 14, 3.8)}
          </>
        );
      case 12:
        // 12. Майор: 2 просвета + 1 средняя золотая звезда (★)
        return (
          <>
            <rect x="3" y="8" width="50" height="2.6" fill="#dc2626" />
            <rect x="3" y="17.4" width="50" height="2.6" fill="#dc2626" />
            {renderStar(25, 14, 5.8)}
          </>
        );
      case 13:
        // 13. Подполковник: 2 просвета + 2 средние золотые звезды (★★)
        return (
          <>
            <rect x="3" y="8" width="50" height="2.6" fill="#dc2626" />
            <rect x="3" y="17.4" width="50" height="2.6" fill="#dc2626" />
            {renderStar(18, 9, 5.3)}
            {renderStar(18, 19, 5.3)}
          </>
        );
      case 14:
        // 14. Полковник: 2 просвета + 3 средние золотые звезды (★★★)
        return (
          <>
            <rect x="3" y="8" width="50" height="2.6" fill="#dc2626" />
            <rect x="3" y="17.4" width="50" height="2.6" fill="#dc2626" />
            {renderStar(15, 8.8, 5.0)}
            {renderStar(15, 19.2, 5.0)}
            {renderStar(30, 14, 5.2)}
          </>
        );
      case 15:
      default:
        // 15. Генерал / Маршал: парадный бордово-золотой погон + 1 большая золотая звезда с лавровым венком (★)
        return (
          <>
            {/* Золотое парадное шитье вдоль краев */}
            <rect x="3" y="3" width="50" height="22" rx="2" fill="none" stroke="#facc15" strokeWidth="1.1" strokeDasharray="2 1" />
            {/* Лавровый венок вокруг маршальской звезды */}
            <circle cx="24" cy="14" r="9.2" fill="none" stroke="#eab308" strokeWidth="1.6" strokeDasharray="3 1.2" />
            {renderStar(24, 14, 7.6, '#fde047', '#a16207')}
          </>
        );
    }
  };

  return (
    <span
      className={`relative inline-flex items-center gap-1 select-none align-middle ${className}`}
      title={tooltipText}
      onClick={(e) => {
        e.stopPropagation();
        setShowPopup((v) => !v);
      }}
      onMouseLeave={() => setShowPopup(false)}
    >
      <svg
        width={widthPx}
        height={heightPx}
        viewBox="0 0 56 28"
        className={`shrink-0 rounded-[2px] shadow-sm cursor-pointer ${
          !badgeEquipped ? 'opacity-65 grayscale-[35%]' : ''
        }`}
        style={{ imageRendering: 'pixelated' }}
      >
        {/* Основа погона со скошенным правым краем под пуговицу */}
        <polygon
          points="1,1 48,1 55,7 55,21 48,27 1,27"
          fill={bgFill}
          stroke={borderStroke}
          strokeWidth="1.8"
        />
        {/* Текстурная внутренняя рамка */}
        <polygon
          points="3,3 47,3 53,8 53,20 47,25 3,25"
          fill="none"
          stroke={isMarshal ? '#b45309' : '#3f5238'}
          strokeWidth="0.7"
        />
        {/* Лычки / Просветы / Звезды */}
        {renderInsignia()}
        {/* Золотая пуговка погона справа */}
        <circle cx="49.5" cy="14" r="2.2" fill="#facc15" stroke="#78350f" strokeWidth="0.7" />
      </svg>

      {showLabel && (
        <span className="text-[10px] font-bold text-[#1f3b1f]">
          {rankTitle}
        </span>
      )}

      {showPopup && (
        <span
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full left-0 z-50 mb-1.5 w-64 rounded border border-[#b8a060] bg-[#1e261c] p-2 text-left text-[10px] text-[#f4f4e8] shadow-xl pointer-events-auto"
        >
          <div className="font-black text-amber-300 border-b border-[#3d4d38] pb-1 mb-1 flex items-center justify-between">
            <span>🎖️ {rankTitle}</span>
            <span className="font-mono text-[9px] text-emerald-300">
              {displayPts.toLocaleString('ru-RU')} PTS
            </span>
          </div>
          <div className="text-[9.5px] leading-snug text-slate-200">
            <strong>Бонусы:</strong> {bonusSummaryText}
          </div>
          {rankMeta.perkName && (
            <div className="mt-1 text-[9.5px] leading-snug text-cyan-300">
              <strong>Перк «{rankMeta.perkName}»:</strong> {rankMeta.perkDescription}
            </div>
          )}
          <div className="mt-1 text-[8.5px] text-amber-200/80">
            {badgeEquipped
              ? '✅ Знак клана надет — бонусы погона активны'
              : '⚠️ Наденьте «Знак клана», чтобы активировать бонусы погона'}
          </div>
        </span>
      )}
    </span>
  );
};

interface ClanBadgeMiniProps {
  emblem?: string | null;
  tag?: string | null;
  clanName?: string | null;
  size?: number;
  className?: string;
}

/**
 * Компактный значок клана 18x18px в стиле Gwars рядом с погоном и ником игрока
 */
export const ClanBadgeMini: React.FC<ClanBadgeMiniProps> = ({
  emblem,
  tag,
  clanName,
  size = 18,
  className = ''
}) => {
  const isImageUrl = Boolean(
    emblem &&
      (emblem.startsWith('data:image/') ||
        emblem.startsWith('http://') ||
        emblem.startsWith('https://') ||
        emblem.startsWith('/'))
  );

  return (
    <span
      className={`inline-flex items-center gap-0.5 align-middle select-none shrink-0 ${className}`}
      title={clanName ? `Клан: [${tag || 'КЛАН'}] ${clanName}` : tag ? `[${tag}]` : 'Знак клана'}
    >
      <span
        style={{ width: `${size}px`, height: `${size}px` }}
        className="inline-flex items-center justify-center rounded-[2px] border border-[#b89b52] bg-[#1f291e] text-[11px] leading-none shadow-sm overflow-hidden shrink-0"
      >
        {isImageUrl ? (
          <img
            src={emblem || ''}
            alt={tag || 'clan'}
            className="h-full w-full object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <span>{emblem || '🦅'}</span>
        )}
      </span>
      {tag && (
        <span className="font-mono text-[9.5px] font-black text-amber-300 leading-none">
          [{tag}]
        </span>
      )}
    </span>
  );
};

