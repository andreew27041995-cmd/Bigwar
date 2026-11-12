-- =================================================================================
-- МИГРАЦИЯ v1.0.40: Heartbeat (Онлайн/Офлайн), Привязка Пирамид (1-3) к Уровню,
-- Надёжное сохранение прогресса без откатов и Таблица/Логика Рулетки
-- =================================================================================

-- 1. Расширение таблицы public.players всеми необходимыми колонками прогресса, Heartbeat и Рулетки
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS lvl integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS exp integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hp integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS max_hp integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS energy integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS max_energy integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS str integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS agi integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS vit integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS stat_points integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS location text DEFAULT 'city',
  ADD COLUMN IF NOT EXISTS pyramid_tier integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS row integer DEFAULT 9,
  ADD COLUMN IF NOT EXISTS col integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS external_sync_ts bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_until bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_wheel_spin_time bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_gold_wheel_spins integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_crystal_wheel_spins integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_wheel_spins_date text DEFAULT '',
  ADD COLUMN IF NOT EXISTS equipped jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS inventory jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trade_protocol jsonb DEFAULT '[]'::jsonb;

-- 2. Отдельная таблица истории вращений и выигрышей Рулетки (public.roulette_spins)
CREATE TABLE IF NOT EXISTS public.roulette_spins (
  id text PRIMARY KEY,
  player_name text NOT NULL,
  spin_mode text NOT NULL DEFAULT 'free',
  prize_name text NOT NULL,
  prize_icon text NOT NULL DEFAULT '🎁',
  prize_quality text NOT NULL DEFAULT 'rare',
  is_premium boolean NOT NULL DEFAULT false,
  spun_at bigint NOT NULL DEFAULT (extract(epoch FROM now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roulette_spins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read roulette_spins" ON public.roulette_spins;
CREATE POLICY "Allow public read roulette_spins"
  ON public.roulette_spins
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow public insert roulette_spins" ON public.roulette_spins;
CREATE POLICY "Allow public insert roulette_spins"
  ON public.roulette_spins
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 3. Отдельная таблица состояний ярусов Пирамид 1, 2, 3 (public.pyramid_tiers)
CREATE TABLE IF NOT EXISTS public.pyramid_tiers (
  tier integer PRIMARY KEY CHECK (tier IN (1, 2, 3)),
  min_level integer NOT NULL,
  max_level integer NOT NULL,
  seed bigint NOT NULL DEFAULT 1,
  last_respawn bigint NOT NULL DEFAULT 0,
  cells jsonb NOT NULL DEFAULT '[]'::jsonb,
  rare_boss_timers jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at bigint NOT NULL DEFAULT 0
);

INSERT INTO public.pyramid_tiers (tier, min_level, max_level)
VALUES
  (1, 1, 5),
  (2, 6, 10),
  (3, 11, 20)
ON CONFLICT (tier) DO UPDATE
SET min_level = EXCLUDED.min_level,
    max_level = EXCLUDED.max_level;

ALTER TABLE public.pyramid_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read pyramid_tiers" ON public.pyramid_tiers;
CREATE POLICY "Allow public read pyramid_tiers"
  ON public.pyramid_tiers
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow public write pyramid_tiers" ON public.pyramid_tiers;
CREATE POLICY "Allow public write pyramid_tiers"
  ON public.pyramid_tiers
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Триггерная функция жесткой привязки номера Пирамиды к уровню игрока и контроля Heartbeat (last_seen)
CREATE OR REPLACE FUNCTION public.fn_enforce_pyramid_tier_and_heartbeat()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  now_ms bigint := (extract(epoch FROM now()) * 1000)::bigint;
  effective_lvl integer := GREATEST(1, COALESCE(NEW.lvl, 1));
BEGIN
  -- Жесткая привязка значка и яруса Пирамиды к уровню:
  -- 1-5 ур. -> Пирамида 1
  -- 6-10 ур. -> Пирамида 2
  -- 11-20 ур. -> Пирамида 3
  IF effective_lvl <= 5 THEN
    NEW.pyramid_tier := 1;
  ELSIF effective_lvl <= 10 THEN
    NEW.pyramid_tier := 2;
  ELSE
    NEW.pyramid_tier := 3;
  END IF;

  -- Автоматический контроль статуса Онлайн через Heartbeat (last_seen):
  -- Если сигнал не поступал более 15 секунд, статус автоматически переключается на Офлайн
  IF COALESCE(NEW.is_online, false) = true THEN
    IF COALESCE(NEW.last_seen, 0) <= 0 OR (now_ms - NEW.last_seen) > 15000 THEN
      NEW.is_online := false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pyramid_tier_and_heartbeat ON public.players;
CREATE TRIGGER trg_enforce_pyramid_tier_and_heartbeat
  BEFORE INSERT OR UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enforce_pyramid_tier_and_heartbeat();

-- 5. Серверная RPC-функция пинга активности (Heartbeat) и авто-очистки зависших сессий
CREATE OR REPLACE FUNCTION public.ping_player_heartbeat(p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  now_ms bigint := (extract(epoch FROM now()) * 1000)::bigint;
BEGIN
  -- Подтверждаем активность текущего игрока
  UPDATE public.players
  SET is_online = true,
      last_seen = now_ms
  WHERE lower(name) = lower(trim(p_name));

  -- Автоматически переводим в Офлайн всех игроков, от которых нет пинга более 15 секунд
  UPDATE public.players
  SET is_online = false
  WHERE is_online = true
    AND (COALESCE(last_seen, 0) <= 0 OR (now_ms - last_seen) > 15000);
END;
$$;

-- 6. Нормализация текущих записей в БД
UPDATE public.players
SET pyramid_tier = CASE
  WHEN COALESCE(lvl, 1) <= 5 THEN 1
  WHEN COALESCE(lvl, 1) <= 10 THEN 2
  ELSE 3
END;

UPDATE public.players
SET is_online = false
WHERE is_online = true
  AND (COALESCE(last_seen, 0) <= 0 OR ((extract(epoch FROM now()) * 1000)::bigint - last_seen) > 15000);
