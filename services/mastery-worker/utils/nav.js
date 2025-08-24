function formatIso(lastupdated) {
  if (!lastupdated) return '';
  if (typeof lastupdated === 'string') return lastupdated;
  if (lastupdated && typeof lastupdated.toISOString === 'function') {
    try { return lastupdated.toISOString(); } catch (_) { /* noop */ }
  }
  return String(lastupdated);
}

function forceSyncButton(region, nickname, tag, lastupdated) {
  return `
    <button
      id="forceSyncBtn"
      type="button"
      class="nav-link"
      data-lastupdated="${formatIso(lastupdated)}"
      data-region="${region}"
      data-nickname="${nickname}"
      data-tag="${tag}"
      style="cursor: not-allowed; opacity: 0.7;"
      disabled
    >Last sync: checking...</button>
  `;
}

function renderNav(region, nickname, tag, lastupdated, options) {
  const navParts = [
    `<a href="/" class="nav-link">← Back to Search</a>`
  ];
  // Added-at button (non-clickable), displayed to the left of VIP button when provided
  if (options?.createdAtPretty) {
    navParts.push(`
      <button
        type="button"
        class="nav-link"
        style="cursor: not-allowed; opacity: 0.7;"
        title="This is the time when the account was added to the database. Before this date, history and statistics may be incorrectly archived."
        disabled
      >In database since: ${options.createdAtPretty}</button>
    `);
  }
  // On played-with page we can show when VIP was granted (scan start time) if provided
  if (options?.vipStatusAddedAtPretty) {
    navParts.push(`
      <button
        type="button"
        class="nav-link"
        style="cursor: not-allowed; opacity: 0.7;"
        title="This is the time when Played-with scanning started for this account."
        disabled
      >Played-with since: ${options.vipStatusAddedAtPretty}</button>
    `);
  }
  if (options?.includeVipToggle) {
    const disabled = options.isVip === true ? 'disabled' : '';
    const style = options.isVip === true ? 'cursor: not-allowed; opacity: 0.7;' : 'cursor: pointer;';
    navParts.push(`
      <button
        id="vipToggleBtn"
        type="button"
        class="nav-link"
        data-region="${region}"
        data-nickname="${nickname}"
        data-tag="${tag}"
        style="${style}"
        ${disabled}
      >VIP</button>
    `);
  }
  if (options?.includeOverview) {
    navParts.push(`<a href="/${region}/${nickname}-${tag}/overview" class="nav-link">Overview</a>`);
  }
  if (options?.includeHistory) {
    navParts.push(`<a href="/${region}/${nickname}-${tag}/history" class="nav-link">Mastery History</a>`);
  }
  if (options?.includePlayedWith) {
    navParts.push(`<a href="/${region}/${nickname}-${tag}/played-with" class="nav-link">Played with</a>`);
  }
  navParts.push(forceSyncButton(region, nickname, tag, lastupdated));
  return `<div class="nav-links">\n${navParts.join('\n')}\n</div>`;
}

module.exports = {
  renderNav,
  forceSyncButton
};


