import React, { useState, useEffect, useMemo } from 'react';
import {
  HeroState,
  GameItem,
  EquippedGear,
  GameFeatureFlags,
  PortTravelState,
  PortTerminalResourceKey
} from '../../types/game';
import {
  formatTravelTimeText,
  formatItemBonusesText,
  isTransportItem,
  isRelicItem,
  createRelicItem,
  getTransportsCatalog,
  createTransportItemFromTemplate
} from '../../utils/shopConfig';
import { ItemIcon } from '../ItemIcon';
import { GoldCoinIcon, CrystalIcon } from '../CurrencyIcon';
import { ClanTerritoryWarsView } from './ClanMechanicsSubViews';
import {
  getPlayerClan,
  getClanTerritories,
  PORT_TERMINAL_CATALOG,
  PORT_TERMINAL_INITIAL_STOCK,
  getPortTradingTerminalState,
  tradeWithPortTerminal,
  transferPlayerResourceToPortFacility,
  calculatePlayerPortCargo,
  resolveTransportSpeedAndCargo,
  getPortAllResourcesCatalog,
  getPortResourceWeight,
  getMyOrRedBlackPortEstates,
  getPortFactoryWorkStatus,
  calculatePortFactoryDetailedEconomics,
  collectAllPortEstatesRevenue,
  distributeGoldToAllPortEstates,
  autoBalanceAllPortEstatesPrices,
  fulfillPharaohStateOrder,
  autoSupplyFactoryFromTerminal
} from '../../utils/clanStorage';

interface PortModalProps {
  currentUser?: string | null;
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
  onOpenProfileEstate?: () => void;
  onUpdateHero?: (updated: Partial<HeroState>) => void;
  onUpdateInventory?: (updated: GameItem[]) => void;
  showToast?: (msg: string) => void;
  onClose: () => void;
}

export const PortModal: React.FC<PortModalProps> = ({
  currentUser,
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
  onOpenProfileEstate,
  onUpdateHero,
  onUpdateInventory,
  showToast,
  onClose
}) => {
  const handleOpenTransportShop = onOpenTransportShop || onOpenShopTransport || (() => {});
  const handleOpenForge = onOpenCreateItem || onOpenForgeWeapon || (() => {});
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [portTab, setPortTab] = useState<'productions' | 'tycoon' | 'terminal' | 'shipyard'>('productions');
  const [selectedManageSectorId, setSelectedManageSectorId] = useState<string | null>(null);
  const [massDepositGoldStr, setMassDepositGoldStr] = useState<string>('15000');
  const [, setRefreshTick] = useState(0);
  const [tradeQtyByRes, setTradeQtyByRes] = useState<Record<PortTerminalResourceKey, number>>({
    raw_fish: 10,
    iron_ore: 10,
    gold_nugget: 10,
    quartz_sand: 10,
    crude_oil: 10,
    fish_semifinished: 10,
    alchemy_reagents: 10,
    gold_ingots: 10,
    hardened_steel: 5,
    combat_ration: 5,
    combat_modules: 5,
    port_relics: 1,
    power_kw: 10,
    tavern_meal: 1
  });
  const [targetSectorForSupply, setTargetSectorForSupply] = useState<string>(
    () => getClanTerritories()[0]?.id || 'sector_elite_armory'
  );

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

  const cargoInfo = useMemo(
    () => calculatePlayerPortCargo(hero, inventory, equipped),
    [hero, inventory, equipped]
  );

  const terminalCatalogItems = useMemo(() => {
    const allDynamic = getPortAllResourcesCatalog();
    return PORT_TERMINAL_CATALOG.map((baseItem) => {
      const dyn = allDynamic.find((d) => d.key === baseItem.key);
      return {
        ...baseItem,
        buyPriceGold: dyn ? dyn.buyPriceGold : baseItem.buyPriceGold,
        sellPriceGold: dyn ? dyn.sellPriceGold : baseItem.sellPriceGold,
        weight: dyn ? dyn.weight : getPortResourceWeight(baseItem.key)
      };
    });
  }, [nowMs]);

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

  const terminalState = getPortTradingTerminalState();
  const allPortFacilities = getClanTerritories();
  const keepnetFishCount = Array.isArray(hero.fishingState?.keepnet)
    ? hero.fishingState.keepnet.length
    : 0;

  const getPlayerAvailableResourceQty = (resKey: PortTerminalResourceKey): number => {
    const storedInPortBag = Math.max(0, Number(hero.portResources?.[resKey] || 0));
    if (resKey === 'raw_fish') {
      return storedInPortBag + keepnetFishCount;
    }
    if (resKey === 'port_relics') {
      return storedInPortBag + relicsCount;
    }
    return storedInPortBag;
  };

  const handleBuyTransportDirectly = (tpl: any) => {
    const priceGold = Math.max(0, Number(tpl.priceGold ?? 0));
    const priceCrystals = Math.max(0, Number(tpl.priceCrystals ?? 0));
    if (Number(hero.level || 1) < Number(tpl.lvl || 1)) {
      if (showToast) showToast(`⚠️ Требуется ${tpl.lvl || 1} уровень для покупки «${tpl.name}»!`);
      return;
    }
    if (priceGold > 0 && (hero.gold || 0) < priceGold) {
      if (showToast) showToast(`⚠️ Недостаточно золота! Нужно ${priceGold.toLocaleString('ru-RU')} 🪙.`);
      return;
    }
    if (priceCrystals > 0 && (hero.crystals || 0) < priceCrystals) {
      if (showToast) showToast(`⚠️ Недостаточно кристаллов! Нужно ${priceCrystals.toLocaleString('ru-RU')} 💎.`);
      return;
    }
    const newItem = createTransportItemFromTemplate(tpl);
    if (onUpdateInventory) {
      onUpdateInventory([newItem, ...(Array.isArray(inventory) ? inventory : [])]);
    }
    if (onUpdateHero) {
      onUpdateHero({
        gold: Math.max(0, (hero.gold || 0) - priceGold),
        crystals: Math.max(0, (hero.crystals || 0) - priceCrystals),
        activeTransportId: newItem.id
      });
    }
    onSelectTransport(newItem.id);
    if (showToast) {
      showToast(
        `🚤 Вы приобрели и экипировали «${tpl.name}» (Скорость: ${tpl.stepSeconds || 22} сек./кл., Багажник: +${tpl.cargoCapacity || 100} ед.)!`
      );
    }
    setRefreshTick((v) => v + 1);
  };

  const handleTerminalTrade = (mode: 'buy' | 'sell', resKey: PortTerminalResourceKey) => {
    const qty = Math.max(1, Math.floor(Number(tradeQtyByRes[resKey] || 1)));
    const unitWeight = getPortResourceWeight(resKey);
    if (mode === 'buy' && unitWeight > 0) {
      const neededWeight = qty * unitWeight;
      if (cargoInfo.isOverloaded || neededWeight > cargoInfo.freeWeight) {
        if (showToast) {
          showToast(
            `⚠️ Перегруз багажника! Свободно: ${cargoInfo.freeWeight} / ${cargoInfo.maxWeight} ед. веса (для ${qty} шт. нужно ${neededWeight} ед.). Разгрузите ресурсы или экипируйте транспорт!`
          );
        }
        return;
      }
    }
    const playerAvailable = getPlayerAvailableResourceQty(resKey);
    const activeNick = (currentUser || hero.nick || 'Игрок').trim();

    const res = tradeWithPortTerminal(activeNick, mode, resKey, qty, hero.gold || 0, playerAvailable);
    if (!res.ok) {
      if (showToast) showToast(`⚠️ ${res.error}`);
      return;
    }

    const currentPortRes = { ...(hero.portResources || {}) };
    const storedInBag = Math.max(0, Number(currentPortRes[resKey] || 0));

    if (mode === 'buy') {
      const bought = res.quantity || qty;
      if (resKey === 'port_relics' && onUpdateInventory) {
        const addedRelics: GameItem[] = [];
        for (let i = 0; i < bought; i++) {
          const item = createRelicItem(1);
          item.origin = 'Торговый терминал Порта';
          addedRelics.push(item);
        }
        onUpdateInventory([...inventory, ...addedRelics]);
      } else {
        currentPortRes[resKey] = storedInBag + bought;
      }
      if (onUpdateHero) {
        onUpdateHero({
          gold: Math.max(0, (hero.gold || 0) + (res.deltaHeroGold || 0)),
          portResources: currentPortRes
        });
      }
    } else {
      // Selling to terminal
      const sold = res.quantity || qty;
      if (resKey === 'raw_fish') {
        const takeFromBag = Math.min(storedInBag, sold);
        const takeFromKeepnet = Math.max(0, sold - takeFromBag);
        currentPortRes.raw_fish = Math.max(0, storedInBag - takeFromBag);
        const nextKeepnet = Array.isArray(hero.fishingState?.keepnet)
          ? [...hero.fishingState.keepnet]
          : [];
        if (takeFromKeepnet > 0) {
          nextKeepnet.splice(0, takeFromKeepnet);
        }
        if (onUpdateHero) {
          onUpdateHero({
            gold: Math.max(0, (hero.gold || 0) + (res.deltaHeroGold || 0)),
            portResources: currentPortRes,
            fishingState: {
              ...(hero.fishingState || {}),
              keepnet: nextKeepnet
            }
          });
        }
      } else if (resKey === 'port_relics') {
        const takeFromBag = Math.min(storedInBag, sold);
        let takeFromInv = Math.max(0, sold - takeFromBag);
        currentPortRes.port_relics = Math.max(0, storedInBag - takeFromBag);
        if (takeFromInv > 0 && onUpdateInventory) {
          const nextInv: GameItem[] = [];
          for (const it of inventory) {
            if (takeFromInv > 0 && isRelicItem(it)) {
              takeFromInv--;
              continue;
            }
            nextInv.push(it);
          }
          onUpdateInventory(nextInv);
        }
        if (onUpdateHero) {
          onUpdateHero({
            gold: Math.max(0, (hero.gold || 0) + (res.deltaHeroGold || 0)),
            portResources: currentPortRes
          });
        }
      } else {
        currentPortRes[resKey] = Math.max(0, storedInBag - sold);
        if (onUpdateHero) {
          onUpdateHero({
            gold: Math.max(0, (hero.gold || 0) + (res.deltaHeroGold || 0)),
            portResources: currentPortRes
          });
        }
      }
    }

    if (showToast) showToast(res.message || '📊 Сделка в Торговом терминале выполнена!');
    setRefreshTick((v) => v + 1);
  };

  const handleSendResourceToFacility = (resKey: PortTerminalResourceKey) => {
    const qty = Math.max(1, Math.floor(Number(tradeQtyByRes[resKey] || 5)));
    const available = getPlayerAvailableResourceQty(resKey);
    const activeNick = (currentUser || hero.nick || 'Игрок').trim();
    const res = transferPlayerResourceToPortFacility(
      targetSectorForSupply,
      activeNick,
      resKey,
      qty,
      available
    );
    if (!res.ok) {
      if (showToast) showToast(`⚠️ ${res.error}`);
      return;
    }

    const used = res.loadedQty || qty;
    const currentPortRes = { ...(hero.portResources || {}) };
    const storedInBag = Math.max(0, Number(currentPortRes[resKey] || 0));

    if (resKey === 'raw_fish') {
      const fromBag = Math.min(storedInBag, used);
      const fromKeepnet = Math.max(0, used - fromBag);
      currentPortRes.raw_fish = Math.max(0, storedInBag - fromBag);
      const nextKeepnet = Array.isArray(hero.fishingState?.keepnet)
        ? [...hero.fishingState.keepnet]
        : [];
      if (fromKeepnet > 0) nextKeepnet.splice(0, fromKeepnet);
      if (onUpdateHero) {
        onUpdateHero({
          portResources: currentPortRes,
          fishingState: {
            ...(hero.fishingState || {}),
            keepnet: nextKeepnet
          }
        });
      }
    } else {
      currentPortRes[resKey] = Math.max(0, storedInBag - used);
      if (onUpdateHero) {
        onUpdateHero({
          portResources: currentPortRes
        });
      }
    }

    if (showToast) showToast(res.message || '🚛 Сырьё загружено на склад объекта недвижимости!');
    setRefreshTick((v) => v + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2.5 backdrop-blur-md select-none">
      <div
        className="relative flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-2 border-cyan-500/80 text-slate-100 shadow-[0_0_50px_rgba(6,182,212,0.35)]"
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
                Порт Древнего Нила • Недвижимость и Торговый терминал
              </h2>
              <p className="truncate text-[10px] text-cyan-100/75">
                Карта 10х10 (Gwars) • 12 заводов и 12 ресурсов • Торговый терминал (20 000 ед.)
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

        {/* Верхняя панель Порта (4 чистые вкладки по ТЗ) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 border-b border-slate-700 bg-slate-950 px-2.5 py-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setPortTab('productions')}
            className={`border py-1.5 px-2 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
              portTab === 'productions'
                ? 'border-amber-400 bg-amber-500 text-slate-950'
                : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-amber-200'
            }`}
          >
            [ 🗺️ Карта 10x10 и Сектор ]
          </button>
          <button
            type="button"
            onClick={() => setPortTab('tycoon')}
            className={`border py-1.5 px-2 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
              portTab === 'tycoon'
                ? 'border-amber-400 bg-amber-500 text-slate-950'
                : 'border-slate-700 bg-slate-900 text-amber-300 hover:bg-slate-800 hover:text-amber-200'
            }`}
          >
            [ 🏢 Моя Недвижимость ]
          </button>
          <button
            type="button"
            onClick={() => setPortTab('terminal')}
            className={`border py-1.5 px-2 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
              portTab === 'terminal'
                ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                : 'border-slate-700 bg-slate-900 text-emerald-300 hover:bg-slate-800 hover:text-emerald-200'
            }`}
          >
            [ ⚖️ Торговый Терминал и Биржа ]
          </button>
          <button
            type="button"
            onClick={() => setPortTab('shipyard')}
            className={`border py-1.5 px-2 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer ${
              portTab === 'shipyard'
                ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                : 'border-slate-700 bg-slate-900 text-cyan-300 hover:bg-slate-800 hover:text-cyan-200'
            }`}
          >
            [ ⚓ Верфь, Кузница и Алтарь ]
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {portTab === 'productions' ? (
            <ClanTerritoryWarsView
              clan={getPlayerClan((currentUser || hero.nick || 'Игрок').trim(), hero.clanId)}
              myNick={(currentUser || hero.nick || 'Игрок').trim()}
              hero={hero}
              inventory={inventory}
              equipped={equipped}
              initialSectorId={selectedManageSectorId}
              onUpdateHero={onUpdateHero || (() => {})}
              onUpdateInventory={onUpdateInventory || (() => {})}
              onOpenProfileEstate={() => setPortTab('tycoon')}
              onSwitchToTerminal={() => setPortTab('terminal')}
              onSwitchToShipyard={() => setPortTab('shipyard')}
              showToast={showToast || (() => {})}
              triggerRefresh={() => setRefreshTick((v) => v + 1)}
              requestConfirm={(_title, _message, onConfirm) => onConfirm()}
            />
          ) : portTab === 'tycoon' ? (
            (() => {
              const effectiveOwnerNick = (currentUser || hero.nick || 'RedBlack').trim();
              const myEstates = getMyOrRedBlackPortEstates(effectiveOwnerNick);
              const totalCashInEstates = myEstates.reduce(
                (acc, s) => acc + Math.max(0, Number(s.production?.facilityBalanceGold || 0)),
                0
              );
              const withdrawableAbove5k = myEstates.reduce((acc, s) => {
                const c = Math.max(0, Number(s.production?.facilityBalanceGold || 0));
                return acc + (c > 5000 ? c - 5000 : 0);
              }, 0);
              const workingCount = myEstates.filter((s) => getPortFactoryWorkStatus(s).isWorking).length;

              const handleMassCollectRevenue = () => {
                const res = collectAllPortEstatesRevenue(effectiveOwnerNick, 5000);
                if (!res.ok) {
                  if (showToast) showToast(`⚠️ ${res.error}`);
                  return;
                }
                if (onUpdateHero && res.totalCollectedGold > 0) {
                  onUpdateHero({
                    gold: (hero.gold || 0) + res.totalCollectedGold
                  });
                }
                if (showToast && res.message) showToast(res.message);
                setRefreshTick((v) => v + 1);
              };

              const handleMassDistributeGold = () => {
                const amt = Math.max(100, Math.floor(Number(massDepositGoldStr) || 0));
                const res = distributeGoldToAllPortEstates(effectiveOwnerNick, amt, hero.gold || 0);
                if (!res.ok) {
                  if (showToast) showToast(`⚠️ ${res.error}`);
                  return;
                }
                if (onUpdateHero && res.totalSpentGold > 0) {
                  onUpdateHero({
                    gold: Math.max(0, (hero.gold || 0) - res.totalSpentGold)
                  });
                }
                if (showToast && res.message) showToast(res.message);
                setRefreshTick((v) => v + 1);
              };

              const handleMassAutoBalance = () => {
                const res = autoBalanceAllPortEstatesPrices(effectiveOwnerNick);
                if (!res.ok) {
                  if (showToast) showToast(`⚠️ ${res.error}`);
                  return;
                }
                if (showToast && res.message) showToast(res.message);
                setRefreshTick((v) => v + 1);
              };

              return (
                <div className="border border-slate-700 bg-slate-950 p-2.5 space-y-2.5 text-[11px] text-slate-200">
                  {/* Шапка Кабинета Магната */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div>
                      <strong className="text-amber-300 uppercase">
                        🏢 Кабинет Магната — Управление предприятиями ({myEstates.length} объектов)
                      </strong>
                      <div className="text-[10px] text-slate-400">
                        Работает: <strong className="text-emerald-300">{workingCount}</strong> из{' '}
                        <strong className="text-white">{myEstates.length}</strong> | Всего в кассах:{' '}
                        <strong className="text-amber-300 font-mono">
                          {totalCashInEstates.toLocaleString('ru-RU')} 🪙
                        </strong>{' '}
                        | Доступно к сбору (свыше 5 000 🪙):{' '}
                        <strong className="text-emerald-300 font-mono">
                          +{withdrawableAbove5k.toLocaleString('ru-RU')} 🪙
                        </strong>
                      </div>
                    </div>
                    <div className="text-[10.5px] font-mono text-amber-300">
                      Ваше золото: <strong>{(hero.gold || 0).toLocaleString('ru-RU')} 🪙</strong>
                    </div>
                  </div>

                  {/* 3 кнопки массового управления */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 border-b border-slate-800 pb-2.5">
                    <button
                      type="button"
                      onClick={handleMassCollectRevenue}
                      className="border border-emerald-500/80 bg-emerald-950/60 hover:bg-emerald-900/70 px-2.5 py-1.5 text-[10.5px] font-bold text-emerald-200 cursor-pointer text-center"
                    >
                      [ 💰 Собрать выручку со всех заводов (оставить по 5 000 🪙 в кассах) ]
                    </button>

                    <div className="flex items-center gap-1 border border-amber-500/60 bg-slate-900 px-2 py-1">
                      <input
                        type="number"
                        min={1000}
                        step={1000}
                        value={massDepositGoldStr}
                        onChange={(e) => setMassDepositGoldStr(e.target.value)}
                        className="w-20 border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-center font-mono text-[10.5px] text-white"
                      />
                      <button
                        type="button"
                        onClick={handleMassDistributeGold}
                        className="flex-1 border border-amber-400 bg-amber-500 hover:bg-amber-400 px-2 py-0.5 text-[10.5px] font-bold text-slate-950 cursor-pointer"
                      >
                        [ 🏦 Пополнить кассы всех заводов ]
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleMassAutoBalance}
                      className="border border-cyan-400/80 bg-cyan-950/60 hover:bg-cyan-900/70 px-2.5 py-1.5 text-[10.5px] font-bold text-cyan-200 cursor-pointer text-center"
                    >
                      [ 🔄 Авто-баланс цен на всех заводах (Себестоимость + 20%) ]
                    </button>
                  </div>

                  {/* Сводная таблица всех заводов игрока (строгий табличный стиль Gwars) */}
                  <div className="overflow-x-auto border border-slate-700">
                    <table className="w-full border-collapse text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-700 bg-slate-900 text-slate-300">
                          <th className="py-1.5 px-2 font-bold border-r border-slate-700">
                            Сектор и Название
                          </th>
                          <th className="py-1.5 px-2 font-bold border-r border-slate-700">
                            Статус: 🟢 Работает / 🔴 Стоит (причина)
                          </th>
                          <th className="py-1.5 px-2 font-bold border-r border-slate-700 text-right">
                            Касса 🪙 (Прибыль/ч)
                          </th>
                          <th className="py-1.5 px-2 font-bold border-r border-slate-700">
                            Склад сырья / продукции
                          </th>
                          <th className="py-1.5 px-2 font-bold text-right">
                            Кнопка: Перейти к управлению
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {myEstates.map((s) => {
                          const p = s.production!;
                          const st = getPortFactoryWorkStatus(s);
                          const econ = calculatePortFactoryDetailedEconomics(s);
                          const tier =
                            p.productionTier ||
                            (p.productionStage === 'extraction' ? 1 : p.requiresDualInput ? 3 : 2);
                          const rawSummaryParts: string[] = [];
                          if (tier >= 2 && p.input1ResourceKey) {
                            rawSummaryParts.push(
                              `${p.input1ResourceName || 'Сырье #1'}: ${p.input1Stock ?? p.fishStock ?? 0}/${p.maxInput1Stock ?? 100}`
                            );
                          }
                          if (p.input2ResourceKey) {
                            rawSummaryParts.push(
                              `${p.input2ResourceName || 'Сырье #2'}: ${p.input2Stock ?? 0}/${p.maxInput2Stock ?? 100}`
                            );
                          }
                          if (p.input3ResourceKey) {
                            rawSummaryParts.push(
                              `${p.input3ResourceName || 'Сырье #3'}: ${p.input3Stock ?? 0}/${p.maxInput3Stock ?? 100}`
                            );
                          }
                          if ((p.powerRequiredPerCycle ?? 0) > 0) {
                            rawSummaryParts.push(
                              `Энергия: ${p.powerStock ?? 0}/${p.maxPowerStock ?? 200}`
                            );
                          }

                          const isOutFull = (p.relicStock ?? 0) >= (p.maxRelicStock ?? 70);

                          return (
                            <tr key={s.id} className="border-b border-slate-800 bg-slate-950 hover:bg-slate-900/60">
                              <td className="py-1.5 px-2 border-r border-slate-800">
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex h-[18px] w-[18px] min-w-[18px] min-h-[18px] max-w-[18px] max-h-[18px] shrink-0 items-center justify-center overflow-hidden border border-slate-700 bg-slate-900">
                                    <ItemIcon
                                      icon={s.ownerClanEmblem || '👑'}
                                      name={s.ownerClanName || 'Клан'}
                                      className="w-3.5 h-3.5 text-[10px] leading-none"
                                      imgClassName="w-3.5 h-3.5 max-w-[14px] max-h-[14px] object-contain"
                                    />
                                  </span>
                                  <span className="font-mono text-amber-300 font-bold">
                                    [{s.mapX || 7}/{s.mapY || 6}]
                                  </span>
                                  <strong className="text-white">{s.name}</strong>
                                </div>
                              </td>

                              <td className="py-1.5 px-2 border-r border-slate-800">
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className={`font-bold ${st.isWorking ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {st.statusBadge}
                                  </span>
                                  {econ.isUnprofitable && (
                                    <span className="text-[9.5px] font-bold text-rose-400">
                                      [⚠️ Убыточная цена!]
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-1.5 px-2 border-r border-slate-800 text-right font-mono">
                                <div className="font-bold text-amber-300">
                                  {(p.facilityBalanceGold ?? 0).toLocaleString('ru-RU')} 🪙
                                </div>
                                <div className={`text-[9.5px] ${econ.netOwnerProfitPerHour >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {econ.netOwnerProfitPerHour >= 0
                                    ? `+${econ.netOwnerProfitPerHour.toLocaleString('ru-RU')}`
                                    : econ.netOwnerProfitPerHour.toLocaleString('ru-RU')}{' '}
                                  🪙/ч
                                </div>
                              </td>

                              <td className="py-1.5 px-2 border-r border-slate-800 font-mono text-[10px]">
                                <div className="text-slate-200">
                                  Выход ({p.outputProductName || 'Продукция'}):{' '}
                                  <strong className={isOutFull ? 'text-rose-400' : 'text-amber-300'}>
                                    {p.relicStock}/{p.maxRelicStock}
                                  </strong>{' '}
                                  (цена: {p.productSellPriceGold} 🪙, с/с: {econ.unitSelfCost} 🪙)
                                </div>
                                {rawSummaryParts.length > 0 && (
                                  <div className="text-slate-400">
                                    Вход: {rawSummaryParts.join(' | ')}
                                  </div>
                                )}
                              </td>

                              <td className="py-1.5 px-2 text-right whitespace-nowrap">
                                <div className="inline-flex flex-wrap items-center justify-end gap-1">
                                  {p.relicStock > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const res = fulfillPharaohStateOrder(s.id, effectiveOwnerNick);
                                        if (showToast) showToast(res.ok ? res.message! : `⚠️ ${res.error}`);
                                        setRefreshTick((v) => v + 1);
                                      }}
                                      title="Сдать 50% склада по Госзаказу Фараона (Себестоимость + 15%)"
                                      className={`border px-1.5 py-0.5 text-[9.5px] font-bold cursor-pointer ${
                                        isOutFull
                                          ? 'border-amber-400 bg-amber-500 text-slate-950'
                                          : 'border-amber-500/50 bg-slate-900 text-amber-300 hover:bg-slate-800'
                                      }`}
                                    >
                                      [ 📦 Госзаказ ]
                                    </button>
                                  )}
                                  {rawSummaryParts.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const res = autoSupplyFactoryFromTerminal(
                                          s.id,
                                          effectiveOwnerNick,
                                          hero.gold || 0
                                        );
                                        if (!res.ok) {
                                          if (showToast) showToast(`⚠️ ${res.error}`);
                                          return;
                                        }
                                        if (res.paidFromHeroGold > 0 && onUpdateHero) {
                                          onUpdateHero({
                                            gold: Math.max(0, (hero.gold || 0) - res.paidFromHeroGold)
                                          });
                                        }
                                        if (showToast && res.message) showToast(res.message);
                                        setRefreshTick((v) => v + 1);
                                      }}
                                      title="Закупить недостающее сырье и энергию с Терминала (+10% доставка)"
                                      className="border border-cyan-500/60 bg-slate-900 hover:bg-cyan-950/60 px-1.5 py-0.5 text-[9.5px] font-bold text-cyan-300 cursor-pointer"
                                    >
                                      [ 🚚 Снабдить ]
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedManageSectorId(s.id);
                                      setPortTab('productions');
                                    }}
                                    className="border border-emerald-500/70 bg-slate-900 hover:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold text-emerald-300 cursor-pointer"
                                  >
                                    [ Перейти к управлению ]
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()
          ) : portTab === 'terminal' ? (
            <div className="space-y-3">
              {/* Шапка Торгового терминала Порта */}
              <div className="rounded-2xl border-2 border-emerald-500/70 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 p-3.5 shadow-lg space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-black uppercase tracking-wide text-emerald-300 flex items-center gap-2 flex-wrap">
                      <span>📊 Торговый терминал Порта • Сырьё (Этап 1) и Полуфабрикаты (Этап 2)</span>
                      <span className="rounded bg-emerald-500/25 border border-emerald-400/60 px-2 py-0.5 text-[9px] font-black text-emerald-100">
                        Стартовый запас: {PORT_TERMINAL_INITIAL_STOCK.toLocaleString('ru-RU')} ед. каждого вида
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed">
                      На Торговом терминале продаются и покупаются (по 20 000 ед.) только <strong>8 ресурсов 1-го и 2-го этапов</strong> (Сырая рыба, Железная руда, Золотой самородок, Кварцевый песок, Сырая нефть, Рыбный паштет, Золотые слитки, Алхимический реагент). Продукция 3-го этапа продается только со складов заводов!
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className={`rounded-xl border px-3 py-1.5 text-right ${
                        cargoInfo.isOverloaded
                          ? 'border-rose-500 bg-rose-950/90 text-rose-200'
                          : 'border-cyan-500/50 bg-slate-950/90 text-cyan-200'
                      }`}
                    >
                      <div className="text-[8.5px] font-bold uppercase text-slate-400">
                        🎒 Вес багажника ({cargoInfo.transportName})
                      </div>
                      <div className="text-xs font-black">
                        {cargoInfo.currentWeight} / {cargoInfo.maxWeight} ед. (Свободно: {cargoInfo.freeWeight} ед.)
                      </div>
                    </div>
                    <div className="rounded-xl border border-amber-400/50 bg-slate-950/90 px-3 py-1.5 text-right">
                      <div className="text-[8.5px] font-bold uppercase text-slate-400">Ваше золото</div>
                      <div className="text-xs font-black text-amber-300">
                        {hero.gold.toLocaleString('ru-RU')} 🪙
                      </div>
                    </div>
                  </div>
                </div>

                {/* Выбор целевого объекта в Порту для прямой загрузки купленного сырья */}
                <div className="rounded-xl border border-cyan-500/40 bg-slate-950/90 p-2.5 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                  <span className="font-black text-cyan-300">
                    🚛 Прямая поставка со склада игрока на объект недвижимости в Порту:
                  </span>
                  <select
                    value={targetSectorForSupply}
                    onChange={(e) => setTargetSectorForSupply(e.target.value)}
                    className="rounded-lg border border-cyan-500/50 bg-slate-900 px-2.5 py-1 text-[10px] font-black text-amber-200"
                  >
                    {allPortFacilities.map((f) => {
                      const inNames = [
                        f.production?.input1ResourceName,
                        f.production?.input2ResourceName,
                        f.production?.input3ResourceName
                      ].filter(Boolean);
                      const reqLabel =
                        inNames.length > 0
                          ? `Вход: ${inNames.join(' + ')}`
                          : `Выход: ${f.production?.outputProductName || 'Добыча'}`;
                      return (
                        <option key={f.id} value={f.id}>
                          [{f.mapX || 7}/{f.mapY || 6}] [{f.ownerClanTag || 'RB'}] {f.name} ({reqLabel})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Карточки ресурсов Торгового терминала (8 ресурсов 1-го и 2-го этапов по 20 000 ед.) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {terminalCatalogItems.map((item) => {
                  const stockInTerminal = Math.max(
                    0,
                    Number(terminalState.stocks[item.key] ?? PORT_TERMINAL_INITIAL_STOCK)
                  );
                  const myQty = getPlayerAvailableResourceQty(item.key);
                  const qty = Math.max(1, Number(tradeQtyByRes[item.key] || 1));
                  const unitWeight = Math.max(0, Number(item.weight ?? 1));
                  const totalBuyGold = qty * item.buyPriceGold;
                  const totalSellGold = qty * item.sellPriceGold;
                  const maxByGold =
                    item.buyPriceGold > 0
                      ? Math.floor(Math.max(0, hero.gold || 0) / item.buyPriceGold)
                      : stockInTerminal;
                  const maxByWeight =
                    unitWeight > 0
                      ? Math.floor(Math.max(0, cargoInfo.freeWeight) / unitWeight)
                      : stockInTerminal;
                  const maxCanBuy = Math.max(0, Math.min(stockInTerminal, maxByGold, maxByWeight));
                  const canAffordAndCarry =
                    !cargoInfo.isOverloaded &&
                    stockInTerminal >= qty &&
                    hero.gold >= totalBuyGold &&
                    qty * unitWeight <= cargoInfo.freeWeight;

                  return (
                    <div
                      key={item.key}
                      className="rounded-2xl border border-emerald-500/40 bg-slate-900/95 p-3 space-y-2.5 shadow flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/50 bg-slate-950 text-2xl shadow-inner">
                              {item.icon}
                            </div>
                            <div>
                              <div className="text-xs font-black text-white flex items-center gap-1.5 flex-wrap">
                                <span>{item.name}</span>
                                <span className="rounded bg-cyan-950/90 border border-cyan-500/40 px-1.5 py-0.2 text-[8px] font-bold text-cyan-200">
                                  {item.category}
                                </span>
                                <span className="rounded bg-amber-950/90 border border-amber-500/40 px-1.5 py-0.2 text-[8px] font-bold text-amber-200">
                                  ⚖️ Вес: {unitWeight} ед./шт.
                                </span>
                              </div>
                              <div className="text-[9.5px] text-slate-400 leading-snug mt-0.5">
                                {item.description}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="rounded-lg border border-emerald-400/60 bg-emerald-950/80 px-2 py-0.5 text-[9.5px] font-black text-emerald-200">
                              На терминале: {stockInTerminal.toLocaleString('ru-RU')} ед.
                            </div>
                            <div className="text-[9px] font-bold text-amber-300 mt-0.5">
                              У вас: {myQty.toLocaleString('ru-RU')} ед. ({myQty * unitWeight} ед. веса)
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-800 bg-slate-950/90 p-2 text-[9.5px]">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Покупка с терминала:</span>
                            <strong className="text-amber-300">{item.buyPriceGold} 🪙/ед.</strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Продажа в терминал:</span>
                            <strong className="text-emerald-300">{item.sellPriceGold} 🪙/ед.</strong>
                          </div>
                        </div>

                        <div className="rounded-lg border border-cyan-500/30 bg-slate-950/80 px-2.5 py-1 text-[9.5px] flex items-center justify-between gap-2">
                          <span className="text-slate-300">
                            Вы можете купить: <strong className="text-emerald-300">{maxCanBuy.toLocaleString('ru-RU')} шт.</strong>
                          </span>
                          <span className={cargoInfo.freeWeight < unitWeight ? 'text-rose-400 font-bold' : 'text-cyan-300 font-bold'}>
                            Свободный вес: {cargoInfo.freeWeight} / Макс {cargoInfo.maxWeight}
                          </span>
                        </div>
                      </div>

                      {/* Выбор количества и кнопки Купить / Продать / На склад завода */}
                      <div className="space-y-2 pt-1 border-t border-slate-800">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[9px] font-bold text-slate-400">Количество:</span>
                          <div className="flex items-center gap-1">
                            {[1, 10, 50, 100].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() =>
                                  setTradeQtyByRes((prev) => ({ ...prev, [item.key]: preset }))
                                }
                                className={`rounded border px-2 py-0.5 text-[8.5px] font-black cursor-pointer ${
                                  qty === preset
                                    ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                                    : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
                                }`}
                              >
                                {preset}
                              </button>
                            ))}
                            {maxCanBuy > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setTradeQtyByRes((prev) => ({ ...prev, [item.key]: maxCanBuy }))
                                }
                                className="rounded border border-cyan-500/50 bg-cyan-950 px-1.5 py-0.5 text-[8.5px] font-black text-cyan-200 hover:bg-cyan-900 cursor-pointer"
                              >
                                Макс ({maxCanBuy})
                              </button>
                            )}
                            <input
                              type="number"
                              min={1}
                              max={20000}
                              value={qty}
                              onChange={(e) =>
                                setTradeQtyByRes((prev) => ({
                                  ...prev,
                                  [item.key]: Math.max(1, Number(e.target.value || 1))
                                }))
                              }
                              className="w-16 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-center text-[9.5px] font-black text-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            disabled={!canAffordAndCarry}
                            onClick={() => handleTerminalTrade('buy', item.key)}
                            className={`rounded-xl py-1.5 px-2 text-[9.5px] font-black uppercase transition-all cursor-pointer ${
                              canAffordAndCarry
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow hover:brightness-110'
                                : 'border border-slate-800 bg-slate-950 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {qty * unitWeight > cargoInfo.freeWeight
                              ? `⚠️ Перегруз (${qty * unitWeight}/${cargoInfo.freeWeight} в.)`
                              : `🛒 Купить ${qty} ед. (${totalBuyGold.toLocaleString('ru-RU')} 🪙)`}
                          </button>

                          <button
                            type="button"
                            disabled={myQty < qty}
                            onClick={() => handleTerminalTrade('sell', item.key)}
                            className={`rounded-xl py-1.5 px-2 text-[9.5px] font-black uppercase transition-all cursor-pointer ${
                              myQty >= qty
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow hover:brightness-110'
                                : 'border border-slate-800 bg-slate-950 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            💰 Продать {qty} ед. (+{totalSellGold.toLocaleString('ru-RU')} 🪙)
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={myQty <= 0}
                          onClick={() => handleSendResourceToFacility(item.key)}
                          className={`w-full rounded-lg border py-1 px-2 text-[8.5px] font-black transition-all cursor-pointer ${
                            myQty > 0
                              ? 'border-cyan-400/60 bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-200'
                              : 'border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          🚛 Загрузить со своего склада на выбранный завод в Порту ({Math.min(myQty, qty)} ед.)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
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
                <span className="text-2xl flex items-center justify-center shrink-0">
                  {travelStatus === 'in_port' ? (
                    '⚓'
                  ) : travelStatus === 'to_port' || travelStatus === 'from_port' ? (
                    <ItemIcon
                      icon={portTravel.transportIcon || '🚤'}
                      name={portTravel.transportName || 'Транспорт'}
                      className="w-7 h-7 text-2xl"
                      imgClassName="w-7 h-7 object-contain"
                    />
                  ) : (
                    '🏙️'
                  )}
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

          {/* ================= ВЕРФЬ / ГАРАЖ ПОРТА (ПОКУПКА И ЭКИПИРОВКА 4 ТИПОВ ТРАНСПОРТА) ================= */}
          <div className="rounded-xl border border-[#b8b8b8] bg-[#f4f4f0] text-[#222222] shadow-sm overflow-hidden">
            <div className="bg-[#e4ece4] border-b border-[#b8b8b8] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-bold text-[#005500]">
                ⚓ Верфь / Гараж Порта — Базовая линейка транспорта (Скорость по карте 10x10 и Грузоподъемность)
              </div>
              <div className="text-[10px] font-bold text-[#333333]">
                Ваш багажник: <strong className="text-[#006600]">{cargoInfo.currentWeight} / {cargoInfo.maxWeight} ед.</strong> • Скорость: <strong>{cargoInfo.stepSeconds} сек./кл.</strong>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[10.5px]">
                <thead>
                  <tr className="bg-[#e8e8e2] border-b border-[#c8c8c0] text-left text-[#444444]">
                    <th className="py-1.5 px-2.5 font-bold">Транспорт</th>
                    <th className="py-1.5 px-2 font-bold text-center">Скорость (10x10)</th>
                    <th className="py-1.5 px-2 font-bold text-center">Вместимость багажника</th>
                    <th className="py-1.5 px-2 font-bold text-right">Стоимость</th>
                    <th className="py-1.5 px-2.5 font-bold text-right">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {getTransportsCatalog(featureFlags).map((tpl, idx) => {
                    const ownedItem = ownedTransports.find(
                      (o) =>
                        o.id === tpl.id ||
                        (o.name || '').toLowerCase() === (tpl.name || '').toLowerCase()
                    );
                    const isEquippedNow = Boolean(ownedItem && activeTransport?.id === ownedItem.id);
                    const stepSec = Number(tpl.stepSeconds || 22);
                    const cargoCap = Number(tpl.cargoCapacity || 100);
                    const priceGold = Math.max(0, Number(tpl.priceGold ?? 0));
                    const priceCrystals = Math.max(0, Number(tpl.priceCrystals ?? 0));

                    return (
                      <tr
                        key={tpl.id}
                        className={`border-b border-[#dcdcd4] ${
                          idx % 2 === 0 ? 'bg-[#fafaf7]' : 'bg-[#f0f0ea]'
                        }`}
                      >
                        <td className="py-1.5 px-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{tpl.icon || '🚤'}</span>
                            <div>
                              <div className="font-bold text-[#111111]">{tpl.name}</div>
                              <div className="text-[9px] text-[#666666]">
                                Уровень: {tpl.lvl || 1}+ • Прочность: {tpl.maxDurability || 100}/{tpl.maxDurability || 100}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono font-bold text-[#004488]">
                          {stepSec} сек./кл.
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold text-[#006600]">
                          +{cargoCap} веса (всего {30 + cargoCap} ед.)
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold">
                          {priceCrystals > 0 ? (
                            <span className="text-[#006699]">{priceCrystals.toLocaleString('ru-RU')} 💎</span>
                          ) : (
                            <span className="text-[#885500]">{priceGold.toLocaleString('ru-RU')} 🪙</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 text-right">
                          {ownedItem ? (
                            <button
                              type="button"
                              onClick={() => onSelectTransport(ownedItem.id)}
                              className={`rounded border px-2 py-0.5 text-[10px] font-bold cursor-pointer ${
                                isEquippedNow
                                  ? 'border-[#007700] bg-[#d8f0d8] text-[#005500]'
                                  : 'border-[#888888] bg-[#e8e8e8] text-[#222222] hover:bg-[#dcdcdc]'
                              }`}
                            >
                              {isEquippedNow ? '✓ Экипирован' : '[ Экипировать ]'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleBuyTransportDirectly(tpl)}
                              className="rounded border border-[#006600] bg-[#e2f4e2] hover:bg-[#cceecc] px-2.5 py-0.5 text-[10px] font-bold text-[#005500] cursor-pointer"
                            >
                              [ Купить транспорт ]
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                  🚤 Ваш Транспорт ({ownedTransports.length} ед.):
                </div>
                <div className="text-[9.5px] text-slate-400">
                  Выбранный транспорт определяет скорость перехода по клеткам карты 10x10 и грузоподъемность багажника.
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenTransportShop}
                className="rounded-lg border border-emerald-400/70 bg-emerald-950/80 hover:bg-emerald-900 px-2.5 py-1 text-[10px] font-black text-emerald-200 shadow active:scale-95 cursor-pointer"
              >
                🛒 Открыть Магазин
              </button>
            </div>

            {ownedTransports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-950/20 p-4 text-center space-y-2">
                <div className="text-xs font-black text-amber-300">
                  ⚠️ У вас пока нет Транспорта (Вы передвигаетесь пешком: 30 сек./кл., багажник 30 ед.)
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                  Приобретите транспорт в таблице Верфи выше или в Магазине, чтобы увеличить грузоподъемность до <strong>+2 000 ед. веса</strong> и ускорить переходы по карте 10x10 до <strong>8 сек./клетка</strong>!
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {ownedTransports.map((tr) => {
                  const isSelected = activeTransport?.id === tr.id;
                  const curDur = Math.max(0, Number(tr.durability ?? tr.maxDurability ?? 100));
                  const maxDur = Math.max(1, Number(tr.maxDurability ?? 100));
                  const meetsLvl = Number(hero.level || 1) >= Number(tr.lvl || 1);
                  const travelSec = Math.max(10, Number(tr.travelTimeSec || 600));
                  const trStats = resolveTransportSpeedAndCargo(tr);

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
                            <span className="rounded bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.2 text-[8.5px] font-black text-emerald-300">
                              🎒 +{trStats.cargoCapacity} веса • ⏱️ {trStats.stepSeconds} сек./кл.
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-300 mt-0.5 flex flex-wrap items-center gap-2">
                            <span>
                              ⏱️ Путь в Порт: <strong className="text-cyan-300">{formatTravelTimeText(travelSec)}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              🔧 Прочность:{' '}
                              <strong className={curDur > 0 ? 'text-emerald-300' : 'text-rose-400'}>
                                {curDur}/{maxDur}
                              </strong>
                            </span>
                          </div>
                          {formatItemBonusesText(tr) !== 'Нет бонусов' && (
                            <div className="text-[9.5px] font-bold text-amber-300 mt-0.5">
                              ✨ Бонусы: {formatItemBonusesText(tr)}
                            </div>
                          )}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};
