-- Poro.ninja - Central Database Schema
-- This file manages all database tables for the entire project
-- Each service will use this file to initialize the database

-- =====================================================
-- CORE TABLES (used by multiple services)
-- =====================================================

-- Accounts table - stores all player accounts
CREATE TABLE IF NOT EXISTS AccountsToSync (
    id SERIAL PRIMARY KEY,
    region VARCHAR(10) NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    tag VARCHAR(10) NOT NULL,
    puuid VARCHAR(100) UNIQUE NOT NULL,
    continent VARCHAR(20),
    lastupdated TIMESTAMP NULL,
    createdat TIMESTAMP DEFAULT NOW(),
    vip BOOLEAN DEFAULT FALSE
);

-- Ensure VIP column exists for existing databases
ALTER TABLE AccountsToSync ADD COLUMN IF NOT EXISTS vip BOOLEAN DEFAULT FALSE;
ALTER TABLE AccountsToSync ADD COLUMN IF NOT EXISTS lastupdated_mastery TIMESTAMP NULL;
ALTER TABLE AccountsToSync ADD COLUMN IF NOT EXISTS lastupdated_played_with TIMESTAMP NULL;
ALTER TABLE AccountsToSync ADD COLUMN IF NOT EXISTS vip_status_added_at TIMESTAMP NULL;

-- =====================================================
-- MASTERY API TABLES
-- =====================================================

-- Champion mastery history tracking
CREATE TABLE IF NOT EXISTS ChampionMasteryHistory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES AccountsToSync(id) ON DELETE CASCADE,
    champion_id INTEGER NOT NULL,
    mastery_level INTEGER,
    mastery_points INTEGER,
    tokens_earned INTEGER,
    points_since_last_level INTEGER,
    points_until_next_level INTEGER,
    first_seen TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW(),
    tokens_required INTEGER,
    CONSTRAINT unique_history UNIQUE (user_id, champion_id, mastery_level, mastery_points, tokens_earned)
);

-- Champion grades tracking
CREATE TABLE IF NOT EXISTS ChampionGrades (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES AccountsToSync(id) ON DELETE CASCADE,
    champion_id INTEGER NOT NULL,
    achieved_grades TEXT,
    required_grades TEXT,
    new_grade VARCHAR(10),
    first_seen TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, champion_id)
);

-- Champions reference table
CREATE TABLE IF NOT EXISTS Champions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    image_url TEXT
);

-- =====================================================
-- ACCOUNTS FINDER TABLES
-- =====================================================

-- Table to track scanned matches to avoid duplicate processing
CREATE TABLE IF NOT EXISTS ScannedMatches (
    id SERIAL PRIMARY KEY,
    match_id VARCHAR(100) UNIQUE NOT NULL,
    continent VARCHAR(20) NOT NULL,
    participants_count INTEGER NOT NULL,
    new_accounts_found INTEGER DEFAULT 0,
    scanned_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Extend ScannedMatches for per-participant storage and relations
ALTER TABLE ScannedMatches DROP CONSTRAINT IF EXISTS scannedmatches_match_id_key;
ALTER TABLE ScannedMatches ADD COLUMN IF NOT EXISTS participant_puuid TEXT;
ALTER TABLE ScannedMatches ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES AccountsToSync(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_scanned_matches_match_participant ON ScannedMatches(match_id, participant_puuid);
CREATE INDEX IF NOT EXISTS idx_scanned_matches_participant ON ScannedMatches(participant_puuid);
CREATE INDEX IF NOT EXISTS idx_scanned_matches_account_id ON ScannedMatches(account_id);

-- Table to track how many times a user has played with other users (for VIP accounts)
CREATE TABLE IF NOT EXISTS PlayedWith (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES AccountsToSync(id) ON DELETE CASCADE,
    other_user_id INTEGER REFERENCES AccountsToSync(id) ON DELETE CASCADE,
    match_id VARCHAR(100),
    UNIQUE (user_id, other_user_id, match_id)
);

-- Restructure PlayedWith to per-match rows
ALTER TABLE PlayedWith ADD COLUMN IF NOT EXISTS match_id VARCHAR(100);
-- Drop legacy counters/timestamps if present
ALTER TABLE PlayedWith DROP COLUMN IF EXISTS matches_together;
ALTER TABLE PlayedWith DROP COLUMN IF EXISTS last_seen;
-- Ensure uniqueness per (user_id, other_user_id, match_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_playedwith_unique ON PlayedWith(user_id, other_user_id, match_id);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- AccountsToSync indexes
CREATE INDEX IF NOT EXISTS idx_accounts_puuid ON AccountsToSync(puuid);
CREATE INDEX IF NOT EXISTS idx_accounts_region ON AccountsToSync(region);
CREATE INDEX IF NOT EXISTS idx_accounts_lastupdated ON AccountsToSync(lastupdated);
CREATE INDEX IF NOT EXISTS idx_accounts_vip ON AccountsToSync(vip);
CREATE INDEX IF NOT EXISTS idx_accounts_lastupdated_mastery ON AccountsToSync(lastupdated_mastery);
CREATE INDEX IF NOT EXISTS idx_accounts_lastupdated_played_with ON AccountsToSync(lastupdated_played_with);
CREATE INDEX IF NOT EXISTS idx_accounts_vip_status_added_at ON AccountsToSync(vip_status_added_at);

-- ChampionMasteryHistory indexes
CREATE INDEX IF NOT EXISTS idx_mastery_user_id ON ChampionMasteryHistory(user_id);
CREATE INDEX IF NOT EXISTS idx_mastery_champion_id ON ChampionMasteryHistory(champion_id);
CREATE INDEX IF NOT EXISTS idx_mastery_last_seen ON ChampionMasteryHistory(last_seen);

-- ChampionGrades indexes
CREATE INDEX IF NOT EXISTS idx_grades_user_id ON ChampionGrades(user_id);
CREATE INDEX IF NOT EXISTS idx_grades_champion_id ON ChampionGrades(champion_id);

-- ScannedMatches indexes
CREATE INDEX IF NOT EXISTS idx_scanned_matches_match_id ON ScannedMatches(match_id);
CREATE INDEX IF NOT EXISTS idx_scanned_matches_continent ON ScannedMatches(continent);
CREATE INDEX IF NOT EXISTS idx_scanned_matches_scanned_at ON ScannedMatches(scanned_at);
CREATE INDEX IF NOT EXISTS idx_scanned_matches_participant ON ScannedMatches(participant_puuid);
CREATE INDEX IF NOT EXISTS idx_scanned_matches_account_id ON ScannedMatches(account_id);

-- PlayedWith indexes
CREATE INDEX IF NOT EXISTS idx_playedwith_user_id ON PlayedWith(user_id);
CREATE INDEX IF NOT EXISTS idx_playedwith_other_user_id ON PlayedWith(other_user_id);
CREATE INDEX IF NOT EXISTS idx_playedwith_match_id ON PlayedWith(match_id);
-- Ensure old uniqueness on (user_id, other_user_id) is removed to allow per-match rows
ALTER TABLE PlayedWith DROP CONSTRAINT IF EXISTS playedwith_user_id_other_user_id_key;