import React, { useState, useEffect } from 'react';
import { playCoinSound, playLootSound } from '../utils/audio';

interface CamelBonusProps {
  canClaim: boolean;
  onOpenDailyReward: () => void;
}

export const CamelBonus: React.FC<CamelBonusProps> = ({ canClaim, onOpenDailyReward }) => {
  // Camel states: 'idle-offscreen' | 'walking-in' | 'waiting' | 'walking-out' | 'hidden'
  const [camelState, setCamelState] = useState<'hidden' | 'walking-in' | 'waiting' | 'walking-out'>(
    canClaim ? 'walking-in' : 'hidden'
  );

  // Transition from walking-in to waiting after walk duration (approx 4.5s)
  useEffect(() => {
    if (canClaim) {
      if (camelState === 'hidden') {
        setCamelState('walking-in');
      }
      if (camelState === 'walking-in') {
        const timer = setTimeout(() => {
          setCamelState('waiting');
        }, 4500);
        return () => clearTimeout(timer);
      }
    } else {
      // If reward was claimed while camel was present, animate him walking away
      if (camelState === 'waiting' || camelState === 'walking-in') {
        setCamelState('walking-out');
        const timer = setTimeout(() => {
          setCamelState('hidden');
        }, 4500);
        return () => clearTimeout(timer);
      }
    }
  }, [canClaim, camelState]);

  if (camelState === 'hidden') return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    playLootSound();
    onOpenDailyReward();
  };

  const isLeaving = camelState === 'walking-out';

  return (
    <div
      onClick={handleClick}
      className={`absolute bottom-18 sm:bottom-22 z-20 cursor-pointer select-none transition-transform pointer-events-auto ${
        camelState === 'walking-in'
          ? 'animate-camel-enter'
          : camelState === 'waiting'
          ? 'animate-camel-idle left-[55%] sm:left-[60%]'
          : 'animate-camel-exit'
      }`}
      style={{
        transform: `translate(-50%, 0) ${isLeaving ? 'scaleX(-1)' : 'scaleX(1)'}`
      }}
      title="Верблюд торговца с ежедневным подарком! Нажмите, чтобы забрать"
    >
      <style>{`
        @keyframes camelEnter {
          0% {
            left: 115%;
            transform: translate(0, 0) scaleX(1);
          }
          100% {
            left: 58%;
            transform: translate(-50%, 0) scaleX(1);
          }
        }
        @keyframes camelExit {
          0% {
            left: 58%;
            transform: translate(-50%, 0) scaleX(-1);
          }
          100% {
            left: 115%;
            transform: translate(0, 0) scaleX(-1);
          }
        }
        @keyframes camelIdleBob {
          0%, 100% { transform: translate(-50%, 0) rotate(0deg); }
          50% { transform: translate(-50%, -4px) rotate(-1deg); }
        }
        @keyframes giftGlow {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 6px #f59e0b); }
          50% { transform: scale(1.08); filter: drop-shadow(0 0 14px #fbbf24); }
        }
        .animate-camel-enter {
          animation: camelEnter 4.5s ease-out forwards;
        }
        .animate-camel-exit {
          animation: camelExit 4.2s ease-in forwards;
        }
        .animate-camel-idle {
          animation: camelIdleBob 2.8s ease-in-out infinite;
        }
        .animate-gift-glow {
          animation: giftGlow 2s ease-in-out infinite;
        }
      `}</style>

      {/* Floating Gift Callout Banner */}
      {camelState === 'waiting' && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-amber-400 bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 px-2 py-0.5 text-[8.5px] font-black text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.65)] whitespace-nowrap animate-bounce">
          <span className="text-xs">🎁</span>
          <span>Забрать Бонус!</span>
        </div>
      )}

      {/* Camel SVG Character with Saddlebag & Gift */}
      <div className="relative group transition-transform active:scale-95">
        <svg
          width="74"
          height="62"
          viewBox="0 0 100 85"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_6px_10px_rgba(0,0,0,0.7)]"
        >
          {/* Camel Body Shadow */}
          <ellipse cx="50" cy="80" rx="36" ry="5" fill="rgba(0,0,0,0.35)" />

          {/* Legs Back */}
          <path d="M30 52 L26 76 L22 77" stroke="#92400e" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M68 52 L64 76 L60 77" stroke="#92400e" strokeWidth="4.5" strokeLinecap="round" />

          {/* Camel Body & Hump */}
          <path
            d="M22 55 C22 45 30 42 38 42 C44 42 46 30 54 28 C64 26 68 40 76 45 C82 50 82 58 76 62 C68 66 32 66 22 55 Z"
            fill="#d97706"
            stroke="#78350f"
            strokeWidth="2"
          />

          {/* Hump Highlight */}
          <path
            d="M44 38 C46 30 54 29 60 34"
            stroke="#fef08a"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* Legs Front */}
          <path d="M36 53 L38 78 L42 79" stroke="#b45309" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M74 53 L76 78 L80 79" stroke="#b45309" strokeWidth="4.5" strokeLinecap="round" />

          {/* Tail */}
          <path d="M22 52 C18 55 16 62 18 68" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="18" cy="69" r="2.5" fill="#451a03" />

          {/* Long Neck & Head */}
          <path
            d="M74 50 C80 44 82 32 84 22 C84 18 88 16 94 18 C97 19 98 22 95 24 C91 26 88 28 86 36 C84 44 80 52 74 54 Z"
            fill="#d97706"
            stroke="#78350f"
            strokeWidth="2"
          />

          {/* Camel Eye & Ears */}
          <circle cx="91" cy="20" r="1.5" fill="#451a03" />
          <ellipse cx="85" cy="16" rx="2" ry="3.5" fill="#b45309" transform="rotate(-20 85 16)" />

          {/* Red/Gold Saddle Rug */}
          <path
            d="M42 44 C48 42 62 42 68 46 L66 60 C58 62 50 62 44 59 Z"
            fill="#991b1b"
            stroke="#fbbf24"
            strokeWidth="1.5"
          />
          <path d="M44 58 L66 59" stroke="#fbbf24" strokeWidth="1.2" strokeDasharray="2 2" />

          {/* Golden Treasure Sack / Gift Box on Saddle */}
          <g className="animate-gift-glow">
            <rect
              x="47"
              y="32"
              width="18"
              height="16"
              rx="3"
              fill="#f59e0b"
              stroke="#78350f"
              strokeWidth="1.5"
            />
            {/* Gift Ribbon */}
            <rect x="54" y="32" width="4" height="16" fill="#ef4444" />
            <rect x="47" y="38" width="18" height="4" fill="#ef4444" />
            {/* Gift Bow */}
            <circle cx="56" cy="31" r="3" fill="#ef4444" />
            <circle cx="53" cy="30" r="2" fill="#ef4444" />
            <circle cx="59" cy="30" r="2" fill="#ef4444" />
            {/* Sparkle */}
            <polygon points="56,23 57.5,26.5 61,28 57.5,29.5 56,33 54.5,29.5 51,28 54.5,26.5" fill="#fef08a" />
          </g>

          {/* Reins / Halter */}
          <path d="M92 23 C90 27 86 34 82 40" stroke="#78350f" strokeWidth="1" strokeDasharray="1 1" />
        </svg>

        {/* Pulsing indicator under camel */}
        {camelState === 'waiting' && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-12 rounded-full bg-amber-400/30 blur-xs animate-pulse pointer-events-none" />
        )}
      </div>
    </div>
  );
};
