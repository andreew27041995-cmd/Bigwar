import React, { useState, useEffect, useRef } from 'react';
import { HeroState, PortTerminalResourceKey } from '../types/game';
import {
  DEFAULT_PORT_ESTATE_OWNER_NICK,
  OUTLAND_SMUGGLER_PIERS,
  getPharosStadiumState,
  placePharosStadiumBet,
  resolvePharosStadiumMatchNow,
  collectPharosStadiumCommission,
  transferPharosStadiumOwnership,
  PharosStadiumState
} from '../utils/clanStorage';

interface OutlandCell {
  x: number;
  y: number;
  type: 'empty' | 'evac_boat' | 'chest' | 'herb' | 'marauder' | 'reef';
  gold?: number;
  crystals?: number;
  resourceKey?: PortTerminalResourceKey;
  resourceName?: string;
  resourceQty?: number;
  mobName?: string;
  mobDmg?: number;
  cleared?: boolean;
}

interface OutlandRaidBag {
  gold: number;
  crystals: number;
  raw_fish: number;
  iron_ore: number;
  raw_cotton_fiber: number;
  oasis_herb: number;
}

const OUTLAND_STEP_COOLDOWN_SEC = 8;

const STAGE1_DROP_POOL: Array<{ key: 'raw_fish' | 'iron_ore' | 'raw_cotton_fiber'; name: string; icon: string }> = [
  { key: 'raw_fish', name: 'Сырая рыба', icon: '🐟' },
  { key: 'iron_ore', name: 'Железная руда', icon: '⛏️' },
  { key: 'raw_cotton_fiber', name: 'Сырое Волокно', icon: '🧵' }
];

function generateOutlandGrid12x12(): OutlandCell[][] {
  const rows: OutlandCell[][] = [];
  for (let y = 1; y <= 12; y++) {
    const row: OutlandCell[] = [];
    for (let x = 1; x <= 12; x++) {
      if (x === 1 && y === 1) {
        row.push({ x, y, type: 'evac_boat' });
        continue;
      }
      if (x === 12 && y === 12) {
        row.push({ x, y, type: 'empty' });
        continue;
      }
      const roll = Math.random();
      if (roll < 0.14) {
        // Ящик контрабандиста: 40–150 золота + 1–2 ед. сырья 1-го этапа (0 реликвий/амулетов!) + 5% шанс на 1 💎
        const pick = STAGE1_DROP_POOL[Math.floor(Math.random() * STAGE1_DROP_POOL.length)];
        const isRareHerb = Math.random() < 0.3;
        row.push({
          x,
          y,
          type: 'chest',
          gold: 40 + Math.floor(Math.random() * 111), // 40..150 🪙
          crystals: Math.random() < 0.05 ? 1 : 0, // 5% шанс +1 💎
          resourceKey: isRareHerb ? 'oasis_herb' : pick.key,
          resourceName: isRareHerb ? 'Трава Оазиса' : pick.name,
          resourceQty: isRareHerb ? 1 : 1 + Math.floor(Math.random() * 2) // 1..2 шт.
        });
      } else if (roll < 0.24) {
        // Куст «Трава Оазиса»: редкое растение Порта (продажа в Терминале 120 🪙) + немного золота
        row.push({
          x,
          y,
          type: 'herb',
          gold: 40 + Math.floor(Math.random() * 55), // 40..94 🪙
          crystals: Math.random() < 0.05 ? 1 : 0,
          resourceKey: 'oasis_herb',
          resourceName: 'Трава Оазиса',
          resourceQty: 1 + (Math.random() < 0.25 ? 1 : 0) // 1..2 шт.
        });
      } else if (roll < 0.36) {
        // Мародер архипелага: 50–150 золота + 1–2 сырья 1-го этапа, 5% шанс +1 💎
        const mobs = [
          { name: 'Корсар Прибрежья', dmg: 55 },
          { name: 'Мародер Рифов', dmg: 70 },
          { name: 'Контрабандист Сета', dmg: 85 }
        ];
        const m = mobs[Math.floor(Math.random() * mobs.length)];
        const pick = STAGE1_DROP_POOL[Math.floor(Math.random() * STAGE1_DROP_POOL.length)];
        row.push({
          x,
          y,
          type: 'marauder',
          mobName: m.name,
          mobDmg: m.dmg,
          gold: 50 + Math.floor(Math.random() * 101), // 50..150 🪙
          crystals: Math.random() < 0.05 ? 1 : 0,
          resourceKey: pick.key,
          resourceName: pick.name,
          resourceQty: 1 + Math.floor(Math.random() * 2)
        });
      } else if (roll < 0.43) {
        row.push({ x, y, type: 'reef' });
      } else {
        row.push({ x, y, type: 'empty' });
      }
    }
    rows.push(row);
  }
  return rows;
}

export const OutlandRaidView: React.FC<{
  hero: HeroState;
  pierCoord?: { x: number; y: number } | null;
  onUpdateHero: (patch: Partial<HeroState>) => void;
  onNotify?: (msg: string) => void;
  onBackToMap?: () => void;
}> = ({ hero, pierCoord, onUpdateHero, onNotify, onBackToMap }) => {
  const [inRaid, setInRaid] = useState(false);
  const [grid, setGrid] = useState<OutlandCell[][]>(() => generateOutlandGrid12x12());
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 12, y: 12 });
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [stepCooldownUntil, setStepCooldownUntil] = useState<number>(0);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [raidBag, setRaidBag] = useState<OutlandRaidBag>({
    gold: 0,
    crystals: 0,
    raw_fish: 0,
    iron_ore: 0,
    raw_cotton_fiber: 0,
    oasis_herb: 0
  });
  const [raidLog, setRaidLog] = useState<string[]>([
    '🏝️ Прибрежная зона (Outland 12x12): исследуйте сектор 5x5 с радаром и доберитесь до лодки [1/1].'
  ]);

  useEffect(() => {
    if (!inRaid || stepCooldownUntil <= Date.now()) return;
    const t = window.setInterval(() => {
      setNowTs(Date.now());
    }, 250);
    return () => window.clearInterval(t);
  }, [inRaid, stepCooldownUntil]);

  const cooldownRemSec = Math.max(0, Math.ceil((stepCooldownUntil - nowTs) / 1000));

  const activePier =
    OUTLAND_SMUGGLER_PIERS.find((p) => p.x === pierCoord?.x && p.y === pierCoord?.y) ||
    OUTLAND_SMUGGLER_PIERS[0];

  const revealAround = (cx: number, cy: number, prev: Record<string, boolean>) => {
    const next = { ...prev };
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 1 && nx <= 12 && ny >= 1 && ny <= 12) {
          next[`${nx}_${ny}`] = true;
        }
      }
    }
    next['1_1'] = true;
    return next;
  };

  const handleStartRaid = () => {
    const freshGrid = generateOutlandGrid12x12();
    setGrid(freshGrid);
    setPos({ x: 12, y: 12 });
    setVisited(revealAround(12, 12, {}));
    setStepCooldownUntil(0);
    setNowTs(Date.now());
    setRaidBag({
      gold: 0,
      crystals: 0,
      raw_fish: 0,
      iron_ore: 0,
      raw_cotton_fiber: 0,
      oasis_herb: 0
    });
    setRaidLog([
      `🚤 Вы высадились с «${activePier.title}» в сектор [12/12]! Двигайтесь стрелками к Лодке Эвакуации [1/1].`
    ]);
    setInRaid(true);
  };

  const deliverLootToHero = (bag: OutlandRaidBag, mult = 1) => {
    const addGold = Math.floor(bag.gold * mult);
    const addCrystals = Math.floor(bag.crystals * mult);
    const addFish = Math.floor(bag.raw_fish * mult);
    const addIron = Math.floor(bag.iron_ore * mult);
    const addCotton = Math.floor(bag.raw_cotton_fiber * mult);
    const addHerb = Math.floor(bag.oasis_herb * mult);

    const curRes = { ...(hero.portResources || {}) };
    if (addFish > 0) curRes.raw_fish = (curRes.raw_fish || 0) + addFish;
    if (addIron > 0) curRes.iron_ore = (curRes.iron_ore || 0) + addIron;
    if (addCotton > 0) curRes.raw_cotton_fiber = (curRes.raw_cotton_fiber || 0) + addCotton;
    if (addHerb > 0) curRes.oasis_herb = (curRes.oasis_herb || 0) + addHerb;

    onUpdateHero({
      gold: Math.max(0, (hero.gold || 0) + addGold),
      crystals: Math.max(0, (hero.crystals || 0) + addCrystals),
      portResources: curRes
    });

    return { addGold, addCrystals, addFish, addIron, addCotton, addHerb };
  };

  const handleStepDelta = (dx: number, dy: number) => {
    if (!inRaid) return;
    const now = Date.now();
    if (stepCooldownUntil > now) {
      const rem = Math.ceil((stepCooldownUntil - now) / 1000);
      onNotify?.(`⏳ Идет переход по пескам! Следующий шаг доступен через ${rem} сек.`);
      return;
    }

    const tx = pos.x + dx;
    const ty = pos.y + dy;
    if (tx < 1 || tx > 12 || ty < 1 || ty > 12) {
      onNotify?.('🌊 Там открытое море! Выберите направление к острову.');
      return;
    }

    const cell = grid[ty - 1]?.[tx - 1];
    if (!cell) return;
    if (cell.type === 'reef') {
      onNotify?.('🪨 Непроходимые коралловые рифы! Выберите другую стрелку обхода.');
      return;
    }

    const nextVisited = revealAround(tx, ty, visited);
    setVisited(nextVisited);
    setPos({ x: tx, y: ty });
    setNowTs(now);
    setStepCooldownUntil(now + OUTLAND_STEP_COOLDOWN_SEC * 1000);

    if (cell.type === 'evac_boat') {
      const extracted = deliverLootToHero(raidBag, 1);
      const parts = [
        `+${extracted.addGold.toLocaleString('ru-RU')} 🪙`,
        extracted.addCrystals > 0 ? `+${extracted.addCrystals} 💎` : '',
        extracted.addFish > 0 ? `Сырая рыба x${extracted.addFish}` : '',
        extracted.addIron > 0 ? `Жел. руда x${extracted.addIron}` : '',
        extracted.addCotton > 0 ? `Волокно x${extracted.addCotton}` : '',
        extracted.addHerb > 0 ? `Трава Оазиса x${extracted.addHerb}` : ''
      ].filter(Boolean);
      const msg = `🚤 УСПЕШНАЯ ЭВАКУАЦИЯ [1/1]! Вывезли 100% добычи: ${parts.join(', ')}!`;
      setRaidLog((prev) => [msg, ...prev]);
      onNotify?.(msg);
      setInRaid(false);
      return;
    }

    if ((cell.type === 'chest' || cell.type === 'herb') && !cell.cleared) {
      const g = cell.gold || 60;
      const c = cell.crystals || 0;
      const rKey = cell.resourceKey;
      const rQty = cell.resourceQty || 1;
      const nextBag: OutlandRaidBag = {
        ...raidBag,
        gold: raidBag.gold + g,
        crystals: raidBag.crystals + c,
        raw_fish: raidBag.raw_fish + (rKey === 'raw_fish' ? rQty : 0),
        iron_ore: raidBag.iron_ore + (rKey === 'iron_ore' ? rQty : 0),
        raw_cotton_fiber: raidBag.raw_cotton_fiber + (rKey === 'raw_cotton_fiber' ? rQty : 0),
        oasis_herb: raidBag.oasis_herb + (rKey === 'oasis_herb' ? rQty : 0)
      };
      setRaidBag(nextBag);

      const nextGrid = grid.map((row) =>
        row.map((item) =>
          item.x === tx && item.y === ty ? { ...item, cleared: true, type: 'empty' as const } : item
        )
      );
      setGrid(nextGrid);
      const line = `${cell.type === 'herb' ? '🌿 Куст Оазиса' : '🧰 Ящик'} [${tx}/${ty}]: +${g} 🪙${
        c > 0 ? `, +${c} 💎` : ''
      }${cell.resourceName ? `, ${cell.resourceName} x${rQty}` : ''}`;
      setRaidLog((prev) => [line, ...prev.slice(0, 12)]);
      return;
    }

    if (cell.type === 'marauder' && !cell.cleared) {
      const incomingDmg = Math.max(25, (cell.mobDmg || 65) - Math.floor((hero.vit || 5) * 1.5));
      const newHp = Math.max(0, (hero.hp || hero.maxHp || 1000) - incomingDmg);

      if (newHp <= 0) {
        const saved = deliverLootToHero(raidBag, 0.5);
        onUpdateHero({ hp: Math.max(150, Math.floor((hero.maxHp || 1000) * 0.3)) });
        const deathMsg = `💀 Вы пали в стычке с «${cell.mobName}» [${tx}/${ty}]! Спасено 50% мешка: +${saved.addGold} 🪙${
          saved.addCrystals > 0 ? `, +${saved.addCrystals} 💎` : ''
        }.`;
        setRaidLog((prev) => [deathMsg, ...prev]);
        onNotify?.(deathMsg);
        setInRaid(false);
        return;
      }

      const lootGold = cell.gold || 75;
      const lootC = cell.crystals || 0;
      const rKey = cell.resourceKey;
      const rQty = cell.resourceQty || 1;
      onUpdateHero({ hp: newHp });
      setRaidBag((prev) => ({
        ...prev,
        gold: prev.gold + lootGold,
        crystals: prev.crystals + lootC,
        raw_fish: prev.raw_fish + (rKey === 'raw_fish' ? rQty : 0),
        iron_ore: prev.iron_ore + (rKey === 'iron_ore' ? rQty : 0),
        raw_cotton_fiber: prev.raw_cotton_fiber + (rKey === 'raw_cotton_fiber' ? rQty : 0)
      }));
      const nextGrid = grid.map((row) =>
        row.map((item) =>
          item.x === tx && item.y === ty ? { ...item, cleared: true, type: 'empty' as const } : item
        )
      );
      setGrid(nextGrid);
      const winLine = `⚔️ Повержен «${cell.mobName}» [${tx}/${ty}] (-${incomingDmg} HP): +${lootGold} 🪙${
        lootC > 0 ? `, +${lootC} 💎` : ''
      }${cell.resourceName ? `, ${cell.resourceName} x${rQty}` : ''}`;
      setRaidLog((prev) => [winLine, ...prev.slice(0, 12)]);
    }
  };

  // Compass hint toward Evac Boat [1/1]
  const dxEvac = 1 - pos.x;
  const dyEvac = 1 - pos.y;
  const evacDist = Math.max(Math.abs(dxEvac), Math.abs(dyEvac));
  const evacDirArrow =
    dxEvac === 0 && dyEvac === 0
      ? '🚤'
      : `${dyEvac < 0 ? '↑' : dyEvac > 0 ? '↓' : ''}${dxEvac < 0 ? '←' : dxEvac > 0 ? '→' : ''}`;

  return (
    <div className="bg-[#111722] border border-[#2d3b4e] text-[12px] text-[#e2e8f0]">
      {/* Шапка Прибрежной зоны */}
      <div className="bg-[#1a2332] border-b border-[#2d3b4e] px-2.5 py-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-bold text-amber-300 uppercase tracking-wide">
            🏝️ АУТЛЕНД • ПРИБРЕЖНАЯ ЗОНА (РАДАР 5x5)
          </span>
          <span className="ml-2 text-[11px] text-emerald-300 font-mono">
            Причал: {activePier.title}
          </span>
        </div>
        {onBackToMap && (
          <button
            type="button"
            onClick={onBackToMap}
            className="px-2.5 py-1 bg-[#243044] hover:bg-[#31415c] border border-[#3e5270] text-[11px] font-bold text-amber-200 cursor-pointer"
          >
            ⚓ На карту 10x10
          </button>
        )}
      </div>

      {!inRaid ? (
        <div className="p-3 space-y-2.5">
          <div className="border border-amber-500/50 bg-[#1c2638] p-2 text-[11.5px] text-amber-100 leading-snug">
            <span className="font-bold text-amber-300">📜 Правила дикого архипелага 12x12: </span>
            Компактный радар <strong className="text-white">5x5</strong> вокруг героя и пошаговое
            передвижение стрелками с таймером <strong className="text-cyan-300">8 сек/шаг</strong>.
            В тайниках и у мародёров: <strong className="text-amber-300">40–150 🪙</strong>, сырьё
            1-го этапа, редкая <strong className="text-emerald-300">🌿 Трава Оазиса</strong> (120 🪙 в
            Порту) и 5% шанс на <strong className="text-cyan-300">+1 💎</strong>.
          </div>

          <table className="w-full border-collapse text-left text-[11px]">
            <tbody>
              <tr className="bg-[#151d2a]">
                <td className="p-2 border border-[#2d3b4e] font-bold text-amber-300">Старт и Цель</td>
                <td className="p-2 border border-[#2d3b4e]">
                  Высадка в секторе <strong className="font-mono text-sky-300">[12/12]</strong> → Лодка Эвакуации{' '}
                  <strong className="font-mono text-emerald-300">[1/1] 🚤</strong> (100% лута)
                </td>
              </tr>
              <tr className="bg-[#1b2434]">
                <td className="p-2 border border-[#2d3b4e] font-bold text-emerald-300">Средний вынос за рейд</td>
                <td className="p-2 border border-[#2d3b4e]">
                  ~800–1 500 🪙, базовое сырьё для заводов Порта (без реликвий/амулетов 3-го этапа)
                </td>
              </tr>
              <tr className="bg-[#151d2a]">
                <td className="p-2 border border-[#2d3b4e] font-bold text-red-300">Риск</td>
                <td className="p-2 border border-[#2d3b4e]">
                  При бегстве или поражении от мародёра сохраняется только 50% рейдового мешка.
                </td>
              </tr>
            </tbody>
          </table>

          <button
            type="button"
            onClick={handleStartRaid}
            className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 border border-emerald-400 text-white font-bold text-[12.5px] uppercase tracking-wider cursor-pointer"
          >
            🚤 ВЫСАДИТЬСЯ В ПРИБРЕЖНУЮ ЗОНУ [12/12]
          </button>
        </div>
      ) : (
        <div className="p-2.5 space-y-2.5">
          {/* Верхняя полоса радара */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#161f2e] border border-[#2d3b4e] px-2.5 py-1.5 text-[11px]">
            <span>
              Позиция: <strong className="font-mono text-amber-300">[{pos.x}/{pos.y}]</strong> | HP:{' '}
              <strong className="text-red-300">{hero.hp}/{hero.maxHp}</strong>
            </span>
            <span className="font-mono text-emerald-300">
              Компас к Лодке [1/1]: <strong>{evacDirArrow}</strong> ({evacDist} кл.)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
            {/* КОМПАКТНЫЙ РАДАР 5x5 + 8 СТРЕЛОК ПЕРЕДВИЖЕНИЯ */}
            <div className="sm:col-span-6 bg-[#0d131d] border border-[#2d3b4e] p-2 space-y-2">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="font-bold text-amber-300">🧭 Обзор радара 5x5</span>
                <span className={`font-mono font-bold ${cooldownRemSec > 0 ? 'text-amber-300 animate-pulse' : 'text-emerald-400'}`}>
                  {cooldownRemSec > 0 ? `⏳ Шаг через ${cooldownRemSec}с` : '🟢 Можно идти'}
                </span>
              </div>

              {/* Сетка 5x5 с героем строго по центру */}
              <div className="grid grid-cols-5 gap-1 bg-[#090d14] p-1.5 border border-[#263244] max-w-[230px] mx-auto">
                {[-2, -1, 0, 1, 2].map((dy) =>
                  [-2, -1, 0, 1, 2].map((dx) => {
                    const cx = pos.x + dx;
                    const cy = pos.y + dy;
                    const outOfBounds = cx < 1 || cx > 12 || cy < 1 || cy > 12;
                    const isCenter = dx === 0 && dy === 0;
                    const cell = !outOfBounds ? grid[cy - 1]?.[cx - 1] : null;
                    const isVisible = !outOfBounds && Boolean(visited[`${cx}_${cy}`]);

                    let icon = '🌫️';
                    let cellCls = 'bg-[#111824] text-slate-600 border-[#1e293b]';

                    if (outOfBounds) {
                      icon = '🌊';
                      cellCls = 'bg-[#081320] text-cyan-700/80 border-[#102033]';
                    } else if (isCenter) {
                      icon = '🤠';
                      cellCls = 'bg-amber-600/85 text-white border-yellow-300 ring-1 ring-yellow-300';
                    } else if (cx === 1 && cy === 1) {
                      icon = '🚤';
                      cellCls = 'bg-emerald-900/90 text-emerald-200 border-emerald-400';
                    } else if (isVisible && cell) {
                      if (cell.type === 'chest' && !cell.cleared) {
                        icon = '🧰';
                        cellCls = 'bg-amber-950/90 text-amber-300 border-amber-500/60';
                      } else if (cell.type === 'herb' && !cell.cleared) {
                        icon = '🌿';
                        cellCls = 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60';
                      } else if (cell.type === 'marauder' && !cell.cleared) {
                        icon = '🏴‍☠️';
                        cellCls = 'bg-red-950/90 text-red-300 border-red-500/60';
                      } else if (cell.type === 'reef') {
                        icon = '🪨';
                        cellCls = 'bg-slate-800 text-slate-300 border-slate-600';
                      } else {
                        icon = '🌴';
                        cellCls = 'bg-[#16232e] text-emerald-500/70 border-[#223447]';
                      }
                    }

                    const isNeighbor = Math.max(Math.abs(dx), Math.abs(dy)) === 1 && !outOfBounds;
                    return (
                      <button
                        key={`${dx}_${dy}`}
                        type="button"
                        disabled={!isNeighbor}
                        onClick={() => {
                          if (isNeighbor) handleStepDelta(dx, dy);
                        }}
                        title={outOfBounds ? 'Море' : `Сектор [${cx}/${cy}]`}
                        className={`h-9 flex flex-col items-center justify-center border text-[13px] ${cellCls} ${
                          isNeighbor ? 'cursor-pointer hover:brightness-125' : 'cursor-default'
                        }`}
                      >
                        <span className="leading-none">{icon}</span>
                        {!outOfBounds && (
                          <span className="text-[7px] font-mono opacity-80 leading-none mt-0.5">
                            {cx}/{cy}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* 8 Стрелок навигации с таймером */}
              <div className="max-w-[200px] mx-auto pt-1">
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { dx: -1, dy: -1, label: '↖' },
                    { dx: 0, dy: -1, label: '↑' },
                    { dx: 1, dy: -1, label: '↗' },
                    { dx: -1, dy: 0, label: '←' },
                    { dx: 0, dy: 0, label: `${pos.x}/${pos.y}` },
                    { dx: 1, dy: 0, label: '→' },
                    { dx: -1, dy: 1, label: '↙' },
                    { dx: 0, dy: 1, label: '↓' },
                    { dx: 1, dy: 1, label: '↘' }
                  ].map((dir, i) => {
                    if (dir.dx === 0 && dir.dy === 0) {
                      return (
                        <div
                          key={i}
                          className="h-8 flex items-center justify-center bg-[#182232] border border-amber-500/50 text-[10px] font-mono font-bold text-amber-300"
                        >
                          {cooldownRemSec > 0 ? `⏳${cooldownRemSec}с` : dir.label}
                        </div>
                      );
                    }
                    const tx = pos.x + dir.dx;
                    const ty = pos.y + dir.dy;
                    const inBounds = tx >= 1 && tx <= 12 && ty >= 1 && ty <= 12;
                    const isBlockedReef = inBounds && grid[ty - 1]?.[tx - 1]?.type === 'reef';
                    const disabled = !inBounds || isBlockedReef || cooldownRemSec > 0;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleStepDelta(dir.dx, dir.dy)}
                        title={
                          !inBounds
                            ? 'Граница острова'
                            : isBlockedReef
                            ? 'Коралловый риф'
                            : `Шаг в [${tx}/${ty}]`
                        }
                        className={`h-8 border text-[13px] font-black transition-colors ${
                          disabled
                            ? 'bg-[#101621] border-[#1f2937] text-slate-600 cursor-not-allowed'
                            : 'bg-[#22324a] hover:bg-amber-600 border-[#435b7e] hover:border-amber-300 text-white cursor-pointer'
                        }`}
                      >
                        {isBlockedReef ? '🪨' : dir.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* РЕЙДОВЫЙ МЕШОК + ЖУРНАЛ */}
            <div className="sm:col-span-6 flex flex-col gap-2">
              <div className="bg-[#161f2e] border border-[#2d3b4e] p-2">
                <div className="font-bold text-amber-300 uppercase text-[10.5px] border-b border-[#2d3b4e] pb-1 mb-1.5">
                  🎒 РЕЙДОВЫЙ МЕШОК
                </div>
                <table className="w-full border-collapse text-[11px]">
                  <tbody>
                    <tr className="bg-[#131b28]">
                      <td className="p-1 border border-[#2d3b4e]">🪙 Золото:</td>
                      <td className="p-1 border border-[#2d3b4e] font-bold text-amber-300 text-right font-mono">
                        {raidBag.gold.toLocaleString('ru-RU')} 🪙
                      </td>
                    </tr>
                    <tr className="bg-[#1a2436]">
                      <td className="p-1 border border-[#2d3b4e]">💎 Кристаллы (5% шанс):</td>
                      <td className="p-1 border border-[#2d3b4e] font-bold text-cyan-300 text-right font-mono">
                        {raidBag.crystals} 💎
                      </td>
                    </tr>
                    <tr className="bg-[#131b28]">
                      <td className="p-1 border border-[#2d3b4e]">🌿 Трава Оазиса (120 🪙 в Порту):</td>
                      <td className="p-1 border border-[#2d3b4e] font-bold text-emerald-300 text-right font-mono">
                        {raidBag.oasis_herb} шт.
                      </td>
                    </tr>
                    <tr className="bg-[#1a2436]">
                      <td className="p-1 border border-[#2d3b4e]">🐟 Сырая рыба / ⛏️ Руда / 🧵 Волокно:</td>
                      <td className="p-1 border border-[#2d3b4e] font-bold text-sky-200 text-right font-mono">
                        {raidBag.raw_fish} / {raidBag.iron_ore} / {raidBag.raw_cotton_fiber}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <button
                  type="button"
                  onClick={() => {
                    const saved = deliverLootToHero(raidBag, 0.5);
                    const msg = `⚠️ Экстренный отход! Спасено 50% добычи: +${saved.addGold} 🪙${
                      saved.addCrystals > 0 ? `, +${saved.addCrystals} 💎` : ''
                    }.`;
                    onNotify?.(msg);
                    setInRaid(false);
                  }}
                  className="mt-2 w-full py-1.5 bg-red-900/75 hover:bg-red-800 border border-red-500/60 text-red-100 text-[11px] font-bold cursor-pointer"
                >
                  🏳️ Экстренный побег (потеря 50% мешка)
                </button>
              </div>

              <div className="bg-[#161f2e] border border-[#2d3b4e] p-2">
                <div className="font-bold text-sky-300 uppercase text-[10.5px] border-b border-[#2d3b4e] pb-1 mb-1">
                  📜 Журнал рейда
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto text-[10.5px]">
                  {raidLog.map((line, i) => (
                    <div
                      key={i}
                      className={`p-1 border border-[#263346] ${i % 2 === 0 ? 'bg-[#121926]' : 'bg-[#182232]'}`}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const PharosStadiumView: React.FC<{
  hero: HeroState;
  isAdmin?: boolean;
  onUpdateHero: (patch: Partial<HeroState>) => void;
  onNotify?: (msg: string) => void;
  onBackToMap?: () => void;
}> = ({ hero, isAdmin = false, onUpdateHero, onNotify, onBackToMap }) => {
  const [stadium, setStadium] = useState<PharosStadiumState>(() => getPharosStadiumState());
  const [betCurrency, setBetCurrency] = useState<'gold' | 'crystals'>('gold');
  const [betAmount, setBetAmount] = useState<string>('1000');
  const [showTransferBox, setShowTransferBox] = useState(false);
  const [transferTargetNick, setTransferTargetNick] = useState<string>('');
  const [nowTs, setNowTs] = useState<number>(() => Date.now());

  // Интерактивный анимационный бой арены
  const [liveDuel, setLiveDuel] = useState<{
    active: boolean;
    blueHp: number;
    redHp: number;
    logs: string[];
    finishedBanner: string | null;
  } | null>(null);
  const duelTimersRef = useRef<number[]>([]);

  useEffect(() => {
    const t = window.setInterval(() => {
      setNowTs(Date.now());
      setStadium(getPharosStadiumState());
    }, 1000);
    return () => {
      window.clearInterval(t);
      duelTimersRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const currentMatch =
    stadium.matches.find((m) => m.status === 'betting') || stadium.matches[0];

  const playerNick = (hero.nick || DEFAULT_PORT_ESTATE_OWNER_NICK).trim();
  const isOwner =
    Boolean(isAdmin) ||
    stadium.ownerNick.trim().toLowerCase() === playerNick.toLowerCase();

  const blueTeamName = currentMatch?.teamAName || 'Гвардия Фараона';
  const redTeamName = currentMatch?.teamBName || 'Братство Сета';
  const blueOdds = currentMatch?.teamAOdds || 1.8;
  const redOdds = currentMatch?.teamBOdds || 2.0;

  const remSec = currentMatch
    ? Math.max(0, Math.floor((currentMatch.startsAt - nowTs) / 1000))
    : 240;
  const mm = Math.floor(remSec / 60);
  const ss = remSec % 60;

  const parsedBet = Math.max(1, Math.floor(Number(betAmount) || 0));
  const myActiveBetsOnCurrent = currentMatch
    ? stadium.bets.filter(
        (b) =>
          b.matchId === currentMatch.id &&
          b.status === 'active' &&
          b.playerNick.trim().toLowerCase() === playerNick.toLowerCase()
      )
    : [];

  const handleQuickBet = (side: 'A' | 'B') => {
    if (!currentMatch || liveDuel?.active) return;
    const res = placePharosStadiumBet(
      playerNick,
      currentMatch.id,
      side,
      betCurrency,
      parsedBet,
      hero.gold || 0,
      hero.crystals || 0
    );
    if (!res.ok) {
      onNotify?.(res.error || 'Ошибка ставки');
      return;
    }
    if (res.state) setStadium({ ...res.state });
    onUpdateHero({
      gold: Math.max(0, (hero.gold || 0) - (res.goldSpent || 0)),
      crystals: Math.max(0, (hero.crystals || 0) - (res.crystalsSpent || 0))
    });
    if (res.message) onNotify?.(res.message);
  };

  const handleWatchFightNow = () => {
    if (!currentMatch || liveDuel?.active) return;
    duelTimersRef.current.forEach((id) => window.clearTimeout(id));
    duelTimersRef.current = [];

    setLiveDuel({
      active: true,
      blueHp: 100,
      redHp: 100,
      logs: [`🔔 Гонг Арены Фароса! Начинается схватка «${blueTeamName}» против «${redTeamName}»!`],
      finishedBanner: null
    });

    const t1 = window.setTimeout(() => {
      setLiveDuel((prev) =>
        prev
          ? {
              ...prev,
              blueHp: 76,
              redHp: 68,
              logs: [
                ...prev.logs,
                `⚔️ Раунд 1: Бойцы обменялись мощными ударами! ${blueTeamName} (76% HP) vs ${redTeamName} (68% HP).`
              ]
            }
          : prev
      );
    }, 800);

    const t2 = window.setTimeout(() => {
      setLiveDuel((prev) =>
        prev
          ? {
              ...prev,
              blueHp: 44,
              redHp: 39,
              logs: [
                ...prev.logs,
                `💥 Раунд 2: Критический выпад на песке Колизея! Остаётся последняя схватка...`
              ]
            }
          : prev
      );
    }, 1700);

    const t3 = window.setTimeout(() => {
      const res = resolvePharosStadiumMatchNow(currentMatch.id, playerNick);
      if (res.state) setStadium({ ...res.state });
      if (res.wonGold > 0 || res.wonCrystals > 0) {
        onUpdateHero({
          gold: (hero.gold || 0) + res.wonGold,
          crystals: (hero.crystals || 0) + res.wonCrystals
        });
      }
      const winText = res.message || 'Бой завершен!';
      if (res.message) onNotify?.(res.message);

      setLiveDuel((prev) =>
        prev
          ? {
              active: false,
              blueHp: res.message?.includes(blueTeamName) ? 28 : 0,
              redHp: res.message?.includes(blueTeamName) ? 0 : 28,
              logs: [...prev.logs, `🏆 ${winText}`],
              finishedBanner: winText
            }
          : null
      );
    }, 2600);

    duelTimersRef.current = [t1, t2, t3];
  };

  const handleCollectCommission = () => {
    const res = collectPharosStadiumCommission(playerNick, isAdmin);
    if (!res.ok) {
      onNotify?.(res.error || 'Ошибка сбора выручки');
      return;
    }
    if (res.state) setStadium({ ...res.state });
    onUpdateHero({
      gold: (hero.gold || 0) + res.collectedGold,
      crystals: (hero.crystals || 0) + res.collectedCrystals
    });
    if (res.message) onNotify?.(res.message);
  };

  const handleTransferStadium = () => {
    const res = transferPharosStadiumOwnership(playerNick, transferTargetNick, isAdmin);
    if (!res.ok) {
      onNotify?.(res.error || 'Ошибка передачи Стадиона');
      return;
    }
    if (res.state) setStadium({ ...res.state });
    setTransferTargetNick('');
    setShowTransferBox(false);
    if (res.message) onNotify?.(res.message);
  };

  return (
    <div className="bg-[#111722] border border-[#2d3b4e] text-[12px] text-[#e2e8f0] space-y-2.5 p-2.5">
      {/* Шапка Стадиона */}
      <div className="bg-[#1a2332] border border-[#2d3b4e] px-2.5 py-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-bold text-amber-300 uppercase tracking-wide">
            🏟️ СТАДИОН ФАРОСА [5/5] • ТОТАЛИЗАТОР В 3 КЛИКА
          </span>
        </div>
        {onBackToMap && (
          <button
            type="button"
            onClick={onBackToMap}
            className="px-2.5 py-1 bg-[#243044] hover:bg-[#31415c] border border-[#3e5270] text-[11px] font-bold text-amber-200 cursor-pointer"
          >
            ⚓ На карту 10x10
          </button>
        )}
      </div>

      {/* КАРТОЧКА 1: БЛИЖАЙШИЙ БОЙ НА АРЕНЕ */}
      <div className="bg-[#151e2c] border border-amber-500/50 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2d3b4e] pb-2">
          <span className="font-bold text-amber-300 uppercase text-[11.5px]">
            ⚔️ БЛИЖАЙШИЙ БОЙ НА АРЕНЕ
          </span>
          <span className="font-mono text-emerald-300 font-bold text-[11px]">
            Старт через {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
          </span>
        </div>

        {/* Выбор суммы ставки и валюты */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#101722] border border-[#283548] p-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-300">Ставка:</span>
            <input
              type="number"
              min={1}
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="w-24 px-2 py-1 bg-[#0b1018] border border-[#3b4e6d] text-white font-mono text-[12px]"
            />
            <button
              type="button"
              onClick={() => {
                setBetCurrency('gold');
                setBetAmount('1000');
              }}
              className={`px-2 py-1 border text-[11px] font-bold cursor-pointer ${
                betCurrency === 'gold'
                  ? 'bg-amber-600 border-amber-300 text-white'
                  : 'bg-[#162030] border-[#2d3b4e] text-gray-300'
              }`}
            >
              🪙 Золото
            </button>
            <button
              type="button"
              onClick={() => {
                setBetCurrency('crystals');
                setBetAmount('10');
              }}
              className={`px-2 py-1 border text-[11px] font-bold cursor-pointer ${
                betCurrency === 'crystals'
                  ? 'bg-cyan-700 border-cyan-300 text-white'
                  : 'bg-[#162030] border-[#2d3b4e] text-gray-300'
              }`}
            >
              💎 Кристаллы
            </button>
          </div>

          <div className="text-[11px] text-amber-200">
            Ваш баланс:{' '}
            <strong>
              {betCurrency === 'gold'
                ? `${(hero.gold || 0).toLocaleString('ru-RU')} 🪙`
                : `${(hero.crystals || 0).toLocaleString('ru-RU')} 💎`}
            </strong>
          </div>
        </div>

        {/* 2 понятные команды: Синяя vs Красная */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* СИНИЕ */}
          <div className="border border-sky-500/60 bg-sky-950/35 p-2.5 flex flex-col justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold uppercase text-sky-300">🔵 Синяя команда</div>
              <div className="text-[13px] font-bold text-white mt-0.5">«{blueTeamName}»</div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Сила: <strong className="text-sky-200">850</strong> | Коэфф:{' '}
                <strong className="text-amber-300 font-mono">x{blueOdds}</strong>
              </div>
              <div className="text-[10.5px] text-emerald-300 mt-1">
                Если ваша команда победит, вы получите:{' '}
                <strong className="font-mono">
                  {Math.round(parsedBet * blueOdds).toLocaleString('ru-RU')}{' '}
                  {betCurrency === 'gold' ? '🪙' : '💎'}
                </strong>
              </div>
            </div>
            <button
              type="button"
              disabled={Boolean(liveDuel?.active)}
              onClick={() => handleQuickBet('A')}
              className="w-full py-2 bg-sky-700 hover:bg-sky-600 border border-sky-400 text-white font-bold text-[11.5px] cursor-pointer disabled:opacity-50"
            >
              Поставить на Синих ({parsedBet.toLocaleString('ru-RU')} {betCurrency === 'gold' ? '🪙' : '💎'})
            </button>
          </div>

          {/* КРАСНЫЕ */}
          <div className="border border-rose-500/60 bg-rose-950/35 p-2.5 flex flex-col justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold uppercase text-rose-300">🔴 Красная команда</div>
              <div className="text-[13px] font-bold text-white mt-0.5">«{redTeamName}»</div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Сила: <strong className="text-rose-200">780</strong> | Коэфф:{' '}
                <strong className="text-amber-300 font-mono">x{redOdds}</strong>
              </div>
              <div className="text-[10.5px] text-emerald-300 mt-1">
                Если ваша команда победит, вы получите:{' '}
                <strong className="font-mono">
                  {Math.round(parsedBet * redOdds).toLocaleString('ru-RU')}{' '}
                  {betCurrency === 'gold' ? '🪙' : '💎'}
                </strong>
              </div>
            </div>
            <button
              type="button"
              disabled={Boolean(liveDuel?.active)}
              onClick={() => handleQuickBet('B')}
              className="w-full py-2 bg-rose-700 hover:bg-rose-600 border border-rose-400 text-white font-bold text-[11.5px] cursor-pointer disabled:opacity-50"
            >
              Поставить на Красных ({parsedBet.toLocaleString('ru-RU')} {betCurrency === 'gold' ? '🪙' : '💎'})
            </button>
          </div>
        </div>

        {/* Активные ставки игрока на текущий бой */}
        {myActiveBetsOnCurrent.length > 0 && (
          <div className="bg-emerald-950/40 border border-emerald-500/50 px-2.5 py-1.5 text-[11px] text-emerald-200">
            🎟️ Ваши ставки в этом бою:{' '}
            {myActiveBetsOnCurrent.map((b, idx) => (
              <span key={b.id} className="font-bold">
                {idx > 0 ? '; ' : ''}
                {b.amount.toLocaleString('ru-RU')} {b.currency === 'gold' ? '🪙' : '💎'} на «{b.teamName}» (выплата{' '}
                {Math.round(b.amount * b.odds).toLocaleString('ru-RU')})
              </span>
            ))}
          </div>
        )}

        {/* Кнопка [ ▶️ Смотреть бой сейчас ] и живой ход боя */}
        <button
          type="button"
          disabled={Boolean(liveDuel?.active)}
          onClick={handleWatchFightNow}
          className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 border border-amber-300 text-white font-bold text-[12.5px] uppercase tracking-wider cursor-pointer disabled:opacity-60"
        >
          {liveDuel?.active ? '⚔️ ИДЕТ БОЙ НА АРЕНЕ ФАРОСА...' : '▶️ Смотреть бой сейчас'}
        </button>

        {liveDuel && (
          <div className="bg-[#0d131d] border border-[#2d3b4e] p-2.5 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[10.5px]">
              <div>
                <div className="flex justify-between text-sky-300 font-bold mb-0.5">
                  <span>🔵 {blueTeamName}</span>
                  <span>{liveDuel.blueHp}%</span>
                </div>
                <div className="h-2 bg-slate-900 border border-sky-500/50">
                  <div className="h-full bg-sky-500 transition-all duration-500" style={{ width: `${liveDuel.blueHp}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-rose-300 font-bold mb-0.5">
                  <span>🔴 {redTeamName}</span>
                  <span>{liveDuel.redHp}%</span>
                </div>
                <div className="h-2 bg-slate-900 border border-rose-500/50">
                  <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${liveDuel.redHp}%` }} />
                </div>
              </div>
            </div>
            <div className="space-y-1 text-[11px] text-slate-200">
              {liveDuel.logs.map((l, i) => (
                <div key={i} className="bg-[#141d2b] border border-[#263346] px-2 py-1">
                  {l}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* КАРТОЧКА 2: КАССА ВЛАДЕЛЬЦА СТАДИОНА */}
      <div className="bg-[#151e2c] border border-[#2d3b4e] p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11.5px] leading-snug">
            🏦 <strong className="text-amber-300">Касса Стадиона</strong> (Владелец:{' '}
            <strong className="text-white">{stadium.ownerNick}</strong>): накоплено{' '}
            <strong className="text-amber-300 font-mono">
              {stadium.commissionBoxGold.toLocaleString('ru-RU')} 🪙
            </strong>
            {stadium.commissionBoxCrystals > 0 && (
              <strong className="text-cyan-300 font-mono">
                {' '}
                / {stadium.commissionBoxCrystals.toLocaleString('ru-RU')} 💎
              </strong>
            )}{' '}
            <span className="text-slate-400">(10% комиссия со всех ставок игроков)</span>
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowTransferBox((p) => !p)}
              className="text-[10.5px] text-slate-300 hover:text-amber-200 underline cursor-pointer"
            >
              🤝 Передать Стадион
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleCollectCommission}
          disabled={!isOwner}
          className={`w-full py-2 border font-bold text-[12px] ${
            isOwner
              ? 'bg-emerald-700 hover:bg-emerald-600 border-emerald-400 text-white cursor-pointer'
              : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          💰 Забрать выручку ({stadium.commissionBoxGold.toLocaleString('ru-RU')} 🪙
          {stadium.commissionBoxCrystals > 0 ? ` / ${stadium.commissionBoxCrystals} 💎` : ''})
        </button>

        {isOwner && showTransferBox && (
          <div className="flex gap-1.5 pt-1">
            <input
              type="text"
              value={transferTargetNick}
              onChange={(e) => setTransferTargetNick(e.target.value)}
              placeholder="Никнейм нового владельца..."
              className="flex-1 px-2 py-1 bg-[#0d131d] border border-[#334155] text-white text-[11px]"
            />
            <button
              type="button"
              onClick={handleTransferStadium}
              className="px-3 py-1 bg-[#253449] hover:bg-[#324663] border border-amber-400/60 text-amber-200 font-bold text-[11px] cursor-pointer"
            >
              Подтвердить
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
