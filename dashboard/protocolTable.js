// The board's tables: the ranked pre-token table, the live-token table, and the movers strip.
//
// Filtering and sorting live in this file. The state they read (search, filters, sort, selection)
// and the render they call back into are the page's shared globals, so every module here reads
// the same state the controls write.

/** The rows the current search, category, chain and watchlist filters leave visible. */
function protocolRows() {
  var query = state.q.trim().toLowerCase();
  return DATA.rows.filter(function (r) {
    if (state.category !== 'all' && r.category !== state.category) return false;
    if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
    if (state.watchOnly && !r.on_watchlist) return false;
    if (!query) return true;
    var haystack = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
    return haystack.indexOf(query) >= 0;
  });
}

/** The value one row sorts on for the current sort key; nulls sort to an end, never an error. */
function sortValue(r) {
  if (state.sort === 'name') return r.name.toLowerCase();
  if (state.sort === 'tvl') return r.tvl_usd;
  if (state.sort === 'growth') return r.change_7d === null ? -Infinity : r.change_7d;
  if (state.sort === 'age') return r.age_days === null ? Infinity : r.age_days;
  if (state.sort === 'multiple') return r.implied_multiple;
  return r.implied_value_usd;
}

/** The visible rows in the current sort order; ties always break on slug. */
function sortedProtocolRows(list) {
  return list.slice().sort(function (a, b) {
    var av = sortValue(a);
    var bv = sortValue(b);
    if (av < bv) return -state.dir;
    if (av > bv) return state.dir;
    if (a.slug < b.slug) return -1;
    if (a.slug > b.slug) return 1;
    return 0;
  });
}

/** The five fastest-growing pre-token protocols, for the movers strip. */
function topMovers() {
  return DATA.rows
    .filter(function (r) { return r.change_7d !== null && r.change_7d > 0; })
    .sort(function (a, b) { return b.change_7d - a.change_7d; })
    .slice(0, 5);
}

/** The movers strip: the five fastest growers, each opening its detail view. */
function moversStrip() {
  var list = topMovers();
  if (!list.length) return null;
  return el('section', { class: 'movers', 'aria-label': 'Fastest growing pre-token protocols' },
    list.map(function (r, i) {
      return el('button', { type: 'button', class: 'mover', onclick: function () { openProtocolDetail(r.slug); } },
        el('span', { class: 'm-rank', text: 'Mover ' + (i + 1) }),
        el('span', { class: 'm-name', text: r.name }),
        el('span', { class: 'm-growth', text: fmtPct(r.change_7d) + ' in 7d' })
      );
    })
  );
}

/** One sortable column header: clicking picks the key, or flips the direction. */
function sortHeader(key, label) {
  var arrow = null;
  if (state.sort === key) {
    arrow = el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' });
  }
  return el('th', { scope: 'col' },
    el('button', {
      type: 'button',
      onclick: function () {
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = -1; }
        render();
      }
    }, label, arrow)
  );
}

/** A protocol's name cell: the name, and its category and chains underneath. */
function protocolNameCell(r) {
  var chains = (r.chains && r.chains.length) ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain';
  return el('td', null, el('div', { class: 'name' },
    el('b', { text: r.name }),
    el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + chains })
  ));
}

/** A growth cell: the seven-day percent, green when up, red when down, plain when unknown. */
function growthCell(value) {
  var text = value === null ? 'n/a' : fmtPct(value);
  var tone = value === null ? '' : (value >= 0 ? 'pos' : 'neg');
  return el('td', { class: 'num ' + tone, text: text });
}

/** The empty board: shown when no row matches the filters, with a way back. */
function emptyBoard() {
  return el('div', { class: 'panel' }, el('div', { class: 'empty' },
    el('h2', { text: 'No protocol matches that filter' }),
    el('p', { text: 'Clear the search or pick another category to see the board again.' }),
    el('button', {
      class: 'button primary', type: 'button', text: 'Clear filters',
      onclick: function () {
        state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchOnly = false;
        writeHash(); render();
      }
    })
  ));
}

/** One ranked row: rank, protocol, TVL, growth, age, value per TVL, implied value and list badge. */
function boardRow(r, maxImplied) {
  var barWidth = Math.max(3, Math.round((r.implied_value_usd / maxImplied) * 100));
  var row = el('tr', {
    'data-selected': state.selected === r.slug ? 'true' : 'false',
    tabindex: '0',
    onclick: function () { openProtocolDetail(r.slug); },
    onkeydown: function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProtocolDetail(r.slug); }
    }
  },
    el('td', { class: 'num', text: String(r.rank) }),
    protocolNameCell(r),
    el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
    growthCell(r.change_7d),
    el('td', { class: 'num', text: fmtAge(r.age_days) }),
    el('td', { class: 'num', text: r.implied_multiple.toFixed(2) + 'x' }),
    el('td', null, el('div', { class: 'implied' },
      el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + barWidth + '%' })),
      el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
    )),
    el('td', null, el('span', { class: 'badge ' + (r.on_watchlist ? 'watch' : 'early'), text: r.on_watchlist ? 'Watchlist' : 'Early' }))
  );
  return row;
}

/** The ranked pre-token table, strongest implied value first. Select a row for its model and farm plan. */
function boardTable() {
  var list = sortedProtocolRows(protocolRows());
  if (list.length === 0) return emptyBoard();
  var maxImplied = list[0].implied_value_usd || 1;
  var tbody = el('tbody');
  list.forEach(function (r) { tbody.appendChild(boardRow(r, maxImplied)); });
  return el('div', { class: 'panel' },
    el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
        el('thead', null, el('tr', null,
          sortHeader('implied', 'Rank'),
          sortHeader('name', 'Protocol'),
          sortHeader('tvl', 'TVL'),
          sortHeader('growth', '7d'),
          sortHeader('age', 'Age'),
          sortHeader('multiple', 'Value / TVL'),
          sortHeader('implied', 'Implied value'),
          el('th', { scope: 'col', text: 'List' })
        )),
        tbody
      )
    )
  );
}

/** The live-token table: protocols that already trade, shown with market caps, never ranked. */
function liveTable() {
  var tbody = el('tbody');
  DATA.live.forEach(function (r) {
    var tone = (r.change_7d !== null && r.change_7d >= 0) ? 'pos' : 'neg';
    tbody.appendChild(el('tr', null,
      el('td', { class: 'num', text: 'live' }),
      protocolNameCell(r),
      el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
      el('td', { class: 'num ' + tone, text: fmtPct(r.change_7d) }),
      el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
      el('td', null, el('span', { class: 'badge live', text: 'Already trades' }))
    ));
  });
  return el('div', { class: 'panel' },
    el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
        el('thead', null, el('tr', null,
          el('th', { scope: 'col', text: 'Status' }),
          el('th', { scope: 'col', text: 'Protocol' }),
          el('th', { scope: 'col', text: 'TVL' }),
          el('th', { scope: 'col', text: '7d' }),
          el('th', { scope: 'col', text: 'Market cap' }),
          el('th', { scope: 'col', text: 'Token' })
        )),
        tbody
      )
    )
  );
}
