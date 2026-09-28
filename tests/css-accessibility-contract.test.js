const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

let checkCssContract;
let stylesheet;
test.before(async () => {
  ({ checkCssContract } = await import('../scripts/check-css-contract.mjs'));
  stylesheet = readFileSync(new URL('../styles.css', `file://${__filename}`), 'utf8');
});

test('NEXO-003 accepts the committed CSS accessibility contract', () => {
  assert.deepEqual(checkCssContract(stylesheet), []);
});

test('NEXO-003 rejects an unchecked filter opacity that drops text below 4.5:1 contrast', () => {
  const lowContrast = stylesheet.replace('opacity: 0.8', 'opacity: 0.48');
  assert.ok(
    checkCssContract(lowContrast).includes('Unchecked group-filter text must maintain at least 4.5:1 contrast against its filter background.')
  );
});
