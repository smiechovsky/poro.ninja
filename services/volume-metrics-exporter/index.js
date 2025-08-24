const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9106;

let metrics = '';

function getDirectorySize(dirPath) {
  return new Promise((resolve, reject) => {
    // Use Linux du command to get directory size
    const command = `du -sb "${dirPath}" 2>/dev/null | awk '{print $1}'`;
    exec(command, (err, stdout) => {
      if (err) {
        console.error(`Error getting size for ${dirPath}:`, err.message);
        resolve(0);
        return;
      }
      const size = parseInt(stdout.trim()) || 0;
      resolve(size);
    });
  });
}

async function collectVolumeMetrics() {
  try {
    console.log('[VOLUME-METRICS] Starting volume metrics collection...');
    
    // Get Docker volume paths using docker volume inspect
    const result = await new Promise((resolve, reject) => {
      exec('docker volume ls --format "{{.Name}}"', (err, stdout) => {
        if (err) {
          console.error('Error listing volumes:', err.message);
          resolve('');
          return;
        }
        resolve(stdout);
      });
    });

    const volumeNames = result.trim().split('\n').filter(name => 
      name && ['poroninja_postgres_data', 'poroninja_prometheus_data', 'poroninja_grafana_data'].includes(name)
    );
    
    console.log('[VOLUME-METRICS] Found volumes:', volumeNames);
    
    let resultMetrics = '';

    for (const volumeName of volumeNames) {
      try {
        // Get volume mountpoint using docker volume inspect
        const inspectResult = await new Promise((resolve, reject) => {
          exec(`docker volume inspect ${volumeName} --format "{{.Mountpoint}}"`, (err, stdout) => {
            if (err) {
              console.error(`Error inspecting volume ${volumeName}:`, err.message);
              resolve('');
              return;
            }
            resolve(stdout.trim());
          });
        });

        if (inspectResult) {
          console.log(`[VOLUME-METRICS] Getting size for ${volumeName} at ${inspectResult}`);
          const size = await getDirectorySize(inspectResult);
          resultMetrics += `docker_volume_size_bytes{volume="${volumeName}"} ${size}\n`;
          console.log(`[VOLUME-METRICS] Volume ${volumeName} size: ${size} bytes`);
        } else {
          console.log(`[VOLUME-METRICS] No mountpoint found for volume ${volumeName}`);
        }
      } catch (err) {
        console.error(`Error processing volume ${volumeName}:`, err.message);
      }
    }

    // Add timestamp metric
    resultMetrics += `volume_metrics_collection_timestamp ${Date.now()}\n`;
    
    metrics = resultMetrics;
    console.log('[VOLUME-METRICS] Metrics collection completed');
  } catch (err) {
    console.error('[VOLUME-METRICS] Error collecting volume metrics:', err.message);
    metrics = '# error collecting volume metrics\n';
  }
}

// Collect metrics immediately and then every 30 seconds
collectVolumeMetrics();
setInterval(collectVolumeMetrics, 30000);

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[volume-metrics-exporter] listening on :${PORT}`);
}); 