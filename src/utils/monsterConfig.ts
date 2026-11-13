const SUPABASE_REST_URL = 'https://lgbxbwzqckdnviygsghu.supabase.co/rest/v1/players';
const SUPABASE_KEY = 'sb_publishable_lGMAAuZELw2gPDZeuEx0VQ_DgPK7szm';

export interface MonsterConfig {
  id: string;
  name: string;
  icon: string;
  tier: 1 | 2 | 3;
  rowLimit?: 'boss' | 'front' | 'mid' | 'any' | 'rare_boss';
  lvl: number;
  hp: number;
  dmg: number;         // Урон монстра по игроку
  isBoss: boolean;
  spawnWeight: number; // 1 - 100 (частота появления)
  dropChance: number;  // 0 - 100 (% шанс выпадения вещей)
  goldMin: number;
  goldMax: number;
  expReward: number;
  crystalsReward: number;
  isCustom?: boolean;
  enabled: boolean;
}

export const DEFAULT_MONSTERS: MonsterConfig[] = [
  // ==================== ПИРАМИДА 1 (1–5 уровень персонажа: 30–60 золота) ====================
  // Босс 5 ур. — ХП 500, урон 80, опыт 15, 60 золота
  {
    id: 't1_boss_imhotep',
    name: '👑 Жрец Имхотеп (Босс)',
    icon: '👑',
    tier: 1,
    rowLimit: 'boss',
    lvl: 5,
    hp: 500,
    dmg: 80,
    isBoss: true,
    spawnWeight: 100,
    dropChance: 0,
    goldMin: 55,
    goldMax: 60,
    expReward: 15,
    crystalsReward: 0,
    enabled: true
  },
  // Монстр 2 ур. — ХП 100, урон 20, опыт 5, 30–40 золота
  {
    id: 't1_mob_scorpion_2',
    name: '🦂 Песчаный Скорпион',
    icon: '🦂',
    tier: 1,
    rowLimit: 'any',
    lvl: 2,
    hp: 100,
    dmg: 20,
    isBoss: false,
    spawnWeight: 100,
    dropChance: 0,
    goldMin: 30,
    goldMax: 40,
    expReward: 5,
    crystalsReward: 0,
    enabled: true
  },
  {
    id: 't1_mob_scarab_2',
    name: '🪲 Золотой Скарабей',
    icon: '🪲',
    tier: 1,
    rowLimit: 'any',
    lvl: 2,
    hp: 100,
    dmg: 20,
    isBoss: false,
    spawnWeight: 100,
    dropChance: 0,
    goldMin: 30,
    goldMax: 40,
    expReward: 5,
    crystalsReward: 0,
    enabled: true
  },
  // Монстр 4 ур. — ХП 150, урон 30, опыт 10, 42–55 золота
  {
    id: 't1_mob_viper_4',
    name: '🐍 Пустынная Гадюка',
    icon: '🐍',
    tier: 1,
    rowLimit: 'front',
    lvl: 4,
    hp: 150,
    dmg: 30,
    isBoss: false,
    spawnWeight: 90,
    dropChance: 0,
    goldMin: 42,
    goldMax: 55,
    expReward: 10,
    crystalsReward: 0,
    enabled: true
  },
  {
    id: 't1_mob_mummy_4',
    name: '🧟 Древняя Мумия',
    icon: '🧟',
    tier: 1,
    rowLimit: 'front',
    lvl: 4,
    hp: 150,
    dmg: 30,
    isBoss: false,
    spawnWeight: 90,
    dropChance: 0,
    goldMin: 42,
    goldMax: 55,
    expReward: 10,
    crystalsReward: 0,
    enabled: true
  },

  // ==================== ПИРАМИДА 2 (5–10 уровень персонажа: 60–200 золота) ====================
  // Босс 10 ур. — ХП 1000, урон 150, опыт 250, 200 золота
  {
    id: 't2_boss_anubis',
    name: '🐺 Великий Анубис (Босс)',
    icon: '🐺',
    tier: 2,
    rowLimit: 'boss',
    lvl: 10,
    hp: 1000,
    dmg: 150,
    isBoss: true,
    spawnWeight: 100,
    dropChance: 0,
    goldMin: 180,
    goldMax: 200,
    expReward: 250,
    crystalsReward: 0,
    enabled: true
  },
  // Монстр 5 ур. — ХП 400, урон 40, опыт 35, 80–110 золота
  {
    id: 't2_mob_jackal_5',
    name: '🐺 Шакал Анубиса',
    icon: '🐺',
    tier: 2,
    rowLimit: 'any',
    lvl: 5,
    hp: 400,
    dmg: 40,
    isBoss: false,
    spawnWeight: 100,
    dropChance: 0,
    goldMin: 80,
    goldMax: 110,
    expReward: 35,
    crystalsReward: 0,
    enabled: true
  },
  {
    id: 't2_mob_mummy_5',
    name: '🧟 Ожившая Мумия Воина',
    icon: '🧟',
    tier: 2,
    rowLimit: 'any',
    lvl: 5,
    hp: 400,
    dmg: 40,
    isBoss: false,
    spawnWeight: 100,
    dropChance: 0,
    goldMin: 80,
    goldMax: 110,
    expReward: 35,
    crystalsReward: 0,
    enabled: true
  },
  // Монстр 8 ур. — ХП 650, урон 50, опыт 45, 110–145 золота
  {
    id: 't2_mob_guardian_8',
    name: '🗿 Гранитный Страж Гробницы',
    icon: '🗿',
    tier: 2,
    rowLimit: 'front',
    lvl: 8,
    hp: 650,
    dmg: 50,
    isBoss: false,
    spawnWeight: 90,
    dropChance: 0,
    goldMin: 110,
    goldMax: 145,
    expReward: 45,
    crystalsReward: 0,
    enabled: true
  },
  {
    id: 't2_mob_sobek_8',
    name: '🐊 Свирепый Воин Собека',
    icon: '🐊',
    tier: 2,
    rowLimit: 'front',
    lvl: 8,
    hp: 650,
    dmg: 50,
    isBoss: false,
    spawnWeight: 90,
    dropChance: 0,
    goldMin: 110,
    goldMax: 145,
    expReward: 45,
    crystalsReward: 0,
    enabled: true
  },

  // ==================== ПИРАМИДА 3 (10–20 уровень персонажа: 150–500 золота) ====================
  // Босс 20 ур. — ХП 2000, урон 250, опыт 200, 350–500 золота
  {
    id: 't3_boss_apophis',
    name: '🐉 Божественный Фараон Рамзес (Босс)',
    icon: '🐉',
    tier: 3,
    rowLimit: 'boss',
    lvl: 20,
    hp: 2000,
    dmg: 250,
    isBoss: true,
    spawnWeight: 100,
    dropChance: 0,
    goldMin: 350,
    goldMax: 500,
    expReward: 200,
    crystalsReward: 0,
    enabled: true
  },
  // Монстр 10 ур. — ХП 800, урон 70, опыт 60, 145–190 золота
  {
    id: 't3_mob_demon_10',
    name: '💀 Песчаный Демон Дуата',
    icon: '💀',
    tier: 3,
    rowLimit: 'any',
    lvl: 10,
    hp: 800,
    dmg: 70,
    isBoss: false,
    spawnWeight: 100,
    dropChance: 0,
    goldMin: 145,
    goldMax: 190,
    expReward: 60,
    crystalsReward: 0,
    enabled: true
  },
  {
    id: 't3_mob_keeper_10',
    name: '🔮 Хранитель Книги Мертвых',
    icon: '🔮',
    tier: 3,
    rowLimit: 'any',
    lvl: 10,
    hp: 800,
    dmg: 70,
    isBoss: false,
    spawnWeight: 100,
    dropChance: 0,
    goldMin: 145,
    goldMax: 190,
    expReward: 60,
    crystalsReward: 0,
    enabled: true
  },
  // Монстр 15 ур. — ХП 1000, урон 100, опыт 100, 220–320 золота
  {
    id: 't3_mob_sphinx_15',
    name: '🦁 Крылатый Сфинкс Вечности',
    icon: '🦁',
    tier: 3,
    rowLimit: 'front',
    lvl: 15,
    hp: 1000,
    dmg: 100,
    isBoss: false,
    spawnWeight: 90,
    dropChance: 0,
    goldMin: 220,
    goldMax: 320,
    expReward: 100,
    crystalsReward: 0,
    enabled: true
  },
  {
    id: 't3_mob_colossus_15',
    name: '🔥 Огненный Колосс Ра',
    icon: '🔥',
    tier: 3,
    rowLimit: 'front',
    lvl: 15,
    hp: 1000,
    dmg: 100,
    isBoss: false,
    spawnWeight: 90,
    dropChance: 0,
    goldMin: 220,
    goldMax: 320,
    expReward: 100,
    crystalsReward: 0,
    enabled: true
  }
];

const MONSTERS_STORAGE_KEY = 'pyramid_monsters_config_v2';
let memoryMonstersConfig: MonsterConfig[] = [];

function mergeWithDefaults(loaded: MonsterConfig[]): MonsterConfig[] {
  const map = new Map<string, MonsterConfig>();
  DEFAULT_MONSTERS.forEach((d) => map.set(d.id, { ...d }));
  loaded.forEach((item) => {
    if (item && item.id) {
      if (map.has(item.id) || item.isCustom) {
        const def = map.get(item.id);
        const migratedGoldMin = def && Number(item.goldMin || 0) < def.goldMin ? def.goldMin : item.goldMin;
        const migratedGoldMax = def && Number(item.goldMax || 0) < def.goldMax ? def.goldMax : item.goldMax;
        map.set(item.id, {
          ...def,
          ...item,
          goldMin: migratedGoldMin,
          goldMax: migratedGoldMax
        });
      }
    }
  });
  return Array.from(map.values());
}

export function getMonsterConfigs(): MonsterConfig[] {
  if (memoryMonstersConfig.length === 0) {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(MONSTERS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            memoryMonstersConfig = mergeWithDefaults(parsed);
            return memoryMonstersConfig;
          }
        }
      } catch (e) {
        console.warn('Error reading local monster config:', e);
      }
    }
    memoryMonstersConfig = DEFAULT_MONSTERS.map((m) => ({ ...m }));
  }
  return memoryMonstersConfig;
}

export async function syncMonsterConfigsFromSupabase(): Promise<MonsterConfig[]> {
  try {
    const res = await fetch(
      `${SUPABASE_REST_URL}?name=eq.__GLOBAL_MONSTERS_CONFIG_V2__&select=email`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.email) {
        const parsed = JSON.parse(rows[0].email);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryMonstersConfig = mergeWithDefaults(parsed);
          if (typeof window !== 'undefined') {
            localStorage.setItem(MONSTERS_STORAGE_KEY, JSON.stringify(memoryMonstersConfig));
          }
          return memoryMonstersConfig;
        }
      }
    }
  } catch (e) {
    console.warn('Error fetching monsters config from Supabase:', e);
  }
  return getMonsterConfigs();
}

export async function saveMonsterConfigs(configs: MonsterConfig[]): Promise<boolean> {
  memoryMonstersConfig = [...configs];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(MONSTERS_STORAGE_KEY, JSON.stringify(configs));
    } catch (e) {
      console.warn('Error saving local monsters config:', e);
    }
  }

  try {
    const jsonStr = JSON.stringify(configs);
    const checkRes = await fetch(
      `${SUPABASE_REST_URL}?name=eq.__GLOBAL_MONSTERS_CONFIG_V2__&select=id`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const existing = checkRes.ok ? await checkRes.json() : [];

    if (Array.isArray(existing) && existing.length > 0) {
      await fetch(`${SUPABASE_REST_URL}?name=eq.__GLOBAL_MONSTERS_CONFIG_V2__`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: jsonStr })
      });
    } else {
      await fetch(SUPABASE_REST_URL, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([
          {
            name: '__GLOBAL_MONSTERS_CONFIG_V2__',
            email: jsonStr,
            password: 'system_monsters_key_v2',
            gold: 0,
            crystals: 0,
            is_admin: 0
          }
        ])
      });
    }
    return true;
  } catch (e) {
    console.error('Error saving monsters config to Supabase:', e);
    return false;
  }
}

export function findMonsterConfigByName(
  name?: string | null,
  lvl?: number,
  isBoss?: boolean
): MonsterConfig | undefined {
  const configs = getMonsterConfigs();
  if (name) {
    const clean = name.trim().toLowerCase();
    const exactOrPartial =
      configs.find((m) => m.name.toLowerCase() === clean) ||
      configs.find(
        (m) => clean.includes(m.name.toLowerCase()) || m.name.toLowerCase().includes(clean)
      );
    if (exactOrPartial) return exactOrPartial;
  }
  if (lvl !== undefined) {
    const byLvl = configs.find((m) => m.lvl === lvl && Boolean(m.isBoss) === Boolean(isBoss));
    if (byLvl) return byLvl;
  }
  return undefined;
}

export function pickConfiguredPyramidMob(
  tier: number,
  row: number,
  isBoss: boolean,
  rand1: number,
  rand2: number
): MonsterConfig | null {
  const allForTier = getMonsterConfigs().filter(
    (m) => m.enabled && m.tier === tier && m.rowLimit !== 'rare_boss'
  );
  if (allForTier.length === 0) return null;

  if (isBoss) {
    const bosses = allForTier.filter((m) => m.isBoss || m.rowLimit === 'boss');
    if (bosses.length === 0) return null;
    const idx = Math.min(bosses.length - 1, Math.floor(Math.abs(rand1) * bosses.length));
    return bosses[idx];
  }

  let pool = allForTier.filter((m) => !m.isBoss && m.rowLimit !== 'boss');
  // Upper half rows (rows 1..4) prefer stronger mobs ('front') while lower rows (rows 5..9) prefer entry mobs ('any')
  if (row <= 4) {
    const stronger = pool.filter((m) => m.rowLimit === 'front' || m.isCustom);
    if (stronger.length > 0) pool = stronger;
  } else {
    const entry = pool.filter((m) => m.rowLimit !== 'front' || m.isCustom);
    if (entry.length > 0) pool = entry;
  }

  if (pool.length === 0) return null;

  const totalWeight = pool.reduce((acc, m) => acc + Math.max(1, Number(m.spawnWeight || 50)), 0);
  let target = ((Math.abs(rand1 * 0.7 + rand2 * 0.3)) % 1) * totalWeight;
  for (const mob of pool) {
    const w = Math.max(1, Number(mob.spawnWeight || 50));
    if (target <= w) {
      return mob;
    }
    target -= w;
  }
  return pool[0];
}
