import React, { useState, useEffect, useMemo } from 'react';
import {
  HeroState,
  GameItem,
  EquippedGear,
  GameFeatureFlags,
  PortTravelState
} from '../../types/game';
import {
  formatTravelTimeText,
  isTransportItem,
  isRelicItem
} from '../../utils/shopConfig';
import { ItemIcon } from '../ItemIcon';
import { GoldCoinIcon, CrystalIcon } from '../CurrencyIcon';

interface PortModalProps {
  hero: HeroState;
  inventory: GameItem[];
  equipped?: EquippedGear;
  featureFlags?: GameFeatureFlags;
  onSelectTransport: (transportId: string) => void;
  onStartTravelToPort: (transport: GameItem, durationSec?: number) => void;
  onStartReturnFromPort: (transport?: GameItem | null, durationSec?: number) => void;
  onCompletePortTravelStep?: (nextStateOrStatus: any) => void;
  onCompleteTravelStep?: (nextStatus: 'in_port' | 'idle') => void;
  onOpenCreateItem?: () => void;
  onOpenForgeWeapon?: () => void;
  onOpenAltar: () => void;
  onOpenTransportShop?: () => void;
  onOpenShopTransport?: () => void;
  showToast?: (msg: string) => void;
  onClose: () => void;
}

export const PortModal: React.FC<PortModalProps> = ({
  hero,
  inventory,
  equipped,
  featureFlags,
  onSelectTransport,
  onStartTravelToPort,
  onStartReturnFromPort,
  onCompletePortTravelStep,
  onCompleteTravelStep,
  onOpenCreateItem,
  onOpenForgeWeapon,
  onOpenAltar,
  onOpenTransportShop,
  onOpenShopTransport,
  onClose
}) => {
  const handleOpenTransportShop = onOpenTransportShop || onOpenShopTransport || (() => {});
  const handleOpenForge = onOpenCreateItem || onOpenForgeWeapon || (() => {});
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  const ownedTransports = useMemo(() => {
    const list: GameItem[] = [];
    const seenIds = new Set<string>();
    const eqTr = equipped?.transport;
    if (eqTr && isTransportItem(eqTr)) {
      list.push(eqTr);
      seenIds.add(eqTr.id);
    }
    (Array.isArray(inventory) ? inventory : []).forEach((it) => {
      if (isTransportItem(it) && !seenIds.has(it.id)) {
        list.push(it);
        seenIds.add(it.id);
      }
    });
    return list;
  }, [inventory, equipped]);

  const relicsCount = useMemo(() => {
    return (Array.isArray(inventory) ? inventory : []).filter((it) => isRelicItem(it)).length;
  }, [inventory]);

  const activeTransport = useMemo(() => {
    if (hero.activeTransportId) {
      const found = ownedTransports.find((t) => t.id === hero.activeTransportId);
      if (found) return found;
    }
    if (equipped?.transport && Number(equipped.transport.durability ?? 1) > 0) {
      return equipped.transport;
    }
    // Auto-pick fastest available transport with durability > 0
    const usable = ownedTransports
      .filter((t) => Number(t.durability ?? 1) > 0 && Number(hero.level || 1) >= Number(t.lvl || 1))
      .sort((a, b) => Number(a.travelTimeSec || 600) - Number(b.travelTimeSec || 600));
    return usable[0] || ownedTransports[0] || null;
  }, [ownedTransports, equipped, hero.activeTransportId, hero.level]);

  const portTravel: PortTravelState = hero.portTravel || { status: 'idle' };
  const travelStatus = portTravel.status || 'idle';
  const startMs = portTravel.departureTime || portTravel.startTime || 0;

  // Auto-transition when travel timer finishes
  useEffect(() => {
    if (travelStatus === 'to_port' && portTravel.arrivalTime && nowMs >= portTravel.arrivalTime) {
      if (onCompleteTravelStep) {
        onCompleteTravelStep('in_port');
      } else if (onCompletePortTravelStep) {
        onCompletePortTravelStep('in_port');
      }
    } else if (travelStatus === 'from_port' && portTravel.arrivalTime && nowMs >= portTravel.arrivalTime) {
      if (onCompleteTravelStep) {
        onCompleteTravelStep('idle');
      } else if (onCompletePortTravelStep) {
        onCompletePortTravelStep('idle');
      }
    }
  }, [travelStatus, portTravel, nowMs, onCompletePortTravelStep, onCompleteTravelStep]);

  const remainingSec = useMemo(() => {
    if ((travelStatus === 'to_port' || travelStatus === 'from_port') && portTravel.arrivalTime) {
      return Math.max(0, Math.ceil((portTravel.arrivalTime - nowMs) / 1000));
    }
    return 0;
  }, [travelStatus, portTravel.arrivalTime, nowMs]);

  const progressPct = useMemo(() => {
    if (
      (travelStatus === 'to_port' || travelStatus === 'from_port') &&
      startMs > 0 &&
      portTravel.arrivalTime &&
      portTravel.arrivalTime > startMs
    ) {
      const totalMs = portTravel.arrivalTime - startMs;
      const elapsedMs = Math.max(0, Math.min(totalMs, nowMs - startMs));
      return Math.max(2, Math.min(100, Math.round((elapsedMs / totalMs) * 100)));
    }
    return 0;
  }, [travelStatus, startMs, portTravel.arrivalTime, nowMs]);

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const canUseSelectedTransport = Boolean(
    activeTransport &&
      Number(activeTransport.durability ?? 1) > 0 &&
      Number(hero.level || 1) >= Number(activeTransport.lvl || 1)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2.5 backdrop-blur-md select-none">
      <div
        className="relative flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border-2 border-cyan-500/80 text-slate-100 shadow-[0_0_50px_rgba(6,182,212,0.35)]"
        style={{
          background:
            'radial-gradient(circle at 50% 25%, rgba(14, 116, 144, 0.38) 0%, rgba(15, 23, 42, 0.96) 60%, rgba(3, 7, 18, 1) 100%)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/40 bg-slate-950/90 px-3.5 py-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/70 bg-cyan-950/80 text-xl shadow-[0_0_12px_rgba(34,211,238,0.5)]">
              ⚓
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-serif text-sm sm:text-base font-black uppercase tracking-wider text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
                Порт Древнего Нила
              </h2>
              <p className="truncate text-[10px] text-cyan-100/75">
                Кузница Оружия и Именного Транспорта • Алтарь Модификации по Реликвиям
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-2 py-1 text-[10px] font-black">
              <span className="inline-flex items-center gap-1 text-amber-300">
                <GoldCoinIcon size="sm" />
                <span>{hero.gold.toLocaleString('ru-RU')}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-cyan-300">
                <CrystalIcon size="sm" />
                <span>{hero.crystals.toLocaleString('ru-RU')}</span>
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/60 bg-rose-950/70 text-xs font-bold text-rose-200 hover:bg-rose-800 active:scale-95 cursor-pointer"
              title="Закрыть окно Порта"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Status Banner */}
          <div
            className={`rounded-2xl border-2 p-3 shadow-lg ${
              travelStatus === 'in_port'
                ? 'border-emerald-400/80 bg-gradient-to-r from-emerald-950/75 via-teal-950/60 to-slate-950'
                : travelStatus === 'to_port' || travelStatus === 'from_port'
                ? 'border-amber-400/80 bg-gradient-to-r from-amber-950/75 via-cyan-950/60 to-slate-950'
                : 'border-cyan-500/50 bg-slate-950/90'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-2xl">
                  {travelStatus === 'in_port'
                    ? '⚓'
                    : travelStatus === 'to_port'
                    ? portTravel.transportIcon || '🚤'
                    : travelStatus === 'from_port'
                    ? portTravel.transportIcon || '🚤'
                    : '🏙️'}
                </span>
                <div>
                  <div className="text-xs sm:text-sm font-black uppercase tracking-wide text-white">
                    {travelStatus === 'in_port'
                      ? '🟢 Вы находитесь в Порту!'
                      : travelStatus === 'to_port'
                      ? `🌊 В пути в Порт (${portTravel.transportName || 'Транспорт'})...`
                      : travelStatus === 'from_port'
                      ? `🏠 Возвращение из Порта в Город (${portTravel.transportName || 'Транспорт'})...`
                      : '🏙️ Вы находитесь в Городе'}
                  </div>
                  <div className="text-[10px] text-slate-300 mt-0.5">
                    {travelStatus === 'in_port'
                      ? 'Все разделы Порта открыты: «Создать оружие / транспорт» и «Алтарь Реликвий».'
                      : travelStatus === 'to_port'
                      ? 'Дождитесь прибытия транспорта в Порт, чтобы открыть Кузницу и Алтарь.'
                      : travelStatus === 'from_port'
                      ? 'Дорога обратно занимает столько же времени, сколько заняла дорога в Порт.'
                      : 'Чтобы добраться до Порта и получить доступ к его функциям, выберите Транспорт.'}
                  </div>
                </div>
              </div>

              <span className="rounded-lg border border-amber-500/50 bg-amber-950/70 px-2.5 py-1 text-[10px] font-black text-amber-300">
                🏺 Реликвий: {relicsCount} шт.
              </span>
            </div>

            {/* Live Travel Timer & Progress Bar */}
            {(travelStatus === 'to_port' || travelStatus === 'from_port') && (
              <div className="mt-3 space-y-1.5 rounded-xl border border-amber-400/50 bg-slate-950/90 p-2.5">
                <div className="flex items-center justify-between text-[11px] font-black">
                  <span className="text-amber-300">
                    {travelStatus === 'to_port' ? '⏳ Прибытие в Порт через:' : '⏳ Возвращение в Город через:'}
                  </span>
                  <span className="font-mono text-base text-cyan-300 tabular-nums">
                    {formatCountdown(remainingSec)}
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full border border-cyan-500/50 bg-slate-900">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9.5px] text-slate-400">
                  <span>Транспорт: {portTravel.transportName || 'Лодка'}</span>
                  <span>Прогресс пути: {progressPct}%</span>
                </div>
              </div>
            )}
          </div>

          {/* ================= СЕКЦИЯ ДОСТУПА К ФУНКЦИЯМ ПОРТА (КОГДА В ПОРТУ) ================= */}
          <div className="rounded-2xl border border-cyan-500/50 bg-slate-950/90 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-black uppercase tracking-wider text-cyan-300">
                🏛️ Разделы Порта (доступны по прибытии в Порт):
              </span>
              <span
                className={`rounded px-2 py-0.5 text-[9px] font-black ${
                  travelStatus === 'in_port'
                    ? 'bg-emerald-500/20 border border-emerald-400/60 text-emerald-300'
                    : 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
                }`}
              >
                {travelStatus === 'in_port' ? '🔓 Доступ открыт' : '🔒 Требуется прибыть в Порт'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* 1. Создать оружие и Именной транспорт */}
              <button
                type="button"
                disabled={travelStatus !== 'in_port'}
                onClick={handleOpenForge}
                className={`group flex flex-col justify-between rounded-xl border-2 p-3 text-left transition-all ${
                  travelStatus === 'in_port'
                    ? 'border-amber-400/80 bg-gradient-to-br from-amber-950/70 via-slate-900 to-slate-950 hover:border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.25)] active:scale-98 cursor-pointer'
                    : 'border-slate-800 bg-slate-900/50 opacity-55 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/60 bg-amber-950/80 text-2xl shadow">
                    ⚒️
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black uppercase text-amber-300">
                      1. Создать оружие
                    </div>
                    <div className="text-[9.5px] text-amber-100/80 font-semibold">
                      + Крафт Именного Транспорта (500/500)
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[9.5px] text-slate-300 leading-snug">
                  Создание именного оружия, брони и особого <strong>Именного Транспорта</strong> с прочностью 500/500 и ускорением пути до Порта.
                </p>
                <div className="mt-2 flex items-center justify-between border-t border-amber-500/25 pt-1.5 text-[9.5px] font-black text-amber-300">
                  <span>{travelStatus === 'in_port' ? 'Открыть Кузницу Порта ▶' : '🔒 Приплывите в Порт'}</span>
                </div>
              </button>

              {/* 2. Алтарь модификации (по Реликвиям, до 50 шт.) */}
              <button
                type="button"
                disabled={travelStatus !== 'in_port'}
                onClick={onOpenAltar}
                className={`group flex flex-col justify-between rounded-xl border-2 p-3 text-left transition-all ${
                  travelStatus === 'in_port'
                    ? 'border-fuchsia-400/80 bg-gradient-to-br from-fuchsia-950/70 via-slate-900 to-slate-950 hover:border-fuchsia-300 shadow-[0_0_20px_rgba(217,70,239,0.25)] active:scale-98 cursor-pointer'
                    : 'border-slate-800 bg-slate-900/50 opacity-55 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-fuchsia-400/60 bg-fuchsia-950/80 text-2xl shadow">
                    🔮
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black uppercase text-fuchsia-300">
                      2. Алтарь Реликвий
                    </div>
                    <div className="text-[9.5px] text-fuchsia-100/80 font-semibold">
                      До {featureFlags?.altarMaxSacrificeItems ?? 50} реликвий • М1–М10 (+50%)
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[9.5px] text-slate-300 leading-snug">
                  Модификация амуниции с помощью <strong>Реликвий из Пирамид</strong> (до {featureFlags?.altarMaxSacrificeItems ?? 50} шт. за раз, +5% к характеристикам за каждый класс).
                </p>
                <div className="mt-2 flex items-center justify-between border-t border-fuchsia-500/25 pt-1.5 text-[9.5px] font-black text-fuchsia-300">
                  <span>{travelStatus === 'in_port' ? 'Открыть Алтарь Модификации ▶' : '🔒 Приплывите в Порт'}</span>
                </div>
              </button>
            </div>

            {/* Return from Port Button when currently in_port */}
            {travelStatus === 'in_port' && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() =>
                    onStartReturnFromPort(
                      activeTransport,
                      portTravel.travelDurationSec || activeTransport?.travelTimeSec || 600
                    )
                  }
                  className="w-full rounded-xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 py-2.5 px-3 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(16,185,129,0.45)] hover:brightness-110 active:scale-98 cursor-pointer"
                >
                  ⚓ Отправиться обратно в Город / Пирамиду (путь назад:{' '}
                  {formatTravelTimeText(portTravel.travelDurationSec || activeTransport?.travelTimeSec || 600)})
                </button>
              </div>
            )}
          </div>

          {/* ================= УПРАВЛЕНИЕ ТРАНСПОРТОМ И ОТПРАВЛЕНИЕ В ПОРТ ================= */}
          <div className="rounded-2xl border border-amber-500/50 bg-slate-950/90 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="text-[10.5px] font-black uppercase tracking-wider text-amber-300">
                  🚤 Ваш Транспорт для пути в Порт ({ownedTransports.length} ед.):
                </div>
                <div className="text-[9.5px] text-slate-400">
                  Дорога обратно из Порта занимает ровно столько же времени, сколько дорога туда.
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenTransportShop}
                className="rounded-lg border border-emerald-400/70 bg-emerald-950/80 hover:bg-emerald-900 px-2.5 py-1 text-[10px] font-black text-emerald-200 shadow active:scale-95 cursor-pointer"
              >
                🛒 Купить Транспорт в Магазине
              </button>
            </div>

            {ownedTransports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-950/20 p-4 text-center space-y-2">
                <div className="text-xs font-black text-amber-300">
                  ⚠️ У вас пока нет Транспорта!
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                  Чтобы добраться до Порта и получить доступ к разделам «Создать оружие» и «Алтарь», приобретите <strong>Лодку (1 ур., 10 мин)</strong>, <strong>Катер (3 ур., 6 мин)</strong>, <strong>Апач (5 ур., 4 мин)</strong> или <strong>М-8 (9 ур., 3 мин)</strong> в Магазине!
                </p>
                <button
                  type="button"
                  onClick={handleOpenTransportShop}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2 text-xs font-black text-slate-950 shadow-lg hover:brightness-110 active:scale-95 cursor-pointer"
                >
                  <span>🚤 Перейти в Магазин («Транспорт»)</span>
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {ownedTransports.map((tr) => {
                  const isSelected = activeTransport?.id === tr.id;
                  const curDur = Math.max(0, Number(tr.durability ?? tr.maxDurability ?? 100));
                  const maxDur = Math.max(1, Number(tr.maxDurability ?? 100));
                  const meetsLvl = Number(hero.level || 1) >= Number(tr.lvl || 1);
                  const travelSec = Math.max(10, Number(tr.travelTimeSec || 600));

                  return (
                    <div
                      key={tr.id}
                      onClick={() => onSelectTransport(tr.id)}
                      className={`flex items-center justify-between gap-2.5 rounded-xl border p-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-950/50 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                          : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-500/40 bg-slate-950 p-1 text-xl">
                          <ItemIcon icon={tr.icon || '🚤'} alt={tr.name} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-white truncate">
                              {tr.name}
                            </span>
                            {tr.isNamedTransport && (
                              <span className="rounded bg-amber-500/25 border border-amber-400/60 px-1.5 py-0.2 text-[8.5px] font-black text-amber-300">
                                👑 Именной (-{tr.timeReductionPct || 35}% времени)
                              </span>
                            )}
                            <span
                              className={`rounded px-1.5 py-0.2 text-[8.5px] font-bold border ${
                                meetsLvl
                                  ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                                  : 'bg-rose-950/70 border-rose-500/40 text-rose-300'
                              }`}
                            >
                              {tr.lvl || 1} ур.
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-300 mt-0.5 flex flex-wrap items-center gap-2">
                            <span>
                              ⏱️ Время в пути: <strong className="text-cyan-300">{formatTravelTimeText(travelSec)}</strong> (туда / обратно)
                            </span>
                            <span>•</span>
                            <span>
                              🔧 Прочность:{' '}
                              <strong className={curDur > 0 ? 'text-emerald-300' : 'text-rose-400'}>
                                {curDur}/{maxDur}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTransport(tr.id);
                        }}
                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[9.5px] font-black ${
                          isSelected
                            ? 'bg-cyan-500 text-slate-950 shadow'
                            : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {isSelected ? '✓ Выбран' : 'Выбрать'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Departure Button when in City (status === 'idle') */}
            {travelStatus === 'idle' && activeTransport && (
              <button
                type="button"
                disabled={!canUseSelectedTransport}
                onClick={() => onStartTravelToPort(activeTransport, activeTransport.travelTimeSec || 600)}
                className="w-full rounded-xl border-2 border-cyan-300 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 py-2.5 px-3 text-xs sm:text-sm font-black uppercase tracking-wider text-white shadow-[0_0_25px_rgba(34,211,238,0.45)] hover:brightness-110 active:scale-98 disabled:opacity-40 cursor-pointer"
              >
                {!canUseSelectedTransport
                  ? Number(activeTransport.durability ?? 0) <= 0
                    ? '⚠️ ТРАНСПОРТ СЛОМАН (ПРОЧНОСТЬ 0)'
                    : `⚠️ ТРЕБУЕТСЯ ${activeTransport.lvl} УРОВЕНЬ ДЛЯ ЭТОГО ТРАНСПОРТА`
                  : `⛵ ОТПРАВИТЬСЯ В ПОРТ НА «${activeTransport.name.toUpperCase()}» (${formatTravelTimeText(
                      activeTransport.travelTimeSec || 600
                    )})`}
              </button>
            )}
          </div>

          {/* Info Table of All Transports */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-2.5 text-[9.5px] text-slate-300 space-y-1">
            <div className="font-black text-cyan-300 uppercase tracking-wider">
              📋 Справка по системе «Порт и Транспорт»:
            </div>
            <div>• 🛶 <strong>Лодка (1 ур.):</strong> Время в пути до порта — 10 минут (и 10 минут обратно).</div>
            <div>• 🚤 <strong>Катер (3 ур.):</strong> Время в пути до порта — 6 минут (и 6 минут обратно).</div>
            <div>• 🚁 <strong>Апач (5 ур.):</strong> Время в пути до порта — 4 минуты (и 4 минуты обратно).</div>
            <div>• 🛩️ <strong>М-8 (9 ур.):</strong> Время в пути до порта — 3 минуты (и 3 минуты обратно).</div>
            <div>• 👑 <strong>Именной транспорт (создаётся в Порту):</strong> Повышенная прочность <strong>500 / 500</strong> и дополнительное сокращение времени в пути до следующего порта!</div>
          </div>
        </div>
      </div>
    </div>
  );
};
