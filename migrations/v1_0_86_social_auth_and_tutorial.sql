-- =================================================================================
-- МИГРАЦИЯ БД v1.0.86: Регистрация через Google, Facebook, Telegram + Обучение + Офлайн реген
-- Выполните этот SQL-скрипт в Supabase SQL Editor (https://supabase.com/dashboard)
-- Примечание: Игра также автоматически сохраняет эти поля внутри JSON-состояния игрока,
-- поэтому прогресс всех существующих персонажей полностью сохранен!
-- =================================================================================

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS real_email text DEFAULT '';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS auth_provider text DEFAULT 'local';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS google_id text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS facebook_id text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS telegram_id text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS telegram_username text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS oauth_avatar text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS tutorial_completed boolean DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS last_seen bigint DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS premium_until bigint DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS npc_companion jsonb DEFAULT null;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_players_name_lower ON public.players (lower(name));
CREATE INDEX IF NOT EXISTS idx_players_google_id ON public.players (google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_facebook_id ON public.players (facebook_id) WHERE facebook_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_telegram_id ON public.players (telegram_id) WHERE telegram_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_real_email ON public.players (lower(real_email)) WHERE real_email IS NOT NULL AND real_email <> '';
