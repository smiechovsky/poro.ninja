(function(){
  const feed = document.getElementById('historyFeed');
  const sentinel = document.getElementById('infiniteSentinel');
  if (!feed || !sentinel) return;

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  // expects /:region/:user/history
  const region = pathParts[0];
  const user = pathParts[1];
  const feedUrl = `/${region}/${user}/history-feed`;

  let loading = false;
  let ended = false;

  async function loadMore(){
    if (loading || ended) return;
    const cursor = sentinel.dataset.nextCursor || '';
    if (!cursor) { ended = true; observer.disconnect(); return; }
    loading = true;
    try {
      const res = await fetch(`${feedUrl}?cursor=${encodeURIComponent(cursor)}`);
      if (!res.ok) throw new Error('feed error');
      const data = await res.json();
      if (data.entriesHtml) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = data.entriesHtml;
        // append nodes
        while (wrapper.firstChild) feed.appendChild(wrapper.firstChild);
      }
      if (data.nextCursor) {
        sentinel.dataset.nextCursor = data.nextCursor;
      } else {
        ended = true;
        observer.disconnect();
      }
    } catch (_) {
      // stop trying on error to avoid loops
      ended = true;
      observer.disconnect();
    } finally {
      loading = false;
    }
  }

  const observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        loadMore();
      }
    }
  }, { rootMargin: '200px' });

  observer.observe(sentinel);
})();


