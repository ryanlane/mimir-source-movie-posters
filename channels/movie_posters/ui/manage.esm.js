// Movie Posters Manager Web Component for Mimir Platform
const CHANNEL_ID = 'com.mimir.movieposters';

// TMDB genre list (stable — rarely changes)
const TMDB_GENRES = [
  { id: '28', name: 'Action' }, { id: '12', name: 'Adventure' },
  { id: '16', name: 'Animation' }, { id: '35', name: 'Comedy' },
  { id: '80', name: 'Crime' }, { id: '99', name: 'Documentary' },
  { id: '18', name: 'Drama' }, { id: '10751', name: 'Family' },
  { id: '14', name: 'Fantasy' }, { id: '36', name: 'History' },
  { id: '27', name: 'Horror' }, { id: '10402', name: 'Music' },
  { id: '9648', name: 'Mystery' }, { id: '10749', name: 'Romance' },
  { id: '878', name: 'Science Fiction' }, { id: '53', name: 'Thriller' },
  { id: '10752', name: 'War' }, { id: '37', name: 'Western' },
];

const TMDB_LISTS = [
  { id: 'popular',   name: 'Popular' },
  { id: 'top_rated', name: 'Top Rated' },
  { id: 'now_playing', name: 'Now Playing' },
  { id: 'upcoming',  name: 'Upcoming' },
];

const CSS = `
  :host {
    display: block;
    font-family: "Lato", system-ui, sans-serif;
    font-size: 14px;
    color: var(--color-text, #e0e0e0);
    background: transparent;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .manager { display: flex; flex-direction: column; gap: 16px; padding: 16px 0; }

  .section { display: flex; flex-direction: column; gap: 8px; }
  .section-header { display: flex; align-items: center; justify-content: space-between; }
  .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-secondary, #888); }

  /* Setup banner */
  .setup-banner {
    background: #0d1f2d;
    border: 1px solid #1e4a6b;
    border-radius: 10px;
    padding: 20px;
    display: flex; flex-direction: column; gap: 14px;
  }
  .setup-banner-title { font-size: 15px; font-weight: 700; color: var(--color-text, #e0e0e0); }
  .setup-steps { display: flex; flex-direction: column; gap: 8px; }
  .setup-step {
    display: flex; gap: 10px; align-items: flex-start;
    font-size: 13px; color: var(--color-text-secondary, #888); line-height: 1.5;
  }
  .step-num {
    flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
    background: #1e4a6b; color: #38bdf8; font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }
  .setup-step a { color: var(--color-accent, #00C851); text-decoration: none; }
  .setup-step a:hover { text-decoration: underline; }
  .setup-step code {
    background: var(--color-surface, #162325); border: 1px solid var(--color-border, #2a3a3c);
    border-radius: 3px; padding: 1px 5px; font-size: 12px; color: var(--color-text, #e0e0e0);
  }
  .key-input-row { display: flex; gap: 8px; align-items: stretch; }
  .key-input-row input {
    flex: 1; background: var(--color-background, #0B1314); border: 1px solid var(--color-border, #2a3a3c);
    border-radius: 6px; padding: 9px 12px; font-size: 13px; font-family: monospace;
    color: var(--color-text, #e0e0e0);
  }
  .key-input-row input:focus { outline: 2px solid var(--color-accent, #00C851); border-color: transparent; }

  /* Source cards */
  .source-list { display: flex; flex-direction: column; gap: 6px; }
  .source-card {
    background: var(--color-surface, #162325);
    border: 1px solid var(--color-border, #2a3a3c);
    border-radius: 8px; padding: 12px 14px;
    display: flex; align-items: center; gap: 12px;
  }
  .source-info { flex: 1; min-width: 0; }
  .source-name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .source-meta { font-size: 12px; color: var(--color-text-secondary, #888); margin-top: 4px; }
  .source-actions { display: flex; gap: 6px; flex-shrink: 0; }

  .empty-state {
    padding: 24px; text-align: center; font-size: 13px;
    color: var(--color-text-secondary, #888);
    background: var(--color-surface, #162325);
    border: 1px dashed var(--color-border, #2a3a3c); border-radius: 8px;
  }

  /* Type badges */
  .type-badge {
    display: inline-block; padding: 1px 6px; border-radius: 4px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
  }
  .type-badge.list   { background: #0a2918; color: #4ade80; border: 1px solid #1a5c38; }
  .type-badge.genre  { background: #1a1a0a; color: #fbbf24; border: 1px solid #5c4a1a; }

  /* Type toggle */
  .type-toggle { display: flex; gap: 0; border: 1px solid var(--color-border, #2a3a3c); border-radius: 6px; overflow: hidden; }
  .type-toggle button {
    flex: 1; padding: 6px 10px; border: none; background: transparent;
    font-size: 12px; font-family: inherit; cursor: pointer; font-weight: 500;
    color: var(--color-text-secondary, #888); transition: background 0.12s, color 0.12s;
  }
  .type-toggle button.active { background: var(--color-accent, #00C851); color: #000; font-weight: 700; }
  .type-toggle button:not(.active):hover { background: var(--color-surface-hover, #1e2f31); color: var(--color-text, #e0e0e0); }

  /* Add source panel */
  .add-panel {
    background: var(--color-surface, #162325);
    border: 1px solid var(--color-border, #2a3a3c);
    border-radius: 8px; padding: 16px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .input-row { display: flex; gap: 8px; align-items: flex-end; }
  .field { display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .field label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-secondary, #888); }
  .field select, .field input {
    background: var(--color-background, #0B1314); border: 1px solid var(--color-border, #2a3a3c);
    border-radius: 6px; padding: 8px 10px; font-size: 13px; font-family: inherit;
    color: var(--color-text, #e0e0e0); width: 100%;
  }
  .field select:focus, .field input:focus { outline: 2px solid var(--color-accent, #00C851); border-color: transparent; }

  /* Settings */
  .settings-panel {
    background: var(--color-surface, #162325); border: 1px solid var(--color-border, #2a3a3c);
    border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 14px;
  }
  .settings-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
  .settings-row .field { min-width: 130px; }
  .settings-actions { display: flex; justify-content: flex-end; gap: 8px; }

  /* Key management */
  .key-panel {
    background: var(--color-surface, #162325); border: 1px solid var(--color-border, #2a3a3c);
    border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 10px;
  }
  .key-masked { font-family: monospace; font-size: 13px; color: var(--color-text-secondary, #888); letter-spacing: 0.05em; }
  .key-row { display: flex; gap: 8px; align-items: center; }

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 6px; border: none;
    font-size: 13px; font-family: inherit; cursor: pointer;
    font-weight: 600; transition: background 0.15s, opacity 0.15s; white-space: nowrap;
  }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-primary { background: var(--color-accent, #00C851); color: #000; }
  .btn-primary:hover:not(:disabled) { background: var(--color-accent-hover, #00d858); }
  .btn-secondary { background: var(--color-surface, #162325); color: var(--color-text, #e0e0e0); border: 1px solid var(--color-border, #2a3a3c); }
  .btn-secondary:hover:not(:disabled) { background: var(--color-surface-hover, #1e2f31); }
  .btn-danger { background: #c62828; color: #fff; }
  .btn-danger:hover:not(:disabled) { background: #d32f2f; }
  .btn-ghost { background: transparent; color: var(--color-text-secondary, #888); padding: 4px 8px; font-size: 12px; font-weight: 400; }
  .btn-ghost:hover:not(:disabled) { color: var(--color-text, #e0e0e0); }
  .btn-sm { padding: 4px 10px; font-size: 12px; }
  .btn-icon { padding: 5px 8px; }

  /* Status messages */
  .status-msg {
    padding: 8px 12px; border-radius: 6px; font-size: 13px;
    display: flex; align-items: center; gap: 6px;
  }
  .status-msg.success { background: #0a2918; border: 1px solid #1a5c38; color: #4ade80; }
  .status-msg.error   { background: #2a0a0a; border: 1px solid #6b1111; color: #f87171; }
  .status-msg.info    { background: var(--color-surface, #162325); border: 1px solid var(--color-border, #2a3a3c); color: var(--color-text-secondary, #888); }

  /* Attribution */
  .attribution {
    font-size: 11px; color: var(--color-text-tertiary, #666);
    padding: 8px 0; border-top: 1px solid var(--color-border, #2a3a3c);
  }
  .attribution a { color: var(--color-accent, #00C851); text-decoration: none; }
  .attribution a:hover { text-decoration: underline; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid var(--color-border, #2a3a3c);
    border-top-color: var(--color-accent, #00C851);
    animation: spin 0.7s linear infinite; flex-shrink: 0;
  }
`;

class MoviePostersManager extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.state = {
      loading: true,
      validating: false,
      saving: false,
      refreshing: false,
      setupRequired: false,
      sources: [],
      cacheStats: {},
      settings: null,
      apiKeyInput: '',
      newType: 'list',
      newQuery: '',
      showSettings: false,
      showChangeKey: false,
      message: null,
    };
  }

  get channelId() { return this.getAttribute('channel-id') || CHANNEL_ID; }
  get apiBase() { return `/api/channels/${this.channelId}`; }

  async connectedCallback() {
    this.render();
    await this.loadStatus();
  }

  async loadStatus() {
    this.setState({ loading: true });
    try {
      const resp = await fetch(`${this.apiBase}/status`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this.setState({
        loading: false,
        setupRequired: data.setup_required || false,
        sources: data.settings?.sources || [],
        cacheStats: data.cache_stats || {},
        settings: data.settings || {},
      });
    } catch (err) {
      this.setState({ loading: false, message: { type: 'error', text: `Failed to load: ${err.message}` } });
    }
  }

  setState(updates) {
    Object.assign(this.state, updates);
    this.render();
  }

  async validateAndSaveKey() {
    const key = this.state.apiKeyInput.trim();
    if (!key) { this.setState({ message: { type: 'error', text: 'Enter your TMDB API key first' } }); return; }
    this.setState({ validating: true, message: null });
    try {
      const resp = await fetch(`${this.apiBase}/validate-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key }),
      });
      const data = await resp.json();
      if (data.valid) {
        this.setState({ validating: false, setupRequired: false, showChangeKey: false, apiKeyInput: '',
          message: { type: 'success', text: 'API key saved and verified ✓ Refreshing poster cache…' } });
        setTimeout(() => this.refreshAll(), 800);
      } else {
        this.setState({ validating: false, message: { type: 'error', text: data.error || 'Invalid API key' } });
      }
    } catch (err) {
      this.setState({ validating: false, message: { type: 'error', text: `Validation failed: ${err.message}` } });
    }
  }

  async addSource() {
    const { newType, newQuery, sources } = this.state;
    if (!newQuery) { this.setState({ message: { type: 'error', text: 'Select a genre or list first' } }); return; }

    let label, id;
    if (newType === 'genre') {
      const genre = TMDB_GENRES.find(g => g.id === newQuery);
      if (!genre) { this.setState({ message: { type: 'error', text: 'Unknown genre' } }); return; }
      id = `genre_${newQuery}`;
      label = genre.name;
    } else {
      const list = TMDB_LISTS.find(l => l.id === newQuery);
      if (!list) { this.setState({ message: { type: 'error', text: 'Unknown list' } }); return; }
      id = newQuery;
      label = list.name;
    }

    if (sources.some(s => s.id === id)) {
      this.setState({ message: { type: 'error', text: `"${label}" is already in your sources` } }); return;
    }

    const newSources = [...sources, { id, label, type: newType, query: newQuery }];
    this.setState({ saving: true, message: null });
    try {
      await this._putSettings({ sources: newSources });
      this.setState({ saving: false, newQuery: '', message: { type: 'success', text: `Added "${label}" — fetching posters…` } });
      fetch(`${this.apiBase}/refresh`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: id }) });
      setTimeout(() => this.loadStatus(), 2500);
    } catch (err) {
      this.setState({ saving: false, message: { type: 'error', text: `Save failed: ${err.message}` } });
    }
  }

  async removeSource(id) {
    const newSources = this.state.sources.filter(s => s.id !== id);
    this.setState({ saving: true, message: null });
    try {
      await this._putSettings({ sources: newSources });
      this.setState({ saving: false, message: { type: 'success', text: `Removed source` } });
    } catch (err) {
      this.setState({ saving: false, message: { type: 'error', text: `Remove failed: ${err.message}` } });
    }
  }

  async refreshAll() {
    this.setState({ refreshing: true, message: null });
    try {
      await fetch(`${this.apiBase}/refresh`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      this.setState({ message: { type: 'info', text: 'Cache refresh started — may take a minute…' } });
      setTimeout(() => this.loadStatus(), 3000);
    } catch (err) {
      this.setState({ message: { type: 'error', text: `Refresh failed: ${err.message}` } });
    } finally {
      this.setState({ refreshing: false });
    }
  }

  async refreshSource(id) {
    try {
      await fetch(`${this.apiBase}/refresh`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: id }) });
      this.setState({ message: { type: 'info', text: `Refreshing…` } });
      setTimeout(() => this.loadStatus(), 3000);
    } catch (err) {
      this.setState({ message: { type: 'error', text: `Refresh failed: ${err.message}` } });
    }
  }

  async saveDisplaySettings() {
    const root = this.shadowRoot;
    const patch = {
      poster_size: root.querySelector('#setting-poster-size')?.value || 'w780',
      fit_mode: root.querySelector('#setting-fit-mode')?.value || 'letterbox',
      cache_max_per_source: parseInt(root.querySelector('#setting-cache-max')?.value || '500', 10),
      refresh_interval_hours: parseInt(root.querySelector('#setting-refresh-hours')?.value || '168', 10),
      min_vote_count: parseInt(root.querySelector('#setting-min-votes')?.value || '50', 10),
    };
    this.setState({ saving: true, message: null });
    try {
      await this._putSettings(patch);
      this.setState({ saving: false, message: { type: 'success', text: 'Settings saved' } });
    } catch (err) {
      this.setState({ saving: false, message: { type: 'error', text: `Save failed: ${err.message}` } });
    }
  }

  async _putSettings(patch) {
    const payload = { ...(this.state.settings || {}), ...patch };
    const resp = await fetch(`${this.apiBase}/settings`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    this.setState({ settings: data.settings, sources: data.settings?.sources || [] });
  }

  _formatAge(fetchedAt) {
    if (!fetchedAt) return 'never';
    const mins = Math.round((Date.now() / 1000 - fetchedAt) / 60);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  }

  _esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ------------------------------------------------------------------
  // Builders

  buildSetupBanner() {
    const { validating, apiKeyInput } = this.state;
    return `
      <div class="setup-banner">
        <div class="setup-banner-title">🎬 TMDB API Key Required</div>
        <div class="setup-steps">
          <div class="setup-step">
            <span class="step-num">1</span>
            <span>Create a free account at <a href="https://www.themoviedb.org/signup" target="_blank">themoviedb.org/signup</a> and verify your email.</span>
          </div>
          <div class="setup-step">
            <span class="step-num">2</span>
            <span>Go to <a href="https://www.themoviedb.org/settings/api" target="_blank">themoviedb.org/settings/api</a>, click <strong>Create</strong>, and choose <strong>Developer</strong>.</span>
          </div>
          <div class="setup-step">
            <span class="step-num">3</span>
            <span>Fill in the application form — use anything for the URL (e.g. <code>http://localhost</code>) and a brief description like <code>Personal home display</code>.</span>
          </div>
          <div class="setup-step">
            <span class="step-num">4</span>
            <span>Copy your <strong>API Key (v3 auth)</strong> and paste it below.</span>
          </div>
        </div>
        <div class="key-input-row">
          <input type="password" placeholder="Paste your TMDB v3 API key here…"
            value="${this._esc(apiKeyInput)}" data-field="apiKeyInput" autocomplete="off" />
          <button class="btn btn-primary" data-action="validate-key" ${validating ? 'disabled' : ''}>
            ${validating ? '<span class="spinner"></span> Verifying…' : 'Verify & Save'}
          </button>
        </div>
      </div>`;
  }

  buildKeyPanel() {
    const { settings, showChangeKey, validating, apiKeyInput } = this.state;
    const masked = settings?.api_key || '';
    if (showChangeKey) {
      return `
        <div class="key-panel">
          <span class="section-title">Change API Key</span>
          <div class="key-input-row">
            <input type="password" placeholder="Paste new TMDB v3 API key…"
              value="${this._esc(apiKeyInput)}" data-field="apiKeyInput" autocomplete="off" />
            <button class="btn btn-primary btn-sm" data-action="validate-key" ${validating ? 'disabled' : ''}>
              ${validating ? '<span class="spinner"></span>' : 'Verify & Save'}
            </button>
            <button class="btn btn-ghost btn-sm" data-action="cancel-change-key">Cancel</button>
          </div>
        </div>`;
    }
    return `
      <div class="key-panel">
        <div class="key-row">
          <span class="section-title" style="flex:1">TMDB API Key</span>
          <span class="key-masked">${this._esc(masked)}</span>
          <button class="btn btn-ghost btn-sm" data-action="show-change-key">Change</button>
        </div>
      </div>`;
  }

  buildSourceList() {
    const { sources, cacheStats } = this.state;
    if (!sources.length) return `<div class="empty-state">No sources configured. Add one below.</div>`;
    return `<div class="source-list">${sources.map(s => {
      const stat = cacheStats[s.id] || {};
      const count = (stat.count || 0).toLocaleString();
      const age = this._formatAge(stat.fetched_at);
      const typeLabel = s.type === 'genre' ? 'Genre' : 'List';
      return `
        <div class="source-card">
          <div class="source-info">
            <div class="source-name">
              ${this._esc(s.label)}
              <span class="type-badge ${s.type || 'list'}">${typeLabel}</span>
            </div>
            <div class="source-meta">${count} posters · cached ${age}</div>
          </div>
          <div class="source-actions">
            <button class="btn btn-secondary btn-sm btn-icon" data-action="refresh-source" data-id="${this._esc(s.id)}" title="Refresh">↻</button>
            <button class="btn btn-danger btn-sm btn-icon" data-action="remove-source" data-id="${this._esc(s.id)}" title="Remove">✕</button>
          </div>
        </div>`;
    }).join('')}</div>`;
  }

  buildAddPanel() {
    const { newType, newQuery, saving } = this.state;
    const isGenre = newType === 'genre';
    const options = isGenre
      ? TMDB_GENRES.map(g => `<option value="${g.id}" ${newQuery === g.id ? 'selected' : ''}>${g.name}</option>`).join('')
      : TMDB_LISTS.map(l => `<option value="${l.id}" ${newQuery === l.id ? 'selected' : ''}>${l.name}</option>`).join('');

    return `
      <div class="add-panel">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span class="section-title">Add Source</span>
          <div class="type-toggle">
            <button data-action="set-type-list" class="${!isGenre ? 'active' : ''}">Curated List</button>
            <button data-action="set-type-genre" class="${isGenre ? 'active' : ''}">Genre</button>
          </div>
        </div>
        <div class="input-row">
          <div class="field">
            <label>${isGenre ? 'Genre' : 'List'}</label>
            <select data-field="newQuery">
              <option value="">— select —</option>
              ${options}
            </select>
          </div>
          <button class="btn btn-primary" data-action="add-source" ${saving ? 'disabled' : ''}>
            ${saving ? '<span class="spinner"></span>' : '+ Add'}
          </button>
        </div>
      </div>`;
  }

  buildSettingsPanel() {
    const s = this.state.settings || {};
    if (!this.state.showSettings) return '';
    return `
      <div class="settings-panel">
        <div class="section-title">Display Settings</div>
        <div class="settings-row">
          <div class="field">
            <label for="setting-poster-size">Poster Size</label>
            <select id="setting-poster-size">
              <option value="w342" ${s.poster_size === 'w342' ? 'selected' : ''}>w342 — Small</option>
              <option value="w500" ${s.poster_size === 'w500' ? 'selected' : ''}>w500 — Medium</option>
              <option value="w780" ${(!s.poster_size || s.poster_size === 'w780') ? 'selected' : ''}>w780 — Large</option>
              <option value="original" ${s.poster_size === 'original' ? 'selected' : ''}>Original</option>
            </select>
          </div>
          <div class="field">
            <label for="setting-fit-mode">Fit Mode</label>
            <select id="setting-fit-mode">
              <option value="letterbox" ${(!s.fit_mode || s.fit_mode === 'letterbox') ? 'selected' : ''}>Letterbox</option>
              <option value="crop" ${s.fit_mode === 'crop' ? 'selected' : ''}>Crop</option>
              <option value="stretch" ${s.fit_mode === 'stretch' ? 'selected' : ''}>Stretch</option>
            </select>
          </div>
          <div class="field">
            <label for="setting-cache-max">Max Posters / Source</label>
            <input id="setting-cache-max" type="number" min="50" max="2000" value="${s.cache_max_per_source || 500}" />
          </div>
          <div class="field">
            <label for="setting-refresh-hours">Refresh (hours)</label>
            <input id="setting-refresh-hours" type="number" min="1" max="720" value="${s.refresh_interval_hours || 168}" />
          </div>
          <div class="field">
            <label for="setting-min-votes">Min Vote Count</label>
            <input id="setting-min-votes" type="number" min="0" max="1000" value="${s.min_vote_count ?? 50}" />
          </div>
        </div>
        <div class="settings-actions">
          <button class="btn btn-primary btn-sm" data-action="save-settings">Save Settings</button>
        </div>
      </div>`;
  }

  render() {
    const { loading, refreshing, message, setupRequired, showSettings } = this.state;
    const msgHtml = message ? `
      <div class="status-msg ${message.type}">
        <span>${message.type === 'success' ? '✓' : message.type === 'error' ? '✕' : '⟳'}</span>
        ${this._esc(message.text)}
      </div>` : '';

    if (loading) {
      this.shadowRoot.innerHTML = `<style>${CSS}</style>
        <div class="manager"><div class="status-msg info"><span class="spinner"></span> Loading…</div></div>`;
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>${CSS}</style>
      <div class="manager">
        ${setupRequired ? this.buildSetupBanner() : `
          ${this.buildKeyPanel()}
          <div class="section">
            <div class="section-header">
              <span class="section-title">Sources</span>
              <div style="display:flex;gap:6px">
                <button class="btn btn-ghost btn-sm" data-action="toggle-settings">${showSettings ? 'Hide Settings' : 'Settings'}</button>
                <button class="btn btn-secondary btn-sm" data-action="refresh-all" ${refreshing ? 'disabled' : ''}>
                  ${refreshing ? '<span class="spinner"></span>' : '↻'} Refresh All
                </button>
              </div>
            </div>
            ${this.buildSourceList()}
          </div>
          ${msgHtml}
          ${this.buildAddPanel()}
          ${this.buildSettingsPanel()}
        `}
        ${setupRequired && msgHtml ? msgHtml : ''}
        <div class="attribution">
          This product uses the <a href="https://www.themoviedb.org" target="_blank">TMDB</a> API but is not endorsed or certified by TMDB.
        </div>
      </div>`;

    this._attachListeners();
  }

  _attachListeners() {
    const root = this.shadowRoot;
    root.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', () => {
        const a = el.dataset.action;
        if (a === 'validate-key')    this.validateAndSaveKey();
        else if (a === 'add-source') this.addSource();
        else if (a === 'refresh-all') this.refreshAll();
        else if (a === 'remove-source') this.removeSource(el.dataset.id);
        else if (a === 'refresh-source') this.refreshSource(el.dataset.id);
        else if (a === 'toggle-settings') this.setState({ showSettings: !this.state.showSettings, message: null });
        else if (a === 'save-settings') this.saveDisplaySettings();
        else if (a === 'show-change-key') this.setState({ showChangeKey: true, apiKeyInput: '', message: null });
        else if (a === 'cancel-change-key') this.setState({ showChangeKey: false, message: null });
        else if (a === 'set-type-list') this.setState({ newType: 'list', newQuery: '', message: null });
        else if (a === 'set-type-genre') this.setState({ newType: 'genre', newQuery: '', message: null });
      });
    });
    root.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('input', () => { this.state[el.dataset.field] = el.value; });
      el.addEventListener('change', () => { this.state[el.dataset.field] = el.value; });
    });
  }
}

customElements.define('x-movie-posters-manager', MoviePostersManager);
export default MoviePostersManager;
