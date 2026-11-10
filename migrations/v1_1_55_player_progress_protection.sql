-- =================================================================================
-- МИГРАЦИЯ v1.1.55: ЗАЩИТА ПРОГРЕССА ИГРОКОВ ПРИ ОБНОВЛЕНИЯХ (PLAYER PROGRESS LEDGER)
-- Создает таблицу слепков прогресса (валюта, рейтинги, достижения, рыбалка, БП)
-- и триггер PostgreSQL, предотвращающий обнуление статистики или потерю наград
-- при любых клиентских и серверных обновлениях.
-- =================================================================================

-- 1. Добавляем недостающие колонки прогресса в основную таблицу public.players
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS mobs_killed integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS bosses_killed integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pvp_kills integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pvp_wins integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pvp_losses integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS items_sold integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS total_gold_collected bigint DEFAULT 1000;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS home_pyramid_tier integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS claimed_achievement_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS fishing_state jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS battle_pass jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS daily_quests jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS daily_quests_date text DEFAULT '';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS daily_crystal_chest_claimed_date text DEFAULT '';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS daily_login_day integer DEFAULT 1;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS daily_login_last_date text DEFAULT '';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS owned_skin_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS owned_skins jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS claimed_mail_gift_ids jsonb DEFAULT '[]'::jsonb;

-- 2. Создаем отдельную таблицу реестра прогресса игроков (player_progress_ledger)
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

-- Индекс для быстрого поиска по регистронезависимому имени персонажа
CREATE INDEX IF NOT EXISTS idx_player_progress_ledger_lower_name
  ON public.player_progress_ledger (lower(player_name));

-- Включаем RLS для таблицы player_progress_ledger
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

-- 3. Функция объединения уникальных элементов двух JSONB-массивов (для достижений и скинов)
CREATE OR REPLACE FUNCTION public.jsonb_array_union_unique(a jsonb, b jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(DISTINCT elem),
    '[]'::jsonb
  )
  FROM (
    SELECT jsonb_array_elements(
      CASE WHEN jsonb_typeof(a) = 'array' THEN a ELSE '[]'::jsonb END
    ) AS elem
    UNION
    SELECT jsonb_array_elements(
      CASE WHEN jsonb_typeof(b) = 'array' THEN b ELSE '[]'::jsonb END
    ) AS elem
  ) sub;
$$;

-- 4. Триггер защиты прогресса персонажей при UPDATE в таблице public.players
CREATE OR REPLACE FUNCTION public.protect_player_progress_on_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_json jsonb := '{}'::jsonb;
  new_json jsonb := '{}'::jsonb;
  merged_achievements jsonb;
  merged_skins jsonb;
  merged_gifts jsonb;
BEGIN
  -- Пропускаем системные строки
  IF NEW.name IN ('__GLOBAL_MAILBOX__', '__GLOBAL_PYRAMID_TIERS__', '__PLAYER_PROGRESS_LEDGER__') THEN
    RETURN NEW;
  END IF;

  -- Безопасно парсим JSON из колонки email (если там хранится расширенное состояние)
  BEGIN
    IF OLD.email IS NOT NULL AND left(btrim(OLD.email), 1) = '{' THEN
      old_json := OLD.email::jsonb;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    old_json := '{}'::jsonb;
  END;

  BEGIN
    IF NEW.email IS NOT NULL AND left(btrim(NEW.email), 1) = '{' THEN
      new_json := NEW.email::jsonb;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    new_json := '{}'::jsonb;
  END;

  -- Монотонная защита уровня и опыта (никогда не уменьшаются при обычном сохранении)
  NEW.level := GREATEST(COALESCE(NEW.level, 1), COALESCE(OLD.level, 1));
  IF NEW.level = OLD.level THEN
    NEW.exp := GREATEST(COALESCE(NEW.exp, 0), COALESCE(OLD.exp, 0));
  END IF;

  -- Защита от случайного сброса на дефолтные значения (1000 золота / 100 кристаллов) при перезагрузке
  IF COALESCE(NEW.gold, 0) = 1000 AND COALESCE(NEW.crystals, 0) = 100
     AND (COALESCE(OLD.gold, 0) > 1000 OR COALESCE(OLD.crystals, 0) > 100) THEN
    NEW.gold := OLD.gold;
    NEW.crystals := OLD.crystals;
  END IF;

  -- Монотонная защита накопительных рейтингов и счетчиков
  NEW.mobs_killed := GREATEST(
    COALESCE(NEW.mobs_killed, 0),
    COALESCE(OLD.mobs_killed, 0),
    COALESCE((new_json->>'mobs_killed')::integer, 0),
    COALESCE((old_json->>'mobs_killed')::integer, 0)
  );
  NEW.bosses_killed := GREATEST(
    COALESCE(NEW.bosses_killed, 0),
    COALESCE(OLD.bosses_killed, 0),
    COALESCE((new_json->>'bosses_killed')::integer, 0),
    COALESCE((old_json->>'bosses_killed')::integer, 0)
  );
  NEW.pvp_kills := GREATEST(
    COALESCE(NEW.pvp_kills, 0),
    COALESCE(OLD.pvp_kills, 0),
    COALESCE((new_json->>'pvp_kills')::integer, 0),
    COALESCE((old_json->>'pvp_kills')::integer, 0)
  );
  NEW.pvp_wins := GREATEST(
    COALESCE(NEW.pvp_wins, 0),
    COALESCE(OLD.pvp_wins, 0),
    COALESCE((new_json->>'pvp_wins')::integer, 0),
    COALESCE((old_json->>'pvp_wins')::integer, 0)
  );
  NEW.pvp_losses := GREATEST(
    COALESCE(NEW.pvp_losses, 0),
    COALESCE(OLD.pvp_losses, 0),
    COALESCE((new_json->>'pvp_losses')::integer, 0),
    COALESCE((old_json->>'pvp_losses')::integer, 0)
  );
  NEW.items_sold := GREATEST(
    COALESCE(NEW.items_sold, 0),
    COALESCE(OLD.items_sold, 0),
    COALESCE((new_json->>'items_sold')::integer, 0),
    COALESCE((old_json->>'items_sold')::integer, 0)
  );
  NEW.total_gold_collected := GREATEST(
    COALESCE(NEW.total_gold_collected, 1000),
    COALESCE(OLD.total_gold_collected, 1000),
    COALESCE(NEW.gold, 1000),
    COALESCE((new_json->>'total_gold_collected')::bigint, 1000),
    COALESCE((old_json->>'total_gold_collected')::bigint, 1000)
  );
  NEW.home_pyramid_tier := GREATEST(
    COALESCE(NEW.home_pyramid_tier, 0),
    COALESCE(OLD.home_pyramid_tier, 0),
    COALESCE((new_json->>'home_pyramid_tier')::integer, 0),
    COALESCE((old_json->>'home_pyramid_tier')::integer, 0)
  );

  -- Аддитивное объединение полученных достижений, скинов и подарков почты (никогда не стираются)
  merged_achievements := public.jsonb_array_union_unique(
    public.jsonb_array_union_unique(COALESCE(OLD.claimed_achievement_ids, '[]'::jsonb), COALESCE(NEW.claimed_achievement_ids, '[]'::jsonb)),
    public.jsonb_array_union_unique(COALESCE(old_json->'claimed_achievement_ids', '[]'::jsonb), COALESCE(new_json->'claimed_achievement_ids', '[]'::jsonb))
  );
  NEW.claimed_achievement_ids := merged_achievements;

  merged_skins := public.jsonb_array_union_unique(
    public.jsonb_array_union_unique(COALESCE(OLD.owned_skin_ids, '[]'::jsonb), COALESCE(NEW.owned_skin_ids, '[]'::jsonb)),
    public.jsonb_array_union_unique(COALESCE(old_json->'owned_skin_ids', '[]'::jsonb), COALESCE(new_json->'owned_skin_ids', '[]'::jsonb))
  );
  NEW.owned_skin_ids := merged_skins;

  merged_gifts := public.jsonb_array_union_unique(
    public.jsonb_array_union_unique(COALESCE(OLD.claimed_mail_gift_ids, '[]'::jsonb), COALESCE(NEW.claimed_mail_gift_ids, '[]'::jsonb)),
    public.jsonb_array_union_unique(COALESCE(old_json->'claimed_mail_gift_ids', '[]'::jsonb), COALESCE(new_json->'claimed_mail_gift_ids', '[]'::jsonb))
  );
  NEW.claimed_mail_gift_ids := merged_gifts;

  -- Синхронизируем защищенные поля обратно в JSON колонки email, если она используется
  IF jsonb_typeof(new_json) = 'object' AND new_json <> '{}'::jsonb THEN
    new_json := jsonb_set(new_json, '{mobs_killed}', to_jsonb(NEW.mobs_killed), true);
    new_json := jsonb_set(new_json, '{bosses_killed}', to_jsonb(NEW.bosses_killed), true);
    new_json := jsonb_set(new_json, '{pvp_kills}', to_jsonb(NEW.pvp_kills), true);
    new_json := jsonb_set(new_json, '{pvp_wins}', to_jsonb(NEW.pvp_wins), true);
    new_json := jsonb_set(new_json, '{pvp_losses}', to_jsonb(NEW.pvp_losses), true);
    new_json := jsonb_set(new_json, '{items_sold}', to_jsonb(NEW.items_sold), true);
    new_json := jsonb_set(new_json, '{total_gold_collected}', to_jsonb(NEW.total_gold_collected), true);
    new_json := jsonb_set(new_json, '{home_pyramid_tier}', to_jsonb(NEW.home_pyramid_tier), true);
    new_json := jsonb_set(new_json, '{claimed_achievement_ids}', merged_achievements, true);
    new_json := jsonb_set(new_json, '{owned_skin_ids}', merged_skins, true);
    new_json := jsonb_set(new_json, '{claimed_mail_gift_ids}', merged_gifts, true);
    NEW.email := new_json::text;
  END IF;

  -- Записываем актуальный слепок в реестр прогресса player_progress_ledger
  INSERT INTO public.player_progress_ledger (
    player_name, player_id, level, exp, gold, crystals,
    mobs_killed, bosses_killed, pvp_kills, pvp_wins, pvp_losses,
    items_sold, total_gold_collected, home_pyramid_tier,
    claimed_achievement_ids, owned_skin_ids, claimed_mail_gift_ids,
    fishing_state, battle_pass, daily_quests, daily_quests_date,
    daily_crystal_chest_claimed_date, updated_at
  ) VALUES (
    NEW.name, NEW.id, NEW.level, NEW.exp, NEW.gold, NEW.crystals,
    NEW.mobs_killed, NEW.bosses_killed, NEW.pvp_kills, NEW.pvp_wins, NEW.pvp_losses,
    NEW.items_sold, NEW.total_gold_collected, NEW.home_pyramid_tier,
    NEW.claimed_achievement_ids, NEW.owned_skin_ids, NEW.claimed_mail_gift_ids,
    COALESCE(new_json->'fishing_state', NEW.fishing_state, '{}'::jsonb),
    COALESCE(new_json->'battle_pass', NEW.battle_pass, '{}'::jsonb),
    COALESCE(new_json->'daily_quests', NEW.daily_quests, '[]'::jsonb),
    COALESCE(new_json->>'daily_quests_date', NEW.daily_quests_date, ''),
    COALESCE(new_json->>'daily_crystal_chest_claimed_date', NEW.daily_crystal_chest_claimed_date, ''),
    now()
  )
  ON CONFLICT (player_name) DO UPDATE SET
    player_id = EXCLUDED.player_id,
    level = GREATEST(public.player_progress_ledger.level, EXCLUDED.level),
    exp = CASE WHEN EXCLUDED.level > public.player_progress_ledger.level THEN EXCLUDED.exp ELSE GREATEST(public.player_progress_ledger.exp, EXCLUDED.exp) END,
    gold = EXCLUDED.gold,
    crystals = EXCLUDED.crystals,
    mobs_killed = GREATEST(public.player_progress_ledger.mobs_killed, EXCLUDED.mobs_killed),
    bosses_killed = GREATEST(public.player_progress_ledger.bosses_killed, EXCLUDED.bosses_killed),
    pvp_kills = GREATEST(public.player_progress_ledger.pvp_kills, EXCLUDED.pvp_kills),
    pvp_wins = GREATEST(public.player_progress_ledger.pvp_wins, EXCLUDED.pvp_wins),
    pvp_losses = GREATEST(public.player_progress_ledger.pvp_losses, EXCLUDED.pvp_losses),
    items_sold = GREATEST(public.player_progress_ledger.items_sold, EXCLUDED.items_sold),
    total_gold_collected = GREATEST(public.player_progress_ledger.total_gold_collected, EXCLUDED.total_gold_collected),
    home_pyramid_tier = GREATEST(public.player_progress_ledger.home_pyramid_tier, EXCLUDED.home_pyramid_tier),
    claimed_achievement_ids = public.jsonb_array_union_unique(public.player_progress_ledger.claimed_achievement_ids, EXCLUDED.claimed_achievement_ids),
    owned_skin_ids = public.jsonb_array_union_unique(public.player_progress_ledger.owned_skin_ids, EXCLUDED.owned_skin_ids),
    claimed_mail_gift_ids = public.jsonb_array_union_unique(public.player_progress_ledger.claimed_mail_gift_ids, EXCLUDED.claimed_mail_gift_ids),
    fishing_state = CASE WHEN EXCLUDED.fishing_state <> '{}'::jsonb THEN EXCLUDED.fishing_state ELSE public.player_progress_ledger.fishing_state END,
    battle_pass = CASE WHEN EXCLUDED.battle_pass <> '{}'::jsonb THEN EXCLUDED.battle_pass ELSE public.player_progress_ledger.battle_pass END,
    daily_quests = CASE WHEN EXCLUDED.daily_quests <> '[]'::jsonb THEN EXCLUDED.daily_quests ELSE public.player_progress_ledger.daily_quests END,
    daily_quests_date = CASE WHEN EXCLUDED.daily_quests_date <> '' THEN EXCLUDED.daily_quests_date ELSE public.player_progress_ledger.daily_quests_date END,
    daily_crystal_chest_claimed_date = CASE WHEN EXCLUDED.daily_crystal_chest_claimed_date <> '' THEN EXCLUDED.daily_crystal_chest_claimed_date ELSE public.player_progress_ledger.daily_crystal_chest_claimed_date END,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_player_progress_on_update ON public.players;
CREATE TRIGGER trg_protect_player_progress_on_update
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_player_progress_on_update();
