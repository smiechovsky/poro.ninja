(function(){
  const btn = document.getElementById('forceSyncBtn');
  if (!btn) return;
  const THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2h
  const onPlayedWithPage = /\/[^/]+\/[^/]+\/played-with$/.test(window.location.pathname);
  const scanName = onPlayedWithPage ? 'Played-with' : 'Mastery';

  function timeAgo(dateStr){
    if (!dateStr) return 'never';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'unknown';
    const diff = Date.now() - d.getTime();
    if (diff < 60*1000) return 'just now';
    const mins = Math.floor(diff/60000);
    if (mins < 60) return mins + ' min ago';
    const hrs = Math.floor(mins/60);
    const remM = mins % 60;
    if (hrs < 24) return hrs + ' h ' + remM + ' min ago';
    const days = Math.floor(hrs/24);
    return days + ' d ago';
  }

  function render(){
    const last = btn.dataset.lastupdated;
    const label = 'Last sync: ' + timeAgo(last);
    btn.textContent = label;
    const stale = !last || (function(){
      const d = new Date(last);
      if (isNaN(d.getTime())) return true;
      return Date.now() - d.getTime() > THRESHOLD_MS;
    })();
    if (stale){
      btn.disabled = false;
      btn.style.cursor = 'pointer';
      btn.style.opacity = '1';
      btn.title = 'Click to force ' + scanName.toLowerCase() + ' scan now';
    } else {
      btn.disabled = true;
      btn.style.cursor = 'not-allowed';
      btn.style.opacity = '0.7';
      btn.title = 'Next ' + scanName.toLowerCase() + ' scan available after 2h from last update';
    }
  }

  render();

  btn.addEventListener('click', async function(){
    if (btn.disabled) return;
    const region = btn.dataset.region;
    const nickname = btn.dataset.nickname;
    const tag = btn.dataset.tag;
    const originalText = btn.textContent;
    btn.textContent = 'Scan in progress...';
    btn.disabled = true;
    btn.style.cursor = 'wait';
    try {
      // On played-with page, trigger played-with refresh; elsewhere trigger mastery sync
      const endpoint = onPlayedWithPage ? '/api/force-played-with' : '/api/force-user-sync';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, nickname, tag })
      });
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      const newLast = data.lastupdated || new Date().toISOString();
      btn.dataset.lastupdated = newLast;
      btn.textContent = 'Last sync: ' + timeAgo(newLast);
      setTimeout(() => { window.location.reload(); }, 800);
    } catch (e) {
      btn.textContent = originalText;
      btn.disabled = false;
      btn.style.cursor = 'pointer';
      btn.title = scanName + ' sync failed. Try again later.';
    }
  });
})();


// VIP toggle handler IIFE
(function(){
  const vipBtn = document.getElementById('vipToggleBtn');
  if (!vipBtn) return;
  vipBtn.addEventListener('click', async function(){
    const region = vipBtn.getAttribute('data-region');
    const nickname = vipBtn.getAttribute('data-nickname');
    const tag = vipBtn.getAttribute('data-tag');
    try {
      vipBtn.disabled = true;
      vipBtn.textContent = 'Updating VIP...';
      const res = await fetch(`/${region}/${encodeURIComponent(nickname)}-${encodeURIComponent(tag)}/vip-toggle`, {
        method: 'POST'
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (e) {
      // noop
    } finally {
      vipBtn.disabled = false;
    }
  });
})();

