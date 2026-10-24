-- ========================================================
-- Схема таблицы public.players и RLS-политики для Supabase
-- Колонки: id, created_at, name, email, password, gold, crystals, is_admin
-- ========================================================

-- 1. Добавление необходимых колонок в таблицу players (если они еще не созданы)
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS email text DEFAULT '';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS password text DEFAULT '';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS gold bigint DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS crystals bigint DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_admin integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS location text DEFAULT 'city';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pyramid_tier integer DEFAULT 1;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS row integer DEFAULT 9;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS col integer DEFAULT 4;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS hp integer DEFAULT 100;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS max_hp integer DEFAULT 100;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS energy integer DEFAULT 100;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS max_energy integer DEFAULT 100;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS hp_potions integer DEFAULT 3;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS en_potions integer DEFAULT 3;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS lvl integer DEFAULT 1;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS exp bigint DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS avatar text DEFAULT '🧙‍♂️';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS equipped jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS inventory jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT true;

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

-- 7. Добавление таблицы players в Realtime-публикацию
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
  END IF;
END $$;
