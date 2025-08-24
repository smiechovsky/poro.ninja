# Poro.ninja - League of Legends Mastery Tracking System

Modular system for tracking champion mastery in League of Legends, built with microservices architecture.

## 🏗️ Project Architecture

```
poro.ninja/
├── docker-compose.yml          # Orchestration of all services
├── utils/
│   └── initDb.js              # Universal database initialization system
└── services/
    ├── mastery-api/           # API service - data processing
    │   ├── server.js          # Main API server
    │   ├── init.sql           # Database schema (shared by all services)
    │   ├── services/          # Business logic
    │   │   ├── dataSync.js    # Mastery data synchronization
    │   │   ├── riotApi.js     # Riot API integration
    │   │   └── updateChampions.js # Champion updates
    │   ├── debugger/          # Logging system
    │   ├── utils/             # Helper utilities
    │   │   ├── rateLimiter.js # Adaptive rate limiting
    │   │   ├── batchProcessor.js # Batch processing
    │   │   ├── batchSizeManager.js # Adaptive batch sizing
    │   │   ├── memoryMonitor.js # Memory management
    │   │   ├── syncScheduler.js # Continuous sync scheduling
    │   │   └── processManager.js # Process lifecycle management
    │   ├── package.json       # Dependencies
    │   └── Dockerfile         # Container configuration
    │
    ├── mastery-worker/        # Web service - data display
    │   ├── server.js          # Express server
    │   ├── init.sql           # Database schema (duplicate)
    │   ├── routes/            # Web endpoints
    │   │   ├── overview.js    # Mastery overview
    │   │   ├── championOverview.js # Champion details
    │   │   ├── history.js     # Mastery history
    │   │   ├── search.js      # Player search
    │   │   └── index.js       # Homepage
    │   ├── web/               # Frontend (HTML, CSS)
    │   │   └── css/           # Modular CSS files
    │   ├── Icons/             # Icons and assets
    │   ├── debugger/          # Logging system
    │   ├── utils/             # Helper utilities
    │   ├── package.json       # Dependencies
    │   └── Dockerfile         # Container configuration
    │
    ├── accounts-finder/       # Service - finding new players
    │   ├── server.js          # Main service process
    │   ├── init.sql           # Database schema (duplicate)
    │   ├── services/          # Processing logic
    │   │   ├── matchProcessor.js # Match processing
    │   │   ├── rateLimiter.js # Rate limiting control
    │   │   └── riotApi.js     # Riot API integration
    │   ├── debugger/          # Logging system
    │   ├── utils/             # Helper utilities
    │   ├── package.json       # Dependencies
    │   └── Dockerfile         # Container configuration
    │
    └── load-balancer/         # Nginx load balancer
        ├── nginx.conf         # Nginx configuration
        └── Dockerfile         # Container configuration
```

## 🚀 Quick Start

### Requirements
- Docker and Docker Compose
- Riot Games API key
- `.env` configuration file

### Start entire system
```bash
docker-compose up -d
```

### Start specific service
```bash
# API only
docker-compose up mastery-api

# Web interface only
docker-compose up mastery-worker

# New player finder only
docker-compose up accounts-finder

# Load balancer only
docker-compose up load-balancer
```

## 🌐 System Services

### Mastery API (Port: 8080)
**Functions:**
- Mastery data synchronization with Riot API
- Automatic player account addition
- Intelligent scanning with priorities
- `/api/add-account` endpoint for adding accounts
- `/api/force-sync` endpoint for manual sync testing

**Performance Optimizations:**
- **Parallel processing**: Up to 10 accounts processed simultaneously (5 per batch × 2 concurrent batches)
- **Batch database operations**: Multiple mastery records inserted in single query
- **Adaptive rate limiting**: Automatically adjusts API limits based on 429 errors
- **Connection pooling**: Optimized database connections for parallel processing
- **User ID caching**: Reduces database queries for repeated lookups

**Intelligent scanning:**
- Priority for new accounts (without `lastupdated`)
- Spam protection (min. 15 min between scans)
- Detailed progress reporting

### Mastery Worker (Port: 3001)
**Functions:**
- Web interface at `mastery.smiechowski.com`
- Champion mastery overview
- Mastery change history
- Player search
- Statistics and analytics

**Endpoints:**
- `/` - Homepage
- `/overview` - Mastery overview
- `/champion/:id` - Champion details
- `/history` - Mastery history
- `/search` - Search

### Accounts Finder
**Functions:**
- Automatic new player discovery
- Match history processing (100 recent matches)
- Optimization through scanned match tracking
- Intelligent rate limiting management

**Optimizations:**
- `ScannedMatches` table prevents duplicates
- Performance tracking (new accounts per match)
- Detailed progress logging

### Load Balancer (Nginx)
**Functions:**
- Load balancing between services
- Rate limiting (API: 10r/s, Search: 5r/s)
- Gzip compression
- Static file caching
- Health checks

## 🗄️ Database (PostgreSQL)

### Central schema (`init.sql`)
```sql
-- CORE TABLES
AccountsToSync              # All player accounts

-- MASTERY API TABLES  
ChampionMasteryHistory      # Champion mastery history
ChampionGrades             # Champion achievements
Champions                  # Champion reference table

-- ACCOUNTS FINDER TABLES
ScannedMatches             # Scanned match tracking
```

### Centralization benefits:
- Single file manages all tables
- Automatic initialization by all services
- Schema consistency between services
- Easy addition of new tables

## ⚙️ Configuration

### Environment variables (.env)
```env
# Riot API
API_KEY=your_riot_api_key
DDRAGON_Version=latest

# Database
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=poro_ninja
DB_USERNAME=postgres
DB_PASSWORD=your_password

# Logging
LOGS_LEVEL=0

# Intervals
SyncInterval=3600
ACCOUNTS_FINDER_INTERVAL_SECONDS=3600
MATCHES_PER_ACCOUNT=100

# Performance optimization settings
BATCH_SIZE=5                    # Accounts per batch (default: 5)
MAX_CONCURRENT_BATCHES=2        # Concurrent batches (default: 2)
RATE_LIMIT_LOG_INTERVAL=5000    # Rate limit log throttle in ms (default: 5000)
PROGRESS_LOG_INTERVAL=50        # Progress log every N accounts (default: 50)
```

### Logging levels (LOGS_LEVEL)
- `0` - Basic logs (service start, database connection, loops)
- `1` - Detailed logs (progress, rate limiting, summaries)
- `2` - Debug logs (account processing, matches, participants)

**Log format:** `[SERVICE] [LOGS-LEVEL:X] Message`

## 🔧 Advanced Optimization Systems

### 1. Rate Limiter (Ogranicznik zapytań)

**Cel:** Zapobiega przekraczaniu limitów API Riot (błędy 429).

**Jak działa:**
- **Liczy zapytania w oknie czasowym:**
  - Mastery API: 20,000 zapytań na 10 sekund (max) → 4,000 zapytań na 10 sekund (min)
  - Global API: 6,000 zapytań na 10 sekund (max) → 1,200 zapytań na 10 sekund (min)
  - Accounts Finder: 20,000 zapytań na 10 sekund (max) → 10,000 zapytań na 10 sekund (min)

- **Adaptive Mode:** Jeśli pojawiają się błędy 429, limity są dynamicznie zmniejszane:
  - **Agresywna redukcja:** `backoffMultiplier *= 0.5` (do minimum 0.2)
  - **Przywracanie:** Po 5 minutach bez błędów, `backoffMultiplier *= 1.02` (do maksimum 1.0)
  - **Timeout Handling:** Dla błędów 504/ECONNRESET: `backoffMultiplier *= 0.8` (do minimum 0.5)

- **Wartości:**
  - **Mastery API:** 20,000 → 4,000 req/10s (backoff 0.2-1.0)
  - **Accounts Finder:** 20,000 → 10,000 req/10s (backoff 0.5-1.0)
  - **Global:** 6,000 → 1,200 req/10s (backoff 0.2-1.0)

### 2. Batch Processing (Przetwarzanie wsadowe)

**Cel:** Grupuje konta w "batch" (wsad) i przetwarza równolegle.

**Jak działa:**
- **Batch Size:** Rozmiar wsadu dynamicznie dostosowywany:
  - **Minimalny:** 1 konto na batch
  - **Maksymalny:** 3 konta na batch (Mastery API), 5 kont na batch (Accounts Finder)
  - **Zwiększanie:** Jeśli `errorCount < 1` → `batchSize += 1` (powoli)
  - **Zmniejszanie:** Jeśli `errorCount > 5` → `batchSize -= 1` (szybko)

- **Max Concurrent Batches:**
  - **Minimalny:** 1 batch równolegle
  - **Maksymalny:** 1 batch równolegle (Mastery API), 2 batche równolegle (Accounts Finder)

- **Korzyści:** 
  - **Mastery API:** 1-3 konta × 1 batch = 1-3 konta równolegle
  - **Accounts Finder:** 1-5 konta × 1-2 batche = 1-10 kont równolegle

### 3. Adaptive Backoff (Adaptacyjne opóźnienia)

**Cel:** Automatyczne wydłużanie czasu oczekiwania po błędach.

**Jak działa:**
- **Exponential Backoff:** Opóźnienie rośnie wykładniczo z każdą próbą
  - **429 errors:** `waitTime = retryAfter * Math.pow(2, retryCount - 1)` (min 30s)
  - **504/Timeout:** `waitTime = Math.pow(2, retryCount) * 5` (min 10s)
  - **Max retries:** 5 prób przed porzuceniem

- **Wartości:**
  - **Minimalne opóźnienie:** 10-30 sekund
  - **Maksymalne opóźnienie:** 160-480 sekund (po 5 próbach)
  - **Recovery:** Po 200+ sukcesów, opóźnienia powoli wracają do normy

### 4. Memory Management (Zarządzanie pamięcią)

**Cel:** Zapobiega wyciekom pamięci i restartom.

**Jak działa:**
- **Monitoring:** Sprawdza zużycie pamięci co 5 minut
- **Threshold:** 80% heap usage = wymuszenie garbage collection
- **Forced GC:** Co 50 przetworzonych kont (jeśli `global.gc` dostępne)
- **Cache limits:** User cache ograniczony do 500 wpisów

- **Wartości:**
  - **Check interval:** 300,000ms (5 minut)
  - **Memory threshold:** 80% heap usage
  - **GC frequency:** Co 50 kont
  - **Cache size:** 500 wpisów

### 5. Progress Logging & Scheduler Recovery

**Cel:** Monitoruje postęp i automatycznie restartuje scheduler.

**Jak działa:**
- **Progress logging:** Co 10 przetworzonych kont
- **Continuous mode:** Scheduler działa w pętli bez timeoutów
- **Recovery:** Automatyczny restart po błędach
- **Timeout:** 24 godziny (efektywnie wyłączony)

- **Wartości:**
  - **Log frequency:** Co 10 kont
  - **Sync timeout:** 24 godziny (wyłączony)
  - **Recovery delay:** 30 sekund po błędzie

### 6. Graceful Shutdown & Error Handling

**Cel:** Bezpieczne zamykanie i obsługa błędów.

**Jak działa:**
- **Signal handling:** SIGINT/SIGTERM → bezpieczne zamknięcie
- **Database cleanup:** Zamyka połączenia z bazą
- **Uncaught exceptions:** Loguje i kontynuuje pracę
- **Unhandled rejections:** Loguje i kontynuuje pracę

- **Wartości:**
  - **Shutdown timeout:** 30 sekund
  - **Database pool:** 20 max connections, 5 min connections
  - **Connection timeout:** 30 sekund

## 📊 Monitoring & Observability

### Grafana Dashboard (Port: 3000)
**Access:** `http://localhost:3000` (admin/admin)

**Features:**
- **System Resources:** CPU, Memory, Disk usage
- **Container Metrics:** Individual container performance
- **Service Metrics:** Mastery API, Accounts Finder, Mastery Worker stats
- **Rate Limiting:** API limits, errors, wait times
- **Database:** Connections, size, query performance
- **Custom Metrics:** Accounts processed, new entries, matches scanned

### Prometheus (Port: 9090)
**Access:** `http://localhost:9090`

**Metrics Collected:**
- **System:** Node Exporter metrics (CPU, memory, disk, network)
- **Containers:** cAdvisor metrics (container performance)
- **Services:** Custom metrics from all Poro Ninja services
- **Database:** PostgreSQL metrics (if postgres_exporter added)

### cAdvisor (Port: 8081)
**Access:** `http://localhost:8081`

**Features:**
- Real-time container resource usage
- CPU, memory, network per container
- Historical performance data
- Container health status

### Service Metrics Endpoints

#### Mastery API (`http://localhost:8080/metrics`)
```prometheus
# Business metrics
mastery_api_accounts_processed_total 1234
mastery_api_new_entries_total 5678
mastery_api_failed_accounts_total 12

# Rate limiting
mastery_api_rate_limit_remaining 15000
mastery_api_rate_limit_errors_total 5

# Performance
mastery_api_batch_size 2
mastery_api_concurrent_batches 1
mastery_api_memory_usage_bytes 52428800
```

#### Mastery Worker (`http://localhost:3001/metrics`)
```prometheus
# Request metrics
mastery_worker_requests_total 1000
mastery_worker_requests_overview 500
mastery_worker_requests_search 300

# Error metrics
mastery_worker_errors_total 5
mastery_worker_404_errors 2
mastery_worker_500_errors 1
```

#### Accounts Finder (internal metrics)
```prometheus
# Processing metrics
accounts_finder_accounts_processed_total 5000
accounts_finder_new_accounts_total 150
accounts_finder_matches_processed_total 50000

# Error metrics
accounts_finder_errors_total 25
accounts_finder_429_errors 10
```

### Quick Start Monitoring
```bash
# Start all services including monitoring
docker-compose up -d

# Access Grafana
open http://localhost:3000
# Login: admin/admin

# Access Prometheus
open http://localhost:9090

# Access cAdvisor
open http://localhost:8081
```

### Custom Dashboards
The system includes pre-configured dashboards:
- **Poro Ninja Overview:** Main system dashboard
- **Service Performance:** Individual service metrics
- **Rate Limiting:** API limits and errors
- **Database Health:** PostgreSQL performance

### Alerting (Future Enhancement)
Planned alerting rules:
- High CPU/Memory usage (>80%)
- High error rate (>5%)
- Rate limit exhaustion
- Database connection issues
- Service downtime

## 🚀 Performance Optimizations

### Parallel Processing
- **Batch size**: 1-3 accounts processed simultaneously per batch (Mastery API)
- **Concurrent batches**: 1 batch running in parallel (Mastery API)
- **Total concurrency**: Up to 3 accounts processed at once (Mastery API)

### Database Optimizations
- **Connection pooling**: 20 max connections, 5 min connections
- **Batch INSERT**: Multiple mastery records in single query
- **User ID caching**: Reduces repeated database lookups (500 entries max)
- **Statement timeout**: 30 seconds to prevent hanging queries

### Rate Limiting Improvements
- **Increased limits**: 20,000 mastery requests per 10 seconds (max)
- **Adaptive mode**: Automatically reduces limits on 429 errors (min 4,000)
- **Exponential backoff**: Intelligent retry strategy (5 retries max)
- **Global limit**: 6,000 requests per 10 seconds (max)

### Expected Performance Gains
- **3-5x faster**: Parallel processing of accounts
- **2-3x faster**: Batch database operations
- **2-3x faster**: Increased rate limits
- **Overall**: 5-10x improvement in sync speed

## 🔧 Development

### Local service startup
```bash
cd services/mastery-api
npm install
npm run dev
```

### Adding new endpoint
1. Edit file in `services/mastery-api/routes/`
2. Add logic in `services/mastery-api/services/`
3. Test locally
4. Build and run container

### Adding new table
1. Add definition to central `init.sql`
2. Add indexes for performance
3. All services will automatically create the table

## 📊 Monitoring

### Health checks
- API: `http://mastery.smiechowski.com/health`
- Load balancer: `http://localhost/health`

### Performance monitoring
```bash
# Check API health with performance stats
curl http://mastery.smiechowski.com/health

# Response includes:
# - Database pool status
# - Batch processing configuration
# - Current performance metrics
```

### Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs mastery-api
docker-compose logs mastery-worker
docker-compose logs accounts-finder
```

## 🚀 Scaling

### Adding new API instance
```yaml
# In docker-compose.yml
mastery-api-2:
  build: ./services/mastery-api
  environment:
    - API_KEY=${API_KEY}
    # ... other variables
```

### Performance tuning
```env
# For high-performance environments
BATCH_SIZE=10
MAX_CONCURRENT_BATCHES=3

# For conservative environments
BATCH_SIZE=3
MAX_CONCURRENT_BATCHES=1
```

### Adding new service
1. Create folder `services/new-service/`
2. Add `server.js`, `package.json`, `Dockerfile`
3. Add service to `docker-compose.yml`
4. Update Nginx configuration
5. Add new tables to central `init.sql`

## 🔮 Planned Extensions

- `services/history-api/` - Match history
- `services/challenges-api/` - Challenges
- `services/reports-api/` - PDF/image generation
- `services/redis/` - Cache
- `services/monitoring/` - Monitoring and alerts

## 📝 License

Private project - not for public use.