import { ItemSlot } from '../types/game';

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

/**
 * Ancient Egyptian Ornate Equipment SVG Icons (Gold, Lapis Lazuli, Turquoise, Carnelian)
 * Used for both empty equipment slots and equipped/shop items across all tiers.
 */
export const EGYPTIAN_SLOT_SVGS: Record<ItemSlot, string> = {
  // 1. WEAPON — Golden Khopesh of Ra & Anubis (Серповидный меч Хопеш Фараона)
  weapon: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="wGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="wGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="45%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#92400e"/>
        </linearGradient>
        <linearGradient id="wBlade" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fffbeb"/>
          <stop offset="35%" stop-color="#fcd34d"/>
          <stop offset="75%" stop-color="#d97706"/>
          <stop offset="100%" stop-color="#78350f"/>
        </linearGradient>
        <linearGradient id="wLapis" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#1e3a8a"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#wGlow)"/>
      <!-- Khopesh Curved Sickle Blade -->
      <path d="M22 44 L28 36 C24 24 29 11 43 9 C52 8 56 15 52 24 C49 30 42 32 39 27 C43 25 45 20 42 17 C37 14 31 20 34 31 L27 41 Z" fill="url(#wBlade)" stroke="#fef08a" stroke-width="1.5"/>
      <!-- Inner Turquoise Hieroglyph Groove -->
      <path d="M35 28 C33 20 38 14 45 14" stroke="#2dd4bf" stroke-width="1.8" stroke-linecap="round"/>
      <!-- Winged Scarab Guard -->
      <path d="M16 39 L31 47 L28 50 L14 42 Z" fill="url(#wGold)" stroke="#fef08a" stroke-width="1.2"/>
      <circle cx="23.5" cy="43.5" r="3.2" fill="url(#wLapis)" stroke="#fef08a" stroke-width="1"/>
      <!-- Lapis & Gold Grip -->
      <path d="M21 44 L12 55 L16 58 L25 47 Z" fill="url(#wLapis)" stroke="url(#wGold)" stroke-width="1.5"/>
      <path d="M18 47 L22 50 M15 51 L19 54" stroke="#fef08a" stroke-width="1.4"/>
      <!-- Lotus Pommel -->
      <circle cx="12.5" cy="56.5" r="3.5" fill="url(#wGold)" stroke="#ef4444" stroke-width="1.2"/>
    </svg>
  `),

  // 2. ARMOR — Royal Pharaoh Usekh Pectoral & Falcon Cuirass (Доспех Фараона и Крылья Гора)
  armor: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="aGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.38"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="aGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="50%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#92400e"/>
        </linearGradient>
        <linearGradient id="aLapis" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#172554"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#aGlow)"/>
      <!-- Cuirass Body -->
      <path d="M12 18 L22 12 L26 19 C29 22 35 22 38 19 L42 12 L52 18 L56 30 L47 33 L45 53 L32 57 L19 53 L17 33 L8 30 Z" fill="url(#aLapis)" stroke="url(#aGold)" stroke-width="2"/>
      <!-- Usekh Broad Golden Collar -->
      <path d="M16 18 C22 29 42 29 48 18 L43 14 C38 22 26 22 21 14 Z" fill="url(#aGold)" stroke="#fef08a" stroke-width="1.2"/>
      <path d="M14 22 C22 34 42 34 50 22" stroke="#2dd4bf" stroke-width="2" fill="none"/>
      <!-- Winged Sun Disk of Ra on Chest -->
      <path d="M19 34 L29 36 L27 41 L18 39 Z M45 34 L35 36 L37 41 L46 39 Z" fill="url(#aGold)"/>
      <circle cx="32" cy="37" r="4.5" fill="#ef4444" stroke="#fef08a" stroke-width="1.4"/>
      <!-- Golden Scale Ribs & Belt -->
      <path d="M21 46 H43 M22 50 H42" stroke="url(#aGold)" stroke-width="2" stroke-linecap="round"/>
      <polygon points="32,44 35,50 32,55 29,50" fill="#2dd4bf" stroke="#fef08a" stroke-width="1"/>
    </svg>
  `),

  // 3. GLOVES — Golden Bracers of Anubis & Eye of Horus (Наручи Анубиса и Ока Гора)
  gloves: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="gGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="gGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="50%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#92400e"/>
        </linearGradient>
        <linearGradient id="gLapis" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0ea5e9"/>
          <stop offset="100%" stop-color="#1e3a8a"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#gGlow)"/>
      <!-- Left Vambrace -->
      <path d="M12 18 L27 14 L31 46 L14 50 Z" fill="url(#gGold)" stroke="#fef08a" stroke-width="1.6"/>
      <path d="M15 22 L25 19 L28 42 L16 45 Z" fill="url(#gLapis)" stroke="url(#gGold)" stroke-width="1.2"/>
      <circle cx="21.5" cy="32" r="4" fill="#2dd4bf" stroke="#fef08a" stroke-width="1.2"/>
      <!-- Right Vambrace -->
      <path d="M35 14 L52 18 L48 50 L31 46 Z" fill="url(#gGold)" stroke="#fef08a" stroke-width="1.6"/>
      <path d="M37 19 L49 22 L46 45 L34 42 Z" fill="url(#gLapis)" stroke="url(#gGold)" stroke-width="1.2"/>
      <!-- Eye of Horus Emblem -->
      <ellipse cx="41.5" cy="32" rx="4.5" ry="2.8" fill="#fef08a"/>
      <circle cx="41.5" cy="32" r="1.6" fill="#ef4444"/>
      <!-- Gold Bands -->
      <path d="M13 25 L28 22 M35 22 L50 25 M14 42 L29 39 M33 39 L48 42" stroke="#fef08a" stroke-width="1.5"/>
    </svg>
  `),

  // 4. PANTS — Royal Pharaoh Shendyt & Golden Greaves (Царский Шендит и Поножи Рамзеса)
  pants: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="pGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="pGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="50%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#92400e"/>
        </linearGradient>
        <linearGradient id="pLapis" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#1e3a8a"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#pGlow)"/>
      <!-- Royal Cartouche Belt -->
      <rect x="16" y="10" width="32" height="7" rx="2.5" fill="url(#pGold)" stroke="#fef08a" stroke-width="1.5"/>
      <ellipse cx="32" cy="13.5" rx="5" ry="2.2" fill="#ef4444" stroke="#fef08a" stroke-width="1"/>
      <!-- Pleated Shendyt Kilt -->
      <path d="M16 17 L48 17 L54 38 L37 38 L32 28 L27 38 L10 38 Z" fill="#fef3c7" stroke="url(#pGold)" stroke-width="1.8"/>
      <!-- Central Royal Apron with Uraeus Cobras -->
      <path d="M27 17 L37 17 L39 42 L32 46 L25 42 Z" fill="url(#pLapis)" stroke="url(#pGold)" stroke-width="1.6"/>
      <path d="M29 22 H35 M28 27 H36 M28 32 H36 M29 37 H35" stroke="#fef08a" stroke-width="1.4"/>
      <!-- Golden Armored Greaves (Shin Guards) -->
      <path d="M15 38 L25 38 L23 55 L14 55 Z M39 38 L49 38 L50 55 L41 55 Z" fill="url(#pGold)" stroke="#fef08a" stroke-width="1.4"/>
      <path d="M17 42 L23 42 M41 42 L47 42" stroke="#0284c7" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `),

  // 5. BOOTS — Winged Golden Sandals of Horus & Thoth (Золотые Крылатые Сандалии Гора)
  boots: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="bGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="bGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="50%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#92400e"/>
        </linearGradient>
        <linearGradient id="bTurq" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2dd4bf"/>
          <stop offset="100%" stop-color="#0f766e"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#bGlow)"/>
      <!-- Falcon Wing Behind Boot -->
      <path d="M14 28 C6 22 6 14 17 16 C14 11 21 8 28 14 L26 30 Z" fill="url(#bTurq)" stroke="#fef08a" stroke-width="1.3"/>
      <!-- Royal Egyptian Greave & Sandal Shaft -->
      <path d="M22 14 L37 14 L35 42 L48 44 C54 44 57 38 54 34 C59 36 60 46 52 51 L18 51 L20 34 Z" fill="url(#bGold)" stroke="#fef08a" stroke-width="1.8"/>
      <!-- Lapis & Turquoise Straps -->
      <path d="M22 20 H36 M21 27 H35 M20 34 H35" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Sun Gem on Ankle -->
      <circle cx="29" cy="42" r="3.5" fill="#ef4444" stroke="#fef08a" stroke-width="1.2"/>
      <!-- Golden Sole -->
      <path d="M16 51 H53" stroke="#fef08a" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `),

  // 6. RING — Sacred Winged Scarab & Ankh Signet Ring of Ra (Перстень Скарабея и Ока Ра)
  ring: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="rGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#a855f7" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="rGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="50%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#92400e"/>
        </linearGradient>
        <linearGradient id="rScarab" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2dd4bf"/>
          <stop offset="50%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#1e1b4b"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#rGlow)"/>
      <!-- Heavy Golden Ring Band -->
      <circle cx="32" cy="36" r="16" stroke="url(#rGold)" stroke-width="6" fill="none"/>
      <circle cx="32" cy="36" r="19" stroke="#fef08a" stroke-width="1" stroke-opacity="0.6" fill="none"/>
      <!-- Winged Gold Mount -->
      <path d="M12 22 L24 20 L22 27 L10 26 Z M52 22 L40 20 L42 27 L54 26 Z" fill="url(#rGold)" stroke="#fef08a" stroke-width="1"/>
      <!-- Royal Scarab Jewel at Crown of Ring -->
      <ellipse cx="32" cy="21" rx="8.5" ry="10.5" fill="url(#rScarab)" stroke="#fef08a" stroke-width="2"/>
      <!-- Scarab Wing Division Lines -->
      <path d="M24 19 H40 M32 19 V31" stroke="#fef08a" stroke-width="1.4"/>
      <!-- Solar Disk above Scarab -->
      <circle cx="32" cy="9" r="3.5" fill="#ef4444" stroke="#fef08a" stroke-width="1.2"/>
    </svg>
  `)
};

/**
 * SVG Icon for the Killer License (Лицензия киллера) — Ancient Egyptian Blood-Gold Papyrus Decree & Khopesh
 */
export const KILLER_LICENSE_SVG = svgToDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
    <defs>
      <radialGradient id="klGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ef4444" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="klPapyrus" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fde68a"/>
        <stop offset="50%" stop-color="#d97706"/>
        <stop offset="100%" stop-color="#78350f"/>
      </linearGradient>
      <linearGradient id="klCrimson" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f87171"/>
        <stop offset="50%" stop-color="#dc2626"/>
        <stop offset="100%" stop-color="#7f1d1d"/>
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="29" fill="url(#klGlow)"/>
    <!-- Royal Papyrus Scroll -->
    <rect x="14" y="10" width="36" height="44" rx="4" fill="url(#klPapyrus)" stroke="#fef08a" stroke-width="2"/>
    <rect x="10" y="8" width="44" height="5" rx="2.5" fill="#b45309" stroke="#fef08a" stroke-width="1.3"/>
    <rect x="10" y="51" width="44" height="5" rx="2.5" fill="#b45309" stroke="#fef08a" stroke-width="1.3"/>
    <!-- Crimson Seal of Anubis / Crossed Blades -->
    <circle cx="32" cy="30" r="11" fill="url(#klCrimson)" stroke="#fef08a" stroke-width="1.8"/>
    <path d="M25 37 L39 23 M25 23 L39 37" stroke="#fef08a" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="32" cy="30" r="3" fill="#fef08a"/>
    <!-- Hieroglyph Lines -->
    <path d="M20 45 H44 M24 48.5 H40" stroke="#7f1d1d" stroke-width="2" stroke-linecap="round"/>
  </svg>
`);

/**
 * SVG Icon for the Killer Achievement (Достижение «Киллер») — Golden Jackal/Skull Medallion of Set & Anubis
 */
export const KILLER_ACHIEVEMENT_SVG = svgToDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
    <defs>
      <radialGradient id="kaGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ef4444" stop-opacity="0.6"/>
        <stop offset="60%" stop-color="#f59e0b" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="kaGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="50%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#92400e"/>
      </linearGradient>
      <linearGradient id="kaRuby" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ef4444"/>
        <stop offset="100%" stop-color="#7f1d1d"/>
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="29" fill="url(#kaGlow)"/>
    <!-- Winged Medallion Base -->
    <path d="M6 26 L22 22 L18 36 L8 34 Z M58 26 L42 22 L46 36 L56 34 Z" fill="url(#kaGold)" stroke="#fef08a" stroke-width="1.2"/>
    <polygon points="32,8 50,18 46,44 32,56 18,44 14,18" fill="url(#kaRuby)" stroke="url(#kaGold)" stroke-width="2.5"/>
    <!-- Crossed Golden Khopesh Swords -->
    <path d="M18 46 L46 18 M46 46 L18 18" stroke="#fef08a" stroke-width="3" stroke-linecap="round"/>
    <!-- Pharaoh Anubis Crown Center -->
    <circle cx="32" cy="32" r="9" fill="url(#kaGold)" stroke="#fff" stroke-width="1.5"/>
    <circle cx="29" cy="31" r="1.8" fill="#dc2626"/>
    <circle cx="35" cy="31" r="1.8" fill="#dc2626"/>
    <path d="M29 36 H35" stroke="#7f1d1d" stroke-width="2" stroke-linecap="round"/>
  </svg>
`);

const GENERIC_EQUIPMENT_EMOJIS = new Set([
  '⚔️',
  '🗡️',
  '🪓',
  '🔱',
  '🔥',
  '⚡',
  '🛡️',
  '🦺',
  '👖',
  '👟',
  '👢',
  '🥾',
  '🧤',
  '💍'
]);

/**
 * Infers equipment slot from item name or generic emoji so all equipment renders in Egyptian style.
 */
export function inferSlotFromItemIconOrName(icon?: string | null, name?: string | null, slot?: ItemSlot): ItemSlot | null {
  if (slot && EGYPTIAN_SLOT_SVGS[slot]) return slot;
  const n = String(name || '').toLowerCase();
  if (
    n.includes('меч') ||
    n.includes('клин') ||
    n.includes('хопеш') ||
    n.includes('кхопеш') ||
    n.includes('секир') ||
    n.includes('скипетр') ||
    n.includes('копь') ||
    n.includes('серп') ||
    n.includes('жезл') ||
    n.includes('посох') ||
    n.includes('лучезар')
  ) {
    return 'weapon';
  }
  if (
    n.includes('доспех') ||
    n.includes('панцир') ||
    n.includes('кирас') ||
    n.includes('латы') ||
    n.includes('брон') ||
    n.includes('манти') ||
    n.includes('одеян') ||
    n.includes('нагруд') ||
    n.includes('жилет')
  ) {
    return 'armor';
  }
  if (
    n.includes('штан') ||
    n.includes('понож') ||
    n.includes('набедр') ||
    n.includes('шенти') ||
    n.includes('шендит')
  ) {
    return 'pants';
  }
  if (
    n.includes('сапог') ||
    n.includes('сандал') ||
    n.includes('ботфорт') ||
    n.includes('башмак') ||
    n.includes('поступь')
  ) {
    return 'boots';
  }
  if (
    n.includes('перчат') ||
    n.includes('наруч') ||
    n.includes('рукавиц') ||
    n.includes('браслет') ||
    n.includes('обмотк') ||
    n.includes('длан')
  ) {
    return 'gloves';
  }
  if (
    n.includes('кольц') ||
    n.includes('перстен') ||
    n.includes('печатк') ||
    n.includes('око ')
  ) {
    return 'ring';
  }

  const trimmed = String(icon || '').trim();
  if (trimmed === '⚔️' || trimmed === '🗡️' || trimmed === '🪓' || trimmed === '🔱') return 'weapon';
  if (trimmed === '🛡️' || trimmed === '🦺') return 'armor';
  if (trimmed === '👖') return 'pants';
  if (trimmed === '👟' || trimmed === '👢' || trimmed === '🥾') return 'boots';
  if (trimmed === '🧤') return 'gloves';
  if (trimmed === '💍') return 'ring';
  return null;
}

export function resolveEgyptianEquipmentIcon(
  icon?: string | null,
  name?: string | null,
  slot?: ItemSlot
): string | null {
  const trimmed = String(icon || '').trim();
  // Keep custom uploaded or explicit asset images (unless it's a generic emoji)
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('assets/')
  ) {
    return trimmed;
  }
  const inferred = inferSlotFromItemIconOrName(trimmed, name, slot);
  if (inferred && (GENERIC_EQUIPMENT_EMOJIS.has(trimmed) || !trimmed || Boolean(slot) || Boolean(name))) {
    return EGYPTIAN_SLOT_SVGS[inferred];
  }
  return null;
}

// ============================================================================
// ЛИЦЕНЗИЯ КИЛЛЕРА И ДОСТИЖЕНИЕ «КИЛЛЕР» (1-5 УР.)
// ============================================================================

export const KILLER_LICENSE_CONFIG = {
  id: 'killer_license_1d',
  name: 'Лицензия киллера (Рецензия киллера)',
  shortName: 'Лицензия киллера',
  priceCrystals: 10,
  costCrystals: 10,
  durationMs: 24 * 60 * 60 * 1000, // 1 день (24 часа)
  durationDays: 1,
  durationLabel: '1 дн.',
  icon: KILLER_LICENSE_SVG,
  description:
    'Древний указ Фараона и Анубиса, дающий право вершить суд внутри Пирамиды в течение 1 дня (24 часов). С активной лицензией вы можете нападать и убивать других игроков ТОЛЬКО внутри Пирамиды (нападать с главного экрана Города или из Рейтинга запрещено). Разрешено убивать одного и того же игрока неограниченное количество раз! Каждое убийство засчитывается в прогресс достижения «Киллер» (до +500 ❤️ HP навсегда).'
};

export interface KillerAchievementTier {
  level: number;
  requiredKills: number;
  killsRequired: number;
  hpBonusPerLevel: number;
  totalHpBonus: number;
  title: string;
  rankName: string;
}

export const KILLER_ACHIEVEMENT_LEVELS: KillerAchievementTier[] = [
  {
    level: 1,
    requiredKills: 10,
    killsRequired: 10,
    hpBonusPerLevel: 100,
    totalHpBonus: 100,
    title: 'Киллер 1 ур.',
    rankName: 'Охотник Песков'
  },
  {
    level: 2,
    requiredKills: 50,
    killsRequired: 50,
    hpBonusPerLevel: 100,
    totalHpBonus: 200,
    title: 'Киллер 2 ур.',
    rankName: 'Клинок Анубиса'
  },
  {
    level: 3,
    requiredKills: 100,
    killsRequired: 100,
    hpBonusPerLevel: 100,
    totalHpBonus: 300,
    title: 'Киллер 3 ур.',
    rankName: 'Палач Пирамиды'
  },
  {
    level: 4,
    requiredKills: 250,
    killsRequired: 250,
    hpBonusPerLevel: 100,
    totalHpBonus: 400,
    title: 'Киллер 4 ур.',
    rankName: 'Жнец Дуата'
  },
  {
    level: 5,
    requiredKills: 500,
    killsRequired: 500,
    hpBonusPerLevel: 100,
    totalHpBonus: 500,
    title: 'Киллер 5 ур. (МАКС)',
    rankName: 'Владыка Кровавой Пирамиды'
  }
];

export const KILLER_ACHIEVEMENT_DESCRIPTION =
  'Боевое достижение охотника за головами в Пирамиде (макс. 5 уровень). За каждый полученный уровень достижения ваше максимальное здоровье увеличивается на +100 ❤️ HP НАВСЕГДА (до +500 ❤️ HP на 5 уровне). В зачёт идут убийства игроков внутри Пирамиды при активной Лицензии киллера. Разрешено убивать одного и того же игрока многократно.';

export interface KillerAchievementStatus {
  kills: number;
  level: number;
  maxLevel: number;
  isMaxLevel: boolean;
  totalHpBonus: number;
  currentTier: KillerAchievementTier | null;
  nextTier: KillerAchievementTier | null;
  nextTargetKills: number;
  nextKillsRequired: number;
  killsRemainingForNext: number;
  progressPct: number;
}

export function getKillerAchievementInfo(rawPvpKills?: number | null): KillerAchievementStatus {
  const kills = Math.max(0, Math.floor(Number(rawPvpKills) || 0));
  let currentLevel = 0;
  let currentTier: KillerAchievementTier | null = null;

  for (const tier of KILLER_ACHIEVEMENT_LEVELS) {
    if (kills >= tier.requiredKills) {
      currentLevel = tier.level;
      currentTier = tier;
    }
  }

  const nextTier =
    KILLER_ACHIEVEMENT_LEVELS.find((t) => t.level === currentLevel + 1) || null;
  const totalHpBonus = currentLevel * 100;
  const prevTarget = currentTier ? currentTier.requiredKills : 0;
  const nextTargetKills = nextTier ? nextTier.requiredKills : 500;
  const nextKillsRequired = nextTargetKills;
  const isMaxLevel = currentLevel >= 5;
  const killsRemainingForNext = Math.max(0, nextKillsRequired - kills);

  let progressPct = 100;
  if (nextTier) {
    const span = Math.max(1, nextTier.requiredKills - prevTarget);
    const done = Math.max(0, kills - prevTarget);
    progressPct = Math.max(0, Math.min(100, Math.round((done / span) * 100)));
  }

  return {
    kills,
    level: currentLevel,
    maxLevel: 5,
    isMaxLevel,
    totalHpBonus,
    currentTier,
    nextTier,
    nextTargetKills,
    nextKillsRequired,
    killsRemainingForNext,
    progressPct
  };
}

export function formatLicenseRemainingTime(untilMs?: number | null, nowMs: number = Date.now()): string {
  const rem = Math.max(0, Number(untilMs || 0) - nowMs);
  if (rem <= 0) return 'Истекла';
  const totalSec = Math.ceil(rem / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) {
    return `${days}д ${pad(hours)}ч ${pad(mins)}м`;
  }
  return `${pad(hours)}ч ${pad(mins)}м ${pad(secs)}с`;
}
