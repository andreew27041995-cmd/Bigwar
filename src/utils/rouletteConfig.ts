import { ItemQualityKey, CharacterSkinTemplate, NpcTemplate } from '../types/game';

export interface RoulettePrizeConfig {
  id: string;
  name: string;
  icon: string;
  type: 'gold' | 'crystals' | 'item' | 'skin' | 'jackpot' | 'npc';
  amount?: number;
  quality: ItemQualityKey;
  skinId?: string;
  skinDurationDays?: number; // 0 = permanent forever in collection
  skinTemplate?: CharacterSkinTemplate;
  npcTemplateId?: string;
  npcTemplate?: NpcTemplate;
  minLevel?: number; // Minimum player level required to win this prize in roulette (e.g. 15 for NPC)
  dropChancePct?: number; // Explicit drop percentage (e.g. 1 .. 100%)
  weight: number; // Drop chance weight (e.g. 0.1..100)
  enabled: boolean;
}

export const ROULETTE_STORAGE_KEY = 'pyramid_roulette_prizes_v2';
const SUPABASE_REST_URL = 'https://lgbxbwzqckdnviygsghu.supabase.co/rest/v1/players';
const SUPABASE_KEY = 'sb_publishable_lGMAAuZELw2gPDZeuEx0VQ_DgPK7szm';

export const DEFAULT_ROULETTE_PRIZES: RoulettePrizeConfig[] = [
  { id: 'rp_g1', name: '100 Золота', icon: '🪙', type: 'gold', amount: 100, quality: 'common', minLevel: 1, dropChancePct: 34, weight: 34, enabled: true },
  { id: 'rp_g2', name: '250 Золота', icon: '💰', type: 'gold', amount: 250, quality: 'rare', minLevel: 1, dropChancePct: 25, weight: 25, enabled: true },
  { id: 'rp_c1', name: '5 Кристаллов', icon: '💎', type: 'crystals', amount: 5, quality: 'rare', minLevel: 1, dropChancePct: 15, weight: 15, enabled: true },
  { id: 'rp_c2', name: '20 Кристаллов', icon: '💎', type: 'crystals', amount: 20, quality: 'epic', minLevel: 1, dropChancePct: 10, weight: 10, enabled: true },
  { id: 'rp_w1', name: 'Серп Жреца Ра', icon: '⚔️', type: 'item', quality: 'rare', minLevel: 1, dropChancePct: 8, weight: 8, enabled: true },
  { id: 'rp_r1', name: 'Кольцо Ра', icon: '💍', type: 'item', quality: 'legendary', minLevel: 1, dropChancePct: 4, weight: 4, enabled: true },
  { id: 'rp_jp', name: '300 💎 ДЖЕКПОТ', icon: '👑', type: 'jackpot', amount: 300, quality: 'legendary', minLevel: 1, dropChancePct: 2, weight: 2, enabled: true },
  { id: 'rp_skin_pharaoh', name: 'Скин: Воин Фараона', icon: '🤴', type: 'skin', skinId: 'skin_pharaoh', skinDurationDays: 0, quality: 'legendary', minLevel: 1, dropChancePct: 1, weight: 1, enabled: true },
  { id: 'rp_npc_guardian', name: 'Страж NPC: Автономный Страж', icon: '🤖', type: 'npc', npcTemplateId: 'npc_guardian', minLevel: 15, dropChancePct: 1, quality: 'legendary', weight: 1, enabled: true }
];

let memoryRoulettePrizes: RoulettePrizeConfig[] | null = null;

export function getRoulettePrizes(): RoulettePrizeConfig[] {
  if (memoryRoulettePrizes === null) {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(ROULETTE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            memoryRoulettePrizes = parsed.map((p: any) => ({
              id: String(p.id || `rp_${Date.now()}_${Math.random()}`),
              name: String(p.name || 'Приз'),
              icon: String(p.icon || '🎁'),
              type: (p.type || 'gold') as RoulettePrizeConfig['type'],
              amount: p.amount !== undefined ? Number(p.amount) : undefined,
              quality: (p.quality || 'rare') as ItemQualityKey,
              skinId: p.skinId ? String(p.skinId) : undefined,
              skinDurationDays: 0,
              skinTemplate: p.skinTemplate && typeof p.skinTemplate === 'object' ? { ...p.skinTemplate, isTemporary: false, durationDays: 0 } : undefined,
              npcTemplateId: p.npcTemplateId ? String(p.npcTemplateId) : undefined,
              npcTemplate: p.npcTemplate && typeof p.npcTemplate === 'object' ? { ...p.npcTemplate } : undefined,
              minLevel: p.minLevel !== undefined ? Math.max(1, Number(p.minLevel)) : p.type === 'npc' ? 15 : 1,
              dropChancePct: p.dropChancePct !== undefined ? Math.max(0.01, Number(p.dropChancePct)) : undefined,
              weight: Math.max(0.01, Number(p.weight || 10)),
              enabled: p.enabled !== false
            }));
            return memoryRoulettePrizes;
          }
        }
      } catch (e) {
        console.warn('Error reading roulette prizes from localStorage:', e);
      }
    }
    memoryRoulettePrizes = DEFAULT_ROULETTE_PRIZES.map((p) => ({ ...p }));
  }
  return memoryRoulettePrizes;
}

export function setMemoryRoulettePrizes(prizes: RoulettePrizeConfig[]) {
  memoryRoulettePrizes = [...prizes];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ROULETTE_STORAGE_KEY, JSON.stringify(prizes));
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Syncs roulette prize configuration with Supabase so admin adjustments instantly update for all players.
 */
export async function syncRoulettePrizesFromSupabase(): Promise<RoulettePrizeConfig[]> {
  try {
    const res = await fetch(
      `${SUPABASE_REST_URL}?name=eq.__GLOBAL_CONFIG__&select=id,name,email`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0].email) {
        try {
          const cfg = JSON.parse(rows[0].email);
          if (Array.isArray(cfg.roulettePrizes) && cfg.roulettePrizes.length > 0) {
            setMemoryRoulettePrizes(cfg.roulettePrizes);
            return cfg.roulettePrizes;
          }
        } catch (e) {
          // parse error
        }
      }
    }
  } catch (err) {
    console.warn('Failed to sync roulette prizes from Supabase:', err);
  }
  return getRoulettePrizes();
}

export async function saveRoulettePrizesToSupabase(
  prizes: RoulettePrizeConfig[]
): Promise<boolean> {
  setMemoryRoulettePrizes(prizes);
  try {
    const fetchRes = await fetch(
      `${SUPABASE_REST_URL}?name=eq.__GLOBAL_CONFIG__&select=id,name,email`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    let existingCfg: any = {};
    let configId: any = null;
    if (fetchRes.ok) {
      const rows = await fetchRes.json();
      if (Array.isArray(rows) && rows.length > 0) {
        configId = rows[0].id;
        try {
          existingCfg = JSON.parse(rows[0].email || '{}');
        } catch (e) {
          existingCfg = {};
        }
      }
    }

    const nextCfg = {
      ...existingCfg,
      roulettePrizes: prizes,
      lastUpdated: Date.now()
    };

    const payload = {
      name: '__GLOBAL_CONFIG__',
      email: JSON.stringify(nextCfg),
      last_seen: Date.now()
    };

    if (configId) {
      await fetch(`${SUPABASE_REST_URL}?id=eq.${configId}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(payload)
      });
    } else {
      await fetch(SUPABASE_REST_URL, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(payload)
      });
    }
    return true;
  } catch (err) {
    console.error('Failed to save roulette prizes to Supabase:', err);
    return false;
  }
}
