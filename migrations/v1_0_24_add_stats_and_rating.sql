-- ==============================================================================
-- Migration v1.0.24: Safe Schema Expansion for Players & Permanent Leaderboard
-- IMPORTANT: This script uses ADD COLUMN IF NOT EXISTS and CREATE TABLE IF NOT EXISTS.
-- It strictly PRESERVES all existing accounts, passwords, levels, exp, gold, and crystals.
-- ==============================================================================

-- 1. Ensure all statistics and gameplay columns exist in the 'players' table
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS lvl integer DEFAULT 1;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS exp integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS hp integer DEFAULT 100;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS max_hp integer DEFAULT 100;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS energy integer DEFAULT 100;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS max_energy integer DEFAULT 100;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS hp_potions integer DEFAULT 3;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS en_potions integer DEFAULT 3;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS mobs_killed integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS mob_kills integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pvp_kills integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pvp_wins integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pvp_losses integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS deaths integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS total_gold_collected bigint DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS premium_until bigint DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS last_wheel_spin_time bigint DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS last_gold_wheel_spin_time bigint DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS daily_gold_wheel_spins integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS daily_crystal_wheel_spins integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS daily_wheel_spins_date text DEFAULT '';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS daily_gold_to_crystal_count integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS daily_gold_to_crystal_date text DEFAULT '';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS daily_crystal_to_gold_count integer DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS daily_crystal_to_gold_date text DEFAULT '';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS avatar text DEFAULT '🧙‍♂️';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS location text DEFAULT 'city';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pyramid_tier integer DEFAULT 1;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS row integer DEFAULT 9;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS col integer DEFAULT 1;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS last_seen bigint DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS was_killed_in_pvp boolean DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS killed_by text;

-- 2. Create the permanent Leaderboard table
CREATE TABLE IF NOT EXISTS public.leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text UNIQUE NOT NULL,
  lvl integer DEFAULT 1,
  avatar text DEFAULT '🧙‍♂️',
  is_premium boolean DEFAULT false,
  mobs_killed integer DEFAULT 0,
  total_gold bigint DEFAULT 0,
  pvp_kills integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- 3. Configure Row Level Security (RLS) policies for the leaderboard
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leaderboard' AND policyname = 'Allow public read access to leaderboard'
  ) THEN
    CREATE POLICY "Allow public read access to leaderboard" ON public.leaderboard FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leaderboard' AND policyname = 'Allow all write access to leaderboard'
  ) THEN
    CREATE POLICY "Allow all write access to leaderboard" ON public.leaderboard FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Initial sync: Populate leaderboard with existing players
INSERT INTO public.leaderboard (player_name, lvl, avatar, is_premium, mobs_killed, total_gold, pvp_kills, updated_at)
SELECT 
  p.name,
  COALESCE(p.lvl, 1),
  COALESCE(p.avatar, '🧙‍♂️'),
  COALESCE(p.is_premium, false),
  COALESCE(p.mobs_killed, 0),
  COALESCE(p.total_gold_collected, p.gold, 0),
  COALESCE(p.pvp_kills, 0),
  now()
FROM public.players p
WHERE p.name NOT LIKE '__%' AND p.name IS NOT NULL AND p.name <> ''
ON CONFLICT (player_name) DO UPDATE SET
  lvl = EXCLUDED.lvl,
  avatar = EXCLUDED.avatar,
  is_premium = EXCLUDED.is_premium,
  mobs_killed = GREATEST(public.leaderboard.mobs_killed, EXCLUDED.mobs_killed),
  total_gold = GREATEST(public.leaderboard.total_gold, EXCLUDED.total_gold),
  pvp_kills = GREATEST(public.leaderboard.pvp_kills, EXCLUDED.pvp_kills),
  updated_at = now();
