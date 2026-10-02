-- ====================================================================
-- Market Master Supabase Migration: 001_initial_schema.sql
-- Normalized schema supporting multi-user gameplay, admin panel & audit logs
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Profiles (Users / Participants & Admins)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('participant', 'admin')),
    avatar TEXT NOT NULL DEFAULT '🦊',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'banned')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

-- 3. Game Settings (Global / Default Config)
CREATE TABLE IF NOT EXISTS game_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    default_starting_capital NUMERIC NOT NULL DEFAULT 10000,
    default_min_risk NUMERIC NOT NULL DEFAULT 10,
    default_max_risk NUMERIC NOT NULL DEFAULT 75,
    default_question_duration INTEGER NOT NULL DEFAULT 15,
    default_profit_multiplier NUMERIC NOT NULL DEFAULT 1.0,
    default_loss_multiplier NUMERIC NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Questions Repository
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option TEXT NOT NULL,
    explanation TEXT,
    category TEXT NOT NULL DEFAULT 'Market Intelligence',
    duration_seconds INTEGER NOT NULL DEFAULT 15,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_is_active ON questions(is_active);

-- 5. Games Table
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_pin TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'waiting', 'live', 'paused', 'market_closed', 'completed', 'cancelled')),
    starting_capital NUMERIC NOT NULL DEFAULT 10000,
    min_risk NUMERIC NOT NULL DEFAULT 10,
    max_risk NUMERIC NOT NULL DEFAULT 75,
    default_question_duration INTEGER NOT NULL DEFAULT 15,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_games_pin ON games(game_pin);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);

-- 6. Game Questions (Ordered mapping of questions to a specific game)
CREATE TABLE IF NOT EXISTS game_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
    round_number INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 15,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(game_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_game_questions_game ON game_questions(game_id);

-- 7. Rounds Table (Tracks active live round state)
CREATE TABLE IF NOT EXISTS rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'question_open', 'market_open', 'market_closed', 'result', 'settled')),
    started_at TIMESTAMPTZ,
    market_closed_at TIMESTAMPTZ,
    answer_revealed_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(game_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_rounds_game_status ON rounds(game_id, status);

-- 8. Game Players (Participant enrolled in a game)
CREATE TABLE IF NOT EXISTS game_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    current_capital NUMERIC NOT NULL DEFAULT 10000,
    starting_capital NUMERIC NOT NULL DEFAULT 10000,
    total_profit_loss NUMERIC NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'bankrupt', 'left', 'finished')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    UNIQUE(game_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_game_players_game_capital ON game_players(game_id, current_capital DESC);
CREATE INDEX IF NOT EXISTS idx_game_players_user ON game_players(user_id);

-- 9. Answers Table (Player submitted answer per round)
CREATE TABLE IF NOT EXISTS answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    selected_option TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    timed_out BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(round_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_answers_round_user ON answers(round_id, user_id);

-- 10. Positions Table (Player financial risk / bid per round)
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    risk_percent NUMERIC NOT NULL,
    bid_amount NUMERIC NOT NULL,
    multiplier NUMERIC NOT NULL DEFAULT 1,
    potential_profit NUMERIC NOT NULL DEFAULT 0,
    potential_loss NUMERIC NOT NULL DEFAULT 0,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    result TEXT DEFAULT 'pending' CHECK (result IN ('pending', 'win', 'loss', 'timeout')),
    profit_loss NUMERIC DEFAULT 0,
    settled_at TIMESTAMPTZ,
    UNIQUE(round_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_positions_round_user ON positions(round_id, user_id);

-- 11. Transactions (Authoritative ledger for all capital fluctuations)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    round_id UUID REFERENCES rounds(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('starting_capital', 'risk_lock', 'profit', 'loss', 'adjustment', 'refund')),
    amount NUMERIC NOT NULL,
    balance_after NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_game_user ON transactions(game_id, user_id);

-- 12. Leaderboard Snapshots
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    capital NUMERIC NOT NULL,
    profit_loss NUMERIC NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_game_rank ON leaderboard_snapshots(game_id, rank);

-- 13. Admin Actions (Audit Log)
CREATE TABLE IF NOT EXISTS admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);


-- ====================================================================
-- SEED DATA
-- ====================================================================

-- Default Settings (idempotent: only insert once on fresh DB)
INSERT INTO game_settings (default_starting_capital, default_min_risk, default_max_risk, default_question_duration)
SELECT 10000, 10, 75, 15
WHERE NOT EXISTS (SELECT 1 FROM game_settings);

-- Initial Administrator Profile (Required for Admin Panel access)
-- Admin: admin@marketmaster.com / ECELLADMIN
INSERT INTO profiles (id, name, email, password_hash, role, avatar, status)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Admin', 'admin@marketmaster.com', 'pbkdf2:sha256:1000000$gRjr2RETaxjQk4Ur$00c9c0b0e9d63fe71b10924957266e02e4066a4b59a2d2a8b397f86d43403194', 'admin', '🦁', 'active')
ON CONFLICT (email) DO NOTHING;


-- Note: All questions, games, and participants are created dynamically through the Admin Panel or signup flow.

