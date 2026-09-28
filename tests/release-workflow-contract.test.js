const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const workflow = readFileSync(new URL('../.github/workflows/verify-release.yml', `file://${__filename}`), 'utf8');

test('release tag is passed to the verifier as data, not interpolated into shell source', () => {
  assert.match(workflow, /RELEASE_TAG:\s*\$\{\{\s*github\.event\.release\.tag_name\s*\}\}/);
  const run = workflow.match(/^\s+run:\s*(.+)$/m)?.[1];
  assert.equal(run, 'node scripts/verify-release-assets.mjs "$RELEASE_TAG"');
  assert.doesNotMatch(run || '', /\$\{\{/);
});
