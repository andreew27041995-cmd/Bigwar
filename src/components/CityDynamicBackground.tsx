import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import bgImage from '../assets/images/pyramid_city_1792151896034.jpg';
import { playPyramidDoorSound } from '../utils/audio';
import { WEATHER_BUFFS_CATALOG } from '../utils/weatherBuffs';
import { saveWorldWeatherToSupabase, subscribeToGlobalMailAndChat } from '../utils/supabase';

export type CityTimeOfDay = 'morning' | 'day' | 'sunset' | 'night';

interface CityDynamicBackgroundProps {
  onEnterPyramid: () => void;
  energy: number;
  homePyramidTier?: number;
  isAdmin?: boolean;
  children?: React.ReactNode;
}

export const CityDynamicBackground: React.FC<CityDynamicBackgroundProps> = ({
  onEnterPyramid,
  energy,
  homePyramidTier = 1,
  isAdmin = false,
  children
}) => {
  // 1. Time of Day Calculation
  const [currentHour, setCurrentHour] = useState<number>(() => new Date().getHours());
  const [forceTimeOfDay, setForceTimeOfDay] = useState<CityTimeOfDay | null>(() => {
    try {
      const saved = localStorage.getItem('bigwar_force_time_of_day');
      if (saved === 'morning' || saved === 'day' || saved === 'sunset' || saved === 'night') {
        return saved;
      }
    } catch {}
    return null;
  });

  // 2. Sandstorm (Песчаная буря) System
  const [isSandstormActive, setIsSandstormActive] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('bigwar_sandstorm_end');
      if (saved && Number(saved) > Date.now()) return true;
    } catch {}
    return false;
  });
  const [sandstormRemainingSec, setSandstormRemainingSec] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('bigwar_sandstorm_end');
      if (saved) {
        const diff = Math.max(0, Math.ceil((Number(saved) - Date.now()) / 1000));
        return diff;
      }
    } catch {}
    return 0;
  });

  const syncFromStorage = useCallback(() => {
    const now = Date.now();
    setCurrentHour(new Date(now).getHours());
    try {
      const savedForced = localStorage.getItem('bigwar_force_time_of_day');
      if (
        savedForced === 'morning' ||
        savedForced === 'day' ||
        savedForced === 'sunset' ||
        savedForced === 'night'
      ) {
        setForceTimeOfDay(savedForced);
      } else {
        setForceTimeOfDay(null);
      }

      const savedStormEnd = Number(localStorage.getItem('bigwar_sandstorm_end') || 0);
      if (savedStormEnd > now) {
        setIsSandstormActive(true);
        setSandstormRemainingSec(Math.max(0, Math.ceil((savedStormEnd - now) / 1000)));
      } else {
        setIsSandstormActive(false);
        setSandstormRemainingSec(0);
        if (savedStormEnd > 0) {
          localStorage.removeItem('bigwar_sandstorm_end');
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    syncFromStorage();
    const timer = setInterval(syncFromStorage, 1000);
    const onWeatherEvent = () => syncFromStorage();
    window.addEventListener('bigwar_weather_updated', onWeatherEvent);
    window.addEventListener('storage', onWeatherEvent);

    const unsubscribe = subscribeToGlobalMailAndChat((state) => {
      if (state.worldWeather) {
        syncFromStorage();
      }
    });

    return () => {
      clearInterval(timer);
      window.removeEventListener('bigwar_weather_updated', onWeatherEvent);
      window.removeEventListener('storage', onWeatherEvent);
      unsubscribe();
    };
  }, [syncFromStorage]);

  const handleSetForceTimeOfDay = (next: CityTimeOfDay | null) => {
    setForceTimeOfDay(next);
    try {
      if (next) {
        localStorage.setItem('bigwar_force_time_of_day', next);
      } else {
        localStorage.removeItem('bigwar_force_time_of_day');
      }
    } catch {}
    saveWorldWeatherToSupabase({ forcedTimeOfDay: next }).catch(() => {});
  };

  const timeOfDay: CityTimeOfDay = useMemo(() => {
    if (forceTimeOfDay) return forceTimeOfDay;
    if (currentHour >= 5 && currentHour < 8) return 'morning';
    if (currentHour >= 8 && currentHour < 17) return 'day';
    if (currentHour >= 17 && currentHour < 20) return 'sunset';
    return 'night';
  }, [currentHour, forceTimeOfDay]);

  const sandstormCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pyramidClickEffect, setPyramidClickEffect] = useState<boolean>(false);

  // Periodic random sandstorm trigger check (5% chance every 10 min)
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (!isSandstormActive && isAdmin) {
        if (Math.random() < 0.05) {
          triggerSandstorm(300); // 5 minutes
        }
      }
    }, 600000); // 10 minutes

    return () => clearInterval(checkInterval);
  }, [isSandstormActive, isAdmin]);

  const triggerSandstorm = (durationSec = 300) => {
    const endAt = Date.now() + durationSec * 1000;
    try {
      localStorage.setItem('bigwar_sandstorm_end', String(endAt));
    } catch {}
    setIsSandstormActive(true);
    setSandstormRemainingSec(durationSec);
    saveWorldWeatherToSupabase({ sandstormEndAt: endAt }).catch(() => {});
  };

  const stopSandstorm = () => {
    setIsSandstormActive(false);
    setSandstormRemainingSec(0);
    try {
      localStorage.removeItem('bigwar_sandstorm_end');
    } catch {}
    saveWorldWeatherToSupabase({ sandstormEndAt: 0 }).catch(() => {});
  };

  // Sandstorm particle canvas simulation (lightweight 60fps)
  useEffect(() => {
    if (!isSandstormActive) return;
    const canvas = sandstormCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const particleCount = 85;
    const particles = Array.from({ length: particleCount }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: 6 + Math.random() * 8, // fast blowing right
      vy: 1 + Math.random() * 2.5,
      size: 1 + Math.random() * 2.2,
      opacity: 0.3 + Math.random() * 0.5,
      color: Math.random() > 0.4 ? '#d97706' : '#f59e0b'
    }));

    const render = () => {
      if (document.visibilityState === 'hidden') {
        animId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x > canvas.width + 10) {
          p.x = -15;
          p.y = Math.random() * canvas.height;
        }
        if (p.y > canvas.height + 10) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Motion trail streak
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.7;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5);
        ctx.stroke();
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isSandstormActive]);

  // Handle Hotspot Click on Pyramid or Plate
  const handlePyramidHotspotClick = () => {
    playPyramidDoorSound();
    setPyramidClickEffect(true);
    setTimeout(() => setPyramidClickEffect(false), 450);
    onEnterPyramid();
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="relative flex flex-1 w-full min-h-0 flex-col overflow-hidden select-none">
      {/* 1. Base Wallpaper Image with Ultra-Crisp HD Clarity & Time-of-Day Filter */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
        style={{
          backgroundImage: `url(${bgImage})`,
          imageRendering: '-webkit-optimize-contrast',
          filter:
            timeOfDay === 'night'
              ? 'brightness(0.92) contrast(1.18) saturate(1.12)'
              : timeOfDay === 'sunset'
              ? 'brightness(1.08) contrast(1.15) saturate(1.30)'
              : timeOfDay === 'morning'
              ? 'brightness(1.12) contrast(1.12) saturate(1.22)'
              : 'brightness(1.16) contrast(1.15) saturate(1.25)'
        }}
      />

      {/* 2. Atmospheric Sky & Lighting Overlay */}
      {timeOfDay === 'morning' && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-rose-500/20 via-amber-400/15 to-transparent transition-opacity duration-1000">
          {/* Morning Sunrise Celestial Glow */}
          <div className="absolute top-[28%] left-[24%] h-24 w-24 rounded-full bg-gradient-to-r from-amber-300 via-rose-300 to-transparent blur-xl opacity-70 animate-pulse" />
        </div>
      )}

      {timeOfDay === 'day' && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-400/10 via-transparent to-amber-300/10 transition-opacity duration-1000">
          {/* Day Cirrus Cloud Drifts */}
          <div className="absolute top-2 left-[-10%] h-12 w-[60%] rounded-full bg-white/25 blur-lg animate-[cloudDrift_40s_linear_infinite]" />
        </div>
      )}

      {timeOfDay === 'sunset' && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-purple-900/25 via-orange-600/20 to-amber-500/15 transition-opacity duration-1000">
          {/* Fiery Sunset Disc behind Western Horizon */}
          <div className="absolute top-[32%] right-[22%] h-28 w-28 rounded-full bg-gradient-to-t from-orange-500 via-red-500 to-transparent blur-xl opacity-75 animate-pulse" />
        </div>
      )}

      {timeOfDay === 'night' && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/45 via-[#0b132a]/30 to-transparent transition-opacity duration-1000">
          {/* Night Sky Crescent Moon */}
          <div className="absolute top-[14%] right-[18%] flex items-center justify-center">
            <div className="h-9 w-9 rounded-full bg-amber-100 shadow-[0_0_25px_rgba(254,240,138,0.7)]">
              <div className="h-8 w-8 -translate-x-1.5 -translate-y-0.5 rounded-full bg-[#0b132a]" />
            </div>
          </div>

          {/* Twinkling Stars in Night Sky */}
          {[
            [12, 10], [28, 14], [45, 8], [62, 16], [78, 9],
            [18, 22], [36, 26], [54, 20], [86, 24], [92, 12]
          ].map(([x, y], idx) => (
            <div
              key={idx}
              className="absolute h-1 w-1 rounded-full bg-white shadow-[0_0_4px_#ffffff]"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                animation: `starTwinkle ${2 + (idx % 3)}s ease-in-out infinite ${idx * 0.3}s`
              }}
            />
          ))}
        </div>
      )}

      {/* 3. Sandstorm (Песчаная буря) Animated Particle & Sepia Haze Layer */}
      {isSandstormActive && (
        <div className="pointer-events-none absolute inset-0 z-15 overflow-hidden transition-opacity duration-700">
          <div className="absolute inset-0 bg-[#9a6727]/25 mix-blend-multiply" />
          <canvas
            ref={sandstormCanvasRef}
            width={480}
            height={420}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      )}

      {/* Weather & Time of Day Controls: Exclusively for Administrators (Positioned cleanly below top HUD bar so HUD and Modals never collide) */}
      {isAdmin ? (
        <div className="pointer-events-auto absolute top-[52px] sm:top-[54px] right-2 z-25 flex flex-wrap items-center justify-end gap-1 rounded-xl border border-amber-500/40 bg-slate-950/90 px-2 py-1 shadow-[0_6px_18px_rgba(0,0,0,0.75)] backdrop-blur-md animate-fadeIn">
          {/* Admin Tag */}
          <span className="rounded border border-amber-500/50 bg-amber-950/90 px-1 py-0.5 text-[7px] font-black uppercase tracking-wider text-amber-300 shadow">
            Admin
          </span>

          {/* Sandstorm Indicator / Toggle */}
          {isSandstormActive ? (
            <button
              type="button"
              onClick={stopSandstorm}
              title="Песчаная буря активна! Нажмите, чтобы остановить бурю"
              className="flex items-center gap-1 rounded-full border border-amber-400/80 bg-amber-950/90 px-2 py-0.5 text-[8.5px] font-black text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-pulse cursor-pointer"
            >
              <span>🌪️</span>
              <span>Буря ({formatTimer(sandstormRemainingSec)})</span>
              <span className="text-[7.5px] text-amber-400 hover:text-white">✕</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => triggerSandstorm(300)}
              title="Вызвать Песчаную бурю (тест)"
              className="flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-900/90 px-2 py-0.5 text-[8px] font-bold text-slate-200 hover:border-amber-400/60 hover:text-amber-200 cursor-pointer"
            >
              <span>☀️ Ясно</span>
            </button>
          )}

          {/* Time of Day Switcher Pills */}
          <div className="flex items-center rounded-full border border-slate-700/80 bg-slate-900/95 p-0.5 text-[7.5px] font-black text-slate-300">
            <button
              type="button"
              onClick={() => handleSetForceTimeOfDay(forceTimeOfDay === 'morning' ? null : 'morning')}
              className={`rounded-full px-1.5 py-0.5 transition-all cursor-pointer ${
                timeOfDay === 'morning'
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'hover:text-white'
              }`}
              title={`${WEATHER_BUFFS_CATALOG.morning.title}: ${WEATHER_BUFFS_CATALOG.morning.bonusText}`}
            >
              🌅 Утро
            </button>
            <button
              type="button"
              onClick={() => handleSetForceTimeOfDay(forceTimeOfDay === 'day' ? null : 'day')}
              className={`rounded-full px-1.5 py-0.5 transition-all cursor-pointer ${
                timeOfDay === 'day'
                  ? 'bg-sky-500 text-slate-950 font-black shadow'
                  : 'hover:text-white'
              }`}
              title={`${WEATHER_BUFFS_CATALOG.day.title}: ${WEATHER_BUFFS_CATALOG.day.bonusText}`}
            >
              ☀️ День
            </button>
            <button
              type="button"
              onClick={() => handleSetForceTimeOfDay(forceTimeOfDay === 'sunset' ? null : 'sunset')}
              className={`rounded-full px-1.5 py-0.5 transition-all cursor-pointer ${
                timeOfDay === 'sunset'
                  ? 'bg-orange-600 text-white font-black shadow'
                  : 'hover:text-white'
              }`}
              title={`${WEATHER_BUFFS_CATALOG.sunset.title}: ${WEATHER_BUFFS_CATALOG.sunset.bonusText}`}
            >
              🌇 Закат
            </button>
            <button
              type="button"
              onClick={() => handleSetForceTimeOfDay(forceTimeOfDay === 'night' ? null : 'night')}
              className={`rounded-full px-1.5 py-0.5 transition-all cursor-pointer ${
                timeOfDay === 'night'
                  ? 'bg-indigo-600 text-white font-black shadow'
                  : 'hover:text-white'
              }`}
              title={`${WEATHER_BUFFS_CATALOG.night.title}: ${WEATHER_BUFFS_CATALOG.night.bonusText}`}
            >
              🌙 Ночь
            </button>
          </div>
        </div>
      ) : (
        /* Read-only subtle status indicator for regular players showing current time of day & active sandstorm */
        <div className="pointer-events-none absolute top-[52px] sm:top-[54px] right-2 z-20 flex items-center gap-1">
          {isSandstormActive && (
            <div
              className="flex items-center gap-1 rounded-full border border-amber-500/70 bg-amber-950/90 px-2 py-0.5 text-[8px] font-bold text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse"
              title={`${WEATHER_BUFFS_CATALOG.sandstorm.title}: ${WEATHER_BUFFS_CATALOG.sandstorm.bonusText}`}
            >
              <span>🌪️</span>
              <span>Буря ({formatTimer(sandstormRemainingSec)})</span>
            </div>
          )}
          <div
            className="flex items-center gap-1 rounded-full border border-slate-700/75 bg-slate-950/80 px-2 py-0.5 text-[7.5px] font-bold text-slate-200 shadow"
            title={`${WEATHER_BUFFS_CATALOG[timeOfDay].title}: ${WEATHER_BUFFS_CATALOG[timeOfDay].bonusText}`}
          >
            <span>{WEATHER_BUFFS_CATALOG[timeOfDay].icon}</span>
            <span>
              {timeOfDay === 'morning'
                ? 'Утро'
                : timeOfDay === 'day'
                ? 'День'
                : timeOfDay === 'sunset'
                ? 'Закат'
                : 'Ночь'}
            </span>
          </div>
        </div>
      )}

      {/* 4. Interactive Clean Pyramid Zone (Clickable Pyramid background area without artificial wireframe triangle or dots) */}
      <div
        onClick={handlePyramidHotspotClick}
        className="group absolute top-[16%] left-1/2 -translate-x-1/2 w-[82%] max-w-[340px] h-[44%] z-20 cursor-pointer flex items-center justify-center pointer-events-auto rounded-2xl transition-all"
        title="Великая Пирамида — нажмите для входа в залы испытаний"
      >
        {/* Shockwave ripple on click */}
        {pyramidClickEffect && (
          <>
            {/* Screen / Pyramid Flash */}
            <div className="pointer-events-none absolute inset-[-15%] rounded-full bg-amber-300/25 blur-lg animate-[pyramidFlash_0.45s_ease-out_forwards]" />
            {/* Expanding shockwave ring */}
            <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300/80 shadow-[0_0_16px_#f59e0b] animate-[pyramidShockwave_0.5s_ease-out_forwards]" />
          </>
        )}
      </div>

      {/* Children elements (HUD, Camels, Menus) rendered above the background */}
      {children}

      <style>{`
        @keyframes cloudDrift {
          0% { transform: translateX(-10%); }
          100% { transform: translateX(180%); }
        }
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.3); }
        }
        @keyframes pyramidPulseGlow {
          0%, 100% {
            opacity: 0.55;
            filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.45)) drop-shadow(0 0 16px rgba(251, 191, 36, 0.25));
            transform: scale(1);
          }
          50% {
            opacity: 0.95;
            filter: drop-shadow(0 0 14px rgba(245, 158, 11, 0.85)) drop-shadow(0 0 28px rgba(251, 191, 36, 0.6));
            transform: scale(1.018);
          }
        }
        @keyframes pyramidFlash {
          0% { opacity: 0.85; transform: scale(0.9); }
          100% { opacity: 0; transform: scale(1.3); }
        }
        @keyframes pyramidShockwave {
          0% {
            width: 20px;
            height: 20px;
            opacity: 1;
            transform: translate(-50%, -50%) scale(0.5);
          }
          100% {
            width: 320px;
            height: 320px;
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.4);
          }
        }
      `}</style>
    </div>
  );
};
