-- ============================================================================
-- МИГРАЦИЯ БАЗЫ ДАННЫХ: ТАБЛИЦА ТЕРРИТОРИЙ КЛАНОВЫХ ВОЙН (territories)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.territories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_clan_id TEXT DEFAULT NULL,
  bonus_type TEXT NOT NULL,
  bonus_value NUMERIC NOT NULL DEFAULT 0,
  war_status TEXT NOT NULL DEFAULT 'peace',
  owner_clan_name TEXT DEFAULT NULL,
  owner_clan_tag TEXT DEFAULT NULL,
  owner_clan_emblem TEXT DEFAULT NULL,
  captured_at BIGINT DEFAULT NULL,
  protection_until BIGINT DEFAULT NULL,
  war_started_at BIGINT DEFAULT NULL,
  war_ends_at BIGINT DEFAULT NULL,
  attacker_clan_id TEXT DEFAULT NULL,
  attacker_clan_name TEXT DEFAULT NULL,
  attacker_clan_tag TEXT DEFAULT NULL,
  attacker_clan_emblem TEXT DEFAULT NULL,
  war_scores JSONB DEFAULT '{}'::jsonb,
  battle_7x7 JSONB DEFAULT NULL,
  last_battle_report JSONB DEFAULT NULL,
  updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- Начальное заполнение 6 секторов глобальной карты
INSERT INTO public.territories (id, name, owner_clan_id, bonus_type, bonus_value, war_status)
VALUES
  ('sector_ra_temple', 'Храм Ра', NULL, 'slots_luck', 10, 'peace'),
  ('sector_nile_oasis', 'Оазис Нила', NULL, 'fishing_gold', 8, 'peace'),
  ('sector_gold_mines', 'Золотые Рудники', NULL, 'pyramid_gold', 10, 'peace'),
  ('sector_anubis_citadel', 'Цитадель Анубиса', NULL, 'combat_dmg', 7, 'peace'),
  ('sector_luxor_obelisk', 'Обелиск Мудрости Тота', NULL, 'pyramid_exp', 10, 'peace'),
  ('sector_alexandria_port', 'Бастион Дельты', NULL, 'max_hp', 8, 'peace')
ON CONFLICT (id) DO NOTHING;
