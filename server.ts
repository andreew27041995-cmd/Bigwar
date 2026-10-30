import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

const execAsync = promisify(exec);
const fileBackups = new Map<string, string>();

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Shared Gemini Client utility
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// System instruction explaining the game database and full admin control tools
const ADMIN_AI_SYSTEM_INSTRUCTION = `
Ты — Главный ИИ-Архитектор и Полноправный Административный Ассистент онлайн-игры «Пирамида: Войны» (на базе флагманского ядра Argon 4 / gemini-4-argon).
У тебя есть ПОЛНЫЕ права программного управления игрой, базой данных Supabase и всеми серверными и игровыми конфигурациями по запросу Главного Администратора.

Твои принципы работы:
1. ПОЛНОЕ И ТОЧНОЕ ИСПОЛНЕНИЕ: Если администратор дает составную или сложную команду (например: «Выдай игроку RedBlack 1000 кристаллов, 50000 золота, 10 уровень, лицензию киллера и почини вещи» или «Раздай всем игрокам по 500 кристаллов и измени курс обмена на 500 золота»), ты вызываешь ВСЕ необходимые инструменты (function calls) сразу за один ход.
2. БЕЗ ОШИБОК И БЕЗ УРЕЗКИ ДАННЫХ: Все изменения применяются атомарно поверх текущих профилей игроков и конфигураций игры, никогда не стирая и не урезая существующий прогресс, экипировку или таблицы.
3. УМНЫЙ АНАЛИЗ И ДОРАБОТКА: Ты понимаешь любые формулировки на русском и английском языках (сленг, сокращения: «голда», «кри», «лвл», «п1/п2/п3», «випка», «киллерка», «модерка», «админка», «кд боссов», «статы монстров»).

Сущности игры под твоим полным контролем:
- Игроки (public.players): золото, кристаллы, уровень (1-20), опыт, сила/ловкость/живучесть/свободные очки, HP/MaxHP, Энергия/MaxEnergy, бонусный урон/HP, вместимость сумки, зелья (HP/EN/EXP), лицензии киллера (штуки и активные часы), карточки перехода Пирамид (П1, П2, П3), роли (admin, mod, regular), VIP-статус, баны/муты, починка всех вещей на 100%, выдача/создание любых предметов экипировки с кастомными статами, выдача автономного NPC-стража.
- Массовые операции (massManageAllPlayers): начисление золота, кристаллов, VIP-статуса, зелий, починка вещей или пересчет уровней/опыта ВСЕМ игрокам сервера одновременно.
- Экономика, Магазин и Флаги игры (manageGameEconomyAndConfig): курс обмена кристаллов на золото, стоимость рулетки, время респавна боссов, включение/отключение модулей (рулетка, NPC, кланы, обменник, создание предметов), изменение цен в магазине.
- Монстры и Боссы (manageMonstersAndBosses): изменение HP, урона, золота и опыта любого монстра или босса, мгновенный спавн всех боссов в Т1/Т2/Т3, призыв портала, перегенерация карт пирамид.
- Кланы и Территории (manageClansAndTerritory): пополнение казны клана (золото/кристаллы), изменение уровня клана, передача контроля над Клановой Пирамидой, сброс очков клановой битвы.
- Почта и Чат (sendSystemMailOrGift, serverChatAction): отправка системных писем с подарками (золото, кристаллы) конкретному игроку или всем игрокам, глобальные объявления в чат, очистка чата.
- ИИ-ПРОГРАММИСТ И РАЗРАБОТКА КОДА (inspectProjectFile, proposeOrApplyCodePatch, generateCodeSolution):
  Ты также являешься Senior Full-Stack разработчиком (TypeScript, React 19, Tailwind CSS, Express, PostgreSQL / Supabase).
  Если администратор просит:
  • Написать новый код, функцию, компонент, предмет магазина, монстра, механику или SQL-миграцию — используй generateCodeSolution и/или покажи чистый, готовый к работе код в блоках \`\`\`tsx или \`\`\`sql.
  • Прочитать или найти код в файлах проекта (например, src/App.tsx, src/utils/shopConfig.ts, src/utils/gameData.ts, src/components/PyramidScreen.tsx) — используй inspectProjectFile.
  • Внести точечное изменение (патч) в файл проекта без ошибок и без урезки других строк — используй proposeOrApplyCodePatch (передавай точный фрагмент targetContent и замену replacementContent).

Всегда отвечай профессионально, подробно объясняй архитектурные решения и перечисляй все выполненные операции на русском языке.
`;

const ADMIN_TOOL_DECLARATIONS = [
  {
    name: 'modifyPlayerBalanceOrStats',
    description: 'Полное управление профилем игрока: баланс (золото, кристаллы), уровень, опыт, характеристики, здоровье, энергия, эликсиры (HP/EN/EXP), лицензии киллера, карточки пирамид (П1/П2/П3), роли (admin/mod/regular), VIP-статус, NPC-страж, ремонт всех вещей.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetNick: {
          type: Type.STRING,
          description: 'Никнейм игрока (например, RedBlack, марина и т.д.)',
        },
        goldDelta: {
          type: Type.NUMBER,
          description: 'Изменение золота (+/- N). Например, +50000 или -1000',
        },
        setGold: {
          type: Type.NUMBER,
          description: 'Точная установка золота игрока (абсолютное значение)',
        },
        crystalsDelta: {
          type: Type.NUMBER,
          description: 'Изменение кристаллов (+/- N). Например, +1000 или -50',
        },
        setCrystals: {
          type: Type.NUMBER,
          description: 'Точная установка кристаллов игрока (абсолютное значение)',
        },
        setLevel: {
          type: Type.INTEGER,
          description: 'Новый уровень игрока (от 1 до 20)',
        },
        addExp: {
          type: Type.NUMBER,
          description: 'Добавить указанное количество опыта',
        },
        setExp: {
          type: Type.NUMBER,
          description: 'Установить точное значение опыта',
        },
        setStr: {
          type: Type.INTEGER,
          description: 'Установить силу персонажа',
        },
        setAgi: {
          type: Type.INTEGER,
          description: 'Установить ловкость персонажа',
        },
        setVit: {
          type: Type.INTEGER,
          description: 'Установить живучесть персонажа',
        },
        setStatPoints: {
          type: Type.INTEGER,
          description: 'Установить свободные очки характеристик',
        },
        setHp: {
          type: Type.INTEGER,
          description: 'Установить текущее здоровье HP',
        },
        setMaxHp: {
          type: Type.INTEGER,
          description: 'Установить максимальное здоровье Max HP',
        },
        setEnergy: {
          type: Type.INTEGER,
          description: 'Установить текущую энергию',
        },
        setMaxEnergy: {
          type: Type.INTEGER,
          description: 'Установить максимальную энергию',
        },
        setBonusDmg: {
          type: Type.INTEGER,
          description: 'Установить бонусный урон персонажа',
        },
        setBonusHp: {
          type: Type.INTEGER,
          description: 'Установить бонусное здоровье персонажа',
        },
        setBagCapacity: {
          type: Type.INTEGER,
          description: 'Установить вместимость сумки (например, 100, 200)',
        },
        grantVipDays: {
          type: Type.INTEGER,
          description: 'Выдать VIP/Премиум статус на указанное количество дней (например, 7, 30)',
        },
        revokeVip: {
          type: Type.BOOLEAN,
          description: 'Отозвать VIP/Премиум статус у игрока',
        },
        setHpPotions: {
          type: Type.INTEGER,
          description: 'Установить количество эликсиров жизни (HP)',
        },
        setEnPotions: {
          type: Type.INTEGER,
          description: 'Установить количество эликсиров энергии (EN)',
        },
        setExpPotions: {
          type: Type.INTEGER,
          description: 'Установить количество эликсиров опыта (EXP)',
        },
        setKillerLicenses: {
          type: Type.INTEGER,
          description: 'Установить количество лицензий киллера в инвентаре (шт.)',
        },
        activateKillerLicenseHours: {
          type: Type.NUMBER,
          description: 'Активировать лицензию киллера на указанное количество часов (например, 24). 0 = снять.',
        },
        setPyramidCard1: {
          type: Type.INTEGER,
          description: 'Установить количество карточек перехода Пирамиды 1 (П1)',
        },
        setPyramidCard2: {
          type: Type.INTEGER,
          description: 'Установить количество карточек перехода Пирамиды 2 (П2)',
        },
        setPyramidCard3: {
          type: Type.INTEGER,
          description: 'Установить количество карточек перехода Пирамиды 3 (П3)',
        },
        grantNpcCompanion: {
          type: Type.BOOLEAN,
          description: 'Выдать или активировать автономного NPC-стража игроку',
        },
        repairAllItems: {
          type: Type.BOOLEAN,
          description: 'Починить все предметы экипировки и вещи в сумке игрока на 100%',
        },
        resetRoulette: {
          type: Type.BOOLEAN,
          description: 'Сбросить суточные попытки и таймер рулетки, выдав бесплатную прокрутку',
        },
        resetExchange: {
          type: Type.BOOLEAN,
          description: 'Сбросить суточные лимиты обмена кристаллов и золота',
        },
        setRole: {
          type: Type.STRING,
          description: 'Установить роль: "admin" (администратор), "mod" (модератор) или "regular" (обычный игрок)',
        },
      },
      required: ['targetNick'],
    },
  },
  {
    name: 'grantItemToPlayer',
    description: 'Создает и выдает игроку предмет экипировки (оружие, доспех, штаны, сапоги, перчатки или кольцо) с возможностью задать кастомный урон, HP, уворот, энергию и бонусы.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetNick: {
          type: Type.STRING,
          description: 'Никнейм игрока',
        },
        slot: {
          type: Type.STRING,
          description: 'Слот предмета: "weapon", "armor", "pants", "boots", "gloves", "ring"',
        },
        quality: {
          type: Type.STRING,
          description: 'Качество предмета: "common", "uncommon", "rare", "epic", "legendary", "mythic"',
        },
        level: {
          type: Type.INTEGER,
          description: 'Уровень предмета (от 1 до 20)',
        },
        itemName: {
          type: Type.STRING,
          description: 'Название предмета (например, Клинок Анубиса, Доспех Ра)',
        },
        customDmg: {
          type: Type.INTEGER,
          description: 'Кастомный урон предмета (если указан)',
        },
        customHp: {
          type: Type.INTEGER,
          description: 'Кастомный бонус HP предмета (если указан)',
        },
        customDodge: {
          type: Type.INTEGER,
          description: 'Кастомный бонус уворота % (если указан)',
        },
        customEnergy: {
          type: Type.INTEGER,
          description: 'Кастомный бонус энергии (если указан)',
        },
        equipImmediately: {
          type: Type.BOOLEAN,
          description: 'Сразу надеть на персонажа или положить в инвентарь',
        },
      },
      required: ['targetNick', 'slot'],
    },
  },
  {
    name: 'massManageAllPlayers',
    description: 'Массовое действие для ВСЕХ игроков сервера: раздача золота, кристаллов, VIP-статуса, зелий, починка всех вещей или глобальный пересчет уровней по таблице опыта.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        goldDelta: {
          type: Type.NUMBER,
          description: 'Выдать всем игрокам указанное количество золота',
        },
        crystalsDelta: {
          type: Type.NUMBER,
          description: 'Выдать всем игрокам указанное количество кристаллов',
        },
        grantVipDays: {
          type: Type.INTEGER,
          description: 'Выдать всем игрокам VIP-статус на N дней',
        },
        addHpPotions: {
          type: Type.INTEGER,
          description: 'Выдать всем игрокам N эликсиров жизни',
        },
        addEnPotions: {
          type: Type.INTEGER,
          description: 'Выдать всем игрокам N эликсиров энергии',
        },
        addExpPotions: {
          type: Type.INTEGER,
          description: 'Выдать всем игрокам N эликсиров опыта',
        },
        repairAllForEveryone: {
          type: Type.BOOLEAN,
          description: 'Починить все предметы всем игрокам сервера на 100%',
        },
        recalculateLevels: {
          type: Type.BOOLEAN,
          description: 'Пересчитать уровни и характеристики всех игроков по таблице опыта EXP_TABLE',
        },
      },
    },
  },
  {
    name: 'manageGameEconomyAndConfig',
    description: 'Изменяет глобальные настройки экономики, курсов обмена, рулетки, таймеров боссов, NPC-стражей и модулей игры.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        crystalToGoldRate: {
          type: Type.INTEGER,
          description: 'Курс обмена 1 кристалла в золото (по умолчанию 300)',
        },
        goldToCrystalRate: {
          type: Type.INTEGER,
          description: 'Курс покупки 1 кристалла за золото (по умолчанию 500)',
        },
        rouletteSpinCostGold: {
          type: Type.INTEGER,
          description: 'Стоимость платного вращения рулетки в золоте',
        },
        bossRespawnIntervalSec: {
          type: Type.INTEGER,
          description: 'Интервал респавна боссов в секундах (например, 900 = 15 мин)',
        },
        npcMinLevel: {
          type: Type.INTEGER,
          description: 'Минимальный уровень для покупки NPC-стража',
        },
        npcPriceCrystals: {
          type: Type.INTEGER,
          description: 'Цена покупки NPC-стража в кристаллах',
        },
        rouletteEnabled: {
          type: Type.BOOLEAN,
          description: 'Включить или отключить Рулетку',
        },
        npcCompanionsEnabled: {
          type: Type.BOOLEAN,
          description: 'Включить или отключить систему NPC-стражей',
        },
      },
    },
  },
  {
    name: 'manageMonstersAndBosses',
    description: 'Изменяет характеристики монстров или боссов (HP, урон, награда золотом и опытом) в конфигурации игры.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        monsterName: {
          type: Type.STRING,
          description: 'Имя монстра или босса (или "ALL_BOSSES" / "ALL_MOBS")',
        },
        setHp: {
          type: Type.INTEGER,
          description: 'Установить HP монстра/босса',
        },
        setDmg: {
          type: Type.INTEGER,
          description: 'Установить урон монстра/босса',
        },
        setExpReward: {
          type: Type.INTEGER,
          description: 'Установить награду опытом',
        },
        setGoldMax: {
          type: Type.INTEGER,
          description: 'Установить максимальную награду золотом',
        },
      },
      required: ['monsterName'],
    },
  },
  {
    name: 'manageClansAndTerritory',
    description: 'Управляет кланами: пополнение казны клана (золото, кристаллы), уровень клана, назначение владельца Клановой Пирамиды или сброс очков.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        clanNameOrTag: {
          type: Type.STRING,
          description: 'Название или тег клана',
        },
        addTreasuryGold: {
          type: Type.NUMBER,
          description: 'Добавить золото в казну клана',
        },
        addTreasuryCrystals: {
          type: Type.NUMBER,
          description: 'Добавить кристаллы в казну клана',
        },
        setClanLevel: {
          type: Type.INTEGER,
          description: 'Установить уровень клана (1-5)',
        },
        setAsPyramidOwner: {
          type: Type.BOOLEAN,
          description: 'Назначить этот клан владельцем Клановой Пирамиды',
        },
        resetPyramidScores: {
          type: Type.BOOLEAN,
          description: 'Сбросить очки битвы за Клановую Пирамиду',
        },
      },
    },
  },
  {
    name: 'sendSystemMailOrGift',
    description: 'Отправляет системное письмо по игровой почте (с вложением золота или кристаллов) конкретному игроку или ВСЕМ игрокам ("ALL").',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetNick: {
          type: Type.STRING,
          description: 'Никнейм получателя или "ALL" для рассылки всем игрокам',
        },
        message: {
          type: Type.STRING,
          description: 'Текст письма от Администрации',
        },
        giftGold: {
          type: Type.NUMBER,
          description: 'Количество золота во вложении подарка',
        },
        giftCrystals: {
          type: Type.NUMBER,
          description: 'Количество кристаллов во вложении подарка',
        },
      },
      required: ['targetNick', 'message'],
    },
  },
  {
    name: 'managePlayerBanAndRestrictions',
    description: 'Управляет баном игрока (мут чата, полный бан или снятие наказания).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetNick: {
          type: Type.STRING,
          description: 'Никнейм игрока',
        },
        unban: {
          type: Type.BOOLEAN,
          description: 'Снять все баны и мут с игрока',
        },
        blockChat: {
          type: Type.BOOLEAN,
          description: 'Заблокировать доступ к чату (мут)',
        },
        blockFullAccess: {
          type: Type.BOOLEAN,
          description: 'Полный бан аккаунта',
        },
        durationHours: {
          type: Type.NUMBER,
          description: 'Длительность бана в часах (например, 1, 24, 72). Если 0 или не указано — навсегда',
        },
        isPermanent: {
          type: Type.BOOLEAN,
          description: 'Бессрочный постоянный бан',
        },
        reason: {
          type: Type.STRING,
          description: 'Причина бана (спам, мат, читы и т.д.)',
        },
      },
      required: ['targetNick'],
    },
  },
  {
    name: 'serverLocationAndBossAction',
    description: 'Управляет спавном боссов, сбросом локаций пирамид или событиями карты.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: 'Действие: "spawn_all_bosses", "reset_pyramid_t1", "reset_pyramid_t2", "reset_pyramid_t3", "spawn_portal", "reset_all_maps"',
        },
        tier: {
          type: Type.INTEGER,
          description: 'Номер пирамиды (1, 2, 3) если применимо',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'serverChatAction',
    description: 'Управляет системным и мировым чатом игры (очистка, объявление от администрации).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: 'Действие: "clear_all_chat", "clear_recent_chat", "broadcast_announcement"',
        },
        recentMinutes: {
          type: Type.INTEGER,
          description: 'За сколько минут очистить чат (например, 2 или 3)',
        },
        broadcastMessage: {
          type: Type.STRING,
          description: 'Текст системного оповещения для всех онлайн игроков',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'resetStadiumAndPvPStats',
    description: 'Сбрасывает PvP-статистику матчей, арены или стадиона у указанного игрока или всех игроков.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetNick: {
          type: Type.STRING,
          description: 'Никнейм конкретного игрока, или "ALL" для сброса всем игрокам',
        },
        resetWins: {
          type: Type.BOOLEAN,
          description: 'Сбросить победы',
        },
        resetLosses: {
          type: Type.BOOLEAN,
          description: 'Сбросить поражения',
        },
        resetKills: {
          type: Type.BOOLEAN,
          description: 'Сбросить PvP-убийства',
        },
      },
      required: ['targetNick'],
    },
  },
  {
    name: 'queryPlayerInformation',
    description: 'Запрашивает полную карточку и статус игрока из базы данных Supabase.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetNick: {
          type: Type.STRING,
          description: 'Никнейм игрока для поиска',
        },
      },
      required: ['targetNick'],
    },
  },
  {
    name: 'inspectProjectFile',
    description: 'Читает исходный код файла проекта (например, src/utils/shopConfig.ts, src/App.tsx) или ищет текст по кодовой базе для помощи в программировании.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: 'Относительный путь к файлу (например, src/utils/shopConfig.ts, src/utils/monsterConfig.ts, src/App.tsx)',
        },
        searchQuery: {
          type: Type.STRING,
          description: 'Строка поиска внутри файла или по проекту',
        },
        startLine: {
          type: Type.INTEGER,
          description: 'Начальная строка чтения (1-indexed)',
        },
        endLine: {
          type: Type.INTEGER,
          description: 'Конечная строка чтения',
        },
      },
    },
  },
  {
    name: 'proposeOrApplyCodePatch',
    description: 'Предлагает или безопасно применяет точечный патч в исходный файл проекта (замена targetContent на replacementContent) БЕЗ урезки остального файла.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: {
          type: Type.STRING,
          description: 'Путь к файлу (например, src/utils/shopConfig.ts)',
        },
        description: {
          type: Type.STRING,
          description: 'Краткое описание того, что делает этот патч кода',
        },
        targetContent: {
          type: Type.STRING,
          description: 'Точный фрагмент существующего кода для замены',
        },
        replacementContent: {
          type: Type.STRING,
          description: 'Новый фрагмент кода, который заменит targetContent',
        },
        autoApply: {
          type: Type.BOOLEAN,
          description: 'Применить ли патч сразу на сервере (true) или предложить для ревью (false)',
        },
      },
      required: ['filePath', 'description', 'targetContent', 'replacementContent'],
    },
  },
  {
    name: 'generateCodeSolution',
    description: 'Генерирует готовый программный модуль, React-компонент, функцию TypeScript, предмет магазина, конфигурацию монстра или SQL-скрипт.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Название решения или фичи',
        },
        language: {
          type: Type.STRING,
          description: 'Язык программирования: "typescript", "tsx", "sql", "json"',
        },
        filePath: {
          type: Type.STRING,
          description: 'Рекомендуемый файл проекта для вставки кода',
        },
        code: {
          type: Type.STRING,
          description: 'Полный чистый исходный код решения без сокращений',
        },
        explanation: {
          type: Type.STRING,
          description: 'Пошаговое техническое объяснение работы кода',
        },
      },
      required: ['title', 'language', 'code'],
    },
  },
];

// Helper to resolve safe workspace paths
function resolveSafeProjectPath(relPath: string): string | null {
  const cleaned = String(relPath || '').replace(/^\/+/, '').trim();
  if (!cleaned || cleaned.includes('..') || cleaned.startsWith('.env') || cleaned.startsWith('node_modules')) {
    return null;
  }
  const full = path.resolve(__dirname, cleaned);
  if (!full.startsWith(__dirname)) return null;
  return full;
}

function listProjectSourceFiles(dir: string, baseDir: string = dir): { path: string; size: number; lines: number }[] {
  const results: { path: string; size: number; lines: number }[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules', '.git', 'docs', 'dist'].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      results.push(...listProjectSourceFiles(fullPath, baseDir));
    } else if (/\.(ts|tsx|css|sql|json|html)$/.test(entry.name) && !entry.name.startsWith('package-lock')) {
      try {
        const stat = fs.statSync(fullPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n').length;
        results.push({ path: relPath, size: stat.size, lines });
      } catch (e) {}
    }
  }
  return results;
}

// GET /api/admin/code/files — list all source files in workspace
app.get('/api/admin/code/files', (req, res) => {
  try {
    const files = listProjectSourceFiles(__dirname);
    return res.json({ files });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Ошибка чтения списка файлов' });
  }
});

// POST /api/admin/code/read — read file contents with optional line range
app.post('/api/admin/code/read', (req, res) => {
  try {
    const { filePath, startLine, endLine, isAdmin } = req.body;
    if (!isAdmin) return res.status(403).json({ error: 'Требуются права Администратора' });
    const safePath = resolveSafeProjectPath(filePath);
    if (!safePath || !fs.existsSync(safePath)) {
      return res.status(404).json({ error: `Файл «${filePath}» не найден` });
    }
    const raw = fs.readFileSync(safePath, 'utf-8');
    const allLines = raw.split('\n');
    const s = Math.max(1, Number(startLine || 1));
    const e = Math.min(allLines.length, Number(endLine || allLines.length));
    const sliced = allLines.slice(s - 1, e).join('\n');
    return res.json({
      filePath,
      totalLines: allLines.length,
      startLine: s,
      endLine: e,
      content: sliced,
      hasBackup: fileBackups.has(safePath),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Ошибка чтения файла' });
  }
});

// POST /api/admin/code/search — search across project files
app.post('/api/admin/code/search', (req, res) => {
  try {
    const { query, isAdmin } = req.body;
    if (!isAdmin) return res.status(403).json({ error: 'Требуются права Администратора' });
    const q = String(query || '').trim().toLowerCase();
    if (!q) return res.json({ matches: [] });

    const files = listProjectSourceFiles(__dirname);
    const matches: { filePath: string; line: number; text: string }[] = [];
    for (const f of files) {
      if (matches.length >= 60) break;
      const safePath = resolveSafeProjectPath(f.path);
      if (!safePath) continue;
      const lines = fs.readFileSync(safePath, 'utf-8').split('\n');
      lines.forEach((lineText, idx) => {
        if (matches.length < 60 && lineText.toLowerCase().includes(q)) {
          matches.push({
            filePath: f.path,
            line: idx + 1,
            text: lineText.trim().slice(0, 180),
          });
        }
      });
    }
    return res.json({ matches });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Ошибка поиска по коду' });
  }
});

// POST /api/admin/code/patch — safely apply a surgical patch without truncating the file
app.post('/api/admin/code/patch', (req, res) => {
  try {
    const { filePath, targetContent, replacementContent, fullFileContent, isAdmin } = req.body;
    if (!isAdmin) return res.status(403).json({ error: 'Требуются права Администратора' });
    const safePath = resolveSafeProjectPath(filePath);
    if (!safePath || !fs.existsSync(safePath)) {
      return res.status(404).json({ error: `Файл «${filePath}» не найден` });
    }
    const existing = fs.readFileSync(safePath, 'utf-8');

    let updated = existing;
    if (typeof fullFileContent === 'string' && fullFileContent.trim().length > 0) {
      // Anti-truncation safeguard: disallow accidental drastic shrinkage unless small file
      if (existing.length > 500 && fullFileContent.length < existing.length * 0.4) {
        return res.status(400).json({
          error: 'Защита от урезки файлов: новый контент слишком короткий по сравнению с исходным файлом. Используйте точечный патч (targetContent -> replacementContent).',
        });
      }
      updated = fullFileContent;
    } else {
      if (!targetContent || !existing.includes(targetContent)) {
        return res.status(400).json({
          error: `Целевой фрагмент кода (targetContent) не найден в файле «${filePath}». Проверьте точность строк.`,
        });
      }
      updated = existing.replace(targetContent, replacementContent ?? '');
    }

    fileBackups.set(safePath, existing);
    fs.writeFileSync(safePath, updated, 'utf-8');

    return res.json({
      success: true,
      filePath,
      previousLines: existing.split('\n').length,
      newLines: updated.split('\n').length,
      hasBackup: true,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Ошибка применения патча' });
  }
});

// POST /api/admin/code/undo — restore previous backup of a file
app.post('/api/admin/code/undo', (req, res) => {
  try {
    const { filePath, isAdmin } = req.body;
    if (!isAdmin) return res.status(403).json({ error: 'Требуются права Администратора' });
    const safePath = resolveSafeProjectPath(filePath);
    if (!safePath || !fileBackups.has(safePath)) {
      return res.status(400).json({ error: `Для файла «${filePath}» нет сохраненной резервной копии` });
    }
    const prevContent = fileBackups.get(safePath)!;
    fs.writeFileSync(safePath, prevContent, 'utf-8');
    fileBackups.delete(safePath);
    return res.json({
      success: true,
      filePath,
      restoredLines: prevContent.split('\n').length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Ошибка отката файла' });
  }
});

// POST /api/admin/code/typecheck — run tsc --noEmit to verify zero syntax/type errors
app.post('/api/admin/code/typecheck', async (req, res) => {
  try {
    const { isAdmin } = req.body;
    if (!isAdmin) return res.status(403).json({ error: 'Требуются права Администратора' });
    try {
      const { stdout, stderr } = await execAsync('npx tsc --noEmit', { cwd: __dirname, timeout: 25000 });
      return res.json({
        ok: true,
        output: (stdout || stderr || '✅ Проверка TypeScript (tsc --noEmit) пройдена успешно: 0 ошибок!').trim(),
      });
    } catch (tscErr: any) {
      return res.json({
        ok: false,
        output: String(tscErr?.stdout || tscErr?.stderr || tscErr?.message || 'Ошибка компиляции TypeScript').trim(),
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Ошибка запуска проверки типов' });
  }
});

// ==================== BOTS SIMULATION & AUTO-CHAT SERVER API ====================
const BOTS_DATA_FILE = path.join(__dirname, 'bot-simulation.json');

app.get('/api/bots/config', (req, res) => {
  try {
    if (fs.existsSync(BOTS_DATA_FILE)) {
      const raw = fs.readFileSync(BOTS_DATA_FILE, 'utf-8');
      return res.json(JSON.parse(raw));
    }
    return res.json({
      enabled: true,
      targetOnlineCount: 28,
      chatEnabled: true,
      chatMinDelaySec: 18,
      chatMaxDelaySec: 42,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Ошибка загрузки конфигурации ботов' });
  }
});

app.post('/api/bots/config', (req, res) => {
  try {
    const { config, isAdmin } = req.body;
    if (!isAdmin) return res.status(403).json({ error: 'Требуются права Администратора' });
    fs.writeFileSync(BOTS_DATA_FILE, JSON.stringify(config, null, 2), 'utf-8');
    return res.json({ success: true, config });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Ошибка сохранения конфигурации ботов' });
  }
});

// POST /api/admin/ai-assistant
app.post('/api/admin/ai-assistant', async (req, res) => {
  try {
    const { prompt, history, adminNick, isAdmin, activeCodeFile } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Параметр prompt обязателен' });
    }

    if (!isAdmin) {
      return res.status(403).json({ error: 'Доступ запрещен: требуются права Администратора' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY не настроен на сервере. Ассистент работает в локальном режиме исполнения команд и генерации кода.',
        fallbackLocal: true,
      });
    }

    // Prepare contents
    const contents: any[] = [];

    if (Array.isArray(history)) {
      for (const msg of history.slice(-8)) {
        if (msg.role === 'user' || msg.role === 'model') {
          contents.push({
            role: msg.role,
            parts: [{ text: String(msg.text || msg.content || '') }],
          });
        }
      }
    }

    let fileContextSnippet = '';
    if (activeCodeFile && typeof activeCodeFile === 'string') {
      const safePath = resolveSafeProjectPath(activeCodeFile);
      if (safePath && fs.existsSync(safePath)) {
        const raw = fs.readFileSync(safePath, 'utf-8');
        fileContextSnippet = `\n[Открытый файл в IDE: ${activeCodeFile} (первых 120 строк)]:\n\`\`\`tsx\n${raw.split('\n').slice(0, 120).join('\n')}\n\`\`\`\n`;
      }
    }

    contents.push({
      role: 'user',
      parts: [
        {
          text: `Главный Администратор: ${adminNick || 'Админ'}${fileContextSnippet}\nКоманда / Запрос: ${prompt}`,
        },
      ],
    });

    let response;
    let modelUsed = 'gemini-4-argon';
    try {
      response = await ai.models.generateContent({
        model: 'gemini-4-argon',
        contents,
        config: {
          systemInstruction: ADMIN_AI_SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: ADMIN_TOOL_DECLARATIONS }],
        },
      });
    } catch {
      modelUsed = 'gemini-3.8-flash';
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: ADMIN_AI_SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: ADMIN_TOOL_DECLARATIONS }],
        },
      });
    }

    const candidate = response.candidates?.[0];
    const textReply = response.text || '';
    const functionCalls = response.functionCalls || [];

    return res.json({
      reply: textReply,
      functionCalls,
      modelUsed,
      finishReason: candidate?.finishReason,
    });
  } catch (err: any) {
    console.error('[API Admin AI Error]:', err);
    return res.status(500).json({
      error: err?.message || 'Внутренняя ошибка сервиса Gemini AI',
      fallbackLocal: true,
    });
  }
});

// POST /api/ai/player-advice — AI tactical & progression advisor for players
app.post('/api/ai/player-advice', async (req, res) => {
  try {
    const { playerProfile, strategyMode, localHint } = req.body;
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY не настроен',
        fallbackLocal: true,
      });
    }

    const promptText = `Проанализируй профиль игрока онлайн-RPG «Пирамида: Войны» и выдай точный тактический совет на русском языке.
Профиль игрока: ${JSON.stringify(playerProfile || {})}
Стратегия ИИ: ${strategyMode || 'balanced'}
Предварительная диагностика движка: ${JSON.stringify(localHint || {})}`;

    const generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Краткий заголовок совета (до 70 символов)',
          },
          category: {
            type: Type.STRING,
            description: 'Категория: combat, equipment, economy, progression или boss',
          },
          adviceText: {
            type: Type.STRING,
            description: 'Конкретный полезный совет для игрока (2-3 предложения)',
          },
          recommendedAction: {
            type: Type.STRING,
            description:
              'Код действия: repair_gear, buy_equipment, distribute_stats, use_potion, attack_boss, farm_pyramid, exchange_currency или upgrade_vip',
          },
          expectedImpact: {
            type: Type.STRING,
            description: 'Ожидаемый численный эффект от выполнения совета',
          },
          confidenceScore: {
            type: Type.INTEGER,
            description: 'Уверенность ИИ от 80 до 99',
          },
        },
        required: [
          'title',
          'category',
          'adviceText',
          'recommendedAction',
          'expectedImpact',
          'confidenceScore',
        ],
      },
    };

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-4-argon',
        contents: promptText,
        config: generationConfig,
      });
    } catch {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptText,
        config: generationConfig,
      });
    }

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'Ошибка генерации совета ИИ',
      fallbackLocal: true,
    });
  }
});

// Setup dev server with Vite middleware or static files
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from docs (used for GitHub Pages and production build)
    const staticDir = path.resolve(__dirname, 'docs');
    app.use('/Bigwar', express.static(staticDir));
    app.use(express.static(staticDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Game Server] Running on http://0.0.0.0:${PORT} (Mode: ${isDev ? 'development' : 'production'})`);
  });
}

startServer().catch((err) => {
  console.error('[Game Server Startup Error]:', err);
});
