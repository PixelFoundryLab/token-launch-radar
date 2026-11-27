// The value model, recomputed in the page: the same function main.ts runs, so the page's code
// and the board's data are visibly the same arithmetic. A row's recomputed number must match the
// implied value board.json carries, or the detail view says the data is stale.

/** One row's implied value from the snapshot figures the model scores: TVL, 7-day growth, age and chains. */
function impliedValueOf(row, model) {
  var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
  var growthMult = 1 + (growth / 100) * model.growth_weight;
  var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
  var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  var extra = Math.min(Math.max((row.chains || []).length - 1, 0), model.reach_max_extra_chains);
  var reach = 1 + extra * model.reach_weight;
  return Math.max(1, Math.round(row.tvl_usd * model.base_multiple * growthMult * maturity * reach));
}
