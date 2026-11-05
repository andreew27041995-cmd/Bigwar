-- ========================================================
-- Схема таблицы public.players, public.player_progress_ledger и RLS-политики для Supabase
-- Версия: v1.1.55 (Защита прогресса, валюты, рейтингов и достижений при обновлениях)
-- ========================================================

-- 1. Добавление основных и дополнительных колонок в таблицу players (если они еще не созданы)
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS email text DEFAULT '';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS real_email text DEFAULT '';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS password text DEFAULT '';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS auth_provider text DEFAULT 'local';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS google_id text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS facebook_id text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS telegram_id text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS telegram_username text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS oauth_avatar text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS tutorial_completed boolean DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS gold bigint DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS crystals bigint DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_admin integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS location text DEFAULT 'city';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pyramid_tier integer DEFAULT 1;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS home_pyramid_tier integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS row integer DEFAULT 9;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS col integer DEFAULT 4;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS hp integer DEFAULT 250;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS max_hp integer DEFAULT 250;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS energy integer DEFAULT 100;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS max_energy integer DEFAULT 100;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS hp_potions integer DEFAULT 3;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS en_potions integer DEFAULT 3;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS exp_potions integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS lvl integer DEFAULT 1;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS level integer DEFAULT 1;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS exp bigint DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS str integer DEFAULT 1;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS agi integer DEFAULT 1;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS vit integer DEFAULT 1;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS stat_points integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS avatar text DEFAULT '🧙‍♂️';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS equipped jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS inventory jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT true;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS last_seen bigint DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS premium_until bigint DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS npc_companion jsonb DEFAULT null;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS mobs_killed integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS bosses_killed integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pvp_kills integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pvp_wins integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pvp_losses integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS items_sold integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS total_gold_collected bigint DEFAULT 1000;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS claimed_achievement_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS fishing_state jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS battle_pass jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS daily_quests jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS daily_quests_date text DEFAULT '';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS daily_crystal_chest_claimed_date text DEFAULT '';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS owned_skin_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS owned_skins jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS claimed_mail_gift_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Индексы для быстрого поиска по провайдерам авторизации и имени
CREATE INDEX IF NOT EXISTS idx_players_name_lower ON public.players (lower(name));
CREATE INDEX IF NOT EXISTS idx_players_google_id ON public.players (google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_facebook_id ON public.players (facebook_id) WHERE facebook_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_telegram_id ON public.players (telegram_id) WHERE telegram_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_real_email ON public.players (lower(real_email)) WHERE real_email IS NOT NULL AND real_email <> '';

-- 2. Включаем RLS для таблицы players
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- 3. Удаляем старые конфликтующие политики (если были)
DROP POLICY IF EXISTS "Allow anonymous insert on players" ON public.players;
DROP POLICY IF EXISTS "Allow anonymous select on players" ON public.players;
DROP POLICY IF EXISTS "Allow anonymous update on players" ON public.players;
DROP POLICY IF EXISTS "Enable all access for players" ON public.players;

-- 4. ПОЛИТИКА INSERT (Регистрация и добавление новых игроков)
CREATE POLICY "Allow anonymous insert on players"
ON public.players
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 5. ПОЛИТИКА SELECT (Чтение онлайна и списка зарегистрированных игроков)
CREATE POLICY "Allow anonymous select on players"
ON public.players
FOR SELECT
TO anon, authenticated
USING (true);

-- 6. ПОЛИТИКА UPDATE (Обновление данных игрока)
CREATE POLICY "Allow anonymous update on players"
ON public.players
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 7. Таблица реестра прогресса игроков (player_progress_ledger) для защиты от потери данных при обновлениях
CREATE TABLE IF NOT EXISTS public.player_progress_ledger (
  player_name text PRIMARY KEY,
  player_id bigint,
  level integer NOT NULL DEFAULT 1,
  exp bigint NOT NULL DEFAULT 0,
  gold bigint NOT NULL DEFAULT 1000,
  crystals bigint NOT NULL DEFAULT 100,
  mobs_killed integer NOT NULL DEFAULT 0,
  bosses_killed integer NOT NULL DEFAULT 0,
  pvp_kills integer NOT NULL DEFAULT 0,
  pvp_wins integer NOT NULL DEFAULT 0,
  pvp_losses integer NOT NULL DEFAULT 0,
  items_sold integer NOT NULL DEFAULT 0,
  total_gold_collected bigint NOT NULL DEFAULT 1000,
  home_pyramid_tier integer NOT NULL DEFAULT 0,
  claimed_achievement_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  claimed_fishing_achievements jsonb NOT NULL DEFAULT '[]'::jsonb,
  owned_skin_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  claimed_mail_gift_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  fishing_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  battle_pass jsonb NOT NULL DEFAULT '{}'::jsonb,
  daily_quests jsonb NOT NULL DEFAULT '[]'::jsonb,
  daily_quests_date text NOT NULL DEFAULT '',
  daily_crystal_chest_claimed_date text NOT NULL DEFAULT '',
  app_version text NOT NULL DEFAULT '1.1.55',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_progress_ledger_lower_name
  ON public.player_progress_ledger (lower(player_name));

ALTER TABLE public.player_progress_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select on player_progress_ledger" ON public.player_progress_ledger;
DROP POLICY IF EXISTS "Allow public insert on player_progress_ledger" ON public.player_progress_ledger;
DROP POLICY IF EXISTS "Allow public update on player_progress_ledger" ON public.player_progress_ledger;

CREATE POLICY "Allow public select on player_progress_ledger"
  ON public.player_progress_ledger FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert on player_progress_ledger"
  ON public.player_progress_ledger FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update on player_progress_ledger"
  ON public.player_progress_ledger FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 8. Добавление таблицы players в Realtime-публикацию
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
  END IF;
END $$;
