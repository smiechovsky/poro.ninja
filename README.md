# Poro.ninja - League of Legends Champion Mastery Tracker

A comprehensive Node.js application for tracking League of Legends champion mastery data, grades, and progression history. Built with Express.js, PostgreSQL, and Docker.

## 🎯 Overview

Poro.ninja is a web application that allows users to:
- Search for League of Legends players by nickname and tag
- View detailed champion mastery information including levels, points, and progression
- Track champion grades (S+, S, A+, A, etc.) and mastery tokens
- View historical mastery data and progression over time
- Monitor mastery requirements and achievements

## 🏗️ Architecture

### Core Components

#### **Backend Services**
- **Express.js Server** (`app/server.js`) - Main application server
- **PostgreSQL Database** - Data persistence with 4 main tables
- **Riot Games API Integration** - Fetches player and mastery data
- **Data Synchronization Service** - Automated background sync
- **Champion Data Service** - Updates champion information from Data Dragon

#### **Database Schema**
- `AccountsToSync` - Player accounts to track
- `ChampionMasteryHistory` - Historical mastery progression
- `ChampionGrades` - Grade achievements and requirements
- `Champions` - Champion metadata and images

#### **API Routes**
- `/` - Main search interface
- `/search` - Account search with autocomplete
- `/:region/:user/overview` - Champion mastery overview
- `/:region/:user/history` - Mastery progression history
- `/:region/:user/overview/:champion` - Individual champion details

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Riot Games API Key
- PostgreSQL (included in Docker setup)

### Environment Variables
Create a `.env` file with:
```env
API_KEY=your_riot_api_key
DB_HOST=db
DB_PORT=5432
DB_DATABASE=poro_ninja
DB_USERNAME=postgres
DB_PASSWORD=your_password
DDRAGON_Version=15.6.1
SyncInterval=900
LOGS_LEVEL=1
```

### Installation & Running
```bash
# Clone the repository
git clone <repository-url>
cd poro.ninja

# Start the application
docker-compose up -d

# Access the application
open http://localhost:8000
```

## 📁 Project Structure

```
poro.ninja/
├── app/
│   ├── debugger/               # Logging and debugging utilities
│   │   ├── api.js              # API call logging
│   │   ├── config.js           # Log level configuration
│   │   ├── database.js         # Database operation logging
│   │   ├── overview.js         # Overview page logging
│   │   ├── scheduler.js        # Sync process logging
│   │   ├── server.js           # Server startup logging
│   │   └── utils.js            # Utility function logging
│   ├── Icons/                  # Static assets (mastery tokens)
│   ├── routes/                 # Express.js route handlers
│   │   ├── index.js            # Main route and search redirect
│   │   ├── search.js           # Account search API
│   │   ├── overview.js         # Champion mastery overview
│   │   ├── history.js          # Mastery history tracking
│   │   └── championOverview.js # Individual champion details
│   ├── services/               # Business logic services
│   │   ├── dataSync.js         # Data synchronization service
│   │   ├── riotApi.js          # Riot Games API client
│   │   ├── updateChampions.js  # Champion data updates
│   │   └── dbService.js        # Database operations
│   ├── utils/                  # Utility functions
│   │   ├── initDb.js           # Database initialization
│   │   ├── waitForDb.js        # Database connection waiting
│   │   └── regions.js          # Region mapping utilities
│   ├── web/                    # Frontend assets
│   │   └── index.html          # Main search interface
│   ├── db.js                   # Database connection pool
│   ├── init.sql                # Database schema
│   ├── scheduler.js            # Legacy scheduler (deprecated)
│   └── server.js               # Main application server
├── .env                        # Environment Variables
├── docker-compose.yml          # Docker services configuration
├── Dockerfile                  # Application container definition
└── package.json                # Node.js dependencies
```

## 🔧 Key Features

### 1. **Account Search & Management**
- Real-time search with autocomplete
- Support for all League of Legends regions
- Automatic account creation and tracking

### 2. **Champion Mastery Tracking**
- Mastery levels (1-7) and points
- Progress towards next level
- Mastery tokens earned and required
- Historical progression tracking

### 3. **Grade System Integration**
- Champion grades (S+, S, A+, A, B+, B, C+, C, D+, D)
- Grade requirements for mastery progression
- Visual indicators for achieved vs required grades
- Grade comparison and validation

### 4. **Automated Data Synchronization**
- Background sync every 15 minutes (configurable)
- Incremental updates to minimize API calls
- Error handling and retry logic
- Comprehensive logging system

### 5. **Comprehensive Logging**
- Multi-level logging system (0-2)
- Module-specific log prefixes
- Database operation tracking
- API call monitoring

## 🗄️ Database Schema

### AccountsToSync
```sql
CREATE TABLE AccountsToSync (
    id SERIAL PRIMARY KEY,
    region VARCHAR(10) NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    tag VARCHAR(10) NOT NULL,
    puuid VARCHAR(100) UNIQUE NOT NULL,
    continent VARCHAR(20),
    lastupdated TIMESTAMP DEFAULT NOW(),
    createdat TIMESTAMP DEFAULT NOW()
);
```

### ChampionMasteryHistory
```sql
CREATE TABLE ChampionMasteryHistory (
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
```

### ChampionGrades
```sql
CREATE TABLE ChampionGrades (
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
```

### Champions
```sql
CREATE TABLE Champions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    image_url TEXT
);
```

## 🔌 API Integration

### Riot Games API Endpoints Used
- **Account API**: `/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`
- **Champion Mastery API**: `/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}`
- **Data Dragon API**: Champion metadata and images

### Rate Limiting
- Respects Riot Games API rate limits
- Implements retry logic for failed requests
- Efficient caching of champion data

## 🐳 Docker Configuration

### Services
- **app**: Node.js application (port 8000)
- **db**: PostgreSQL database (port 5432)

### Volumes
- `db_data`: Persistent PostgreSQL data storage

## 📊 Logging System

### Log Levels
- **Level 0**: Essential logs only (startup, errors)
- **Level 1**: Standard operation logs (sync status, database operations)
- **Level 2**: Detailed debug logs (API calls, query details)

### Log Format
```
[MODULE] [LOGS-LEVEL:X] Message
```

### Modules
- `[SERVER]` - Server startup and configuration
- `[UTILS]` - Database initialization and utilities
- `[DATABASE]` - Database operations and errors
- `[API]` - Riot Games API calls
- `[SCHEDULER-SYNC]` - Data synchronization process
- `[OVERVIEW]` - Overview page operations

## 🔄 Data Synchronization

### Sync Process
1. **Account Discovery**: Find accounts in database
2. **API Data Fetch**: Retrieve current mastery data
3. **Database Update**: Upsert mastery and grade information
4. **History Tracking**: Record changes for historical analysis
5. **Scheduling**: Schedule next sync cycle

### Sync Configuration
- **Default Interval**: 900 seconds (15 minutes)
- **Configurable**: Via `SyncInterval` environment variable
- **Error Handling**: Automatic retry on failures
- **Logging**: Comprehensive sync process logging

## 🎨 Frontend Features

### Search Interface
- Clean, modern design
- Real-time autocomplete suggestions
- Region selection support
- Responsive layout

### Mastery Overview
- Tabular data presentation
- Champion icons and links
- Visual grade indicators
- Token progress visualization
- Links to detailed views

### Historical Data
- Mastery progression over time
- Point accumulation tracking
- Level progression visualization
- Change detection and highlighting

## 🛠️ Development

### Adding New Features
1. Create service in `app/services/`
2. Add routes in `app/routes/`
3. Update database schema if needed
4. Add logging in `app/debugger/`
5. Update frontend in `app/web/`

### Testing
- Manual testing via web interface
- Database query validation
- API response verification
- Log level testing

### Deployment
- Docker-based deployment
- Environment variable configuration
- Database migration handling
- Health check endpoints

## 📝 License

This project is a Node.js rewrite of a Riot mastery tracker application.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions:
- Check the logs for error details
- Verify API key configuration
- Ensure database connectivity
- Review environment variables