import { RealtimePlayer } from './supabase';

export interface BotCharacter {
  id: string;
  nick: string;
  lvl: number;
  avatar: string;
  pyramidTier: 1 | 2 | 3;
  location: 'city' | 'pyramid';
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  isPremium?: boolean;
  clanTag?: string;
  clanEmblem?: string;
  role?: 'regular' | 'winner';
  isOnline: boolean;
  lastSeen: number;
  lastAction?: string;
}

export interface BotSimulationConfig {
  enabled: boolean;
  targetOnlineCount: number; // e.g. 25-35
  chatEnabled: boolean;
  chatMinDelaySec: number; // e.g. 15
  chatMaxDelaySec: number; // e.g. 40
  customPhrases: string[];
}

// 75 authentic Egyptian-themed bot character profiles
export const BOT_DATABASE: Omit<BotCharacter, 'isOnline' | 'lastSeen'>[] = [
  { id: 'bot_1', nick: 'Анубис_77', lvl: 14, avatar: '🧙‍♂️', pyramidTier: 3, location: 'pyramid', row: 4, col: 5, hp: 420, maxHp: 420, isPremium: true, clanTag: 'ANUBIS', clanEmblem: '🛡️' },
  { id: 'bot_2', nick: 'Рамзес_Тень', lvl: 11, avatar: '🤴', pyramidTier: 3, location: 'city', row: 9, col: 1, hp: 350, maxHp: 350, isPremium: false, clanTag: 'RA', clanEmblem: '☀️' },
  { id: 'bot_3', nick: 'Нефертити_X', lvl: 9, avatar: '🧝', pyramidTier: 2, location: 'pyramid', row: 3, col: 4, hp: 280, maxHp: 280, isPremium: true },
  { id: 'bot_4', nick: 'ЖрецОсириса', lvl: 8, avatar: '🧙‍♂️', pyramidTier: 2, location: 'pyramid', row: 6, col: 2, hp: 260, maxHp: 260, isPremium: false, clanTag: 'EGYPT', clanEmblem: '⚱️' },
  { id: 'bot_5', nick: 'ПесчаныйСтраж', lvl: 6, avatar: '🛡️', pyramidTier: 2, location: 'city', row: 9, col: 1, hp: 220, maxHp: 220, isPremium: false },
  { id: 'bot_6', nick: 'Фараон99', lvl: 15, avatar: '👑', pyramidTier: 3, location: 'pyramid', row: 2, col: 6, hp: 460, maxHp: 460, isPremium: true, clanTag: 'PHARAOH', clanEmblem: '👑' },
  { id: 'bot_7', nick: 'ХранительКа', lvl: 7, avatar: '🗿', pyramidTier: 2, location: 'pyramid', row: 5, col: 7, hp: 240, maxHp: 240, isPremium: false },
  { id: 'bot_8', nick: 'Гор_Сокол', lvl: 12, avatar: '🦅', pyramidTier: 3, location: 'city', row: 9, col: 1, hp: 380, maxHp: 380, isPremium: true, clanTag: 'RA', clanEmblem: '☀️' },
  { id: 'bot_9', nick: 'Скарабей_Хит', lvl: 4, avatar: '🪲', pyramidTier: 1, location: 'pyramid', row: 7, col: 3, hp: 170, maxHp: 170, isPremium: false, clanTag: 'SCARAB', clanEmblem: '🪲' },
  { id: 'bot_10', nick: 'Себек_Клык', lvl: 10, avatar: '🐊', pyramidTier: 2, location: 'pyramid', row: 4, col: 2, hp: 310, maxHp: 310, isPremium: false },
  { id: 'bot_11', nick: 'Исида_Маг', lvl: 5, avatar: '🧝', pyramidTier: 1, location: 'city', row: 9, col: 1, hp: 190, maxHp: 190, isPremium: true },
  { id: 'bot_12', nick: 'Сфинкс_Загадка', lvl: 13, avatar: '🦁', pyramidTier: 3, location: 'pyramid', row: 1, col: 4, hp: 400, maxHp: 400, isPremium: false },
  { id: 'bot_13', nick: 'Бастет_Коготь', lvl: 7, avatar: '🐱', pyramidTier: 2, location: 'pyramid', row: 6, col: 8, hp: 230, maxHp: 230, isPremium: false },
  { id: 'bot_14', nick: 'Осирис_Вечный', lvl: 16, avatar: '👑', pyramidTier: 3, location: 'city', row: 9, col: 1, hp: 490, maxHp: 490, isPremium: true, clanTag: 'ANUBIS', clanEmblem: '🛡️' },
  { id: 'bot_15', nick: 'Сет_Буря', lvl: 10, avatar: '🌪️', pyramidTier: 2, location: 'pyramid', row: 5, col: 3, hp: 300, maxHp: 300, isPremium: false },
  { id: 'bot_16', nick: 'Тот_Мудрец', lvl: 8, avatar: '📜', pyramidTier: 2, location: 'city', row: 9, col: 1, hp: 250, maxHp: 250, isPremium: false },
  { id: 'bot_17', nick: 'Хатхор_Звезда', lvl: 6, avatar: '✨', pyramidTier: 2, location: 'pyramid', row: 7, col: 5, hp: 210, maxHp: 210, isPremium: true },
  { id: 'bot_18', nick: 'Амон_Ра_Владыка', lvl: 18, avatar: '☀️', pyramidTier: 3, location: 'pyramid', row: 1, col: 2, hp: 550, maxHp: 550, isPremium: true, clanTag: 'RA', clanEmblem: '☀️' },
  { id: 'bot_19', nick: 'Клеопатра_Золото', lvl: 11, avatar: '👸', pyramidTier: 3, location: 'city', row: 9, col: 1, hp: 340, maxHp: 340, isPremium: true, clanTag: 'PHARAOH', clanEmblem: '👑' },
  { id: 'bot_20', nick: 'Анубис_Жнец', lvl: 9, avatar: '💀', pyramidTier: 2, location: 'pyramid', row: 4, col: 7, hp: 290, maxHp: 290, isPremium: false, clanTag: 'ANUBIS', clanEmblem: '🛡️' },
  { id: 'bot_21', nick: 'Скарабей_Изумруд', lvl: 3, avatar: '🪲', pyramidTier: 1, location: 'pyramid', row: 8, col: 4, hp: 150, maxHp: 150, isPremium: false },
  { id: 'bot_22', nick: 'Жрец_Луксора', lvl: 7, avatar: '🧙‍♂️', pyramidTier: 2, location: 'city', row: 9, col: 1, hp: 235, maxHp: 235, isPremium: false, clanTag: 'EGYPT', clanEmblem: '⚱️' },
  { id: 'bot_23', nick: 'Песок_Времени', lvl: 5, avatar: '⏳', pyramidTier: 1, location: 'pyramid', row: 6, col: 6, hp: 185, maxHp: 185, isPremium: false },
  { id: 'bot_24', nick: 'Страж_Карнака', lvl: 12, avatar: '🛡️', pyramidTier: 3, location: 'pyramid', row: 3, col: 3, hp: 375, maxHp: 375, isPremium: false },
  { id: 'bot_25', nick: 'Хепри_Рассвет', lvl: 4, avatar: '🌅', pyramidTier: 1, location: 'city', row: 9, col: 1, hp: 165, maxHp: 165, isPremium: false },
  { id: 'bot_26', nick: 'Таурт_Сила', lvl: 10, avatar: '🦛', pyramidTier: 2, location: 'pyramid', row: 5, col: 2, hp: 320, maxHp: 320, isPremium: true },
  { id: 'bot_27', nick: 'Птах_Зодчий', lvl: 8, avatar: '🔨', pyramidTier: 2, location: 'city', row: 9, col: 1, hp: 255, maxHp: 255, isPremium: false },
  { id: 'bot_28', nick: 'Анубис_Гнев', lvl: 14, avatar: '🔥', pyramidTier: 3, location: 'pyramid', row: 2, col: 5, hp: 430, maxHp: 430, isPremium: true, clanTag: 'ANUBIS', clanEmblem: '🛡️' },
  { id: 'bot_29', nick: 'Саркофаг_Тайна', lvl: 6, avatar: '⚰️', pyramidTier: 2, location: 'pyramid', row: 7, col: 1, hp: 215, maxHp: 215, isPremium: false },
  { id: 'bot_30', nick: 'Нейт_Стрела', lvl: 9, avatar: '🏹', pyramidTier: 2, location: 'city', row: 9, col: 1, hp: 275, maxHp: 275, isPremium: false },
  { id: 'bot_31', nick: 'Сохмет_Пламя', lvl: 13, avatar: '🦁', pyramidTier: 3, location: 'pyramid', row: 3, col: 6, hp: 410, maxHp: 410, isPremium: true },
  { id: 'bot_32', nick: 'Уаджит_Кобра', lvl: 7, avatar: '🐍', pyramidTier: 2, location: 'pyramid', row: 6, col: 4, hp: 245, maxHp: 245, isPremium: false },
  { id: 'bot_33', nick: 'Маат_Перо', lvl: 5, avatar: '🪶', pyramidTier: 1, location: 'city', row: 9, col: 1, hp: 180, maxHp: 180, isPremium: false },
  { id: 'bot_34', nick: 'Хонсу_Луна', lvl: 11, avatar: '🌙', pyramidTier: 3, location: 'pyramid', row: 4, col: 1, hp: 355, maxHp: 355, isPremium: true },
  { id: 'bot_35', nick: 'Анубис_Тень', lvl: 15, avatar: '🐺', pyramidTier: 3, location: 'city', row: 9, col: 1, hp: 470, maxHp: 470, isPremium: true, clanTag: 'ANUBIS', clanEmblem: '🛡️' },
  { id: 'bot_36', nick: 'Рамзес_Великий', lvl: 17, avatar: '🤴', pyramidTier: 3, location: 'pyramid', row: 1, col: 3, hp: 520, maxHp: 520, isPremium: true, clanTag: 'PHARAOH', clanEmblem: '👑' },
  { id: 'bot_37', nick: 'Имхотеп_Архитектор', lvl: 10, avatar: '📐', pyramidTier: 2, location: 'city', row: 9, col: 1, hp: 305, maxHp: 305, isPremium: false },
  { id: 'bot_38', nick: 'Менкаура_Царь', lvl: 12, avatar: '👑', pyramidTier: 3, location: 'pyramid', row: 3, col: 5, hp: 390, maxHp: 390, isPremium: false, clanTag: 'PHARAOH', clanEmblem: '👑' },
  { id: 'bot_39', nick: 'Хеопс_Строитель', lvl: 14, avatar: '🔺', pyramidTier: 3, location: 'pyramid', row: 2, col: 4, hp: 440, maxHp: 440, isPremium: true },
  { id: 'bot_40', nick: 'Хафра_Владыка', lvl: 13, avatar: '🗿', pyramidTier: 3, location: 'city', row: 9, col: 1, hp: 415, maxHp: 415, isPremium: false },
  { id: 'bot_41', nick: 'Тутмос_Воин', lvl: 8, avatar: '⚔️', pyramidTier: 2, location: 'pyramid', row: 5, col: 6, hp: 265, maxHp: 265, isPremium: false },
  { id: 'bot_42', nick: 'Эхнатон_Солнце', lvl: 11, avatar: '☀️', pyramidTier: 3, location: 'pyramid', row: 4, col: 3, hp: 345, maxHp: 345, isPremium: true, clanTag: 'RA', clanEmblem: '☀️' },
  { id: 'bot_43', nick: 'Тутанхамон_Золотой', lvl: 16, avatar: '👑', pyramidTier: 3, location: 'city', row: 9, col: 1, hp: 500, maxHp: 500, isPremium: true, clanTag: 'PHARAOH', clanEmblem: '👑' },
  { id: 'bot_44', nick: 'Нефертари_Краса', lvl: 9, avatar: '👸', pyramidTier: 2, location: 'pyramid', row: 5, col: 5, hp: 285, maxHp: 285, isPremium: true },
  { id: 'bot_45', nick: 'Мут_Царица', lvl: 10, avatar: '🦅', pyramidTier: 2, location: 'city', row: 9, col: 1, hp: 315, maxHp: 315, isPremium: false },
  { id: 'bot_46', nick: 'Серкет_Скорпион', lvl: 6, avatar: '🦂', pyramidTier: 2, location: 'pyramid', row: 7, col: 6, hp: 225, maxHp: 225, isPremium: false },
  { id: 'bot_47', nick: 'Себекхотеп_Скала', lvl: 7, avatar: '🐊', pyramidTier: 2, location: 'pyramid', row: 6, col: 3, hp: 250, maxHp: 250, isPremium: false },
  { id: 'bot_48', nick: 'Апеп_Змей', lvl: 12, avatar: '🐍', pyramidTier: 3, location: 'city', row: 9, col: 1, hp: 385, maxHp: 385, isPremium: false },
  { id: 'bot_49', nick: 'Бэс_Защитник', lvl: 4, avatar: '🛡️', pyramidTier: 1, location: 'pyramid', row: 7, col: 2, hp: 160, maxHp: 160, isPremium: false },
  { id: 'bot_50', nick: 'Анубис_Охотник', lvl: 13, avatar: '🐺', pyramidTier: 3, location: 'pyramid', row: 2, col: 7, hp: 405, maxHp: 405, isPremium: true, clanTag: 'ANUBIS', clanEmblem: '🛡️' },
  { id: 'bot_51', nick: 'Хранитель_Некрополя', lvl: 8, avatar: '💀', pyramidTier: 2, location: 'city', row: 9, col: 1, hp: 270, maxHp: 270, isPremium: false },
  { id: 'bot_52', nick: 'Песчаный_Клинок', lvl: 5, avatar: '🗡️', pyramidTier: 1, location: 'pyramid', row: 6, col: 5, hp: 195, maxHp: 195, isPremium: false },
  { id: 'bot_53', nick: 'Сокол_Гора', lvl: 11, avatar: '🦅', pyramidTier: 3, location: 'pyramid', row: 4, col: 4, hp: 360, maxHp: 360, isPremium: true, clanTag: 'RA', clanEmblem: '☀️' },
  { id: 'bot_54', nick: 'Око_Ра', lvl: 9, avatar: '👁️', pyramidTier: 2, location: 'city', row: 9, col: 1, hp: 295, maxHp: 295, isPremium: true },
  { id: 'bot_55', nick: 'Сфинкс_Гизы', lvl: 15, avatar: '🦁', pyramidTier: 3, location: 'pyramid', row: 1, col: 5, hp: 475, maxHp: 475, isPremium: false },
  { id: 'bot_56', nick: 'Номарх_Фив', lvl: 10, avatar: '🏛️', pyramidTier: 2, location: 'city', row: 9, col: 1, hp: 325, maxHp: 325, isPremium: false },
  { id: 'bot_57', nick: 'Жрец_Мемфиса', lvl: 7, avatar: '🧙‍♂️', pyramidTier: 2, location: 'pyramid', row: 6, col: 7, hp: 240, maxHp: 240, isPremium: false, clanTag: 'EGYPT', clanEmblem: '⚱️' },
  { id: 'bot_58', nick: 'Караванщик_Нила', lvl: 3, avatar: '🐫', pyramidTier: 1, location: 'city', row: 9, col: 1, hp: 145, maxHp: 145, isPremium: false },
  { id: 'bot_59', nick: 'Мумия_Царя', lvl: 12, avatar: '🧟', pyramidTier: 3, location: 'pyramid', row: 3, col: 7, hp: 395, maxHp: 395, isPremium: false },
  { id: 'bot_60', nick: 'Древний_Визирь', lvl: 14, avatar: '📜', pyramidTier: 3, location: 'city', row: 9, col: 1, hp: 445, maxHp: 445, isPremium: true },
  { id: 'bot_61', nick: 'Жрец_Анубиса', lvl: 8, avatar: '🧙‍♂️', pyramidTier: 2, location: 'pyramid', row: 5, col: 4, hp: 260, maxHp: 260, isPremium: false, clanTag: 'ANUBIS', clanEmblem: '🛡️' },
  { id: 'bot_62', nick: 'Страж_Фив', lvl: 6, avatar: '🛡️', pyramidTier: 2, location: 'city', row: 9, col: 1, hp: 220, maxHp: 220, isPremium: false },
  { id: 'bot_63', nick: 'Клинок_Нила', lvl: 4, avatar: '⚔️', pyramidTier: 1, location: 'pyramid', row: 8, col: 2, hp: 175, maxHp: 175, isPremium: false },
  { id: 'bot_64', nick: 'Слеза_Исиды', lvl: 9, avatar: '💧', pyramidTier: 2, location: 'pyramid', row: 4, col: 6, hp: 285, maxHp: 285, isPremium: true },
  { id: 'bot_65', nick: 'Гробница_Фараона', lvl: 11, avatar: '⚱️', pyramidTier: 3, location: 'city', row: 9, col: 1, hp: 350, maxHp: 350, isPremium: false },
  { id: 'bot_66', nick: 'Солнце_Атона', lvl: 13, avatar: '☀️', pyramidTier: 3, location: 'pyramid', row: 3, col: 2, hp: 410, maxHp: 410, isPremium: true, clanTag: 'RA', clanEmblem: '☀️' },
  { id: 'bot_67', nick: 'Лев_Баст', lvl: 7, avatar: '🦁', pyramidTier: 2, location: 'city', row: 9, col: 1, hp: 245, maxHp: 245, isPremium: false },
  { id: 'bot_68', nick: 'Пустынный_Странник', lvl: 2, avatar: '🧙‍♂️', pyramidTier: 1, location: 'pyramid', row: 8, col: 6, hp: 130, maxHp: 130, isPremium: false },
  { id: 'bot_69', nick: 'Песчаный_Волк', lvl: 5, avatar: '🐺', pyramidTier: 1, location: 'city', row: 9, col: 1, hp: 190, maxHp: 190, isPremium: false },
  { id: 'bot_70', nick: 'Жрец_Сета', lvl: 10, avatar: '🧙‍♂️', pyramidTier: 2, location: 'pyramid', row: 5, col: 1, hp: 310, maxHp: 310, isPremium: false },
  { id: 'bot_71', nick: 'Всадник_Пустыни', lvl: 6, avatar: '🐎', pyramidTier: 2, location: 'city', row: 9, col: 1, hp: 230, maxHp: 230, isPremium: false },
  { id: 'bot_72', nick: 'Хранитель_Свитков', lvl: 8, avatar: '📜', pyramidTier: 2, location: 'pyramid', row: 6, col: 5, hp: 265, maxHp: 265, isPremium: false },
  { id: 'bot_73', nick: 'Золотой_Скарабей', lvl: 15, avatar: '🪲', pyramidTier: 3, location: 'pyramid', row: 2, col: 3, hp: 480, maxHp: 480, isPremium: true, clanTag: 'SCARAB', clanEmblem: '🪲' },
  { id: 'bot_74', nick: 'Скипетр_Власти', lvl: 12, avatar: '🪄', pyramidTier: 3, location: 'city', row: 9, col: 1, hp: 370, maxHp: 370, isPremium: false },
  { id: 'bot_75', nick: 'Страж_Осириса', lvl: 9, avatar: '🛡️', pyramidTier: 2, location: 'pyramid', row: 4, col: 8, hp: 295, maxHp: 295, isPremium: false, clanTag: 'EGYPT', clanEmblem: '⚱️' }
];

// 110+ natural and realistic chat phrases for bots
export const DEFAULT_BOT_CHAT_PHRASES: string[] = [
  'Всем привет! Как фарм сегодня?',
  'Кто качал ловкость, уворот реально тащит в П2?',
  'Что лучше максить воину — силу или живучесть?',
  'Народ, подскажите, сколько статпоинтов дают за ап уровня?',
  'Вкачал живучесть до 30, теперь босс не пробивает с одного удара)',
  'Качайте ловкость, криты и увороты решают на высоких этажах!',
  'Где лучше всего опыт качать на 8 уровне?',
  'В П2 на 2 ярусе мобы жирные, без эликсиров тяжело.',
  'Кто знает точный шанс крита от ловкости?',
  'Эликсир опыта (+25%) реально ускоряет кач, за час 2 уровня апнул!',
  'На 1 линии в П1 респ отличный, фармлю голду потихоньку.',
  'Кто на босса в П2 пойдет? Собираю пати.',
  'Осторожно, на 4 ряду мумия критует очень больно!',
  'Босс в П3 возродился или еще на кд?',
  'Редкий босс в первой пирамиде заспавнился, кто рядом бежит?',
  'Еле удрал из пирамиды на 15 хп :D',
  'Портал в П2 на какой линии находится?',
  'На 3 ярусе скорпионы ядом травят, запасайтесь банками!',
  'Сундуки на 5 ряду кто-то залутал уже?',
  'Фармлю мешки на 2 линии, уже 3000 голды поднял.',
  'Кто знает, сколько откат у босса в П1?',
  'С босса в П2 кому-нибудь эпик падал?',
  'Карточка перехода в П3 спасает, когда портал закрыт.',
  'С дропа упал редкий доспех, кайф!',
  'Наконец-то выбил сапоги на +3 к скорости)',
  'В магазине кольца топовые завезли, кто брал?',
  'Кто продает оружие на 7 ур? Куплю на ауке.',
  'Выставил на аукцион щит эпический, забирайте недорого.',
  'Починил шмот в сумке, голда улетела вся :D',
  'Прочность 0/1 — это все, предмет на выброс или чинится?',
  'Скрафтил меч в кузнице с бонусом к криту, зверь просто!',
  'Какое оружие самое профитное для П1?',
  'Не забывайте чинить вещи вовремя, а то максимальная прочность падает!',
  'В сумке мест не хватает, продал весь серый хлам кнопкой быстрой продажи.',
  'На аукционе кто-то эликсиры по дешевке слил, я урвал)',
  'Кто уже точил вещи в Алтаре до М5?',
  'У меня на М4 шанс был 40%, зашло с первой попытки!',
  'В Алтаре шмот не ломается при неудаче, только жертва горит — это топ тема.',
  'Слил три меча в Алтаре, зато теперь М7 (+35% ко всем статам!)',
  'Где брать шмот для жертвы? В магазине покупаю самые дешевые.',
  'Круговая шкала в Алтаре залипательная, нервы щекочет))',
  'На М10 реально заточить? Там же +50% ко всем статам будет!',
  'Кто до какого класса точил? У меня пока М3 максимум.',
  'Совет: на высокие классы кидайте сразу 6 шмоток в жертву, чтобы шанс поднять.',
  'Вчера заточил лук до М6, урон вырос конкретно.',
  'В турнире скарабея кто на первом месте сейчас?',
  'Мой скарабей сегодня разнес в пух и прах!',
  'Качайте панцирь скарабею, иначе ваншотят соперники.',
  'Награды за топ в турнире скарабея очень достойные.',
  'Кто какой архетип скарабея выбрал? Танк или дамагер?',
  'Турнир скарабея раз в месяц — успейте прокачать жука!',
  'Улучшил клешни скарабею, теперь критует через ход.',
  'В клан [RA] идет набор активных бойцов от 5 лвл, пишите в ЛС!',
  'Кто в клановую пирамиду сегодня пойдет?',
  'Клан [PHARAOH] ищет офицеров для захвата территорий.',
  'Купил лицензию киллера, берегитесь в пирамиде хаха)',
  'В П2 кто-то с лицензией киллера бегает, осторожнее на верхних рядах!',
  'ПвП в пирамиде напряженное, чуть не поймали.',
  'В клановой казне накопили на ап уровня, скоро баффы вырастут.',
  'Респект соклану за помощь с боссом!',
  'Всем удачного дропа и поменьше промахов!',
  'Ура, наконец-то апнул 10 уровень!',
  'Хаха, чуть от босса не отлетел на 5 хп, банки спасли.',
  'Рулетка сегодня насыпала 50 кристаллов, повезло нереально!',
  'Банки на энергию кончились, сижу в городе регенюсь.',
  'Кто в игре, го в П1 наперегонки до босса)',
  'Доброе утро, воины пирамид!',
  'Сегодня дроп отличный, уже два фиолетовых сундука нашел.',
  'Чат живет, онлайн радует 👍',
  'Купил скин фараона, теперь как царь хожу.',
  'Всем хорошей игры и плотного фарма!',
  'Где взять кристаллы без доната? В рулетке и на ачивках прилично дают.',
  'Ачивки за монстров чекайте, там много кристаллов насыпают.',
  'Страж NPC фармит пока я чай пью, кайфовая штука.',
  'Сколько голды нужно на расширение сумки?',
  'Крафт кастомного оружия дорогой, но статы того стоят.',
  'Крутанул колесо удачи — выпал свиток опыта, неплохо.',
  'Кто-нибудь бил древнего сфинкса соло?',
  'Пойду вздремну часок, перс пусть в городе ману копит.',
  'Слушайте, а в П3 мобы с какого уровня пускают?',
  'Отличная обнова, игра прям ожила!',
  'Удачи на арене скарабеев тем, кто сейчас бьется!',
  'Погнали фармить, пока боссы стоят!',
  'Кто на рынке кристаллы по 1000 голды меняет?',
  'Зацените мой новый доспех в профиле)',
  'Всем фарту и побольше критов!',
  'А где рецепт на кольцо живучести взять?',
  'В пирамиде на 3 ярусе темнотища, факелы бы добавить)',
  'Только что сдал в аренду меч, пассивный доход пошел.',
  'Народ, лицензия киллера на 24 часа работает или до смерти?',
  'На 24 часа таймер тикает, убивай сколько влезет.',
  'Надо накопить 10 кристалликов на киллерку.',
  'Починил перчатки, теперь снова 100% защиты.',
  'Кто в курсе, когда следующий турнир скарабеев стартует?',
  'Слушайте, а в банк кто кристаллы закидывал? Мгновенно приходят?',
  'Да, моментально зачисляются, я уже два раза брал.',
  'У меня страж NPC нафармил 5к голды за ночь, нормально так.',
  'В сумке уже места нет от этих свитков и банок.',
  'Надеюсь, сегодня босс пирамиды 3 ляжет.',
  'Всем мира и побед над мумиями!',
  'Кто сильнее — Себек или Гор?',
  'Гор по урону топчик, а Себек жирный как танк.',
  'Подскажите, а в клане сколько человек максимум может быть?',
  'Зависит от уровня клановой базы.',
  'Пошел тестить новый билд через ловкость, пожелайте удачи!',
  'Не умирай там, реген долго ждать)',
  'Я с банками пошел, все под контролем.',
  'Чат, всем спокойной ночи, кто спать!'
];

const BOT_CONFIG_STORAGE_KEY = 'bigwar_bot_simulation_config_v1';
const BOT_ACTIVE_STORAGE_KEY = 'bigwar_bot_simulation_active_v1';

export function getBotSimulationConfig(): BotSimulationConfig {
  if (typeof window === 'undefined') {
    return {
      enabled: true,
      targetOnlineCount: 28,
      chatEnabled: true,
      chatMinDelaySec: 18,
      chatMaxDelaySec: 42,
      customPhrases: DEFAULT_BOT_CHAT_PHRASES
    };
  }

  try {
    const raw = localStorage.getItem(BOT_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: parsed.enabled !== false,
        targetOnlineCount: Math.max(5, Math.min(60, Number(parsed.targetOnlineCount || 28))),
        chatEnabled: parsed.chatEnabled !== false,
        chatMinDelaySec: Math.max(5, Math.min(120, Number(parsed.chatMinDelaySec || 18))),
        chatMaxDelaySec: Math.max(10, Math.min(300, Number(parsed.chatMaxDelaySec || 42))),
        customPhrases: Array.isArray(parsed.customPhrases) && parsed.customPhrases.length > 0
          ? parsed.customPhrases
          : DEFAULT_BOT_CHAT_PHRASES
      };
    }
  } catch (e) {
    console.warn('[BotSimulation] Failed to load config from storage:', e);
  }

  return {
    enabled: true,
    targetOnlineCount: 28,
    chatEnabled: true,
    chatMinDelaySec: 18,
    chatMaxDelaySec: 42,
    customPhrases: DEFAULT_BOT_CHAT_PHRASES
  };
}

export function saveBotSimulationConfig(config: BotSimulationConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BOT_CONFIG_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('bigwar_bot_config_updated', { detail: config }));
  } catch (e) {
    console.warn('[BotSimulation] Failed to save config to storage:', e);
  }
}

const BOT_CITY_ACTIONS = [
  'В Городе Луксор (отдых и регенерация)',
  'Выбирает экипировку в Магазине',
  'Просматривает лоты на Аукционе',
  'Улучшает предмет на Алтаре',
  'Чинит доспехи в Сумке',
  'Общается в мировом чате',
  'Крутит Колесо Удачи'
];

const BOT_PYRAMID_ACTIONS = [
  'Фармит монстров в Пирамиде',
  'Ищет сундуки и мешки с золотом',
  'Сражается со Стражем Гробницы',
  'Охотится на Босса яруса',
  'Исследует коридоры Пирамиды',
  'Собирает добычу после боя'
];

// In-memory runtime pool of bots
let cachedRuntimeBots: BotCharacter[] | null = null;

export function initializeRuntimeBots(targetCount: number = 28): BotCharacter[] {
  const cfg = getBotSimulationConfig();
  const now = Date.now();
  const count = cfg.enabled ? Math.max(5, Math.min(BOT_DATABASE.length, targetCount)) : 0;

  // Pick deterministic subset initially, then randomize on subsequent ticks
  const pool = BOT_DATABASE.map((base, idx) => {
    const isOnline = cfg.enabled && idx < count;
    // Jitter coordinates and HP slightly
    const randomRow = isOnline && base.location === 'pyramid'
      ? Math.max(1, Math.min(8, base.row + ((idx % 3) - 1)))
      : base.row;
    const randomCol = isOnline && base.location === 'pyramid'
      ? Math.max(0, Math.min(9, base.col + ((idx % 2) === 0 ? 1 : -1)))
      : base.col;
    const defaultAction =
      base.location === 'pyramid'
        ? BOT_PYRAMID_ACTIONS[idx % BOT_PYRAMID_ACTIONS.length]
        : BOT_CITY_ACTIONS[idx % BOT_CITY_ACTIONS.length];

    return {
      ...base,
      row: Math.max(0, Math.min(9, randomRow)),
      col: Math.max(0, Math.min(9, randomCol)),
      isOnline,
      lastSeen: isOnline ? now - (idx * 300) : now - 1000000,
      lastAction: isOnline ? defaultAction : 'Оффлайн'
    };
  });

  cachedRuntimeBots = pool;
  return pool;
}

export function getRuntimeBots(targetCount?: number): BotCharacter[] {
  const cfg = getBotSimulationConfig();
  if (!cachedRuntimeBots) {
    cachedRuntimeBots = initializeRuntimeBots(targetCount || cfg.targetOnlineCount);
  }
  if (!cfg.enabled) {
    return cachedRuntimeBots.map((b) => ({ ...b, isOnline: false, lastAction: 'Оффлайн (Симуляция выкл)' }));
  }
  return cachedRuntimeBots;
}

/**
 * Ticks the bot simulation:
 * 1. Keeps online count close to targetOnlineCount by logging out idle bots or logging in bots immediately when re-enabled.
 * 2. Simulates movement inside the Pyramid for bots currently in 'pyramid' (adjusts row/col by ±1).
 * 3. Keeps their `lastSeen` fresh so they pass `isPlayerOnlineByHeartbeat` seamlessly.
 */
export function tickBotSimulation(cfg?: BotSimulationConfig): BotCharacter[] {
  const config = cfg || getBotSimulationConfig();
  if (!cachedRuntimeBots) {
    cachedRuntimeBots = initializeRuntimeBots(config.targetOnlineCount);
  }

  if (!config.enabled) {
    cachedRuntimeBots = cachedRuntimeBots.map((b) => ({
      ...b,
      isOnline: false,
      lastAction: 'Оффлайн (Симуляция выкл)'
    }));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bigwar_bots_ticked', { detail: cachedRuntimeBots }));
    }
    return cachedRuntimeBots;
  }

  const bots = cachedRuntimeBots;
  const now = Date.now();
  const targetOnline = Math.max(5, Math.min(BOT_DATABASE.length, config.targetOnlineCount));

  let nextBots = [...bots];
  let currentOnlineBots = nextBots.filter((b) => b.isOnline);
  let currentOfflineBots = nextBots.filter((b) => !b.isOnline);

  // Immediately bring bots online if count is significantly below target (e.g. right after turning simulation ON)
  if (currentOnlineBots.length < targetOnline - 1) {
    const needed = targetOnline - currentOnlineBots.length;
    const shuffledOffline = [...currentOfflineBots].sort(() => Math.random() - 0.5);
    const idsToActivate = new Set(shuffledOffline.slice(0, needed).map((b) => b.id));
    nextBots = nextBots.map((b) =>
      idsToActivate.has(b.id)
        ? {
            ...b,
            isOnline: true,
            lastSeen: now,
            lastAction:
              b.location === 'pyramid'
                ? BOT_PYRAMID_ACTIONS[Math.floor(Math.random() * BOT_PYRAMID_ACTIONS.length)]
                : BOT_CITY_ACTIONS[Math.floor(Math.random() * BOT_CITY_ACTIONS.length)]
          }
        : b
    );
    currentOnlineBots = nextBots.filter((b) => b.isOnline);
    currentOfflineBots = nextBots.filter((b) => !b.isOnline);
  } else if (currentOnlineBots.length > targetOnline + 1) {
    const excess = currentOnlineBots.length - targetOnline;
    const shuffledOnline = [...currentOnlineBots].sort(() => Math.random() - 0.5);
    const idsToDeactivate = new Set(shuffledOnline.slice(0, excess).map((b) => b.id));
    nextBots = nextBots.map((b) =>
      idsToDeactivate.has(b.id)
        ? { ...b, isOnline: false, lastSeen: now - 30000, lastAction: 'Вышел из игры' }
        : b
    );
    currentOnlineBots = nextBots.filter((b) => b.isOnline);
    currentOfflineBots = nextBots.filter((b) => !b.isOnline);
  }

  // If online count deviates slightly or randomly 25% of the time, rotate 1 bot
  const shouldRotate = Math.random() < 0.25;

  nextBots = nextBots.map((bot) => {
    if (!bot.isOnline) return bot;

    // Refresh heartbeat
    const updatedLastSeen = now;
    let nextRow = bot.row;
    let nextCol = bot.col;
    let nextLocation = bot.location;
    let nextAction = bot.lastAction;

    // Move in Pyramid occasionally (35% chance per tick)
    if (bot.location === 'pyramid' && Math.random() < 0.35) {
      const dRow = Math.random() < 0.5 ? (Math.random() < 0.5 ? 1 : -1) : 0;
      const dCol = Math.random() < 0.5 ? (Math.random() < 0.5 ? 1 : -1) : 0;
      nextRow = Math.max(1, Math.min(8, bot.row + dRow));
      nextCol = Math.max(0, Math.min(9, bot.col + dCol));
      nextAction = BOT_PYRAMID_ACTIONS[Math.floor(Math.random() * BOT_PYRAMID_ACTIONS.length)];

      // 5% chance to exit to city
      if (Math.random() < 0.05) {
        nextLocation = 'city';
        nextRow = 9;
        nextCol = 1;
        nextAction = 'Вернулся из Пирамиды в Город';
      }
    } else if (bot.location === 'city' && Math.random() < 0.1) {
      // 10% chance to enter pyramid
      nextLocation = 'pyramid';
      nextRow = Math.floor(Math.random() * 7) + 2;
      nextCol = Math.floor(Math.random() * 10);
      nextAction = `Вошёл в Пирамиду (Ярус ${bot.pyramidTier})`;
    } else if (Math.random() < 0.2) {
      nextAction =
        nextLocation === 'pyramid'
          ? BOT_PYRAMID_ACTIONS[Math.floor(Math.random() * BOT_PYRAMID_ACTIONS.length)]
          : BOT_CITY_ACTIONS[Math.floor(Math.random() * BOT_CITY_ACTIONS.length)];
    }

    return {
      ...bot,
      row: nextRow,
      col: nextCol,
      location: nextLocation,
      lastSeen: updatedLastSeen,
      lastAction: nextAction
    };
  });

  if (shouldRotate && currentOnlineBots.length > 5 && currentOfflineBots.length > 0) {
    const outIdx = Math.floor(Math.random() * currentOnlineBots.length);
    const inIdx = Math.floor(Math.random() * currentOfflineBots.length);
    const toLogOff = currentOnlineBots[outIdx];
    const toLogIn = currentOfflineBots[inIdx];
    nextBots = nextBots.map((b) => {
      if (b.id === toLogOff.id) {
        return { ...b, isOnline: false, lastSeen: now - 30000, lastAction: 'Вышел из игры' };
      }
      if (b.id === toLogIn.id) {
        return {
          ...b,
          isOnline: true,
          lastSeen: now,
          lastAction:
            b.location === 'pyramid'
              ? BOT_PYRAMID_ACTIONS[Math.floor(Math.random() * BOT_PYRAMID_ACTIONS.length)]
              : BOT_CITY_ACTIONS[Math.floor(Math.random() * BOT_CITY_ACTIONS.length)]
        };
      }
      return b;
    });
  }

  cachedRuntimeBots = nextBots;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bigwar_bots_ticked', { detail: cachedRuntimeBots }));
  }
  return nextBots;
}

const BOT_LOCATIONS = [
  'Москва, Россия',
  'Санкт-Петербург, Россия',
  'Екатеринбург, Россия',
  'Новосибирск, Россия',
  'Казань, Россия',
  'Краснодар, Россия',
  'Минск, Беларусь',
  'Алматы, Казахстан',
  'Астана, Казахстан',
  'Ташкент, Узбекистан'
];

const BOT_DEVICES = [
  '📱 Мобильный (Android 14) • Chrome Mobile',
  '📱 Мобильный (iPhone / iOS 17.4) • Safari',
  '📱 Мобильный (Android 13 • Telegram WebApp)',
  '💻 ПК (Windows 10/11) • Chrome 124',
  '📱 Мобильный (iPhone / iOS 17.5 • Telegram WebApp)'
];

function getBotDeterministicIp(botId: string, nick: string): string {
  let hash = 0;
  const seed = `${botId}_${nick}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const oct1 = [46, 77, 85, 91, 95, 109, 176, 178, 185, 188, 212][hash % 11];
  const oct2 = (hash >> 4) % 220 + 15;
  const oct3 = (hash >> 8) % 240 + 10;
  const oct4 = (hash >> 12) % 230 + 12;
  return `${oct1}.${oct2}.${oct3}.${oct4}`;
}

/**
  * Converts active bots to RealtimePlayer array for merging into the live game state
  */
export function convertBotsToRealtimePlayers(bots: BotCharacter[]): RealtimePlayer[] {
  const cfg = getBotSimulationConfig();
  if (!cfg.enabled) return [];
  const now = Date.now();
  return bots
    .filter((b) => b.isOnline)
    .map((b, idx) => {
      const botIp = getBotDeterministicIp(b.id, b.nick);
      const botLoc = BOT_LOCATIONS[idx % BOT_LOCATIONS.length];
      const botDevice = BOT_DEVICES[idx % BOT_DEVICES.length];
      return {
        id: b.id,
        nick: b.nick,
        lvl: b.lvl,
        hp: b.hp,
        maxHp: b.maxHp,
        avatar: b.avatar,
        location: b.location,
        pyramidTier: b.pyramidTier,
        row: b.row,
        col: b.col,
        isOnline: true,
        lastSeen: b.lastSeen || now,
        last_seen: b.lastSeen || now,
        isPremium: b.isPremium,
        clanTag: b.clanTag,
        clanEmblem: b.clanEmblem,
        role: b.role || 'regular',
        status: b.lastAction || (b.location === 'pyramid' ? `В Пирамиде (Т${b.pyramidTier})` : 'В Городе'),
        ip_address: botIp,
        last_login_ip: botIp,
        ip_location: botLoc,
        device_info: botDevice,
        screen_res: idx % 3 === 0 ? '390x844 (DPR 3)' : '412x915 (DPR 2.6)',
        timezone: 'Europe/Moscow',
        isSimulatedBot: true
      } as any;
    });
}

/**
 * Selects a random active online bot and a random message from the configured phrases pool
 */
export function getRandomBotChatMessage(cfg?: BotSimulationConfig): { author: string; text: string; channel: 'world' | 'general'; avatar?: string } | null {
  const config = cfg || getBotSimulationConfig();
  if (!config.enabled || !config.chatEnabled) return null;

  const bots = getRuntimeBots(config.targetOnlineCount);
  const onlineBots = bots.filter((b) => b.isOnline);
  if (onlineBots.length === 0) return null;

  const randomBot = onlineBots[Math.floor(Math.random() * onlineBots.length)];
  const phrases = config.customPhrases && config.customPhrases.length > 0 ? config.customPhrases : DEFAULT_BOT_CHAT_PHRASES;
  const randomText = phrases[Math.floor(Math.random() * phrases.length)];

  // 85% world chat, 15% general chat
  const channel: 'world' | 'general' = Math.random() < 0.85 ? 'world' : 'general';

  return {
    author: randomBot.nick,
    text: randomText,
    channel,
    avatar: randomBot.avatar
  };
}
