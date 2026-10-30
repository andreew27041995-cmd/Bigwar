import { HeroState, NpcCompanionState, NpcLogEntry, NpcNotificationEntry, NpcTemplate } from '../types/game';
export type { NpcTemplate, NpcNotificationEntry };
import { getPyramidTierForLevel, getPyramidMob, getCanonicalMobRewards } from './gameData';
import { getFeatureFlags } from './shopConfig';

export function sendNpcBrowserPushNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  try {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        tag: `npc_alert_${Date.now()}`
      });
    }
  } catch (e) {
    // ignore push notification errors in restricted frames
  }
}

export const DEFAULT_NPC_CONFIG = {
  minLevel: 15,
  priceCrystals: 2900,
  baseEnergy: 500,
  baseHp: 3000,
  baseDmg: 200,
  rewardMultiplier: 0.5, // 50% gold and exp
  bagCapacity: 100, // 100 trophies/kills
  energyPerAttack: 3,
  regenIntervalSec: 2, // 1 energy every 2 seconds (~16 minutes for 0 -> 500)
};

export let NPC_CONFIG = { ...DEFAULT_NPC_CONFIG };

export const DEFAULT_NPC_TEMPLATES: NpcTemplate[] = [
  {
    id: 'npc_guardian',
    name: 'Автономный Страж Пирамиды',
    icon: '🤖',
    minLevel: 15,
    priceCrystals: 2900,
    baseEnergy: 500,
    baseHp: 3000,
    baseDmg: 200,
    rewardMultiplier: 0.5,
    bagCapacity: 100,
    energyPerAttack: 3,
    regenIntervalSec: 2,
    description: 'Классический авто-страж. Копирует экипировку и уровень владельца, добывает 50% золота и опыта.',
    enabled: true
  },
  {
    id: 'npc_anubis',
    name: 'Анубис-Автобот',
    icon: '🐺',
    minLevel: 15,
    priceCrystals: 4500,
    baseEnergy: 650,
    baseHp: 4500,
    baseDmg: 320,
    rewardMultiplier: 0.65,
    bagCapacity: 150,
    energyPerAttack: 3,
    regenIntervalSec: 2,
    description: 'Боевой шакал фараонов. Повышенные HP и урон, вместительный рюкзак и 65% наград!',
    enabled: true
  },
  {
    id: 'npc_pharaoh_guard',
    name: 'Элитный Страж Фараона',
    icon: '👑',
    minLevel: 15,
    priceCrystals: 6900,
    baseEnergy: 800,
    baseHp: 6000,
    baseDmg: 450,
    rewardMultiplier: 0.75,
    bagCapacity: 200,
    energyPerAttack: 3,
    regenIntervalSec: 1,
    description: 'Золотой голем древних жрецов. Колоссальная живучесть, быстрая регенерация и 75% наград!',
    enabled: true
  }
];

let cachedNpcTemplates: NpcTemplate[] | null = null;

export function getNpcGlobalConfig(): typeof NPC_CONFIG {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('pyramid_npc_global_config');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          NPC_CONFIG = {
            ...DEFAULT_NPC_CONFIG,
            ...parsed,
            minLevel: Math.max(1, Number(parsed.minLevel ?? DEFAULT_NPC_CONFIG.minLevel ?? 15))
          };
          return NPC_CONFIG;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  return NPC_CONFIG;
}

export function updateNpcGlobalConfig(cfg: Partial<typeof NPC_CONFIG>): typeof NPC_CONFIG {
  NPC_CONFIG = {
    ...getNpcGlobalConfig(),
    ...cfg,
    minLevel: Math.max(1, Number(cfg.minLevel ?? NPC_CONFIG.minLevel ?? 15))
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('pyramid_npc_global_config', JSON.stringify(NPC_CONFIG));
    } catch (e) {
      // ignore
    }
  }
  return NPC_CONFIG;
}

export const NPC_DEFAULT_MIN_LEVEL = 15;

export function getNpcRequiredLevel(template?: NpcTemplate | null): number {
  const globalMin = Math.max(1, Number(getNpcGlobalConfig().minLevel ?? NPC_DEFAULT_MIN_LEVEL));
  if (template && template.minLevel !== undefined && Number(template.minLevel) >= 1) {
    return Math.max(1, Number(template.minLevel));
  }
  return globalMin;
}

export function setNpcRequiredLevel(minLevel: number): number {
  const normalized = Math.max(1, Math.floor(Number(minLevel) || NPC_DEFAULT_MIN_LEVEL));
  updateNpcGlobalConfig({ minLevel: normalized });
  const updatedTemplates = getNpcTemplates().map((t) => ({
    ...t,
    minLevel: normalized
  }));
  saveNpcTemplates(updatedTemplates);
  return normalized;
}

export function canPurchaseNpcCompanion(
  heroOrLevel: HeroState | number,
  template?: NpcTemplate | null
): { allowed: boolean; requiredLevel: number; currentLevel: number; errorMessage?: string } {
  const currentLevel =
    typeof heroOrLevel === 'number'
      ? Math.max(1, Math.floor(heroOrLevel))
      : Math.max(1, Math.floor(Number(heroOrLevel?.level ?? (heroOrLevel as any)?.lvl ?? 1)));
  const requiredLevel = getNpcRequiredLevel(template);
  if (currentLevel < requiredLevel) {
    return {
      allowed: false,
      requiredLevel,
      currentLevel,
      errorMessage: `⛔ Купить Стража «${template?.name || 'Страж Пирамиды'}» можно только с ${requiredLevel}-го уровня! (Ваш уровень: ${currentLevel})`
    };
  }
  return {
    allowed: true,
    requiredLevel,
    currentLevel
  };
}

export function getNpcTemplates(): NpcTemplate[] {
  const globalMin = Math.max(1, Number(getNpcGlobalConfig().minLevel ?? 15));
  if (cachedNpcTemplates && cachedNpcTemplates.length > 0) {
    return cachedNpcTemplates.map((t) => ({
      ...t,
      minLevel: Math.max(1, Number(t.minLevel ?? globalMin))
    }));
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('pyramid_npc_templates');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedNpcTemplates = parsed.map((t: NpcTemplate) => ({
            ...t,
            minLevel: Math.max(1, Number(t.minLevel ?? globalMin))
          }));
          return cachedNpcTemplates;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  cachedNpcTemplates = DEFAULT_NPC_TEMPLATES.map((t) => ({
    ...t,
    minLevel: Math.max(1, Number(t.minLevel ?? globalMin))
  }));
  return cachedNpcTemplates;
}

export function saveNpcTemplates(templates: NpcTemplate[]): void {
  cachedNpcTemplates = templates;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('pyramid_npc_templates', JSON.stringify(templates));
    } catch (e) {
      // ignore
    }
  }
}

export function saveNpcActiveOverride(
  ownerNick: string | undefined | null,
  isActive: boolean,
  toggledAt: number = Date.now()
): void {
  if (typeof window === 'undefined') return;
  try {
    const cleanNick = String(ownerNick || '').trim().toLowerCase();
    const payload = JSON.stringify({
      isActive: Boolean(isActive),
      lastToggledAt: Math.max(1, Number(toggledAt) || Date.now())
    });
    if (cleanNick) {
      localStorage.setItem(`pyramid_npc_active_override_${cleanNick}`, payload);
    }
    localStorage.setItem('pyramid_npc_active_override_last', payload);
  } catch (e) {
    // ignore storage errors
  }
}

export function getNpcActiveOverride(
  ownerNick?: string | null
): { isActive: boolean; lastToggledAt: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const cleanNick = String(ownerNick || '').trim().toLowerCase();
    const raw =
      (cleanNick && localStorage.getItem(`pyramid_npc_active_override_${cleanNick}`)) ||
      (!cleanNick ? localStorage.getItem('pyramid_npc_active_override_last') : null);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.isActive === 'boolean') {
      return {
        isActive: Boolean(parsed.isActive),
        lastToggledAt: Math.max(0, Number(parsed.lastToggledAt || 0))
      };
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export function reconcileNpcCompanionState(
  npc: NpcCompanionState | undefined | null,
  ownerNick?: string | null
): NpcCompanionState | undefined {
  if (!npc || typeof npc !== 'object' || !npc.unlocked) {
    return npc || undefined;
  }
  const effectiveNick = String(ownerNick || npc.ownerNick || '').trim();
  const override = getNpcActiveOverride(effectiveNick);
  const npcToggledAt = Math.max(0, Number(npc.lastToggledAt || 0));

  let resolvedIsActive = Boolean(npc.isActive);
  let resolvedToggledAt = npcToggledAt;

  if (override) {
    // If local override is newer (or NPC had no lastToggledAt recorded yet), strictly enforce local ON/OFF choice
    if (override.lastToggledAt >= npcToggledAt) {
      resolvedIsActive = Boolean(override.isActive);
      resolvedToggledAt = override.lastToggledAt;
    } else if (npcToggledAt > override.lastToggledAt) {
      saveNpcActiveOverride(effectiveNick, resolvedIsActive, npcToggledAt);
    }
  } else if (npcToggledAt > 0) {
    saveNpcActiveOverride(effectiveNick, resolvedIsActive, npcToggledAt);
  }

  return {
    ...npc,
    isActive: resolvedIsActive,
    lastToggledAt: resolvedToggledAt > 0 ? resolvedToggledAt : npc.lastToggledAt,
    ownerNick: effectiveNick || npc.ownerNick
  };
}

export function pickNewestNpcCompanion(
  npcA: NpcCompanionState | undefined | null,
  npcB: NpcCompanionState | undefined | null,
  ownerNick?: string | null
): NpcCompanionState | null {
  const validA = npcA && typeof npcA === 'object' && npcA.unlocked ? npcA : null;
  const validB = npcB && typeof npcB === 'object' && npcB.unlocked ? npcB : null;
  if (!validA && !validB) return (npcA || npcB || null) as any;
  if (validA && !validB) return reconcileNpcCompanionState(validA, ownerNick) || validA;
  if (!validA && validB) return reconcileNpcCompanionState(validB, ownerNick) || validB;

  const toggleA = Math.max(0, Number(validA!.lastToggledAt || 0));
  const toggleB = Math.max(0, Number(validB!.lastToggledAt || 0));
  const actionA = Math.max(0, Number(validA!.lastActionTime || 0), Number(validA!.lastRegenTime || 0));
  const actionB = Math.max(0, Number(validB!.lastActionTime || 0), Number(validB!.lastRegenTime || 0));

  let chosen = validA!;
  if (toggleB > toggleA) {
    chosen = validB!;
  } else if (toggleA > toggleB) {
    chosen = validA!;
  } else if (actionB > actionA) {
    chosen = validB!;
  }

  // Always preserve maximum accumulated bag loot / kills unless just claimed
  return reconcileNpcCompanionState(chosen, ownerNick) || chosen;
}

export function createDefaultNpcCompanion(
  hero?: HeroState,
  template?: NpcTemplate | null
): NpcCompanionState {
  const now = Date.now();
  const timeStr = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const tier = hero ? getPyramidTierForLevel(hero.level || (hero as any).lvl || 1) : 1;

  const tpl = template || getNpcTemplates().find((t) => t.enabled) || DEFAULT_NPC_TEMPLATES[0];

  const maxEnergy = Number(tpl?.baseEnergy || NPC_CONFIG.baseEnergy);
  const baseHp = Number(tpl?.baseHp || NPC_CONFIG.baseHp);
  const baseDmg = Number(tpl?.baseDmg || NPC_CONFIG.baseDmg);
  const bagCap = Number(tpl?.bagCapacity || NPC_CONFIG.bagCapacity || 100);
  const ownerNick = hero?.nick || '';

  if (ownerNick) {
    saveNpcActiveOverride(ownerNick, false, now);
  }

  return {
    unlocked: true,
    isActive: false,
    lastToggledAt: now,
    templateId: tpl?.id || 'npc_guardian',
    name: tpl?.name || 'Автономный Страж Пирамиды',
    icon: tpl?.icon || '🤖',
    energy: maxEnergy,
    maxEnergy,
    hp: baseHp,
    maxHp: baseHp,
    damage: baseDmg,
    tier,
    row: 9,
    col: 0,
    lastActionTime: now,
    lastRegenTime: now,
    bagGold: 0,
    bagExp: 0,
    mobsKilled: 0,
    mobsInBag: 0,
    bagCapacity: bagCap,
    ownerNick,
    pushNotificationsEnabled: true,
    forcedDisableReason: null,
    notifications: [
      {
        id: `npc_notif_init_${now}`,
        timestamp: now,
        time: timeStr,
        reason: 'system',
        title: `🤖 Страж «${tpl?.name || 'Страж'}» активирован в профиле`,
        message: 'Система оповещений включена: вы получите пуш-уведомление и системное сообщение, если Страж принудительно отключится из-за низкой энергии или окончания срока действия.',
        read: false
      }
    ],
    logs: [
      {
        id: `npc_init_${now}`,
        time: timeStr,
        text: `🤖 Страж «${tpl?.name || 'Страж'}» приобретён навсегда! Включите его во вкладке «Персонаж», чтобы начать автономный фарминг.`,
        type: 'loot'
      }
    ]
  };
}

export function getNpcEffectiveStats(hero: HeroState, currentNpc?: NpcCompanionState) {
  const templates = getNpcTemplates();
  const tpl = currentNpc?.templateId
    ? templates.find((t) => t.id === currentNpc.templateId)
    : templates[0];

  const baseHp = Number(tpl?.baseHp || NPC_CONFIG.baseHp);
  const baseDmg = Number(tpl?.baseDmg || NPC_CONFIG.baseDmg);
  const maxEnergy = Number(tpl?.baseEnergy || NPC_CONFIG.baseEnergy);
  const bagCapacity = Number(tpl?.bagCapacity || currentNpc?.bagCapacity || NPC_CONFIG.bagCapacity || 100);

  const gearHp = Number(hero.gearHp || 0) + Number(hero.bonusHp || 0);
  const gearDmg =
    Number(hero.gearDmg || 0) +
    Number(hero.bonusDmg || 0) +
    Number(hero.gearStr || 0) * 2 +
    (Number(hero.str || 1) - 1) * 2;

  const maxHp = baseHp + Math.max(0, gearHp);
  const damage = baseDmg + Math.max(0, gearDmg);
  const currentEnergy = Math.max(0, Math.min(maxEnergy, Number(currentNpc?.energy ?? maxEnergy)));
  const currentHp = Math.max(0, Math.min(maxHp, Number(currentNpc?.hp ?? maxHp)));
  const tier = getPyramidTierForLevel(hero.level || (hero as any).lvl || 1);

  return {
    maxHp,
    damage,
    maxEnergy,
    currentEnergy,
    currentHp,
    tier,
    bagCapacity,
    rewardMultiplier: Number(tpl?.rewardMultiplier || NPC_CONFIG.rewardMultiplier),
    icon: currentNpc?.icon || tpl?.icon || '🤖',
    name: currentNpc?.name || tpl?.name || 'Страж Пирамиды'
  };
}

/**
 * Deterministically simulates NPC activity either for a live tick (e.g. 3s)
 * or for offline catch-up when player returns to the game.
 * Strictly respects ON/OFF state: if NPC is OFF (isActive === false), it NEVER farms while offline or online.
 */
export function simulateNpcProgress(
  rawNpc: NpcCompanionState,
  hero: HeroState,
  nowMs: number = Date.now()
): {
  updatedNpc: NpcCompanionState;
  summaryText?: string;
  bagWarningToast?: string;
  forcedDisableAlert?: string;
} {
  if (!rawNpc || !rawNpc.unlocked) {
    return { updatedNpc: rawNpc };
  }

  const ownerNick = hero?.nick || rawNpc.ownerNick || '';
  const npc = reconcileNpcCompanionState(rawNpc, ownerNick) || rawNpc;

  const effective = getNpcEffectiveStats(hero, npc);
  let energy = Math.max(0, Math.min(effective.maxEnergy, Number(npc.energy ?? effective.maxEnergy)));
  let hp = Math.max(0, Math.min(effective.maxHp, Number(npc.hp ?? effective.maxHp)));
  const flags = getFeatureFlags();
  const isGloballyEnabled = flags?.npcCompanionsEnabled !== false;
  let isActive = isGloballyEnabled ? Boolean(npc.isActive) : false;
  let bagGold = Math.max(0, Number(npc.bagGold || 0));
  let bagExp = Math.max(0, Number(npc.bagExp || 0));
  let mobsKilled = Math.max(0, Number(npc.mobsKilled || 0));
  let mobsInBag = Math.max(0, Number(npc.mobsInBag ?? (bagGold > 0 ? Math.min(effective.bagCapacity, Math.ceil(bagGold / 40)) : 0)));
  const logs: NpcLogEntry[] = Array.isArray(npc.logs) ? [...npc.logs] : [];
  const notifications: NpcNotificationEntry[] = Array.isArray(npc.notifications) ? [...npc.notifications] : [];
  let forcedDisableReason = npc.forcedDisableReason || null;
  let forcedDisabledAt = npc.forcedDisabledAt;
  const pushEnabled = npc.pushNotificationsEnabled !== false;
  let summaryText: string | undefined;
  let bagWarningToast: string | undefined;
  let forcedDisableAlert: string | undefined;
  let lastBagWarning = Number(npc.lastBagWarningTime || 0);
  let lastToggledAt = Number(npc.lastToggledAt || 0);

  const lastAction = Number(npc.lastActionTime || nowMs);
  const lastRegen = Number(npc.lastRegenTime || nowMs);

  // Check if NPC has expired (expiresAt timestamp reached)
  const expiresAt = Number(npc.expiresAt || 0);
  if (expiresAt > 0 && nowMs >= expiresAt) {
    if (isActive || forcedDisableReason !== 'expired') {
      isActive = false;
      forcedDisableReason = 'expired';
      forcedDisabledAt = nowMs;
      lastToggledAt = nowMs;
      if (ownerNick) {
        saveNpcActiveOverride(ownerNick, false, nowMs);
      }
      const timeStr = new Date(nowMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const expTitle = '⏰ Страж NPC отключён: истёк срок действия';
      const expMsg = `Срок действия Стража «${effective.name}» завершился. Страж был принудительно остановлен и возвращён в Город.`;
      notifications.unshift({
        id: `npc_notif_exp_${nowMs}`,
        timestamp: nowMs,
        time: timeStr,
        reason: 'expired',
        title: expTitle,
        message: expMsg,
        read: false
      });
      logs.unshift({
        id: `npc_expired_${nowMs}`,
        time: timeStr,
        text: `⏰ ${expMsg}`,
        type: 'energy'
      });
      if (pushEnabled) {
        sendNpcBrowserPushNotification(expTitle, expMsg);
      }
      forcedDisableAlert = `⏰ Системное оповещение: ${expMsg}`;
    }
  }

  // Check if globally disabled by admin while active
  if (!isGloballyEnabled && Boolean(npc.isActive)) {
    isActive = false;
    forcedDisableReason = 'global_disabled';
    forcedDisabledAt = nowMs;
    const timeStr = new Date(nowMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const globTitle = '🛑 Страж NPC временно приостановлен сервером';
    const globMsg = 'Автономные Стражи были временно отключены администрацией сервера. Ваш Страж ожидает в Городе.';
    notifications.unshift({
      id: `npc_notif_glob_${nowMs}`,
      timestamp: nowMs,
      time: timeStr,
      reason: 'system',
      title: globTitle,
      message: globMsg,
      read: false
    });
    if (pushEnabled) {
      sendNpcBrowserPushNotification(globTitle, globMsg);
    }
    forcedDisableAlert = `🛑 ${globMsg}`;
  }

  // 1. If NPC is NOT active (turned OFF): it does NOT farm online or offline; only passively regenerates energy in City
  if (!isActive) {
    const regenStepSec = Math.max(1, Number(NPC_CONFIG.regenIntervalSec || 2));
    const elapsedSec = Math.max(0, Math.floor((nowMs - lastRegen) / 1000));
    let nextRegenTime = lastRegen;
    if (energy >= effective.maxEnergy) {
      nextRegenTime = nowMs;
      hp = effective.maxHp;
    } else if (elapsedSec >= regenStepSec) {
      const energyGain = Math.floor(elapsedSec / regenStepSec);
      const prevEnergy = energy;
      energy = Math.min(effective.maxEnergy, energy + energyGain);
      hp = effective.maxHp;
      nextRegenTime =
        energy >= effective.maxEnergy
          ? nowMs
          : lastRegen + energyGain * regenStepSec * 1000;

      if (prevEnergy < effective.maxEnergy && energy >= effective.maxEnergy) {
        const timeStr = new Date(nowMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        logs.unshift({
          id: `npc_full_${nowMs}`,
          time: timeStr,
          text: `⚡ Энергия Стража NPC полностью заряжена (${effective.maxEnergy}/${effective.maxEnergy}⚡)! Готов к включению во вкладке «Персонаж».`,
          type: 'energy'
        });
        notifications.unshift({
          id: `npc_notif_full_${nowMs}`,
          timestamp: nowMs,
          time: timeStr,
          reason: 'recharged',
          title: '⚡ Энергия Стража полностью восстановлена (100%)',
          message: `Страж «${effective.name}» полностью зарядил энергию (${effective.maxEnergy}/${effective.maxEnergy}⚡) и готов к новому походу в Пирамиду!`,
          read: false
        });
        if (forcedDisableReason === 'low_energy') {
          forcedDisableReason = null;
        }
      }
    }

    return {
      updatedNpc: {
        ...npc,
        isActive: false,
        lastToggledAt,
        forcedDisableReason,
        forcedDisabledAt,
        pushNotificationsEnabled: pushEnabled,
        notifications: notifications.slice(0, 30),
        energy,
        maxEnergy: effective.maxEnergy,
        hp: effective.maxHp,
        maxHp: effective.maxHp,
        damage: effective.damage,
        tier: effective.tier,
        bagCapacity: effective.bagCapacity,
        mobsInBag,
        lastRegenTime: nextRegenTime,
        lastActionTime: nowMs,
        lastBagWarningTime: lastBagWarning,
        bagGold,
        bagExp,
        mobsKilled,
        logs: logs.slice(0, 35)
      },
      forcedDisableAlert
    };
  }

  // Clear previous low_energy forced disable reason while actively running
  if (forcedDisableReason === 'low_energy') {
    forcedDisableReason = null;
  }

  // 2. If NPC IS ACTIVE: simulate monster combat in corresponding pyramid tier (both online & offline until energy reaches 0)
  const actionStepMs = 3500; // 1 action every 3.5 seconds
  const energyPerAttack = Math.max(1, Number(NPC_CONFIG.energyPerAttack || 3));
  const elapsedActionMs = Math.max(0, nowMs - lastAction);
  const maxActionsPossible = Math.floor(energy / energyPerAttack);
  const desiredActions = Math.floor(elapsedActionMs / actionStepMs);
  const actionsToPerform = Math.min(desiredActions, maxActionsPossible);

  let currentR = Number(npc.row ?? 9);
  let currentC = Number(npc.col ?? 0);

  if (actionsToPerform <= 0 && energy < energyPerAttack) {
    // Out of energy! Recall to City and persist OFF state
    isActive = false;
    energy = 0;
    lastToggledAt = nowMs;
    forcedDisableReason = 'low_energy';
    forcedDisabledAt = nowMs;
    if (ownerNick) {
      saveNpcActiveOverride(ownerNick, false, nowMs);
    }
    const timeStr = new Date(nowMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const lowEnTitle = '⚡ Страж NPC принудительно отключён (Низкая энергия)';
    const lowEnMsg = `У Стража «${effective.name}» исчерпана энергия (0/${effective.maxEnergy}⚡). Он автоматически отключился и вернулся в Город Луксор для подзарядки.`;
    logs.unshift({
      id: `npc_depleted_${nowMs}`,
      time: timeStr,
      text: `⚡ Энергия Стража NPC исчерпана (0/${effective.maxEnergy}). Он автоматически выключился и вернулся в Город для подзарядки.`,
      type: 'energy'
    });
    notifications.unshift({
      id: `npc_notif_low_en_${nowMs}`,
      timestamp: nowMs,
      time: timeStr,
      reason: 'low_energy',
      title: lowEnTitle,
      message: lowEnMsg,
      read: false
    });
    if (pushEnabled) {
      sendNpcBrowserPushNotification(lowEnTitle, lowEnMsg);
    }
    forcedDisableAlert = `⚡ Системное оповещение: ${lowEnMsg}`;

    return {
      updatedNpc: {
        ...npc,
        isActive: false,
        lastToggledAt,
        forcedDisableReason,
        forcedDisabledAt,
        pushNotificationsEnabled: pushEnabled,
        notifications: notifications.slice(0, 30),
        energy: 0,
        maxEnergy: effective.maxEnergy,
        hp: effective.maxHp,
        maxHp: effective.maxHp,
        damage: effective.damage,
        tier: effective.tier,
        bagCapacity: effective.bagCapacity,
        mobsInBag,
        lastActionTime: nowMs,
        lastRegenTime: nowMs,
        lastBagWarningTime: lastBagWarning,
        bagGold,
        bagExp,
        mobsKilled,
        logs: logs.slice(0, 35)
      },
      summaryText: '⚡ У Стража NPC закончилась энергия — он принудительно отключён и вернулся в Город Луксор для подзарядки.',
      bagWarningToast,
      forcedDisableAlert
    };
  }

  // If less than 3.5s has elapsed since last action, keep lastActionTime unchanged so the 1s tick doesn't reset the timer!
  if (actionsToPerform <= 0) {
    return {
      updatedNpc: {
        ...npc,
        isActive: true,
        forcedDisableReason,
        forcedDisabledAt,
        pushNotificationsEnabled: pushEnabled,
        notifications: notifications.slice(0, 30),
        energy,
        maxEnergy: effective.maxEnergy,
        hp,
        maxHp: effective.maxHp,
        damage: effective.damage,
        tier: effective.tier,
        row: currentR,
        col: currentC,
        bagCapacity: effective.bagCapacity,
        mobsInBag,
        lastActionTime: lastAction,
        lastRegenTime: nowMs,
        lastBagWarningTime: lastBagWarning,
        bagGold,
        bagExp,
        mobsKilled,
        logs: logs.slice(0, 35)
      }
    };
  }

  let actionsCompleted = 0;
  let offlineKilled = 0;
  let offlineGold = 0;
  let offlineExp = 0;

  for (let i = 0; i < actionsToPerform; i++) {
    if (energy < energyPerAttack) {
      isActive = false;
      energy = 0;
      break;
    }

    energy -= energyPerAttack;
    actionsCompleted++;

    // NPC steps to an active pyramid position
    currentR = Math.max(1, Math.min(9, Math.floor(Math.random() * 9) + 1));
    currentC = Math.max(0, Math.min(currentR, Math.floor(Math.random() * (currentR + 1))));

    // Target monster
    const mob = getPyramidMob(effective.tier, currentR, false, Math.random(), Math.random());
    const mobHp = Number(mob.hp || 100);
    const mobDmg = Number(mob.dmg || 20);

    // NPC hits mob
    if (effective.damage >= mobHp || Math.random() < 0.85) {
      const rewards = getCanonicalMobRewards(mob.lvl, false, mob.name);
      const earnedGold = Math.max(1, Math.round(rewards.gold * effective.rewardMultiplier));
      const earnedExp = Math.max(1, Math.round(rewards.exp * effective.rewardMultiplier));

      if (mobsInBag < effective.bagCapacity) {
        bagGold += earnedGold;
        bagExp += earnedExp;
        mobsInBag++;
      }

      mobsKilled++;
      offlineKilled++;
      offlineGold += earnedGold;
      offlineExp += earnedExp;

      if (i >= actionsToPerform - 5 || actionsToPerform === 1) {
        const stepTimeMs = Math.min(nowMs, lastAction + (i + 1) * actionStepMs);
        const timeStr = new Date(stepTimeMs).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        logs.unshift({
          id: `npc_kill_${nowMs}_${i}`,
          time: timeStr,
          text: `💀 Убит ${mob.name} (${mob.lvl} ур.) в Пирамиде ${effective.tier}! В рюкзак: +${earnedGold} 🪙, +${earnedExp} EXP (-${energyPerAttack}⚡, ост. ${energy}⚡)`,
          type: 'kill'
        });
      }
    } else {
      hp = Math.max(1, hp - Math.round(mobDmg * 0.7));
    }
  }

  // Check 90% full threshold
  if (mobsInBag >= effective.bagCapacity * 0.9 && nowMs - lastBagWarning >= 60000) {
    const pct = Math.round((mobsInBag / effective.bagCapacity) * 100);
    bagWarningToast = `⚠️ Рюкзак Стража NPC заполнен на ${pct}% (${mobsInBag}/${effective.bagCapacity})! Не забудьте забрать накопившуюся добычу (+${bagGold.toLocaleString()} 🪙)!`;
    lastBagWarning = nowMs;
    const timeStr = new Date(nowMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    notifications.unshift({
      id: `npc_notif_bag_${nowMs}`,
      timestamp: nowMs,
      time: timeStr,
      reason: 'bag_full',
      title: `🎒 Рюкзак Стража заполнен на ${pct}%`,
      message: `В рюкзаке Стража накопилось +${bagGold.toLocaleString()} 🪙 и +${bagExp.toLocaleString()} EXP (${mobsInBag}/${effective.bagCapacity}). Заберите добычу!`,
      read: false
    });
  }

  let nextActionTime = Math.min(nowMs, lastAction + actionsCompleted * actionStepMs);
  let nextRegenTime = nowMs;

  // If energy ran out (less than energy needed for one attack):
  if (energy < energyPerAttack) {
    isActive = false;
    energy = 0;
    lastToggledAt = nowMs;
    forcedDisableReason = 'low_energy';
    forcedDisabledAt = nowMs;
    if (ownerNick) {
      saveNpcActiveOverride(ownerNick, false, nowMs);
    }
    const depletionTimeMs = Math.min(nowMs, lastAction + actionsCompleted * actionStepMs);
    const timeStr = new Date(depletionTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const lowEnTitle = '⚡ Страж NPC принудительно отключён (Низкая энергия)';
    const lowEnMsg = `У Стража «${effective.name}» закончилась энергия (0/${effective.maxEnergy}⚡) во время похода. Он автоматически выключился и вернулся в Город Луксор на подзарядку.`;
    logs.unshift({
      id: `npc_stop_${nowMs}`,
      time: timeStr,
      text: `⚡ Энергия Стража NPC исчерпана (0/${effective.maxEnergy}). Он автоматически выключился и вернулся в Город Луксор на отдых.`,
      type: 'energy'
    });
    notifications.unshift({
      id: `npc_notif_stop_${nowMs}`,
      timestamp: nowMs,
      time: timeStr,
      reason: 'low_energy',
      title: lowEnTitle,
      message: lowEnMsg,
      read: false
    });
    if (pushEnabled) {
      sendNpcBrowserPushNotification(lowEnTitle, lowEnMsg);
    }
    forcedDisableAlert = `⚡ Системное оповещение: ${lowEnMsg}`;
    nextActionTime = nowMs;
    nextRegenTime = nowMs;
  }

  if (actionsToPerform > 1 && offlineKilled > 0) {
    summaryText = `🤖 Страж NPC добыл пока вы отсутствовали: +${offlineGold} 🪙 золота и +${offlineExp} EXP опыта (${offlineKilled} монстров)!`;
  }

  return {
    updatedNpc: {
      ...npc,
      isActive,
      lastToggledAt,
      forcedDisableReason,
      forcedDisabledAt,
      pushNotificationsEnabled: pushEnabled,
      notifications: notifications.slice(0, 30),
      energy,
      maxEnergy: effective.maxEnergy,
      hp: isActive ? hp : effective.maxHp,
      maxHp: effective.maxHp,
      damage: effective.damage,
      tier: effective.tier,
      row: currentR,
      col: currentC,
      bagCapacity: effective.bagCapacity,
      mobsInBag,
      lastActionTime: nextActionTime,
      lastRegenTime: nextRegenTime,
      lastBagWarningTime: lastBagWarning,
      bagGold,
      bagExp,
      mobsKilled,
      logs: logs.slice(0, 35)
    },
    summaryText,
    bagWarningToast,
    forcedDisableAlert
  };
}

