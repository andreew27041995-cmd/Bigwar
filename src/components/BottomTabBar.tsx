import React, { useState, useEffect, useRef } from 'react';
import {
  Game2DPyramidIcon,
  Game2DHeroIcon,
  Game2DWorldIcon,
  Game2DSocialIcon,
  Game2DShopIcon,
  Game2DFishingIcon,
  Game2DWheelIcon,
  EgyptianCornerOrnaments
} from './ui/Game2DIcons';

export type TabBarHubKey = 'pyramid' | 'hero' | 'world' | 'social' | 'shop';

export interface BottomTabBarProps {
  currentScreen?: 'city' | 'pyramid';
  unreadMailCount?: number;
  unspentStatPoints?: number;
  claimableAchievementsCount?: number;
  claimableSeasonRewards?: number;
  canClaimDailyReward?: boolean;
  isPortTraveling?: boolean;
  isFishingBuffActive?: boolean;
  isVipActive?: boolean;
  onEnterPyramid: () => void;
  onOpenCharModal: () => void;
  onOpenMailModal?: () => void;
  // World Hub
  onOpenPort?: () => void;
  onOpenOutland?: () => void;
  onOpenFishing?: () => void;
  onOpenWheel?: () => void;
  // Social Hub
  onOpenClans?: () => void;
  onOpenClanPyramid?: () => void;
  onOpenStadium?: () => void;
  onOpenLeaderboard?: () => void;
  onOpenForum?: () => void;
  onOpenAchievements?: () => void;
  // Shop / Premium Hub
  onOpenShop?: () => void;
  onOpenBank?: () => void;
  onOpenBattlePass?: () => void;
  onOpenPremium?: () => void;
  onOpenDailyReward?: () => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  currentScreen = 'city',
  unreadMailCount = 0,
  unspentStatPoints = 0,
  claimableAchievementsCount = 0,
  claimableSeasonRewards = 0,
  canClaimDailyReward = false,
  isPortTraveling = false,
  isFishingBuffActive = false,
  isVipActive = false,
  onEnterPyramid,
  onOpenCharModal,
  onOpenMailModal,
  onOpenPort,
  onOpenOutland,
  onOpenFishing,
  onOpenWheel,
  onOpenClans,
  onOpenClanPyramid,
  onOpenStadium,
  onOpenLeaderboard,
  onOpenForum,
  onOpenAchievements,
  onOpenShop,
  onOpenBank,
  onOpenBattlePass,
  onOpenPremium,
  onOpenDailyReward
}) => {
  const [activeHubMenu, setActiveHubMenu] = useState<null | 'world' | 'social' | 'shop'>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close popup menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveHubMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  const heroNotifications = unreadMailCount + unspentStatPoints;
  const socialNotifications = claimableAchievementsCount + (canClaimDailyReward ? 1 : 0);
  const shopNotifications = claimableSeasonRewards;

  const handleTabClick = (hub: TabBarHubKey) => {
    if (hub === 'pyramid') {
      setActiveHubMenu(null);
      onEnterPyramid();
      return;
    }
    if (hub === 'hero') {
      setActiveHubMenu(null);
      if (unreadMailCount > 0 && onOpenMailModal) {
        onOpenMailModal();
      } else {
        onOpenCharModal();
      }
      return;
    }
    // Toggle submenu for 'world', 'social', 'shop'
    setActiveHubMenu((prev) => (prev === hub ? null : hub));
  };

  return (
    <div ref={containerRef} className="relative z-30 w-full select-none">
      {/* POPUP SUBMENU MODAL / SHEET IN 2D EGYPTIAN TABLET STYLE */}
      {activeHubMenu && (
        <div className="game-2d-panel absolute bottom-[calc(100%+7px)] left-1.5 right-1.5 rounded-2xl p-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <EgyptianCornerOrnaments variant="gold" />
          <div className="relative z-20 flex items-center justify-between border-b border-amber-500/35 pb-1.5 mb-2 px-1">
            <span className="text-[10.5px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5 drop-shadow">
              {activeHubMenu === 'world' && (
                <>
                  <Game2DWorldIcon size={16} />
                  <span>Мир и Активности Древнего Египта</span>
                </>
              )}
              {activeHubMenu === 'social' && (
                <>
                  <Game2DSocialIcon size={16} />
                  <span>Сообщество и Социум Фараонов</span>
                </>
              )}
              {activeHubMenu === 'shop' && (
                <>
                  <Game2DShopIcon size={16} />
                  <span>Магазин, Казна и Премиум</span>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => setActiveHubMenu(null)}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-amber-500/50 bg-slate-900/90 text-[10px] font-black text-amber-200 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* 1. WORLD SUBMENU */}
          {activeHubMenu === 'world' && (
            <div className="relative z-20 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {onOpenPort && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveHubMenu(null);
                    onOpenPort();
                  }}
                  className="game-2d-btn flex flex-col items-center justify-center rounded-xl border border-cyan-400/70 bg-gradient-to-b from-cyan-900/90 via-cyan-950 to-slate-950 p-2 text-center shadow-[0_3px_0_#083344] hover:border-cyan-300 cursor-pointer"
                >
                  <Game2DWorldIcon size={24} className="mb-0.5" />
                  <span className="text-[9.5px] font-black text-cyan-100 drop-shadow">Порт Нила</span>
                  <span className="text-[7.5px] text-cyan-300/90">Карта 10x10 & Заводы</span>
                  {isPortTraveling && (
                    <span className="mt-1 rounded bg-amber-400 px-1 text-[6.5px] font-black text-slate-950 shadow">
                      ПЛЫВЁТ
                    </span>
                  )}
                </button>
              )}

              {onOpenOutland && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveHubMenu(null);
                    onOpenOutland();
                  }}
                  className="game-2d-btn flex flex-col items-center justify-center rounded-xl border border-emerald-400/70 bg-gradient-to-b from-emerald-900/90 via-emerald-950 to-slate-950 p-2 text-center shadow-[0_3px_0_#064e3b] hover:border-emerald-300 cursor-pointer"
                >
                  <span className="text-xl leading-none mb-1 drop-shadow">🏝️</span>
                  <span className="text-[9.5px] font-black text-emerald-100 drop-shadow">АУТЛЕНД</span>
                  <span className="text-[7.5px] text-emerald-300/90">Прибрежная зона 5x5</span>
                </button>
              )}

              {onOpenFishing && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveHubMenu(null);
                    onOpenFishing();
                  }}
                  className="game-2d-btn flex flex-col items-center justify-center rounded-xl border border-teal-400/70 bg-gradient-to-b from-teal-900/90 via-teal-950 to-slate-950 p-2 text-center shadow-[0_3px_0_#042f2e] hover:border-teal-300 cursor-pointer"
                >
                  <Game2DFishingIcon size={24} className="mb-0.5" />
                  <span className="text-[9.5px] font-black text-teal-100 drop-shadow">Рыбалка</span>
                  <span className="text-[7.5px] text-teal-300/90">Сдача в Порт (50🪙)</span>
                  {isFishingBuffActive && (
                    <span className="mt-1 rounded bg-purple-600 px-1 text-[6.5px] font-black text-white animate-pulse">
                      БАФФ +25%
                    </span>
                  )}
                </button>
              )}

              {onOpenWheel && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveHubMenu(null);
                    onOpenWheel();
                  }}
                  className="game-2d-btn flex flex-col items-center justify-center rounded-xl border border-rose-400/70 bg-gradient-to-b from-rose-900/90 via-rose-950 to-slate-950 p-2 text-center shadow-[0_3px_0_#4c0519] hover:border-rose-300 cursor-pointer"
                >
                  <Game2DWheelIcon size={24} className="mb-0.5" />
                  <span className="text-[9.5px] font-black text-rose-100 drop-shadow">Азарт</span>
                  <span className="text-[7.5px] text-rose-300/90">Колесо & Кости</span>
                </button>
              )}
            </div>
          )}

          {/* 2. SOCIAL SUBMENU */}
          {activeHubMenu === 'social' && (
            <div className="relative z-20 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {onOpenClans && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveHubMenu(null);
                    onOpenClans();
                  }}
                  className="game-2d-btn game-2d-btn-slot flex items-center gap-2 rounded-xl p-2 text-left cursor-pointer"
                >
                  <Game2DSocialIcon size={22} />
                  <div className="min-w-0">
                    <div className="text-[9px] font-black text-amber-200">Кланы</div>
                    <div className="text-[7.5px] text-slate-400">Склад & Союз</div>
                  </div>
                </button>
              )}

              {onOpenClanPyramid && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveHubMenu(null);
                    onOpenClanPyramid();
                  }}
                  className="game-2d-btn game-2d-btn-slot flex items-center gap-2 rounded-xl border-red-500/60 p-2 text-left cursor-pointer"
                >
                  <Game2DPyramidIcon size={22} active />
                  <div className="min-w-0">
                    <div className="text-[9px] font-black text-red-200">Клановая Битва</div>
                    <div className="text-[7.5px] text-slate-400">Война за Пирамиду</div>
                  </div>
                </button>
              )}

              {onOpenStadium && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveHubMenu(null);
                    onOpenStadium();
                  }}
                  className="game-2d-btn game-2d-btn-slot flex items-center gap-2 rounded-xl border-purple-500/60 p-2 text-left cursor-pointer"
                >
                  <span className="text-lg drop-shadow">🏟️</span>
                  <div className="min-w-0">
                    <div className="text-[9px] font-black text-purple-200">Стадион</div>
                    <div className="text-[7.5px] text-slate-400">Тотализатор [5/5]</div>
                  </div>
                </button>
              )}

              {onOpenLeaderboard && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveHubMenu(null);
                    onOpenLeaderboard();
                  }}
                  className="game-2d-btn game-2d-btn-slot flex items-center gap-2 rounded-xl p-2 text-left cursor-pointer"
                >
                  <span className="text-lg drop-shadow">🏆</span>
                  <div className="min-w-0">
                    <div className="text-[9px] font-black text-amber-200">Рейтинг</div>
                    <div className="text-[7.5px] text-slate-400">Топ бойцов & рыбаков</div>
                  </div>
                </button>
              )}

              {onOpenAchievements && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveHubMenu(null);
                    onOpenAchievements();
                  }}
                  className="game-2d-btn game-2d-btn-slot flex items-center gap-2 rounded-xl border-cyan-500/50 p-2 text-left cursor-pointer"
                >
                  <span className="text-lg drop-shadow">🏅</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-[9px] font-black text-cyan-200">
                      <span>Подвиги</span>
                      {socialNotifications > 0 && (
                        <span className="rounded-full bg-red-600 px-1 text-[7px] text-white">
                          +{socialNotifications}
                        </span>
                      )}
                    </div>
                    <div className="text-[7.5px] text-slate-400">Ачивки & Квесты</div>
                  </div>
                </button>
              )}

              {onOpenForum && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveHubMenu(null);
                    onOpenForum();
                  }}
                  className="game-2d-btn game-2d-btn-slot flex items-center gap-2 rounded-xl border-indigo-500/50 p-2 text-left cursor-pointer col-span-2 sm:col-span-1"
                >
                  <span className="text-lg drop-shadow">📖</span>
                  <div className="min-w-0">
                    <div className="text-[9px] font-black text-indigo-200">Форум</div>
                    <div className="text-[7.5px] text-slate-400">Обновления игры</div>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* 3. SHOP / PREMIUM SUBMENU */}
          {activeHubMenu === 'shop' && (
            <div className="relative z-20 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {onOpenShop && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveHubMenu(null);
                    onOpenShop();
                  }}
                  className="game-2d-btn game-2d-btn-slot flex items-center gap-2 rounded-xl border-emerald-500/55 p-2 text-left cursor-pointer"
                >
                  <Game2DShopIcon size={22} />
                  <div className="min-w-0">
                    <div className="text-[9px] font-black text-emerald-200">Магазин</div>
                    <div className="text-[7.5px] text-slate-400">Оружие, броня, транспорт</div>
                  </div>
                </button>
              )}

              {onOpenBank && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveHubMenu(null);
                    onOpenBank();
                  }}
                  className="game-2d-btn game-2d-btn-slot flex items-center gap-2 rounded-xl border-cyan-500/55 p-2 text-left cursor-pointer"
                >
                  <span className="text-lg drop-shadow">🏦</span>
                  <div className="min-w-0">
                    <div className="text-[9px] font-black text-cyan-200">Банк</div>
                    <div className="text-[7.5px] text-slate-400">Кристаллы & Обмен</div>
                  </div>
                </button>
              )}

              {onOpenBattlePass && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveHubMenu(null);
                    onOpenBattlePass();
                  }}
                  className="game-2d-btn flex items-center gap-2 rounded-xl border border-amber-400/80 bg-gradient-to-r from-amber-950/90 via-purple-950/85 to-slate-950 p-2 text-left shadow-[0_3px_0_#3b0764] hover:border-yellow-300 cursor-pointer"
                >
                  <span className="text-lg drop-shadow">🏆</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-[9px] font-black text-yellow-300">
                      <span>Боевой Пропуск</span>
                      {claimableSeasonRewards > 0 && (
                        <span className="rounded-full bg-red-600 px-1 text-[7px] text-white animate-bounce">
                          {claimableSeasonRewards}
                        </span>
                      )}
                    </div>
                    <div className="text-[7.5px] text-amber-200/85">Сезон 1–40 ур.</div>
                  </div>
                </button>
              )}

              {onOpenPremium && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveHubMenu(null);
                    onOpenPremium();
                  }}
                  className="game-2d-btn game-2d-btn-slot flex items-center gap-2 rounded-xl border-yellow-500/55 p-2 text-left cursor-pointer"
                >
                  <span className="text-lg drop-shadow">👑</span>
                  <div className="min-w-0">
                    <div className="text-[9px] font-black text-yellow-200">
                      VIP Премиум {isVipActive && '✓'}
                    </div>
                    <div className="text-[7.5px] text-slate-400">Бонусы x2 & Реген</div>
                  </div>
                </button>
              )}

              {onOpenDailyReward && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveHubMenu(null);
                    onOpenDailyReward();
                  }}
                  className="game-2d-btn game-2d-btn-slot flex items-center gap-2 rounded-xl border-fuchsia-500/55 p-2 text-left cursor-pointer"
                >
                  <span className="text-lg drop-shadow">🎁</span>
                  <div className="min-w-0">
                    <div className="text-[9px] font-black text-fuchsia-200">
                      Календарь Наград
                    </div>
                    <div className="text-[7.5px] text-slate-400">Ежедневный подарок</div>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* DOCKED BOTTOM TAB BAR (5 CORE 2D GAME BUTTONS WITH ORNATE GOLD FRAME) */}
      <div className="game-2d-dock relative overflow-visible grid grid-cols-5 gap-1.5 rounded-2xl pt-2 px-1.5 pb-1.5">
        <EgyptianCornerOrnaments variant="gold" />

        {/* 1. ПИРАМИДА (Главная / Бой) */}
        <button
          type="button"
          onClick={() => handleTabClick('pyramid')}
          className={`game-2d-btn relative z-20 overflow-visible flex flex-col items-center justify-center rounded-xl py-1 cursor-pointer ${
            currentScreen === 'pyramid'
              ? 'game-2d-btn-gold text-amber-50'
              : 'game-2d-btn-slot text-amber-200'
          }`}
          title="Пирамида: Исследование, монстры и битвы"
        >
          <Game2DPyramidIcon size={23} active={currentScreen === 'pyramid'} className="mb-0.5" />
          <span
            className={`text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] ${
              currentScreen === 'pyramid' ? 'text-white' : 'text-amber-300'
            }`}
          >
            {currentScreen === 'pyramid' ? 'В бою' : 'Пирамида'}
          </span>
        </button>

        {/* 2. ГЕРОЙ (Персонаж, Инвентарь, Почта) */}
        <button
          type="button"
          onClick={() => handleTabClick('hero')}
          className="game-2d-btn game-2d-btn-slot relative z-20 overflow-visible flex flex-col items-center justify-center rounded-xl py-1 cursor-pointer"
          title="Герой: Статы, Экипировка, Инвентарь, Почта"
        >
          {heroNotifications > 0 && (
            <span className="absolute -top-1.5 right-0.5 z-30 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-yellow-300 bg-gradient-to-b from-red-500 to-red-700 px-1 text-[7.5px] font-black text-white shadow-[0_0_10px_#ef4444] animate-bounce">
              {heroNotifications}
            </span>
          )}
          <Game2DHeroIcon size={23} className="mb-0.5" />
          <span className="text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider text-sky-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
            Герой
          </span>
        </button>

        {/* 3. МИР (Порт, Рыбалка, Азарт) */}
        <button
          type="button"
          onClick={() => handleTabClick('world')}
          className={`game-2d-btn relative z-20 overflow-visible flex flex-col items-center justify-center rounded-xl py-1 cursor-pointer ${
            activeHubMenu === 'world' ? 'game-2d-btn-lapis text-white' : 'game-2d-btn-slot text-cyan-200'
          }`}
          title="Мир: Порт Нила, Рыбалка, Азартные игры"
        >
          {(isPortTraveling || isFishingBuffActive) && (
            <span className="absolute -top-1 right-1 z-30 h-2.5 w-2.5 rounded-full bg-teal-400 ring-2 ring-slate-950 shadow-[0_0_8px_#2dd4bf] animate-ping" />
          )}
          <Game2DWorldIcon size={23} className="mb-0.5" />
          <span className="text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider text-cyan-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
            Мир
          </span>
        </button>

        {/* 4. СООБЩЕСТВО (Кланы, Рейтинг, Форум, Подвиги) */}
        <button
          type="button"
          onClick={() => handleTabClick('social')}
          className={`game-2d-btn relative z-20 overflow-visible flex flex-col items-center justify-center rounded-xl py-1 cursor-pointer ${
            activeHubMenu === 'social' ? 'game-2d-btn-emerald text-white' : 'game-2d-btn-slot text-emerald-200'
          }`}
          title="Сообщество: Кланы, Битва за Пирамиду, Рейтинг, Форум, Подвиги"
        >
          {socialNotifications > 0 && (
            <span className="absolute -top-1.5 right-0.5 z-30 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-yellow-300 bg-gradient-to-b from-red-500 to-red-700 px-1 text-[7.5px] font-black text-white shadow-[0_0_10px_#ef4444] animate-bounce">
              {socialNotifications}
            </span>
          )}
          <Game2DSocialIcon size={23} className="mb-0.5" />
          <span className="text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider text-emerald-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
            Социум
          </span>
        </button>

        {/* 5. МАГАЗИН (Магазин, Банк, Сезон, VIP) */}
        <button
          type="button"
          onClick={() => handleTabClick('shop')}
          className={`game-2d-btn relative z-20 overflow-visible flex flex-col items-center justify-center rounded-xl py-1 cursor-pointer ${
            activeHubMenu === 'shop' ? 'game-2d-btn-gold text-white' : 'game-2d-btn-slot text-yellow-300'
          }`}
          title="Магазин: Экипировка, Банк, Сезон 1-40 ур., VIP"
        >
          {shopNotifications > 0 && (
            <span className="absolute -top-1.5 right-0.5 z-30 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-yellow-300 bg-gradient-to-b from-red-500 to-red-700 px-1 text-[7.5px] font-black text-white shadow-[0_0_10px_#ef4444] animate-bounce">
              {shopNotifications}
            </span>
          )}
          <Game2DShopIcon size={23} className="mb-0.5" />
          <span className="text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider text-yellow-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
            Магазин
          </span>
        </button>
      </div>
    </div>
  );
};

