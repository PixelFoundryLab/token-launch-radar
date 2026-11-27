// One protocol's detail view: a drawer with the model's own inputs, the recomputed implied value,
// and the protocol's farm plan. It opens from a table row or a mover, and its slug stays in the
// page's hash so a link opens the same protocol.

var detailDialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
detailDialog.addEventListener('close', function () { state.selected = null; writeHash(); });

/** Open the detail drawer for one protocol, by slug. */
function openProtocolDetail(slug) {
  var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
  if (!row) return;
  state.selected = slug;
  writeHash();
  detailDialog.textContent = '';
  var steps = farmPlanSteps(row);
  var recomputed = impliedValueOf(row, DATA.model);
  detailDialog.appendChild(el('div', { class: 'detail-head' },
    el('div', null,
      el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.on_watchlist ? ' · Watchlist' : ' · Early radar') }),
      el('h2', { id: 'detail-title', text: row.name }),
      el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
    ),
    el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { detailDialog.close(); } })
  ));
  detailDialog.appendChild(el('section', { class: 'detail-section' },
    el('h3', { text: 'Implied value' }),
    el('div', { class: 'equation' },
      el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
      el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
      el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: row.age_days === null || row.age_days === undefined ? 'unknown (model uses 1y)' : fmtAge(row.age_days) })),
      el('div', null, el('span', { text: 'Chains' }), el('b', { class: 'num', text: String((row.chains || []).length) })),
      el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
      el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
      el('div', null, el('span', { text: 'Reach multiplier' }), el('b', { class: 'num', text: String(row.reach_multiplier) })),
      el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
      el('div', null, el('span', { text: 'Value / TVL' }), el('b', { class: 'num', text: row.implied_multiple.toFixed(2) + 'x' }))
    ),
    el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
  ));
  detailDialog.appendChild(el('section', { class: 'detail-section' },
    el('h3', { text: 'Farm plan' }),
    el('ol', { class: 'steps' }, steps.map(function (s) {
      var at = s.indexOf(' Cost: ');
      var action = at >= 0 ? s.slice(0, at) : s;
      var tail = at >= 0 ? s.slice(at + 1) : '';
      return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
    }))
  ));
  detailDialog.appendChild(el('div', { class: 'note', text: 'No token is promised. A protocol that records no token may still have one, and farming never guarantees an airdrop. Never pay anyone to claim, and never share a seed phrase.' }));
  if (typeof detailDialog.showModal === 'function') {
    if (!detailDialog.open) detailDialog.showModal();
  } else {
    detailDialog.setAttribute('open', '');
  }
}
