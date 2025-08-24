const { logHealthCheck } = require('../debugger/server');
const { getDataSync } = require('../utils/globalState');

/**
 * Health check endpoint
 */
function healthCheck(req, res) {
  logHealthCheck();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'mastery-api',
    version: '1.0.0'
  });
}

/**
 * Metrics endpoint for Prometheus
 */
function metrics(req, res) {
  // Get current rate limiter status from global sync instance
  const sync = getDataSync && getDataSync();
  const rateLimiterStatus = sync?.api?.rateLimiter || {};
  const masteryStatus = rateLimiterStatus.getMasteryRateLimitStatus ? rateLimiterStatus.getMasteryRateLimitStatus() : {};
  const globalStatus = rateLimiterStatus.getGlobalRateLimitStatus ? rateLimiterStatus.getGlobalRateLimitStatus() : {};
  
  const metrics = {
    // System metrics
    mastery_api_up: 1,
    mastery_api_start_time: process.uptime(),
    
    // Business metrics
    mastery_api_accounts_processed_total: global.accountsProcessed || 0,
    mastery_api_new_entries_total: global.newEntries || 0,
    mastery_api_failed_accounts_total: global.failedAccounts || 0,
    mastery_api_sync_duration_seconds: global.lastSyncDuration || 0,
    
    // Rate Limiter metrics - Global
    mastery_api_rate_limit_remaining: globalStatus.remaining || 0,
    mastery_api_rate_limit_errors_total: global.rateLimitErrors || 0,
    mastery_api_rate_limit_max_requests: globalStatus.limit || 6000,
    mastery_api_rate_limit_current_requests: globalStatus.current || 0,
    mastery_api_rate_limit_window_seconds: 10,
    mastery_api_rate_limit_adaptive_mode: globalStatus.adaptiveMode ? 1 : 0,
    mastery_api_rate_limit_backoff_multiplier: globalStatus.backoffMultiplier || 1.0,
    
    // Rate Limiter metrics - Mastery endpoint
    mastery_api_mastery_remaining: masteryStatus.remaining || 0,
    mastery_api_mastery_current: masteryStatus.current || 0,
    mastery_api_mastery_limit: masteryStatus.limit || 20000,
    mastery_api_mastery_adaptive_mode: masteryStatus.adaptiveMode ? 1 : 0,
    mastery_api_mastery_backoff_multiplier: masteryStatus.backoffMultiplier || 1.0,
    
    // Batch Processing metrics
    mastery_api_batch_size: global.currentBatchSize || 1,
    mastery_api_batch_size_min: 1,
    mastery_api_batch_size_max: 3,
    mastery_api_concurrent_batches: global.concurrentBatches || 1,
    mastery_api_concurrent_batches_max: 1,
    mastery_api_total_concurrency: (global.currentBatchSize || 1) * (global.concurrentBatches || 1),
    mastery_api_total_concurrency_max: 3,
    
    // Adaptive Backoff metrics
    mastery_api_backoff_min_delay_seconds: 10,
    mastery_api_backoff_max_delay_seconds: 160,
    mastery_api_backoff_current_delay_seconds: global.currentBackoffDelay || 10,
    mastery_api_backoff_retry_count: global.backoffRetryCount || 0,
    mastery_api_backoff_max_retries: 5,
    
    // Memory Management metrics
    mastery_api_memory_usage_bytes: process.memoryUsage().heapUsed,
    mastery_api_memory_total_bytes: process.memoryUsage().heapTotal,
    mastery_api_memory_usage_percent: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
    mastery_api_memory_threshold_percent: 80,
    mastery_api_memory_check_interval_minutes: 5,
    mastery_api_gc_frequency_accounts: 50,
    mastery_api_cache_size_entries: 500,
    
    // Progress Logging metrics
    mastery_api_log_frequency_accounts: 10,
    mastery_api_sync_timeout_hours: 24,
    mastery_api_recovery_delay_seconds: 30,
    
    // Graceful Shutdown metrics
    mastery_api_shutdown_timeout_seconds: 30,
    mastery_api_db_pool_max_connections: 20,
    mastery_api_db_connection_timeout_seconds: 30,
    
    // Error metrics
    mastery_api_errors_total: global.totalErrors || 0,
    mastery_api_429_errors_total: global.error429Count || 0,
    mastery_api_504_errors_total: global.error504Count || 0,
    
    // Performance metrics
    mastery_api_processing_rate_accounts_per_minute: global.processingRate || 0,
    mastery_api_avg_processing_time_seconds: global.avgProcessingTime || 0,
    mastery_api_success_rate_percent: global.successRate || 100,

    // VIP sync metrics
    mastery_api_vip_sync_runs_total: global.m_api_vip_sync_runs_total || 0,
    mastery_api_vip_accounts_processed_total: global.m_api_vip_accounts_processed_total || 0,
    mastery_api_vip_sync_duration_seconds: global.m_api_vip_sync_duration_seconds || 0,
    mastery_api_vip_last_total_accounts: global.m_api_vip_last_total_accounts || 0,
    mastery_api_vip_last_processed: global.m_api_vip_last_processed || 0,
    mastery_api_vip_last_failed: global.m_api_vip_last_failed || 0,
    mastery_api_vip_progress_percent: global.m_api_vip_progress_percent || 0,

    // Totals for Grafana tables
    mastery_api_requests_total: global.m_api_requests_total || 0,
    mastery_api_mastery_requests_total: global.m_api_mastery_requests_total || 0,
    mastery_api_accounts_processed_total: global.accountsProcessed || 0,
    mastery_api_mastery_requests_priority_total: global.m_api_mastery_requests_priority_total || 0,
    mastery_api_mastery_requests_normal_total: global.m_api_mastery_requests_normal_total || 0
  };

  // Redis-backed shared counters (async)
  const rl = sync?.api?.rateLimiter;
  // Predeclare RL metrics as zeros so Grafana always sees series
  metrics.rl_budget_used_total = metrics.rl_budget_used_total || 0;
  metrics.rl_budget_limit_total = metrics.rl_budget_limit_total || (process.env.BUDGET_LIMIT_TOTAL ? parseInt(process.env.BUDGET_LIMIT_TOTAL, 10) : 0);
  metrics.rl_budget_window_ms = metrics.rl_budget_window_ms || (process.env.BUDGET_WINDOW_MS ? parseInt(process.env.BUDGET_WINDOW_MS, 10) : 120000);
  metrics.rl_budget_used_discovery = metrics.rl_budget_used_discovery || 0;
  metrics.rl_budget_used_priority = metrics.rl_budget_used_priority || 0;
  metrics.rl_budget_used_stale = metrics.rl_budget_used_stale || 0;
  metrics.rl_budget_used_background = metrics.rl_budget_used_background || 0;
  metrics.rl_global_used_10s = metrics.rl_global_used_10s || 0;
  metrics.rl_global_limit_10s = metrics.rl_global_limit_10s || (rateLimiterStatus?.globalLimit || 0);
  metrics.rl_mastery_used_10s = metrics.rl_mastery_used_10s || 0;
  metrics.rl_mastery_limit_10s = metrics.rl_mastery_limit_10s || (rateLimiterStatus?.masteryLimit || 0);
  const assemble = async () => {
    try {
      if (rl?.getBudgetRateLimitStatus) {
        const budget = await rl.getBudgetRateLimitStatus();
        metrics.rl_budget_used_total = budget.usedTotal || 0;
        metrics.rl_budget_limit_total = budget.limitTotal || 0;
        metrics.rl_budget_window_ms = budget.windowMs || 0;
        metrics.rl_budget_used_discovery = budget.usedByCategory?.discovery || 0;
        metrics.rl_budget_used_priority = budget.usedByCategory?.priorityRescan || 0;
        metrics.rl_budget_used_stale = budget.usedByCategory?.staleRescan || 0;
        metrics.rl_budget_used_background = budget.usedByCategory?.background || 0;
      }
      if (rl?.getGlobal10sSharedUsage) {
        const g = await rl.getGlobal10sSharedUsage();
        metrics.rl_global_used_10s = g.used || 0;
        metrics.rl_global_limit_10s = g.limit || 0;
      }
      if (rl?.getMastery10sSharedUsage) {
        const m = await rl.getMastery10sSharedUsage();
        metrics.rl_mastery_used_10s = m.used || 0;
        metrics.rl_mastery_limit_10s = m.limit || 0;
      }
    } catch (_) {}
  };

  assemble().finally(() => {
    const prometheusMetrics = Object.entries(metrics)
      .map(([key, value]) => `${key} ${value}`)
      .join('\n');
    res.set('Content-Type', 'text/plain');
    res.send(prometheusMetrics);
  });
}

module.exports = {
  healthCheck,
  metrics
}; 