export type WeatherTimeOfDay = 'morning' | 'day' | 'sunset' | 'night';

export interface WeatherBuffMeta {
  id: WeatherTimeOfDay | 'sandstorm';
  icon: string;
  timeRange: string;
  title: string;
  subtitle: string;
  atmosphere: string;
  bonusText: string;
  shortTag: string;
}

export const WEATHER_BUFFS_CATALOG: Record<WeatherTimeOfDay | 'sandstorm', WeatherBuffMeta> = {
  morning: {
    id: 'morning',
    icon: '🌅',
    timeRange: '05:00 – 08:00',
    title: 'Утро (Рассвет)',
    subtitle: '«Час рыбака и сбора»',
    atmosphere: 'Мягкий розоватый свет, пробуждение Нила.',
    bonusText: '+25% к шансу поймать редкую рыбу в мини-игре «Рыбалка» и повышенный шанс выпадения базовых расходников (лески, крючки).',
    shortTag: '🌅 Утро: +25% редкая рыба и снасти'
  },
  day: {
    id: 'day',
    icon: '☀️',
    timeRange: '08:00 – 17:00',
    title: 'День (Полдень)',
    subtitle: '«Жаркое солнце пустыни»',
    atmosphere: 'Яркое солнце, активный фарм.',
    bonusText: '+15% к получаемому опыту в боях внутри Пирамиды, но затраты энергии на шаги/бои увеличены на 5% (солнце утомляет путников).',
    shortTag: '☀️ День: +15% EXP в Пирамиде (+5% расход ⚡)'
  },
  sunset: {
    id: 'sunset',
    icon: '🌇',
    timeRange: '17:00 – 20:00',
    title: 'Закат',
    subtitle: '«Время охоты за сокровищами»',
    atmosphere: 'Пурпурное небо, длинные тени.',
    bonusText: '+20% к шансу найти сундук с сокровищами или редкий артефакт при исследовании уровней Пирамиды.',
    shortTag: '🌇 Закат: +20% шанс сундука и артефакта'
  },
  night: {
    id: 'night',
    icon: '🌙',
    timeRange: '20:00 – 05:00',
    title: 'Ночь',
    subtitle: '«Таинства гробниц»',
    atmosphere: 'Звездное небо, луна, факелы.',
    bonusText: '+30% к урону критических ударов в боях с боссами и мумиями (ночные духи усиливают бойцов).',
    shortTag: '🌙 Ночь: +30% крит. урон по боссам и мумиям'
  },
  sandstorm: {
    id: 'sandstorm',
    icon: '⏳',
    timeRange: 'Случайное событие',
    title: 'Песчаная буря',
    subtitle: '«Гнев пустыни»',
    atmosphere: 'Клубящиеся вихри песка, плотная золотистая дымка.',
    bonusText: 'Удвоенный шанс (x2) на выпадение редких реликвий и фрагментов карт, но здоровье персонажа восстанавливается на 20% медленнее из-за тяжелых условий.',
    shortTag: '🌪️ Буря: x2 шанс реликвий и карт (-20% реген HP)'
  }
};

export interface ActiveWeatherState {
  timeOfDay: WeatherTimeOfDay;
  isSandstorm: boolean;
  sandstormRemainingSec: number;
  timeBuff: WeatherBuffMeta;
  sandstormBuff: WeatherBuffMeta | null;
  /** +25% rare fish chance in Morning */
  rareFishBonusMultiplier: number;
  /** Extra chance (0..1) to find fishing consumables (lines/hooks) on catch in Morning */
  fishingConsumableDropChance: number;
  /** +15% Pyramid combat EXP in Day */
  pyramidExpMultiplier: number;
  /** +5% extra energy cost chance on steps/fights in Day */
  pyramidExtraEnergyChance: number;
  /** +20% chance to find treasure chest / artifact in Pyramid at Sunset */
  pyramidTreasureBonusChance: number;
  /** +30% crit damage vs Bosses and Mummies at Night */
  nightCritDamageMultiplier: number;
  /** x2 relic & transition card drop multiplier during Sandstorm */
  sandstormRelicAndCardMultiplier: number;
  /** 1.2x slower HP regen interval multiplier (20% slower) during Sandstorm */
  hpRegenIntervalMultiplier: number;
}

export function getActiveWeatherState(nowMs: number = Date.now()): ActiveWeatherState {
  let forcedTime: WeatherTimeOfDay | null = null;
  let isSandstorm = false;
  let sandstormRemainingSec = 0;

  try {
    const savedForced = localStorage.getItem('bigwar_force_time_of_day');
    if (
      savedForced === 'morning' ||
      savedForced === 'day' ||
      savedForced === 'sunset' ||
      savedForced === 'night'
    ) {
      forcedTime = savedForced;
    }
    const savedStormEnd = Number(localStorage.getItem('bigwar_sandstorm_end') || 0);
    if (savedStormEnd > nowMs) {
      isSandstorm = true;
      sandstormRemainingSec = Math.max(0, Math.ceil((savedStormEnd - nowMs) / 1000));
    }
  } catch {
    // ignore storage errors
  }

  const hour = new Date(nowMs).getHours();
  const timeOfDay: WeatherTimeOfDay = forcedTime
    ? forcedTime
    : hour >= 5 && hour < 8
    ? 'morning'
    : hour >= 8 && hour < 17
    ? 'day'
    : hour >= 17 && hour < 20
    ? 'sunset'
    : 'night';

  const timeBuff = WEATHER_BUFFS_CATALOG[timeOfDay];
  const sandstormBuff = isSandstorm ? WEATHER_BUFFS_CATALOG.sandstorm : null;

  return {
    timeOfDay,
    isSandstorm,
    sandstormRemainingSec,
    timeBuff,
    sandstormBuff,
    rareFishBonusMultiplier: timeOfDay === 'morning' ? 1.25 : 1.0,
    fishingConsumableDropChance: timeOfDay === 'morning' ? 0.22 : 0,
    pyramidExpMultiplier: timeOfDay === 'day' ? 1.15 : 1.0,
    pyramidExtraEnergyChance: timeOfDay === 'day' ? 0.05 : 0,
    pyramidTreasureBonusChance: timeOfDay === 'sunset' ? 0.20 : 0,
    nightCritDamageMultiplier: timeOfDay === 'night' ? 1.30 : 1.0,
    sandstormRelicAndCardMultiplier: isSandstorm ? 2.0 : 1.0,
    hpRegenIntervalMultiplier: isSandstorm ? 1.25 : 1.0 // 1 / 0.8 = 1.25 (20% slower HP recovery rate)
  };
}
