-- ====================================================================
-- Market Master Supabase Migration: 002_rls_lockdown.sql
-- Defense-in-depth: enable Row Level Security (deny-by-default) on all
-- application tables. No permissive policies are created on purpose:
--   - browsers never receive the service-role key (backend-only),
--   - all React traffic goes through the Flask API,
--   - Flask uses the service_role key, which bypasses RLS.
-- Result: direct anon/authenticated client access to tables is denied,
-- while the backend keeps full access. Safe to apply to fresh or
-- existing projects; creates no policies and drops nothing.
-- ====================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'game_settings', 'questions', 'games', 'game_questions',
    'rounds', 'game_players', 'answers', 'positions', 'transactions',
    'leaderboard_snapshots', 'admin_actions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;
