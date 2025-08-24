const express = require('express');
const db = require('../db');
const { 
  logLeaderboardsRequest,
  logLeaderboardsQuery,
  logLeaderboardsResults,
  logLeaderboardsSearch,
  logLeaderboardsSearchResults,
  logLeaderboardsError
} = require('../debugger/leaderboards');
const router = express.Router();
const { getJson, setJson } = require('../utils/cache');
const { getChampionLeaderboards, getChampionTop100 } = require('../services/leaderboardsData');

// Middleware to parse POST data
router.use(express.urlencoded({ extended: true }));

// Region mapping
const regionMap = {
  br1: 'BR', euw1: 'EUW', eun1: 'EUNE', jp1: 'JP', kr: 'KR', la1: 'LAN',
  la2: 'LAS', na1: 'NA', oc1: 'OCE', ru: 'RU', tr1: 'TR', ph2: 'PH',
  sg2: 'SG', th2: 'TH', tw2: 'TW', vn2: 'VN'
};


// Get player position and surrounding players for specific champion
async function getPlayerPosition(championName, nickname, tag, region) {
  logLeaderboardsQuery('player position', championName);
  
  // First check if player exists in the leaderboard
  const playerCheckQuery = `
    WITH latest_mastery AS (
      SELECT DISTINCT ON (user_id, champion_id)
        user_id,
        champion_id,
        mastery_points,
        mastery_level,
        tokens_earned,
        last_seen
      FROM ChampionMasteryHistory
      ORDER BY user_id, champion_id, last_seen DESC
    )
    SELECT COUNT(*) as player_count
    FROM latest_mastery lm
    JOIN AccountsToSync a ON lm.user_id = a.id
    JOIN Champions c ON lm.champion_id = c.id
    WHERE c.name = $1 AND LOWER(a.nickname) = LOWER($2) AND a.tag = $3 AND a.region = $4
  `;
  
  const playerCheck = await db.query(playerCheckQuery, [championName, nickname, tag, region]);
  
  // If player doesn't exist in leaderboard, return empty array
  if (Number(playerCheck.rows[0].player_count) === 0) {
    logLeaderboardsResults(0, championName);
    return [];
  }
  
  // Get position and surrounding players
  const positionQuery = `
    WITH latest_mastery AS (
      SELECT DISTINCT ON (user_id, champion_id)
        user_id,
        champion_id,
        mastery_points,
        mastery_level,
        tokens_earned,
        last_seen
      FROM ChampionMasteryHistory
      ORDER BY user_id, champion_id, last_seen DESC
    ),
    player_rank AS (
      SELECT 
        a.region,
        a.nickname,
        a.tag,
        lm.mastery_points,
        lm.mastery_level,
        lm.tokens_earned,
        ROW_NUMBER() OVER (ORDER BY lm.mastery_points DESC) as rank
      FROM latest_mastery lm
      JOIN AccountsToSync a ON lm.user_id = a.id
      JOIN Champions c ON lm.champion_id = c.id
      WHERE c.name = $1
    ),
    target_player AS (
      SELECT rank FROM player_rank 
      WHERE LOWER(nickname) = LOWER($2) AND tag = $3 AND region = $4
    )
    SELECT * FROM player_rank
    WHERE EXISTS (SELECT 1 FROM target_player) 
      AND rank BETWEEN 
        (SELECT GREATEST(1, (SELECT rank FROM target_player) - 50))
        AND 
        (SELECT LEAST((SELECT COUNT(*) FROM player_rank), (SELECT rank FROM target_player) + 50))
    ORDER BY rank ASC
  `;
  
  const { rows } = await db.query(positionQuery, [championName, nickname, tag, region]);
  logLeaderboardsResults(rows.length, championName);
  return rows;
}

// Main leaderboards page
router.get('/', async (req, res) => {
  try {
    logLeaderboardsRequest();
    const cacheKey = 'leaderboards:champion_top';
    let champions = await getJson(cacheKey);
    const refreshMinutes = Number(process.env.LEADERBOARDS_REFRESH_MINUTES || 15);
    const cacheTtlSeconds = Number(process.env.LEADERBOARDS_CACHE_TTL_SECONDS || 3600);

    // Do not hit DB on cache miss; render page with loading indicator and let client poll readiness
    if (!Array.isArray(champions) || champions.length === 0) {
      champions = [];
    }
    
    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Leaderboards - Poro Ninja</title>
          <link rel="stylesheet" href="/css/main.css">
          <link rel="stylesheet" href="/css/leaderboards.css">
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>Leaderboards</h1>
                  <div class="subtitle">Top Mastery Points for Each Champion</div>
                  <div class="subtitle" id="lbStatus"></div>
              </div>
              
              <div class="nav-links">
                  <a href="/" class="nav-link">← Back to Search</a>
              </div>
              
              <div class="data-table" id="lbTableWrapper" style="${champions.length ? '' : 'display: none;'}">
                   <table id="leaderboardsTable">
                       <tr>
                           <th data-sort="champion">Champion</th>
                           <th>Region</th>
                           <th>Top Player</th>
                           <th data-sort="points">Mastery Points</th>
                       </tr>
    `;
    
    for (const champion of champions) {
      const championLink = `/leaderboards/${encodeURIComponent(champion.champion_name)}`;
      const playerLink = `/${champion.region}/${encodeURIComponent(champion.nickname)}-${champion.tag}/overview`;
      
             html += `
         <tr>
           <td data-champion="${champion.champion_name}">
             <div class="champion-card">
               <a href="${championLink}">
                 <img src="${champion.champion_icon}" alt="${champion.champion_name}" class="champion-icon">
               </a>
               <a href="${championLink}" class="champion-name">${champion.champion_name}</a>
             </div>
           </td>
           <td>${regionMap[champion.region] || champion.region}</td>
           <td>
             <a href="${playerLink}" class="player-link">
               ${champion.nickname}#${champion.tag}
             </a>
           </td>
           <td data-points="${champion.mastery_points}">${champion.mastery_points.toLocaleString()}</td>
         </tr>
       `;
    }
    
         html += `
                   </table>
               </div>
           </div>
           
           <script>
           // Leaderboards loading indicator and auto-refresh
           (function(){
             const status = document.getElementById('lbStatus');
             const wrap = document.getElementById('lbTableWrapper');
             const refreshMinutes = ${refreshMinutes};
             const hasData = ${champions.length ? 'true' : 'false'};
             let shown = false;
             function showReady(){ if (!shown) { wrap.style.display = ''; shown = true; } }
             function setMsg(msg){ status.textContent = msg; }
             if (hasData) {
               setMsg('');
               showReady();
             } else {
               setMsg('Preparing leaderboards... This may take up to a couple of minutes on the first run. The page will refresh automatically when ready.');
               let tries = 0;
               const maxTries = 60; // ~2min at ~2s average interval
               const poll = () => {
                 fetch('/leaderboards/ready?_=' + Date.now()).then(r=>r.json()).then(j=>{
                   if (j.ready) { setMsg('Loaded. Refreshing...'); setTimeout(()=>location.reload(), 300); }
                   else {
                     const delay = 2000 + Math.floor(Math.random()*3000); // 2-5s jitter
                     if (++tries < maxTries) setTimeout(poll, delay);
                   }
                 }).catch(()=>{
                   const delay = 3000 + Math.floor(Math.random()*2000); // 3-5s on error
                   if (++tries < maxTries) setTimeout(poll, delay);
                 });
               };
               // Hard fallback refresh after 3 minutes in case polling is cached/proxied
               setTimeout(()=>{ location.reload(); }, 180000);
               poll();

               // Show friendly info only while loading
               const info = document.createElement('div');
               info.className = 'subtitle';
               info.textContent = 'We refresh leaderboards about every ' + refreshMinutes + ' minutes.';
               status.parentNode.appendChild(info);
             }
           })();

           // Table sorting functionality
           document.addEventListener('DOMContentLoaded', function() {
             const table = document.getElementById('leaderboardsTable');
             const getCellValue = (tr, idx) => {
               const cell = tr.children[idx];
               const dataAttr = cell.dataset[Object.keys(cell.dataset)[0]];
               return dataAttr || (cell.innerText || cell.textContent);
             };
             
             const comparer = (idx, asc, isNumeric) => (a, b) => {
               const v1 = getCellValue(asc ? a : b, idx);
               const v2 = getCellValue(asc ? b : a, idx);
               if (isNumeric) {
                 const num1 = parseInt(v1.replace(/,/g, '')) || 0;
                 const num2 = parseInt(v2.replace(/,/g, '')) || 0;
                 return num1 - num2;
               }
               return v1.localeCompare(v2);
             };
             
             Array.from(table.querySelectorAll('th')).forEach((th, idx) => {
               if (!th.dataset.sort) return;
               
               th.addEventListener('click', function() {
                 const isNumeric = th.dataset.sort === 'points';
                 const asc = th.classList.toggle('asc');
                 th.classList.toggle('desc', !asc);
                 
                 Array.from(table.querySelectorAll('th')).forEach((oth) => { 
                   if (oth !== th) { 
                     oth.classList.remove('asc','desc'); 
                   } 
                 });
                 
                 const rows = Array.from(table.querySelectorAll('tr:nth-child(n+2)'));
                 rows.sort(comparer(idx, asc, isNumeric));
                 rows.forEach(tr => table.appendChild(tr));
               });
             });
           });
           </script>
       </body>
       </html>
     `;
    
    res.send(html);
  } catch (err) {
    logLeaderboardsError(err, 'main leaderboards');
    res.status(500).send('Internal Server Error');
  }
});

// Individual champion leaderboard
router.get('/:champion', async (req, res) => {
  try {
    const { champion } = req.params;
    const { search } = req.query;
    
    await renderChampionLeaderboard(req, res, champion, search);
  } catch (err) {
    logLeaderboardsError(err, `champion leaderboard ${req.params.champion}`);
    res.status(500).send('Internal Server Error');
  }
});



// Helper function to render champion leaderboard
async function renderChampionLeaderboard(req, res, champion, search) {
  try {
    logLeaderboardsRequest(champion);
    const cacheKey = `leaderboards:top100:${encodeURIComponent(champion)}`;
    let top100 = await getJson(cacheKey);
    if (!top100) {
      top100 = await getChampionTop100(champion);
      setJson(cacheKey, top100).catch(() => {});
    }
    let searchResults = null;
    let playerPosition = null;
    
    if (search) {
      logLeaderboardsSearch(search, champion);
      const [nickname, tag] = search.split('#');
      if (nickname && tag) {
        // Find region from search results
        const searchQuery = `
          SELECT DISTINCT region FROM AccountsToSync 
          WHERE LOWER(nickname) LIKE LOWER($1) AND tag = $2
          LIMIT 1
        `;
        const regionResult = await db.query(searchQuery, [nickname + '%', tag]);
        
        if (regionResult.rows.length > 0) {
          const region = regionResult.rows[0].region;
          playerPosition = await getPlayerPosition(champion, nickname, tag, region);
          if (playerPosition && playerPosition.length > 0) {
            logLeaderboardsSearchResults(true, search, champion);
          } else {
            logLeaderboardsSearchResults(false, search, champion);
          }
        } else {
          // Try to find exact match
          const exactQuery = `
            SELECT DISTINCT region FROM AccountsToSync 
            WHERE LOWER(nickname) = LOWER($1) AND tag = $2
            LIMIT 1
          `;
          const exactResult = await db.query(exactQuery, [nickname, tag]);
          
          if (exactResult.rows.length > 0) {
            const region = exactResult.rows[0].region;
            playerPosition = await getPlayerPosition(champion, nickname, tag, region);
            if (playerPosition && playerPosition.length > 0) {
              logLeaderboardsSearchResults(true, search, champion);
            } else {
              logLeaderboardsSearchResults(false, search, champion);
            }
          } else {
            logLeaderboardsSearchResults(false, search, champion);
          }
        }
      }
    }
    
    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${champion} Leaderboard - Poro Ninja</title>
          <link rel="stylesheet" href="/css/main.css">
          <link rel="stylesheet" href="/css/leaderboards.css">
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>${champion} Leaderboard</h1>
                  <div class="subtitle">Top 100 Players</div>
              </div>
              
                             <div class="nav-links">
                   <a href="/" class="nav-link">← Back to Search</a>
                   <a href="/leaderboards" class="nav-link">← Back to Leaderboards</a>
               </div>
               
               <div class="data-table">
                   <table>
                       <tr>
                           <th>Rank</th>
                           <th>Player</th>
                           <th>Region</th>
                           <th>Mastery Points</th>
                           <th>Level</th>
                       </tr>
    `;
    
     // Always render Top 100 first
     const searchNickname = search ? search.split('#')[0].toLowerCase() : null;
     const searchTag = search ? search.split('#')[1] : null;

     for (const [idx, player] of top100.entries()) {
       const playerLink = `/${player.region}/${encodeURIComponent(player.nickname)}-${player.tag}/overview`;
       const isHighlighted = !!(searchNickname && searchTag && player.nickname.toLowerCase() === searchNickname && player.tag === searchTag);
       const displayRank = player.rank || (idx + 1);

       html += `
         <tr class="${isHighlighted ? 'highlighted-player' : ''}" ${isHighlighted ? 'id="searched-player"' : ''}>
           <td>${displayRank}</td>
           <td>
             <a href="${playerLink}" class="player-link">
               ${player.nickname}#${player.tag}
             </a>
           </td>
           <td>${regionMap[player.region] || player.region}</td>
           <td>${player.mastery_points.toLocaleString()}</td>
           <td>${player.mastery_level}</td>
         </tr>
       `;
     }

     // Build +/-50 context section when needed (only rows > 100, without duplicates)
     let appendedRows = [];
     let showSeparator = false;

     if (playerPosition && playerPosition.length > 0 && searchNickname && searchTag) {
       const target = playerPosition.find(p => p.nickname.toLowerCase() === searchNickname && p.tag === searchTag);
       const targetRank = target?.rank;
       appendedRows = playerPosition.filter(p => p.rank > 100);
       showSeparator = appendedRows.length > 0 && targetRank > 150;
     }

     if (appendedRows.length > 0) {
       if (showSeparator) {
         html += `
           <tr class="separator-row">
             <td colspan="5">
               <div class="separator">...</div>
             </td>
           </tr>
         `;
       }

       for (const player of appendedRows) {
         const playerLink = `/${player.region}/${encodeURIComponent(player.nickname)}-${player.tag}/overview`;
         const isHighlighted = !!(searchNickname && searchTag && player.nickname.toLowerCase() === searchNickname && player.tag === searchTag);

         html += `
           <tr class="${isHighlighted ? 'highlighted-player' : ''}" ${isHighlighted ? 'id="searched-player"' : ''}>
             <td>${player.rank}</td>
             <td>
               <a href="${playerLink}" class="player-link">
                 ${player.nickname}#${player.tag}
               </a>
             </td>
             <td>${regionMap[player.region] || player.region}</td>
             <td>${player.mastery_points.toLocaleString()}</td>
             <td>${player.mastery_level}</td>
           </tr>
         `;
       }
     }

     if (!playerPosition || playerPosition.length === 0) {
       if (search) {
       // Player not found in leaderboard
       html += `
         <tr class="separator-row">
           <td colspan="5">
             <div class="separator">...</div>
           </td>
         </tr>
         <tr class="no-results">
           <td colspan="5">
             <div class="no-results-message">
               Player ${search} not found in ${champion} leaderboard or has no mastery points.
             </div>
           </td>
         </tr>
       `;
     }
   }
     
                  // Add search row at the bottom
       html += `
         <tr class="search-row">
           <td colspan="5">
                         <form method="GET" class="search-form">
              <div class="search-field">
                <input type="text" name="search" placeholder="Search your account (nickname#tag)" 
                       value="${search || ''}" class="search-input">
              </div>
              <button type="submit" class="search-button">Search</button>
            </form>
           </td>
         </tr>
       `;
    
    html += `
                  </table>
              </div>
          </div>
          
                     <script>
                           // Add autocomplete functionality
              document.addEventListener('DOMContentLoaded', function() {
                const searchInput = document.querySelector('.search-row .search-input');
                if (!searchInput) return;
                
                                 // Create suggestion placeholder element
                 const suggestionPlaceholder = document.createElement('span');
                 suggestionPlaceholder.className = 'suggestion-placeholder';
                 suggestionPlaceholder.style.position = 'absolute';
                 suggestionPlaceholder.style.left = '0';
                 suggestionPlaceholder.style.top = '0';
                 suggestionPlaceholder.style.pointerEvents = 'none';
                 suggestionPlaceholder.style.color = 'rgba(255, 255, 255, 0.3)';
                 suggestionPlaceholder.style.fontSize = '14px';
                 suggestionPlaceholder.style.padding = '8px 12px';
                 suggestionPlaceholder.style.zIndex = '1';
                 searchInput.parentNode.style.position = 'relative';
                 searchInput.parentNode.appendChild(suggestionPlaceholder);
               
                                                searchInput.addEventListener('input', function() {
                   const query = this.value.trim();
                   if (query.length < 3) {
                     suggestionPlaceholder.textContent = '';
                     return;
                   }
                   
                   fetch(\`/search?query=\${encodeURIComponent(query)}\`)
                     .then(r => r.json())
                     .then(list => {
                       if (list.length > 0) {
                         const item = list[0]; // Use first suggestion
                         const suggestionText = item.nickname + '#' + item.tag; // preserve DB casing
                         suggestionPlaceholder.textContent = suggestionText;
                       } else {
                         suggestionPlaceholder.textContent = '';
                       }
                     })
                     .catch(console.error);
                 });
                 
                 // Handle Tab key to complete suggestion (preserve original casing)
                 searchInput.addEventListener('keydown', function(e) {
                   if (e.key === 'Tab' && suggestionPlaceholder.textContent) {
                     e.preventDefault();
                     this.value = suggestionPlaceholder.textContent;
                     suggestionPlaceholder.textContent = '';
                   }
                 });
               
                               // Clear suggestion when clicking outside
                document.addEventListener('click', e => {
                  if (e.target !== searchInput) {
                    suggestionPlaceholder.textContent = '';
                  }
                });
               
               // Auto-scroll to searched player if exists
               const searchedPlayer = document.getElementById('searched-player');
               if (searchedPlayer) {
                 setTimeout(() => {
                   searchedPlayer.scrollIntoView({ 
                     behavior: 'smooth', 
                     block: 'center' 
                   });
                 }, 100);
               }
             });
           </script>
      </body>
      </html>
    `;
    
         res.send(html);
   } catch (err) {
     logLeaderboardsError(err, `champion leaderboard ${champion}`);
     res.status(500).send('Internal Server Error');
   }
}

module.exports = router; 

// Readiness probe for cache warmup
router.get('/ready', async (req, res) => {
  // Prevent any caching of readiness responses
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  try {
    const ready = !!(await getJson('leaderboards:champion_top'));
    return res.json({ ready });
  } catch (_) {
    return res.json({ ready: false });
  }
});