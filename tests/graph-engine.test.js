const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_EDGES, MAX_NODES, graphData, groupFor, positionNodes } = require('../src/graph-engine');

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
    ['inbox.md', 2],
    ['pages/carreira/cv.md', 1],
    ['pages/pessoal/ideas.md', 0]
  ]);
});

test('merges reciprocal links into one bidirectional edge', () => {
  const data = graphData(app(
    ['a.md', 'b.md'],
    { 'a.md': { 'b.md': 1 }, 'b.md': { 'a.md': 1 } }
  ), rules);

  assert.deepEqual(data.edges, [['a.md', 'b.md', true]]);
  assert.deepEqual(data.nodes.map(node => [node.path, node.degree]), [['a.md', 2], ['b.md', 2]]);
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

test('node positioning is deterministic for an unchanged graph', () => {
  const first = graphData(app(['pages/pessoal/a.md', 'pages/pessoal/b.md'], { 'pages/pessoal/a.md': { 'pages/pessoal/b.md': 1 } }), rules).nodes;
  const second = graphData(app(['pages/pessoal/a.md', 'pages/pessoal/b.md'], { 'pages/pessoal/a.md': { 'pages/pessoal/b.md': 1 } }), rules).nodes;

  positionNodes(first);
  positionNodes(second);
  assert.deepEqual(first.map(({ path, x, y }) => [path, x, y]), second.map(({ path, x, y }) => [path, x, y]));
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
  const elapsedMs = performance.now() - startedAt;

  assert.equal(result.nodes.length, MAX_NODES);
  assert.equal(result.edges.length, MAX_EDGES);
  assert.ok(elapsedMs < 1500, `500-note / 1,600-link fixture took ${elapsedMs.toFixed(1)} ms`);
});
