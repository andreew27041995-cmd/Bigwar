import React, { useState, useEffect } from 'react';

export interface GuideStep {
  id: string;
  target: 'pyramid' | 'hero' | 'world' | 'shop';
  title: string;
  badge: string;
  icon: string;
  description: string;
  hint: string;
  position: 'center' | 'bottom';
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'step_pyramid',
    target: 'pyramid',
    title: 'Великая Пирамида',
    badge: 'Главная цель игры',
    icon: '🏛️',
    description:
      'Сердце древнего Египта! Нажмите на Пирамиду в центре экрана, чтобы войти в залы испытаний. Исследуйте ярусы, сражайтесь с мумиями и монстрами, открывайте сундуки и собирайте золото.',
    hint: '💡 Совет: монстры обновляются каждую минуту, а для входа требуется минимум 30⚡ энергии.',
    position: 'center'
  },
  {
    id: 'step_hero',
    target: 'hero',
    title: 'Персонаж и Инвентарь',
    badge: 'Прокачка и Снаряжение',
    icon: '🧙‍♂️',
    description:
      'Вкладка «Герой» и верхняя шторка профиля. Здесь вы распределяете очки характеристик (Сила, Ловкость, Живучесть), экипируете оружие, броню, кольца и меняете уникальные образы (скины).',
    hint: '💡 Совет: нажмите на верхнюю строку профиля в любой момент, чтобы развернуть быструю шторку!',
    position: 'bottom'
  },
  {
    id: 'step_world',
    target: 'world',
    title: 'Мир, Нил и Рыбалка',
    badge: 'Экспедиции и Ремесло',
    icon: '🌊',
    description:
      'Вкладка «Мир» открывает Нильскую Рыбалку с Картой глубин и «Холодными течениями», заброс сетей, Трофейный музей славы, а также Порт с Алтарем Модификации экипировки.',
    hint: '💡 Совет: утренняя рыбалка на рассвете даёт +25% к шансу редкой рыбы и ценным расходникам.',
    position: 'bottom'
  },
  {
    id: 'step_shop',
    target: 'shop',
    title: 'Казна, Магазин и Награды',
    badge: 'Подарки и Эликсиры',
    icon: '🪙',
    description:
      'Вкладка «Магазин» и интерактивный Верблюд 🐫 в Городе. Забирайте ежедневные подарки, крутите Колесо Фортуны, покупайте зелья здоровья/энергии и активируйте VIP-привилегии.',
    hint: '💡 Совет: нажимайте на верблюда с сундуком каждый день, чтобы получать бесплатные бонусы!',
    position: 'bottom'
  }
];

interface CityNewbieGuideProps {
  playerNick?: string;
  onHighlightTarget?: (target: 'pyramid' | 'hero' | 'world' | 'shop') => void;
  onClose?: () => void;
}

export const CityNewbieGuide: React.FC<CityNewbieGuideProps> = ({
  playerNick,
  onHighlightTarget,
  onClose
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isOpen, setIsOpen] = useState(true);

  const step = GUIDE_STEPS[currentStepIdx] || GUIDE_STEPS[0];

  useEffect(() => {
    if (onHighlightTarget) {
      onHighlightTarget(step.target);
    }
  }, [step.target, onHighlightTarget]);

  const handleNext = () => {
    if (currentStepIdx < GUIDE_STEPS.length - 1) {
      setCurrentStepIdx((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    const storageKey = playerNick
      ? `bigwar_newbie_guide_done_${playerNick.toLowerCase()}`
      : 'bigwar_newbie_guide_done_guest';
    try {
      localStorage.setItem(storageKey, 'true');
      localStorage.setItem('bigwar_newbie_guide_done_all', 'true');
    } catch {}
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex flex-col justify-between overflow-hidden">
      {/* Soft translucent backdrop that allows seeing the game screen beneath */}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] transition-opacity duration-300" />

      {/* Target Highlight Pulsing Ring */}
      {step.target === 'pyramid' && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 rounded-full border-2 border-amber-400/90 shadow-[0_0_40px_rgba(245,158,11,0.6)] animate-pulse" />
      )}

      {/* Top Banner Indicator */}
      <div className="pointer-events-auto relative z-10 mx-auto mt-2 max-w-sm px-3">
        <div className="flex items-center justify-between rounded-full border border-amber-500/50 bg-slate-950/90 px-3 py-1 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-300">
            <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            <span>ГИД НОВИЧКА: Шаг {currentStepIdx + 1} из {GUIDE_STEPS.length}</span>
          </div>
          <button
            type="button"
            onClick={handleComplete}
            className="text-[10px] font-bold text-slate-400 hover:text-amber-200 cursor-pointer ml-3"
          >
            ✕ Закрыть
          </button>
        </div>
      </div>

      {/* Floating Contextual Tooltip Card */}
      <div className="pointer-events-auto relative z-20 mx-auto w-full max-w-md px-3 pb-2 sm:pb-3">
        <div className="relative rounded-2xl border-2 border-amber-400/90 bg-gradient-to-b from-[#2a1708] via-[#1a0f05] to-[#0d0703] p-3 sm:p-4 text-left shadow-[0_10px_35px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.35)]">
          {/* Top Egyptian Header Bar */}
          <div className="flex items-center justify-between gap-2 border-b border-amber-500/40 pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/70 bg-gradient-to-b from-amber-500/30 to-amber-950/80 text-xl shadow-md">
                {step.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black uppercase tracking-wide text-amber-300 drop-shadow">
                    {step.title}
                  </span>
                  <span className="rounded-full bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.2 text-[8px] font-bold text-amber-200">
                    {step.badge}
                  </span>
                </div>
                <div className="text-[9px] text-amber-100/70">
                  Ориентир для начинающих искателей приключений
                </div>
              </div>
            </div>

            {/* Stepper Dots */}
            <div className="flex items-center gap-1 shrink-0">
              {GUIDE_STEPS.map((s, idx) => (
                <div
                  key={s.id}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStepIdx
                      ? 'w-4 bg-amber-400 shadow-[0_0_6px_#f59e0b]'
                      : 'w-1.5 bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Body Content */}
          <div className="py-2.5 space-y-2">
            <p className="text-[11px] sm:text-xs leading-relaxed text-amber-50/95 font-medium">
              {step.description}
            </p>
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-2 text-[10px] text-amber-200/90 leading-snug">
              {step.hint}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-500/30">
            <button
              type="button"
              onClick={handleComplete}
              className="text-[10.5px] font-bold text-slate-400 hover:text-amber-200 cursor-pointer px-2 py-1"
            >
              Пропустить всё
            </button>

            <div className="flex items-center gap-2">
              {currentStepIdx > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-[11px] font-extrabold text-slate-200 hover:bg-slate-800 cursor-pointer active:scale-95 transition-transform"
                >
                  ◀ Назад
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                className="rounded-xl border border-amber-400/90 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 px-4 py-1.5 text-[11px] font-black uppercase text-slate-950 shadow-[0_3px_12px_rgba(245,158,11,0.5)] hover:brightness-110 cursor-pointer active:scale-95 transition-transform"
              >
                {currentStepIdx < GUIDE_STEPS.length - 1 ? 'Далее ▶' : 'Всё понятно! ⚔️'}
              </button>
            </div>
          </div>

          {/* Subtle Directional Pointer Indicator Arrow at Bottom */}
          {step.position === 'bottom' && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-r-2 border-b-2 border-amber-400 bg-[#0d0703]" />
          )}
        </div>
      </div>
    </div>
  );
};
