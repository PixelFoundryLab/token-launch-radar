// A protocol's farm plan, generated in the page: the same derivation main.ts writes to board.json,
// so the detail view and the board carry the same steps. Category, chains, TVL and age decide the
// action, the capital, the hold and every cost and time. No name is special-cased.

/** The first chain a protocol names, or a neutral phrase. */
function farmChainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }

/** A second chain when the protocol runs on more than one, else null. */
function farmSecondChainOf(p) { return p.chains && p.chains.length > 1 ? p.chains[1] : null; }

/** How much capital one farm position needs, from the protocol's own TVL. */
function farmCapitalFor(p) {
  if (p.tvl_usd >= 5e9) return 250;
  if (p.tvl_usd >= 1e9) return 150;
  if (p.tvl_usd >= 1e8) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function farmHoldDaysFor(age) {
  if (age === null || age === undefined) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function farmActionFor(p, capital, chain) {
  var c = (p.category || '').toLowerCase();
  var name = p.name;
  if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
  if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
  if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
  if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
  if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
  if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
  if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
  if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
  if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
  if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
  if (c.indexOf('launchpad') >= 0) return 'Join one ' + name + ' sale on ' + chain + ' with $' + capital + ' and hold the allocation.';
  if (c.indexOf('farm') >= 0) return 'Stake $' + capital + ' of LP tokens in ' + name + "'s farm on " + chain + ' and keep the position open.';
  return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
}

/** A second, different action on another chain or product, to deepen the activity. */
function farmSecondActionFor(p, capital, chain) {
  if (!chain) return null;
  var c = (p.category || '').toLowerCase();
  var name = p.name;
  var half = Math.max(25, Math.round(capital / 2));
  if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0) return 'On ' + chain + ', borrow $' + half + ' against the deposit and repay it the same week.';
  if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0) return 'On ' + chain + ', swap $' + half + " through " + name + "'s pool and add the other half as liquidity.";
  if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'On ' + chain + ', deposit $' + half + ' into a second ' + name + ' vault with a different strategy.';
  if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'On ' + chain + ', open a second small position in the opposite direction as a hedge.';
  return 'On ' + chain + ', repeat the same deposit with $' + half + ' so the activity spans two chains.';
}

/** One step as a string: its action, then its cost and time. */
function farmStepText(step) {
  var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
  if (s.length > 600) s = s.slice(0, 596) + '...';
  if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
  return s;
}

/** A protocol's farm plan: seven steps, each an action with a cost and a time. */
function farmPlanSteps(p) {
  var chain = farmChainOf(p);
  var second = farmSecondChainOf(p);
  var capital = farmCapitalFor(p);
  var hold = farmHoldDaysFor(p.age_days);
  var steps = [
    { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: farmActionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' }
  ];
  var secondAction = farmSecondActionFor(p, capital, second);
  if (secondAction) steps.push({ text: secondAction, cost: 'about $' + Math.max(25, Math.round(capital / 2)) + ' of capital and $3 of gas', time: '10 minutes' });
  steps.push(
    { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
    { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
    { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
    { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
  );
  return steps.map(farmStepText);
}
