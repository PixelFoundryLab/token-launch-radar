// The value chart: the board's top 10 by implied value as horizontal bars, drawn from the same
// rows the table shows. Amber is the watchlist, teal is the early radar. The chart follows the
// current filter, so it always pictures the rows on screen.

/** The top 10 rows by implied value as a bar chart: rank, name, a bar to the strongest value, and the value. */
function renderValueChart(rows) {
  var top = rows.slice(0, 10);
  if (top.length === 0) return null;
  var max = top[0].implied_value_usd || 1;
  var bars = top.map(function (r) {
    return el('div', { class: 'chart-row' },
      el('span', { class: 'num c-rank', text: String(r.rank) }),
      el('span', { class: 'c-name', text: r.name }),
      el('div', { class: 'c-bar', 'aria-hidden': 'true' }, el('i', { class: r.on_watchlist ? '' : 'early', style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
      el('span', { class: 'num c-val', text: fmtUsd(r.implied_value_usd) })
    );
  });
  return el('section', { class: 'panel chart', 'aria-label': 'Top 10 protocols by implied value' },
    el('h2', { text: 'Top 10 by implied value' }),
    el('p', { class: 'sub', text: 'The strongest implied values among the rows shown. Amber bars are the watchlist, teal bars are the early radar.' }),
    el('div', { class: 'chart-rows' }, bars)
  );
}
