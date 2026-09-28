const test = require('node:test');
const assert = require('node:assert/strict');
const { CORE_CENTER, CORE_EXCLUSION_RADIUS, DOMAIN_ORBIT_RADIUS, GROUP_RADIUS, LABEL_CLEARANCE, MAX_EDGES, MAX_NODES, activeGroupCenters, edgeRoute, graphData, groupFor, positionNodes, searchMatches, searchSummary } = require('../src/graph-engine');

const rules = [
  { name: 'Personal', prefix: 'pages/pessoal/' },
  { name: 'Career', prefix: 'pages/carreira/' }
];

function app(paths, resolvedLinks = {}) {
  return {
    vault: {
      getMarkdownFiles: () => paths.map(path => ({ path, basename: path.split('/').pop().replace(/\.md$/, '') }))
    },
    metadataCache: { resolvedLinks }
  };
}

test('groups paths case-insensitively and places unmatched notes in Other', () => {
  assert.equal(groupFor('PAGES/PESSOAL/ideas.md', rules), 0);
  assert.equal(groupFor('pages/carreira/cv.md', rules), 1);
  assert.equal(groupFor('inbox.md', rules), 2);

  const data = graphData(app(['pages/pessoal/ideas.md', 'pages/carreira/cv.md', 'inbox.md']), rules);
  assert.deepEqual(data.nodes.map(node => [node.path, node.group]), [
    ['pages/pessoal/ideas.md', 0],
    ['pages/carreira/cv.md', 1],
    ['inbox.md', 2]
  ]);
});

test('supports multiple folder prefixes per group and keeps single-prefix compatibility', () => {
  const grouped = [
    { name: 'Career', prefixes: ['pages/carreira/', 'pages/staff/'] },
    { name: 'Operations', prefix: 'pages/ops/' }
  ];

  assert.equal(groupFor('pages/staff/impact.md', grouped), 0);
  assert.equal(groupFor('PAGES/CARREIRA/cv.md', grouped), 0);
  assert.equal(groupFor('pages/ops/runbook.md', grouped), 1);
  assert.equal(groupFor('pages/meta/harness.md', grouped), 2);
});

test('omits configured path prefixes and their links from the default graph scope', () => {
  const result = graphData(app(
    ['pages/ops/active.md', '_trash/old.md', 'pages/ops/archived/note.md'],
    {
      'pages/ops/active.md': { '_trash/old.md': 1, 'pages/ops/archived/note.md': 1 },
      '_trash/old.md': { 'pages/ops/active.md': 1 }
    }
  ), rules, { ignoredPrefixes: [' _TRASH/', 'pages/ops/archived/'] });

  assert.deepEqual(result.nodes.map(node => node.path), ['pages/ops/active.md']);
  assert.deepEqual(result.edges, []);
  assert.equal(result.total, 3);
  assert.equal(result.ignoredCount, 2);
  assert.equal(result.inScope, 1);
});

test('merges reciprocal links into one bidirectional edge', () => {
  const data = graphData(app(
    ['a.md', 'b.md'],
    { 'a.md': { 'b.md': 1 }, 'b.md': { 'a.md': 1 } }
  ), rules);

  assert.deepEqual(data.edges, [['a.md', 'b.md', true]]);
  assert.deepEqual(data.nodes.map(node => [node.path, node.degree]), [['a.md', 2], ['b.md', 2]]);
  const reversedCache = graphData(app(
    ['b.md', 'a.md'],
    { 'b.md': { 'a.md': 1 }, 'a.md': { 'b.md': 1 } }
  ), rules);
  assert.deepEqual(reversedCache.edges, data.edges);
});

test('graph data reflects new rule notes and edited resolved links on the next render', () => {
  const groups = [{ name: 'Rules', prefixes: ['rules/'] }];
  const paths = ['rules/existing.md', 'docs/readme.md'];
  const graph = app(paths);
  const initial = graphData(graph, groups);
  assert.equal(initial.nodes.length, 2);
  assert.deepEqual(initial.groupCounts, [1, 1]);
  assert.equal(initial.linksInScope, 0);

  paths.push('rules/new-rule.md');
  graph.metadataCache.resolvedLinks = {
    'rules/new-rule.md': { 'docs/readme.md': 1 }
  };
  const updated = graphData(graph, groups);

  assert.equal(updated.nodes.length, 3);
  assert.deepEqual(updated.groupCounts, [2, 1]);
  assert.equal(updated.nodes.find(node => node.path === 'rules/new-rule.md').group, 0);
  assert.deepEqual(updated.edges, [['rules/new-rule.md', 'docs/readme.md', false]]);
  assert.equal(updated.linksInScope, 1);
});

test('local traversal includes exactly the configured undirected depth', () => {
  const graph = app(
    ['a.md', 'b.md', 'c.md', 'd.md', 'outside.md'],
    { 'a.md': { 'b.md': 1 }, 'b.md': { 'c.md': 1 }, 'd.md': { 'c.md': 1 } }
  );

  const oneHop = graphData(graph, rules, { localMode: true, anchorPath: 'b.md', depth: 1 });
  const twoHops = graphData(graph, rules, { localMode: true, anchorPath: 'b.md', depth: 2 });

  assert.deepEqual(oneHop.nodes.map(node => node.path).sort(), ['a.md', 'b.md', 'c.md']);
  assert.deepEqual(twoHops.nodes.map(node => node.path).sort(), ['a.md', 'b.md', 'c.md', 'd.md']);
  assert.equal(graphData(graph, rules, { localMode: true, anchorPath: 'missing.md', depth: 1 }).nodes.length, 0);
});

test('group filters limit the graph without changing group classification', () => {
  const data = graphData(app([
    'pages/pessoal/ideas.md',
    'pages/carreira/cv.md',
    'inbox.md'
  ]), rules, { visibleGroups: new Set([1]) });

  assert.deepEqual(data.nodes.map(node => [node.path, node.group]), [['pages/carreira/cv.md', 1]]);
  assert.equal(data.inScope, 1);
});

test('search matches note names and paths case-insensitively after trimming input', () => {
  const nodes = [
    { name: 'Checkout', path: 'pages/ops/checkout.md' },
    { name: 'Billing', path: 'pages/carreira/billing.md' }
  ];

  assert.deepEqual(searchMatches(nodes, '  CHECK  '), [nodes[0]]);
  assert.deepEqual(searchMatches(nodes, 'CARREIRA'), [nodes[1]]);
  assert.deepEqual(searchMatches(nodes, 'missing'), []);
  assert.equal(searchMatches(nodes, '  '), nodes);
});

test('search status announces visible counts and a clear no-match state', () => {
  const nodes = [
    { name: 'Checkout', path: 'pages/ops/checkout.md' },
    { name: 'Billing', path: 'pages/carreira/billing.md' }
  ];

  assert.equal(searchSummary(nodes, ''), '2 searchable notes');
  assert.equal(searchSummary(nodes, ' checkout '), '1 matching note');
  assert.equal(searchSummary(nodes, 'unknown'), 'No notes match “unknown”');
  assert.equal(searchSummary([], ''), '0 searchable notes');
});

test('node and edge limits select a deterministic result', () => {
  const nodePaths = Array.from({ length: MAX_NODES + 1 }, (_, index) => `notes/${String(index).padStart(3, '0')}.md`);
  const nodeLinks = { [nodePaths[0]]: Object.fromEntries(nodePaths.slice(1).map(path => [path, 1])) };
  const first = graphData(app(nodePaths, nodeLinks), rules);
  const second = graphData(app(nodePaths, nodeLinks), rules);

  assert.equal(first.nodes.length, MAX_NODES);
  assert.deepEqual(first.nodes.map(node => node.path), second.nodes.map(node => node.path));
  assert.equal(first.nodes.some(node => node.path === nodePaths.at(-1)), false);

  const densePaths = Array.from({ length: 58 }, (_, index) => `dense/${index}.md`);
  const denseLinks = Object.fromEntries(densePaths.map(source => [
    source,
    Object.fromEntries(densePaths.filter(target => target !== source).map(target => [target, 1]))
  ]));
  const dense = graphData(app(densePaths, denseLinks), rules);
  assert.equal(dense.edges.length, MAX_EDGES);
  assert.deepEqual(dense.edges, graphData(app(densePaths, denseLinks), rules).edges);
});

test('node sampling preserves smaller groups when one group exceeds the cap', () => {
  const paths = [
    ...Array.from({ length: 580 }, (_, index) => `pages/pessoal/${String(index).padStart(3, '0')}.md`),
    ...Array.from({ length: 6 }, (_, index) => `pages/carreira/cv-${index}.md`),
    ...Array.from({ length: 6 }, (_, index) => `inbox/note-${index}.md`)
  ];
  const result = graphData(app(paths), rules);
  const counts = result.nodes.reduce((groups, node) => groups.set(node.group, (groups.get(node.group) || 0) + 1), new Map());

  assert.equal(result.nodes.length, MAX_NODES);
  assert.equal(counts.get(0), 488);
  assert.equal(counts.get(1), 6);
  assert.equal(counts.get(2), 6);
});

test('edge sampling retains every observed folder-group relationship under the cap', () => {
  const paths = Array.from({ length: 60 }, (_, index) => {
    const group = index < 20 ? 'pages/pessoal' : index < 40 ? 'pages/carreira' : 'inbox';
    return `${group}/note-${String(index).padStart(2, '0')}.md`;
  });
  const links = Object.fromEntries(paths.map(source => [source, Object.fromEntries(paths.filter(target => target !== source).map(target => [target, 1]))]));
  const result = graphData(app(paths, links), rules);
  const groupPairs = new Set(result.edges.map(([source, target]) => {
    const left = groupFor(source, rules);
    const right = groupFor(target, rules);
    return [left, right].sort((a, b) => a - b).join(':');
  }));

  assert.equal(result.edges.length, MAX_EDGES);
  assert.equal(result.linksInScope, 1770);
  assert.equal(groupPairs.size, 6);
});

test('node positioning is deterministic for an unchanged graph', () => {
  const first = graphData(app(['pages/pessoal/a.md', 'pages/pessoal/b.md'], { 'pages/pessoal/a.md': { 'pages/pessoal/b.md': 1 } }), rules).nodes;
  const second = graphData(app(['pages/pessoal/a.md', 'pages/pessoal/b.md'], { 'pages/pessoal/a.md': { 'pages/pessoal/b.md': 1 } }), rules).nodes;

  positionNodes(first);
  positionNodes(second);
  assert.deepEqual(first.map(({ path, x, y }) => [path, x, y]), second.map(({ path, x, y }) => [path, x, y]));
});

test('active domains adapt around a fixed neutral core without reserving empty sectors', () => {
  assert.deepEqual(CORE_CENTER, [600, 400]);
  assert.equal(activeGroupCenters([]).size, 0);
  const one = activeGroupCenters([2]);
  assert.deepEqual([...one.keys()], [2]);
  assert.deepEqual(one.get(2), [CORE_CENTER[0] + DOMAIN_ORBIT_RADIUS, CORE_CENTER[1]]);

  const two = activeGroupCenters([0, 3]);
  assert.equal(two.size, 2);
  assert.ok(two.get(0)[0] > CORE_CENTER[0] && two.get(3)[0] < CORE_CENTER[0]);
  assert.equal(two.get(0)[1], CORE_CENTER[1]);

  const three = activeGroupCenters([0, 1, 2]);
  assert.equal(three.size, 3);
  assert.equal(new Set([...three.values()].map(center => center.map(Math.round).join(':'))).size, 3);

  const four = activeGroupCenters([3, 1, 0, 2]);
  assert.equal(four.size, 4);
  assert.deepEqual([...four.keys()], [0, 1, 2, 3]);
  assert.equal(new Set([...four.values()].map(center => center.map(Math.round).join(':'))).size, 4);
  assert.deepEqual([...four], [...activeGroupCenters([0, 1, 2, 3])]);
  const customNames = [{ name: 'Rules', prefixes: ['rules/'] }, { name: 'Agents', prefixes: ['agents/'] }];
  assert.equal(groupFor('rules/review.md', customNames), 0, 'renaming a group must not change prefix classification');
  assert.equal(groupFor('agents/code-review.md', customNames), 1);
  assert.ok(GROUP_RADIUS < 170, 'domain fields must leave visual space around the Nexo core');
});

test('unclassified notes remain on a neutral ring outside the central mark', () => {
  const nodes = Array.from({ length: 12 }, (_, index) => ({ path: `inbox/${index}.md`, group: 4, degree: 0 }));
  positionNodes(nodes);
  assert.ok(nodes.every(node => Math.hypot(node.x - CORE_CENTER[0], node.y - CORE_CENTER[1]) >= CORE_EXCLUSION_RADIUS + 20));
});

test('neural mesh routes cross-domain links around the visible core', () => {
  const top = { path: 'pages/pessoal/top.md', group: 0, x: 600, y: 165 };
  const right = { path: 'pages/carreira/right.md', group: 1, x: 930, y: 400 };
  const bottom = { path: 'pages/ops/bottom.md', group: 2, x: 600, y: 635 };
  const peer = { path: 'pages/pessoal/peer.md', group: 0, x: 540, y: 150 };

  const adjacent = edgeRoute(top, right);
  assert.equal(adjacent.crossDomain, true);
  assert.match(adjacent.d, /^M 600 165 Q /);

  const opposite = edgeRoute(top, bottom);
  assert.equal(opposite.crossDomain, true);
  assert.match(opposite.d, /^M 600 165 Q /);
  const control = opposite.d.match(/ Q ([\d.-]+) ([\d.-]+) /);
  assert.ok(control);
  const curveMidpoint = [(600 + 2 * Number(control[1]) + 600) / 4, (165 + 2 * Number(control[2]) + 635) / 4];
  assert.ok(Math.hypot(curveMidpoint[0] - 600, curveMidpoint[1] - 400) > 30, 'links must leave the visible neuron icon clear');

  const left = { path: 'pages/meta/left.md', group: 3, x: 270, y: 400 };
  const cross = edgeRoute(right, left);
  assert.match(cross.d, /^M 930 400 Q /);

  const local = edgeRoute(top, peer);
  assert.equal(local.crossDomain, false);
  assert.match(local.d, /^M 600 165 Q /);

  const other = edgeRoute({ path: 'inbox/loose.md', group: 4, x: 700, y: 430 }, top);
  assert.equal(other.crossDomain, true);
});

test('crowded group positions remain inside its documented radius', () => {
  const paths = Array.from({ length: MAX_NODES }, (_, index) => `pages/pessoal/note-${index}.md`);
  const nodes = graphData(app(paths), rules).nodes;
  positionNodes(nodes);
  const [centerX, centerY] = activeGroupCenters([0]).get(0);
  const maxRadius = Math.max(...nodes.map(node => Math.hypot(node.x - centerX, node.y - centerY)));
  assert.ok(maxRadius <= GROUP_RADIUS, `group radius was ${maxRadius.toFixed(1)}`);
});

test('documented maximum-size graph stays within a generous runtime budget', () => {
  const paths = Array.from({ length: MAX_NODES }, (_, index) => `notes/${String(index).padStart(3, '0')}.md`);
  const links = {};
  let remainingEdges = MAX_EDGES;
  for (let sourceIndex = 0; sourceIndex < paths.length && remainingEdges > 0; sourceIndex++) {
    const targets = {};
    for (let offset = 1; offset <= 4 && remainingEdges > 0; offset++) {
      targets[paths[(sourceIndex + offset) % paths.length]] = 1;
      remainingEdges--;
    }
    links[paths[sourceIndex]] = targets;
  }

  const startedAt = performance.now();
  const result = graphData(app(paths, links), rules);
  positionNodes(result.nodes);
  const byPath = new Map(result.nodes.map(node => [node.path, node]));
  for (const [source, target] of result.edges) edgeRoute(byPath.get(source), byPath.get(target));
  const elapsedMs = performance.now() - startedAt;

  assert.equal(result.nodes.length, MAX_NODES);
  assert.equal(result.edges.length, MAX_EDGES);
  assert.ok(elapsedMs < 1500, `500-note / 1,600-link fixture took ${elapsedMs.toFixed(1)} ms`);
});
