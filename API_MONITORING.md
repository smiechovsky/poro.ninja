# API Monitoring System

## Overview

System monitoringu API dla serwisów `accounts-finder` i `mastery-api` z wizualizacją w czasie rzeczywistym zużycia limitów API oraz statusu synchronizacji kont.

## Architecture

### Components

1. **API Metrics Exporter** (`services/api-metrics-exporter/`)
   - Zbiera metryki z obu serwisów API
   - Pobiera dane o synchronizacji kont z bazy danych
   - Eksportuje metryki w formacie Prometheus

2. **Enhanced Service Metrics**
   - `accounts-finder`: Dodane metryki rate limitera dla wszystkich endpointów
   - `mastery-api`: Dodane metryki rate limitera dla endpointów mastery

3. **Grafana Dashboard**
   - Wizualizacja zużycia API requestów w czasie rzeczywistym
   - Monitoring synchronizacji kont
   - Alerty dla wysokiego zużycia limitów

## Metrics

### API Request Metrics

#### Global Metrics
- `api_requests_remaining{service="accounts-finder"}` - Pozostałe requesty dla accounts-finder
- `api_requests_remaining{service="mastery-api"}` - Pozostałe requesty dla mastery-api
- `api_requests_remaining{service="total"}` - Suma pozostałych requestów
- `api_requests_limit{service="*"}` - Limity requestów per serwis
- `api_requests_usage_percent{service="*"}` - Procent wykorzystania limitów

#### Endpoint-specific Metrics
- `api_endpoint_requests_remaining{service="accounts-finder",endpoint="match-ids"}` - Match IDs endpoint
- `api_endpoint_requests_remaining{service="accounts-finder",endpoint="match-details"}` - Match Details endpoint
- `api_endpoint_requests_remaining{service="accounts-finder",endpoint="account-info"}` - Account Info endpoint
- `api_endpoint_requests_remaining{service="mastery-api",endpoint="mastery"}` - Mastery endpoint

#### Error Metrics
- `api_rate_limit_errors_total{service="*"}` - Liczba błędów rate limit per serwis

### Account Synchronization Metrics

#### Count Metrics
- `accounts_total` - Całkowita liczba kont w bazie
- `accounts_synced_1h` - Konta zsynchronizowane w ostatniej godzinie
- `accounts_synced_3h` - Konta zsynchronizowane w ostatnich 3 godzinach
- `accounts_synced_6h` - Konta zsynchronizowane w ostatnich 6 godzinach
- `accounts_synced_12h` - Konta zsynchronizowane w ostatnich 12 godzinach
- `accounts_synced_24h` - Konta zsynchronizowane w ostatnich 24 godzinach
- `accounts_synced_2d` - Konta zsynchronizowane w ostatnich 2 dniach
- `accounts_synced_3d` - Konta zsynchronizowane w ostatnich 3 dniach
- `accounts_synced_5d` - Konta zsynchronizowane w ostatnich 5 dniach
- `accounts_synced_7d` - Konta zsynchronizowane w ostatnich 7 dniach

#### Percentage Metrics
- `accounts_sync_percentage_1h` - Procent kont zsynchronizowanych w ostatniej godzinie
- `accounts_sync_percentage_24h` - Procent kont zsynchronizowanych w ostatnich 24 godzinach
- `accounts_sync_percentage_7d` - Procent kont zsynchronizowanych w ostatnich 7 dniach

## Dashboard Panels

### 1. API Requests Remaining
- Stat panel pokazujący pozostałe requesty dla każdego serwisu
- Kolory: czerwony (<1000), żółty (1000-5000), zielony (>5000)

### 2. API Request Usage Percentage
- Gauge panel pokazujący procent wykorzystania limitów
- Kolory: zielony (<70%), żółty (70-90%), czerwony (>90%)

### 3. API Requests by Endpoint
- Time series pokazujący pozostałe requesty dla każdego endpointu
- Pozwala na identyfikację najbardziej obciążonych endpointów

### 4. Rate Limit Errors
- Stat panel pokazujący liczbę błędów rate limit w ostatniej godzinie
- Kolory: zielony (0-5), żółty (5-20), czerwony (>20)

### 5. Account Synchronization Status
- Stat panel pokazujący całkowitą liczbę kont i liczbę zsynchronizowanych

### 6. Account Synchronization Timeline
- Time series pokazujący liczbę zsynchronizowanych kont w różnych przedziałach czasowych

### 7. Synchronization Percentage
- Gauge panel pokazujący procent kont zsynchronizowanych w ostatnich 24 godzinach
- Kolory: czerwony (<50%), żółty (50-80%), zielony (>80%)

### 8. API Request Limits vs Usage
- Bar gauge pokazujący limity vs wykorzystanie dla każdego serwisu

## Setup

### 1. Build and Start Services

```bash
# Build all services including the new API metrics exporter
docker-compose build

# Start all services
docker-compose up -d
```

### 2. Access Monitoring

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **API Metrics Exporter**: http://localhost:9107/metrics

### 3. Import Dashboard

Dashboard "API Monitoring Dashboard" powinien być automatycznie zaimportowany przez Grafana.

## Configuration

### Environment Variables

#### API Metrics Exporter
- `DB_HOST` - Host bazy danych (default: postgres)
- `DB_PORT` - Port bazy danych (default: 5432)
- `DB_DATABASE` - Nazwa bazy danych (default: poro_ninja)
- `DB_USER` - Użytkownik bazy danych (default: postgres)
- `DB_PASSWORD` - Hasło bazy danych (default: postgres)
- `ACCOUNTS_FINDER_URL` - URL serwisu accounts-finder (default: http://accounts-finder:3002)
- `MASTERY_API_URL` - URL serwisu mastery-api (default: http://mastery-api:8080)

### Cache Configuration

API Metrics Exporter używa cache o czasie życia 30 sekund, aby uniknąć przeciążenia serwisów API.

## Troubleshooting

### Common Issues

1. **No metrics visible in Grafana**
   - Sprawdź czy API Metrics Exporter działa: `curl http://localhost:9107/health`
   - Sprawdź logi: `docker-compose logs api-metrics-exporter`

2. **Rate limit metrics showing 0**
   - Sprawdź czy serwisy API działają
   - Sprawdź czy rate limiter jest poprawnie zainicjalizowany

3. **Database connection errors**
   - Sprawdź czy baza danych jest dostępna
   - Sprawdź zmienne środowiskowe DB_*

### Logs

Wszystkie logi używają formatu zgodnego z konwencją projektu:
- `[API-METRICS] [LOGS-LEVEL:0]` - Podstawowe informacje o działaniu
- `[API-METRICS] [LOGS-LEVEL:1]` - Szczegółowe informacje o pobieraniu metryk

## Performance Considerations

1. **Cache Duration**: 30 sekund cache zapobiega przeciążeniu serwisów API
2. **Database Queries**: Zapytania o synchronizację kont są zoptymalizowane z użyciem FILTER
3. **Prometheus Scrape Interval**: 30 sekund dla API Metrics Exporter
4. **Grafana Refresh**: 30 sekund dla dashboardu

## Future Enhancements

1. **Alerting**: Dodanie alertów dla wysokiego zużycia limitów
2. **Historical Analysis**: Dodanie paneli do analizy historycznych trendów
3. **Custom Queries**: Dodanie możliwości tworzenia własnych zapytań Prometheus
4. **Service Health**: Dodanie metryk zdrowia serwisów 