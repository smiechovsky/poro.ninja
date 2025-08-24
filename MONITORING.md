# Poro Ninja - Monitoring Setup

## 🚀 Quick Start

### 1. Uruchom system z monitoringiem
```bash
docker-compose up -d
```

### 2. Dostęp do narzędzi monitoring

#### Grafana Dashboard
- **URL:** http://localhost:3000
- **Login:** admin
- **Password:** admin
- **Dashboard:** Poro Ninja - System Overview

#### Prometheus
- **URL:** http://localhost:9090
- **Query Examples:**
  - `mastery_api_accounts_processed_total` - Liczba przetworzonych kont
  - `mastery_api_new_entries_total` - Liczba nowych wpisów
  - `rate_limit_errors_total` - Błędy rate limit

#### cAdvisor (Container Metrics)
- **URL:** http://localhost:8081
- **Features:** CPU, Memory, Network per container

## 📊 Dostępne Metryki

### Mastery API (Port 8080)
```bash
curl http://localhost:8080/metrics
```

**Kluczowe metryki:**
- `mastery_api_accounts_processed_total` - Przetworzone konta
- `mastery_api_new_entries_total` - Nowe wpisy mastery
- `mastery_api_failed_accounts_total` - Błędne konta
- `mastery_api_rate_limit_remaining` - Pozostałe zapytania API
- `mastery_api_batch_size` - Aktualny rozmiar batch
- `mastery_api_memory_usage_bytes` - Użycie pamięci

### Mastery Worker (Port 3001)
```bash
curl http://localhost:3001/metrics
```

**Kluczowe metryki:**
- `mastery_worker_requests_total` - Wszystkie requesty
- `mastery_worker_requests_overview` - Requesty overview
- `mastery_worker_requests_search` - Requesty search
- `mastery_worker_errors_total` - Błędy 404/500

### System Resources
- **CPU Usage:** `100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`
- **Memory Usage:** `(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100`
- **Disk Usage:** `(node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes * 100`

### Database (PostgreSQL)
- **Connections:** `pg_stat_database_numbackends`
- **Database Size:** `pg_database_size_bytes / 1024 / 1024`
- **Query Performance:** `pg_stat_statements_*`

## 🎯 Grafana Dashboards

### 1. System Overview
- CPU, Memory, Disk usage
- Container performance
- Service health status

### 2. Poro Ninja Services
- Mastery API performance
- Accounts Finder progress
- Rate limiting status
- Error rates

### 3. Database Health
- Connection pool status
- Query performance
- Database size growth

## 🔧 Konfiguracja

### Prometheus Configuration
Plik: `monitoring/prometheus.yml`
- Scrape interval: 15s
- Retention: 200h
- Targets: All services + system metrics

### Grafana Configuration
Pliki:
- `monitoring/grafana/datasources/prometheus.yml` - Data source
- `monitoring/grafana/dashboards/dashboard.yml` - Dashboard provider
- `monitoring/grafana/dashboards/poro-ninja-dashboard.json` - Main dashboard

## 📈 Przydatne Queries

### Rate Limiting
```promql
# Rate limit errors per minute
rate(mastery_api_rate_limit_errors_total[5m]) * 60

# Remaining API calls
mastery_api_rate_limit_remaining
```

### Performance
```promql
# Accounts processed per minute
rate(mastery_api_accounts_processed_total[5m]) * 60

# Memory usage percentage
(mastery_api_memory_usage_bytes / mastery_api_memory_total_bytes) * 100
```

### Errors
```promql
# Error rate
rate(mastery_worker_errors_total[5m]) * 60

# 429 errors
rate(mastery_api_429_errors_total[5m]) * 60
```

## 🚨 Alerting (Future)

### Planned Alerts
- High CPU usage (>80%)
- High memory usage (>80%)
- High error rate (>5%)
- Rate limit exhaustion
- Service downtime
- Database connection issues

### Alert Rules
```yaml
# Example alert rule
groups:
  - name: poro-ninja
    rules:
      - alert: HighCPUUsage
        expr: 100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage detected"
```

## 🔍 Troubleshooting

### Prometheus Issues
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check service discovery
curl http://localhost:9090/api/v1/targets?state=active
```

### Grafana Issues
```bash
# Check Grafana logs
docker-compose logs grafana

# Restart Grafana
docker-compose restart grafana
```

### Service Metrics Issues
```bash
# Test metrics endpoint
curl http://localhost:8080/metrics
curl http://localhost:3001/metrics

# Check service health
curl http://localhost:8080/health
curl http://localhost:3001/health
```

## 📊 Custom Metrics

### Adding Custom Metrics
1. Update service code to increment global counters
2. Add metrics to `/metrics` endpoint
3. Update Prometheus configuration if needed
4. Add panels to Grafana dashboard

### Example Custom Metric
```javascript
// In service code
global.customMetric = 0;

// Increment metric
global.customMetric++;

// In metrics endpoint
const metrics = {
  custom_metric_total: global.customMetric
};
```

## 🎯 Performance Monitoring

### Key Performance Indicators (KPIs)
- **Throughput:** Accounts processed per hour
- **Latency:** Average response time
- **Error Rate:** Percentage of failed requests
- **Resource Usage:** CPU, Memory, Disk utilization
- **Rate Limiting:** API quota usage and errors

### Optimization Insights
- Monitor batch size effectiveness
- Track rate limit patterns
- Identify performance bottlenecks
- Optimize resource allocation 