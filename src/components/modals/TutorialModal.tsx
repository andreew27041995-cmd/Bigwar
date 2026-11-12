import React, { useState, useEffect, useCallback } from 'react';

interface TutorialModalProps {
  heroNick: string;
  heroLevel: number;
  currentScreen?: 'city' | 'pyramid';
  onClose: () => void;
  onComplete?: () => void;
  onOpenSection?: (section: 'character' | 'lootHistory' | 'npcBag' | 'shop' | 'bank' | 'wheel' | 'dailyReward' | 'forum') => void;
}

interface PointerStep {
  id: number;
  selector: string;
  fallbackSelector?: string;
  badge: string;
  icon: string;
  buttonLabel: string;
  title: string;
  whereToClick: string;
  explanation: string;
  bullets: string[];
  actionKey?: 'character' | 'lootHistory' | 'npcBag' | 'shop' | 'bank' | 'wheel' | 'dailyReward' | 'forum';
  actionText?: string;
}

const POINTER_STEPS: PointerStep[] = [
  {
    id: 1,
    selector: '[data-tutorial="hud-bars"]',
    badge: 'ШАГ 1 ИЗ 9 • ПАНЕЛЬ ГЕРОЯ',
    icon: '❤️',
    buttonLabel: 'Панель HP, Энергии и Валюты',
    title: 'Ваше Здоровье (❤️), Энергия (⚡) и Уровень',
    whereToClick: '👆 В левом верхнем углу экрана находится панель вашего персонажа',
    explanation:
      'Здесь отображаются ваше Здоровье (HP), Энергия (⚡) для шагов и ударов, Опыт (EXP), а также Золото (🪙) и Кристаллы (💎).',
    bullets: [
      '💤 В Городе и даже когда вы ОФФЛАЙН здоровье и энергия восстанавливаются сами (+1 каждые 3 сек, с VIP — каждую 1 сек)!',
      '👤 Нажмите на аватарку героя в этой панели, чтобы быстро открыть Профиль и Почту.'
    ],
    actionKey: 'character',
    actionText: '👤 Открыть профиль'
  },
  {
    id: 2,
    selector: '[data-tutorial="potions-bar"]',
    fallbackSelector: '[data-tutorial="hud-bars"]',
    badge: 'ШАГ 2 ИЗ 9 • БЫСТРЫЕ ЗЕЛЬЯ',
    icon: '🧪',
    buttonLabel: 'Быстрые эликсиры (HP, EN, EXP)',
    title: 'Мгновенное лечение и заряд энергии',
    whereToClick: '👆 Нажмите на квадратные бутылочки слева под панелью героя',
    explanation:
      'Три кнопки быстрого доступа позволяют пить эликсиры в 1 клик прямо во время боя или прогулки:',
    bullets: [
      '🧪 HP — мгновенно восстанавливает +50 здоровья.',
      '⚗️ EN — мгновенно добавляет +20⚡ энергии для шагов и атак.',
      '✨ EXP — включает бонус +25% к получаемому опыту на 30 минут!'
    ]
  },
  {
    id: 3,
    selector: '[data-tutorial="btn-character"]',
    fallbackSelector: '[data-tutorial="hud-bars"]',
    badge: 'ШАГ 3 ИЗ 9 • ПЕРСОНАЖ И ДОБЫЧА',
    icon: '👤',
    buttonLabel: 'Кнопка «👤 Персонаж»',
    title: 'Экипировка, Статы, Страж NPC и История Добычи',
    whereToClick: '👆 Нажмите на кнопку «👤 Персонаж» в центре меню Города',
    explanation:
      'Это главный центр управления вашим героем. Внутри открываются 5 важных вкладок:',
    bullets: [
      '👤 Вещи и +Статы — надевайте оружие/броню и распределяйте очки (+Сила, +Ловкость, +Живучесть).',
      '🤖 NPC — включайте или выключайте своего автономного Стража Пирамиды и проверяйте его уведомления.',
      '📜 Добыча (Loot History) — список последних 20 убитых монстров и открытых сундуков за текущую сессию!'
    ],
    actionKey: 'lootHistory',
    actionText: '📜 Посмотреть вкладку «Добыча»'
  },
  {
    id: 4,
    selector: '[data-tutorial="btn-shop"]',
    fallbackSelector: '[data-tutorial="hud-bars"]',
    badge: 'ШАГ 4 ИЗ 9 • МАГАЗИН И АУКЦИОН',
    icon: '🛒',
    buttonLabel: 'Кнопка «🛒 Магазин»',
    title: 'Покупка Оружия, Зелий, Скинов и Аукцион',
    whereToClick: '👆 Нажмите на зелёную кнопку «🛒 Магазин» справа от Персонажа',
    explanation:
      'В Магазине вы усиливаете своего героя для походов на более высокие ярусы Пирамиды:',
    bullets: [
      '⚔️ Покупайте мечи, броню, сапоги, перчатки и кольца по своему уровню.',
      '🎫 В разделе «Лицензии» продаются Карточки перехода (П1, П2, П3) и Лицензия Киллера для PvP.',
      '⚖️ Из Магазина также открывается Аукцион игроков и Кузница именного оружия.'
    ],
    actionKey: 'shop',
    actionText: '🛒 Открыть Магазин'
  },
  {
    id: 5,
    selector: '[data-tutorial="btn-bank"]',
    fallbackSelector: '[data-tutorial="hud-bars"]',
    badge: 'ШАГ 5 ИЗ 9 • БАНК И ОБМЕН ВАЛЮТ',
    icon: '🏦',
    buttonLabel: 'Кнопка «🏦 Банк»',
    title: 'Обмен Золота и Кристаллов',
    whereToClick: '👆 Нажмите на голубую кнопку «🏦 Банк» в правом ряду меню',
    explanation:
      'В Банке вы можете обменивать игровую валюту по курсу и пополнять баланс кристаллов:',
    bullets: [
      '💎 Меняйте Кристаллы на Золото или Золото на Кристаллы в рамках дневного лимита.',
      '👑 Здесь же можно активировать VIP Премиум-статус для ускоренной регенерации (1 сек) и двойного опыта!'
    ],
    actionKey: 'bank',
    actionText: '🏦 Открыть Банк'
  },
  {
    id: 6,
    selector: '[data-tutorial="btn-wheel"]',
    fallbackSelector: '[data-tutorial="btn-daily-gift"]',
    badge: 'ШАГ 6 ИЗ 9 • РУЛЕТКА И ПОДАРКИ',
    icon: '🎡',
    buttonLabel: 'Кнопка «🎡 Рулетка» и «🎁 Подарок»',
    title: 'Бесплатное вращение каждый день!',
    whereToClick: '👆 Нажмите на кнопку «🎡 Рулетка» в нижнем ряду меню',
    explanation:
      'Испытайте удачу в Колесе Фортуны и не забывайте забирать ежедневные награды:',
    bullets: [
      '🎁 Раз в день каждому игроку даётся 1 БЕСПЛАТНЫЙ прокрут Рулетки!',
      '🪙💎 Дополнительно крутить рулетку можно за Золото или за Кристаллы.',
      '🎭 Выигрывайте эксклюзивные скины навсегда, кристаллы, золото и даже Стража NPC!'
    ],
    actionKey: 'wheel',
    actionText: '🎡 Открыть Рулетку'
  },
  {
    id: 7,
    selector: '[data-tutorial="btn-enter-pyramid"]',
    fallbackSelector: '[data-tutorial="pyramid-exit"]',
    badge: 'ШАГ 7 ИЗ 9 • ПОХОД В ПИРАМИДУ',
    icon: '🏛️',
    buttonLabel: 'Главная кнопка «🏛️ Войти в Пирамиду»',
    title: 'Как исследовать Пирамиду и бить монстров',
    whereToClick: '👆 Нажмите на большую кнопку «🏛️ Войти в Пирамиду»',
    explanation:
      'Пирамида состоит из 10 ступенчатых рядов — от широкого основания внизу до вершины с Верховным Боссом:',
    bullets: [
      '⚡ Для входа после поражения нужно минимум 30⚡ энергии. Шаг на пустую плиту стоит 1⚡, удар по монстру — 3⚡.',
      '👣 Нажимайте на соседние каменные плиты вокруг вашего героя (по горизонтали, вертикали или диагонали), чтобы шагать и открывать сундуки/мешки с золотом.',
      '🌀 Победите Босса на самой вершине, чтобы открыть Портал в следующую Пирамиду!'
    ]
  },
  {
    id: 8,
    selector: '[data-tutorial="pyramid-exit"]',
    fallbackSelector: '[data-tutorial="btn-enter-pyramid"]',
    badge: 'ШАГ 8 ИЗ 9 • ВАЖНОЕ ПРАВИЛО ВЫХОДА!',
    icon: '🚪',
    buttonLabel: 'Кнопка «❖ ВЫХОД ❖» (Только с 1-й линии)',
    title: 'Выход из Пирамиды работает ТОЛЬКО на 1-й линии!',
    whereToClick: '👆 Внутри Пирамиды кнопка «ВЫХОД» находится в самом низу у основания',
    explanation:
      'Запомните главное правило безопасного возвращения в Город с добычей:',
    bullets: [
      '🛑 Кнопка «❖ ВЫХОД ❖» активна ТОЛЬКО когда ваш персонаж стоит на Первой линии (самый нижний ряд пирамиды у входа — ряд 9)!',
      '🧭 Если вы поднялись на 2-ю линию и выше, кнопка покажет «🔒 ВЫХОД (1-Я ЛИНИЯ)» — сначала спуститесь по плитам на нижний ряд.',
      '💡 Следите за запасом HP и энергии, чтобы вовремя вернуться на 1-ю линию!'
    ]
  },
  {
    id: 9,
    selector: '[data-tutorial="chat-combat-log"]',
    fallbackSelector: '[data-tutorial="btn-forum"]',
    badge: 'ШАГ 9 ИЗ 9 • ЧАТ, ЛОГ БОЯ И ФОРУМ',
    icon: '⚔️',
    buttonLabel: 'Нижняя панель Чата и Боевого Лога',
    title: 'Фильтры Боевого Лога, Личные сообщения и Форум',
    whereToClick: '👆 В нижней части экрана расположены вкладки «Мир», «✉️ ЛС» и «⚔️ Лог»',
    explanation:
      'Общайтесь с игроками, торгуйте и анализируйте свои сражения:',
    bullets: [
      '⚔️ Во вкладке «Лог» можно фильтровать удары по типу: 💥 Критические удары, 💨 Промахи/Увороты и 🎁 Добыча!',
      '📖 Нажмите кнопку «📖 Форум» в меню, чтобы прочитать последние Обновления и энциклопедию «Об игре».',
      '🎓 Кнопка «🎓 Обучение» вверху экрана остаётся с вами до 5-го уровня — вы можете закрыть или открыть её в любой момент!'
    ],
    actionKey: 'forum',
    actionText: '📖 Открыть Форум и Об игре'
  }
];

export const TutorialModal: React.FC<TutorialModalProps> = ({
  heroNick,
  heroLevel,
  onClose,
  onComplete,
  onOpenSection
}) => {
  const [mode, setMode] = useState<'pointer' | 'overview'>('pointer');
  const [stepIdx, setStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStep = POINTER_STEPS[stepIdx];
  const isLastStep = stepIdx === POINTER_STEPS.length - 1;

  const updateSpotlightRect = useCallback(() => {
    if (mode !== 'pointer') {
      setTargetRect(null);
      return;
    }
    const step = POINTER_STEPS[stepIdx];
    if (!step) return;

    let el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el && step.fallbackSelector) {
      el = document.querySelector(step.fallbackSelector) as HTMLElement | null;
    }
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect(rect);
        return;
      }
    }
    setTargetRect(null);
  }, [mode, stepIdx]);

  useEffect(() => {
    updateSpotlightRect();
    const timer = setTimeout(updateSpotlightRect, 120);
    window.addEventListener('resize', updateSpotlightRect);
    window.addEventListener('scroll', updateSpotlightRect, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSpotlightRect);
      window.removeEventListener('scroll', updateSpotlightRect, true);
    };
  }, [updateSpotlightRect]);

  // Decide whether Coach Card should sit at the bottom or top of viewport so it NEVER covers the highlighted button
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const targetCenterY = targetRect ? targetRect.top + targetRect.height / 2 : viewportH * 0.25;
  const placeCardAtTop = targetRect !== null && targetCenterY > viewportH * 0.46;

  if (mode === 'overview') {
    return (
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm select-none">
        <div className="relative flex w-full max-w-[410px] max-h-[90dvh] flex-col overflow-hidden rounded-2xl border-2 border-amber-400/90 bg-gradient-to-b from-[#1e1330] via-[#131722] to-[#0b0e14] text-white shadow-[0_0_40px_rgba(245,158,11,0.45)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-amber-500/30 bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 px-3.5 py-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/60 bg-amber-500/20 text-base shadow">
                🎓
              </span>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-amber-300">
                  Полная Памятка Игрока
                </div>
                <div className="text-[9px] text-amber-200/80">
                  Герой: <strong className="text-white">{heroNick}</strong> (Ур. {heroLevel}) • До 5 ур.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMode('pointer')}
                className="rounded-lg border border-cyan-400/80 bg-cyan-950/80 px-2 py-1 text-[9.5px] font-black text-cyan-200 hover:bg-cyan-900 cursor-pointer"
              >
                👆 Показать на экране
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 bg-slate-900/90 px-2 py-1 text-[10px] font-extrabold text-slate-300 hover:border-red-400 hover:text-red-200 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* All Steps Summary List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {POINTER_STEPS.map((s, idx) => (
              <div
                key={s.id}
                onClick={() => {
                  setStepIdx(idx);
                  setMode('pointer');
                }}
                className="rounded-xl border border-slate-800 bg-slate-900/85 p-2.5 hover:border-amber-500/50 transition-all cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                    <span>{s.icon}</span>
                    <span>
                      {idx + 1}. {s.title}
                    </span>
                  </span>
                  <span className="rounded bg-cyan-950/80 border border-cyan-500/40 px-1.5 py-0.5 text-[8px] font-bold text-cyan-300">
                    👆 Показать
                  </span>
                </div>
                <div className="text-[9.5px] text-emerald-300 font-semibold">{s.whereToClick}</div>
                <p className="text-[9.5px] text-slate-300 leading-snug">{s.explanation}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800 bg-slate-950 px-3.5 py-2.5 shrink-0 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMode('pointer')}
              className="rounded-xl border border-cyan-400 bg-cyan-950/80 px-3 py-1.5 text-[10.5px] font-black text-cyan-200 hover:bg-cyan-900 cursor-pointer"
            >
              👆 Вернуться к указателю
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-4 py-1.5 text-[10.5px] font-black text-slate-950 cursor-pointer"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pad = 6;
  const spotLeft = targetRect ? Math.max(4, targetRect.left - pad) : 0;
  const spotTop = targetRect ? Math.max(4, targetRect.top - pad) : 0;
  const spotWidth = targetRect ? targetRect.width + pad * 2 : 0;
  const spotHeight = targetRect ? targetRect.height + pad * 2 : 0;

  return (
    <div className="fixed inset-0 z-[130] select-none overflow-hidden">
      {/* Dark backdrop if no targetRect found */}
      {!targetRect && <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px]" />}

      {/* Spotlight Cutout & Animated Pointer around the real UI element */}
      {targetRect && (
        <>
          <div
            onClick={() => {
              if (currentStep.actionKey && onOpenSection) {
                onOpenSection(currentStep.actionKey);
              } else if (!isLastStep) {
                setStepIdx((p) => p + 1);
              }
            }}
            style={{
              position: 'fixed',
              left: `${spotLeft}px`,
              top: `${spotTop}px`,
              width: `${spotWidth}px`,
              height: `${spotHeight}px`,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.78)'
            }}
            className="z-[131] rounded-xl border-2 border-amber-400 ring-4 ring-amber-400/40 transition-all duration-300 cursor-pointer animate-pulse"
            title="Нажмите, чтобы перейти дальше или открыть раздел"
          />

          {/* Bouncing Hand Pointer Badge pointing directly at the highlighted button */}
          <div
            style={{
              position: 'fixed',
              left: `${Math.min(Math.max(12, spotLeft + spotWidth / 2 - 75), (typeof window !== 'undefined' ? window.innerWidth : 400) - 165)}px`,
              top: placeCardAtTop
                ? `${Math.max(8, spotTop - 38)}px`
                : `${Math.min((typeof window !== 'undefined' ? window.innerHeight : 800) - 42, spotTop + spotHeight + 8)}px`
            }}
            className="z-[133] pointer-events-none flex items-center gap-1 rounded-full border-2 border-amber-300 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-[0_0_20px_rgba(251,191,36,0.95)] animate-bounce"
          >
            <span className="text-sm leading-none">{placeCardAtTop ? '👇' : '👆'}</span>
            <span>Нажмите сюда!</span>
          </div>
        </>
      )}

      {/* Floating Coach Explanation Card (automatically docks to Top or Bottom to never block the target button) */}
      <div
        className={`fixed left-1/2 z-[135] w-[95%] max-w-[410px] -translate-x-1/2 transition-all duration-300 ${
          placeCardAtTop ? 'top-2.5' : 'bottom-2.5'
        }`}
      >
        <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-amber-400/95 bg-gradient-to-b from-[#1e1330]/98 via-[#121622]/98 to-[#0b0e14]/98 text-white shadow-[0_0_35px_rgba(245,158,11,0.5)] backdrop-blur-md">
          {/* Top Coach Bar */}
          <div className="flex items-center justify-between border-b border-amber-500/30 bg-gradient-to-r from-amber-950/90 via-slate-900 to-cyan-950/80 px-3 py-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-amber-400/60 bg-amber-500/20 text-sm">
                🎓
              </span>
              <div className="truncate">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-300 truncate">
                  {currentStep.badge}
                </div>
                <div className="text-[8.5px] text-cyan-200/90 truncate">
                  Интерактивный гид • Шаг {stepIdx + 1} из {POINTER_STEPS.length}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setMode('overview')}
                className="rounded-lg border border-purple-400/60 bg-purple-950/70 px-2 py-1 text-[8.5px] font-bold text-purple-200 hover:bg-purple-900 cursor-pointer"
                title="Открыть полный список всех шагов"
              >
                📖 Все шаги
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[9px] font-extrabold text-slate-300 hover:border-red-400 hover:text-red-200 cursor-pointer"
                title="Отменить / Закрыть обучение (кнопка останется до 5 уровня)"
              >
                ✕ Закрыть
              </button>
            </div>
          </div>

          {/* Progress Dots */}
          <div className="flex items-center gap-1 bg-slate-950/90 px-3 py-1.5 border-b border-slate-800/80">
            {POINTER_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStepIdx(idx)}
                className={`h-1.5 flex-1 rounded-full transition-all cursor-pointer ${
                  idx === stepIdx
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 shadow-[0_0_8px_#fbbf24]'
                    : idx < stepIdx
                    ? 'bg-emerald-500/80'
                    : 'bg-slate-800 hover:bg-slate-700'
                }`}
                title={s.title}
              />
            ))}
          </div>

          {/* Main Explanation Body */}
          <div className="p-3 space-y-2 max-h-[46dvh] overflow-y-auto">
            <div className="flex items-start gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/60 bg-slate-950 text-xl shadow-inner">
                {currentStep.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-400/50 px-1.5 py-0.2 text-[8.5px] font-black text-amber-300 mb-0.5">
                  <span>🎯 Цель:</span>
                  <span>{currentStep.buttonLabel}</span>
                </div>
                <h3 className="text-xs sm:text-sm font-black text-white leading-tight">
                  {currentStep.title}
                </h3>
              </div>
            </div>

            {/* Highlighted "Where to press" instruction */}
            <div className="rounded-lg border border-cyan-500/50 bg-cyan-950/40 px-2.5 py-1.5 text-[10px] font-extrabold text-cyan-200 flex items-center gap-1.5">
              <span className="text-sm shrink-0">👉</span>
              <span>{currentStep.whereToClick}</span>
            </div>

            <p className="text-[10.5px] text-slate-200 leading-snug">
              {currentStep.explanation}
            </p>

            <div className="space-y-1">
              {currentStep.bullets.map((b, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-slate-800/90 bg-slate-900/90 px-2.5 py-1.5 text-[9.5px] text-slate-300 leading-snug"
                >
                  {b}
                </div>
              ))}
            </div>

            {/* Optional Direct Action Button to open the highlighted section right now */}
            {currentStep.actionKey && onOpenSection && (
              <button
                type="button"
                onClick={() => onOpenSection(currentStep.actionKey!)}
                className="w-full rounded-xl border border-emerald-400/80 bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-950 py-1.5 text-[10px] font-black text-emerald-200 shadow hover:brightness-110 active:scale-98 cursor-pointer"
              >
                {currentStep.actionText || '🔍 Открыть этот раздел сейчас'}
              </button>
            )}
          </div>

          {/* Navigation Controls Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-slate-800 bg-slate-950 px-3 py-2">
            <button
              type="button"
              disabled={stepIdx === 0}
              onClick={() => setStepIdx((p) => Math.max(0, p - 1))}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-[10.5px] font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              ← Назад
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-[9.5px] font-bold text-slate-400 hover:text-white cursor-pointer"
            >
              Отложить (до 5 ур.)
            </button>

            {!isLastStep ? (
              <button
                type="button"
                onClick={() => setStepIdx((p) => Math.min(POINTER_STEPS.length - 1, p + 1))}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-4 py-1.5 text-[10.5px] font-black uppercase tracking-wider text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)] hover:brightness-110 active:scale-95 cursor-pointer"
              >
                Далее →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onComplete) onComplete();
                  onClose();
                }}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-400 px-3.5 py-1.5 text-[10.5px] font-black uppercase tracking-wider text-slate-950 shadow-[0_0_14px_rgba(16,185,129,0.6)] hover:brightness-110 active:scale-95 cursor-pointer"
              >
                ✅ Завершить!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
