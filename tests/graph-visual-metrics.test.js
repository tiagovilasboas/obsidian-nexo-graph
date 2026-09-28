const test = require('node:test');
const assert = require('node:assert/strict');

let metrics;
test.before(async () => {
  metrics = await import('../scripts/graph-visual-metrics.mjs');
});

test('NEXO-005 finds a known crossing in a synthetic quadratic fixture', () => {
  const result = metrics.edgeCrossingMetrics([
    { id: 'descending', source: 'fixture/a', target: 'fixture/b', path: 'M 0 0 Q 50 0 100 100' },
    { id: 'ascending', source: 'fixture/c', target: 'fixture/d', path: 'M 0 100 Q 50 100 100 0' }
  ]);

  assert.deepEqual(result, {
    edgeCount: 2,
    segments: 24,
    crossingCount: 1,
    crossings: [['ascending', 'descending']]
  });
});

test('NEXO-005 reports no crossing for separated synthetic curves', () => {
  const result = metrics.edgeCrossingMetrics([
    { id: 'upper', source: 'fixture/a', target: 'fixture/b', path: 'M 0 0 Q 50 10 100 0' },
    { id: 'lower', source: 'fixture/c', target: 'fixture/d', path: 'M 0 100 Q 50 90 100 100' }
  ]);

  assert.equal(result.crossingCount, 0);
  assert.deepEqual(result.crossings, []);
});

test('NEXO-005 counts an intersection that lands exactly on sampled curve vertices', () => {
  const result = metrics.edgeCrossingMetrics([
    { id: 'diagonal-a', source: 'fixture/a', target: 'fixture/b', path: 'M 0 0 Q 50 50 100 100' },
    { id: 'diagonal-b', source: 'fixture/c', target: 'fixture/d', path: 'M 0 100 Q 50 50 100 0' }
  ]);

  assert.equal(result.crossingCount, 1);
  assert.deepEqual(result.crossings, [['diagonal-a', 'diagonal-b']]);
});

test('NEXO-005 ignores pairs that meet at the same graph node', () => {
  const result = metrics.edgeCrossingMetrics([
    { id: 'from-shared', source: 'fixture/shared', target: 'fixture/a', path: 'M 0 0 Q 45 45 100 100' },
    { id: 'to-shared', source: 'fixture/b', target: 'fixture/shared', path: 'M 100 0 Q 55 45 0 0' }
  ]);

  assert.equal(result.crossingCount, 0);
  assert.deepEqual(result.crossings, []);
});

test('NEXO-005 ignores coincident curve endpoints with distinct node ids', () => {
  const result = metrics.edgeCrossingMetrics([
    { id: 'first', source: 'fixture/a', target: 'fixture/b', path: 'M 0 0 Q 0 50 0 100' },
    { id: 'second', source: 'fixture/c', target: 'fixture/d', path: 'M 0 100 Q 50 100 100 0' }
  ]);

  assert.equal(result.crossingCount, 0);
  assert.deepEqual(result.crossings, []);
});

test('NEXO-005 metrics are deterministic across edge input order', () => {
  const first = metrics.edgeCrossingMetrics(metrics.SYNTHETIC_CROSSING_FIXTURE, { segments: 32 });
  const second = metrics.edgeCrossingMetrics([...metrics.SYNTHETIC_CROSSING_FIXTURE].reverse(), { segments: 32 });

  assert.deepEqual(first, second);
  assert.deepEqual(first.crossings, [['alpha', 'beta']]);
});

test('NEXO-005 accepts exponent coordinates and rejects paths with extra SVG commands', () => {
  assert.deepEqual(metrics.parseQuadraticPath('M -1e1 0 Q 5 2.5 10 20'), {
    start: [-10, 0],
    control: [5, 2.5],
    end: [10, 20]
  });
  assert.throws(() => metrics.parseQuadraticPath('M 0 0 L 1 1 Q 50 0 100 100'), TypeError);
  assert.throws(() => metrics.parseQuadraticPath('M 0 0 Q 50 0 100 100 Z'), TypeError);
});
