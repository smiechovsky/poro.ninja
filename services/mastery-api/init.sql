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

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- AccountsToSync indexes
CREATE INDEX IF NOT EXISTS idx_accounts_puuid ON AccountsToSync(puuid);
CREATE INDEX IF NOT EXISTS idx_accounts_region ON AccountsToSync(region);
CREATE INDEX IF NOT EXISTS idx_accounts_lastupdated ON AccountsToSync(lastupdated);

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