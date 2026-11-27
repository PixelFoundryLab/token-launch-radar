// Token Radar's dashboard, radar-2. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail drawer with the model's own
// inputs and the protocol's farm plan. No network: every byte it shows is in data.js.
//
// The page is split by job: format.js formats numbers, valueModel.js recomputes the model,
// farmPlan.js generates the farm plans, valueChart.js draws the top-10 chart, protocolTable.js
// renders the tables, protocolDetail.js renders the detail drawer. This file wires them together.

var DATA = window.RADAR;
var state = { q: '', category: 'all', chain: 'all', watchOnly: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

/** The page's hash into state: search, filters, watchlist and the open protocol. */
function readHash() {
  var hash = window.location.hash.replace(/^#/, '');
  if (!hash) return;
  var params = new URLSearchParams(hash);
  if (params.get('q')) state.q = params.get('q');
  if (params.get('p')) state.selected = params.get('p');
  if (params.get('category')) state.category = params.get('category');
  if (params.get('chain')) state.chain = params.get('chain');
  if (params.get('tab') === 'live' || params.get('tab') === 'pre-token') state.tab = params.get('tab');
  if (params.get('watch') === '1') state.watchOnly = true;
}

/** The state back into the page's hash, so a link reopens the same view. */
function writeHash() {
  var params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category !== 'all') params.set('category', state.category);
  if (state.chain !== 'all') params.set('chain', state.chain);
  if (state.tab !== 'pre-token') params.set('tab', state.tab);
  if (state.watchOnly) params.set('watch', '1');
  if (state.selected) params.set('p', state.selected);
  var next = params.toString();
  if (next) window.history.replaceState(null, '', '#' + next);
  else window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

/** The top bar: the name and the snapshot it reads. */
function header() {
  return el('header', { class: 'top' },
    el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
    el('div', { class: 'top-meta' },
      el('span', { text: 'Snapshot ' + DATA.as_of }),
      el('span', { text: 'DefiLlama protocol index' }),
      el('span', { text: DATA.model_version + ' model' })
    )
  );
}

/** The lede: what the board is, and the four coverage facts. */
function lede() {
  return el('section', { class: 'lede' },
    el('div', null,
      el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
      el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' genuine pre-token protocols below it. Implied value is a model, not a promise.' })
    ),
    el('div', { class: 'facts' },
      el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
      el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
      el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
      el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
    )
  );
}

/** Search, category and chain filters, the watchlist switch and the pre-token / live-token tabs. */
function controls() {
  var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
  var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
  var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
  search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
  var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
    el('option', { value: 'all', text: 'All categories' }),
    categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
  );
  select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
  var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
    el('option', { value: 'all', text: 'All chains' }),
    chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
  );
  chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
  var watch = el('label', { class: 'check' },
    el('input', { type: 'checkbox', checked: state.watchOnly ? 'checked' : null, 'aria-label': 'Watchlist only' }),
    'Watchlist only'
  );
  watch.querySelector('input').addEventListener('change', function (e) { state.watchOnly = e.target.checked; writeHash(); render(); });
  var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
  var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
  return el('div', { class: 'controls' },
    el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
    el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
    el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
    watch,
    el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
    el('span', { class: 'count', text: state.tab === 'pre-token' ? protocolRows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
  );
}

/** The model, stated in full: the formula and what each input means. */
function modelPanel() {
  var m = DATA.model;
  return el('section', { class: 'panel model' },
    el('h2', { text: 'How implied value is computed' }),
    el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
    el('div', { class: 'formula' },
      el('b', { text: 'implied = round( tvl_usd x ' + m.base_multiple }),
      ' x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ')',
      ' x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ')',
      ' x (1 + min(chains - 1, ' + m.reach_max_extra_chains + ') x ' + m.reach_weight + ') )'
    ),
    el('p', { class: 'sub', text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. Reach rewards protocols that run on more chains: each extra chain adds ' + Math.round(m.reach_weight * 100) + '% to the implied value, up to ' + m.reach_max_extra_chains + ' extra chains. The early radar is every genuine pre-token protocol below the watchlist floor, and the live-token protocols are set aside with their market caps shown.' })
  );
}

/** The footer: the data's source and the model's limits. */
function footer() {
  return el('footer', { class: 'foot' },
    el('span', { text: 'Data: ' + DATA.source + '. Snapshot ' + DATA.as_of + '; the board reads these bytes only.' }),
    el('span', { text: 'Implied values are this entry\u2019s own model, not a price and not a prediction that a token is issued. A protocol is said to record no token, never that it has none.' })
  );
}

/** The whole page, rebuilt from state on every change. */
function render() {
  var app = document.getElementById('board');
  app.textContent = '';
  var shell = el('div', { class: 'shell' });
  shell.appendChild(header());
  shell.appendChild(lede());
  if (state.tab === 'pre-token') {
    var strip = moversStrip();
    if (strip) shell.appendChild(strip);
    var chart = renderValueChart(protocolRows());
    if (chart) shell.appendChild(chart);
  }
  shell.appendChild(controls());
  shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
  if (state.tab === 'pre-token') shell.appendChild(modelPanel());
  shell.appendChild(footer());
  app.appendChild(shell);
  app.setAttribute('aria-busy', 'false');
  if (!detailDialog.isConnected) app.appendChild(detailDialog);
  if (state.selected) openProtocolDetail(state.selected);
}

if (DATA) {
  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && detailDialog.open) detailDialog.close();
  });
}
