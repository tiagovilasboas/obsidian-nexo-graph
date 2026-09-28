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

test('NEXO-007 rejects cross-domain edges that dominate local edges at rest', () => {
  const dominantCrossDomain = stylesheet.replace(
    '.nexo-edges path.is-cross-domain { stroke-width: 1.1; opacity: 0.28; }',
    '.nexo-edges path.is-cross-domain { stroke-width: 1.1; opacity: 0.4; }'
  );
  assert.ok(
    checkCssContract(dominantCrossDomain).includes('Cross-domain graph edges must not be more prominent than local edges at rest.')
  );
});

test('NEXO-007 rejects dimmed edges that are as prominent as resting edges', () => {
  const undimmed = stylesheet.replace(
    '.nexo-edges path.is-dimmed { opacity: 0.05; }',
    '.nexo-edges path.is-dimmed { opacity: 0.28; }'
  );
  assert.ok(
    checkCssContract(undimmed).includes('Dimmed graph edges must remain quieter than graph edges at rest.')
  );
});
