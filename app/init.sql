CREATE TABLE IF NOT EXISTS AccountsToSync (
    id SERIAL PRIMARY KEY,
    region VARCHAR(10) NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    tag VARCHAR(10) NOT NULL,
    puuid VARCHAR(100) UNIQUE NOT NULL,
    continent VARCHAR(20),
    lastupdated TIMESTAMP DEFAULT NOW(),
    createdat TIMESTAMP DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS Champions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    image_url TEXT
);