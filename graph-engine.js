const MAX_NODES = 500;
const MAX_EDGES = 1600;
const GROUP_CENTERS = [[330, 230], [870, 230], [330, 585], [870, 585], [600, 400]];

function groupFor(path, rules) {
  const normalized = path.toLowerCase();
  const index = rules.findIndex(rule => rule.prefix && normalized.startsWith(rule.prefix.toLowerCase()));
  return index < 0 ? rules.length : index;
}

function graphData(app, rules, options = {}) {
  const files = app.vault.getMarkdownFiles();
  const byPath = new Map(files.map(file => [file.path, file]));
  const degree = new Map(files.map(file => [file.path, 0]));
  const allEdges = [];
  const neighbors = new Map(files.map(file => [file.path, new Set()]));

  for (const [source, targets] of Object.entries(app.metadataCache.resolvedLinks)) {
    if (!byPath.has(source)) continue;
    for (const target of Object.keys(targets)) {
      if (source === target || !byPath.has(target)) continue;
      allEdges.push([source, target]);
      degree.set(source, (degree.get(source) || 0) + 1);
      degree.set(target, (degree.get(target) || 0) + 1);
      neighbors.get(source).add(target);
      neighbors.get(target).add(source);
    }
  }

  let candidates = files;
  if (options.localMode && !byPath.has(options.anchorPath)) {
    candidates = [];
  } else if (options.localMode) {
    const reached = new Set([options.anchorPath]);
    let frontier = [options.anchorPath];
    for (let level = 0; level < options.depth; level++) {
      const next = [];
      for (const path of frontier) {
        for (const neighbor of neighbors.get(path) || []) {
          if (!reached.has(neighbor)) {
            reached.add(neighbor);
            next.push(neighbor);
          }
        }
      }
      frontier = next;
    }
    candidates = files.filter(file => reached.has(file.path));
  }

  candidates = candidates.filter(file => options.visibleGroups?.has(groupFor(file.path, rules)) ?? true);
  const chosen = [...candidates]
    .sort((a, b) => (degree.get(b.path) || 0) - (degree.get(a.path) || 0) || a.path.localeCompare(b.path))
    .slice(0, MAX_NODES);
  const visible = new Set(chosen.map(file => file.path));
  const nodes = chosen.map(file => ({
    path: file.path,
    name: file.basename,
    file,
    degree: degree.get(file.path) || 0,
    group: groupFor(file.path, rules)
  }));
  const edgePairs = new Map();
  for (const [source, target] of allEdges) {
    if (!visible.has(source) || !visible.has(target)) continue;
    const key = [source, target].sort().join('\u0000');
    const existing = edgePairs.get(key);
    if (existing) existing.bidirectional = true;
    else edgePairs.set(key, { source, target, bidirectional: false });
  }
  const edges = [...edgePairs.values()].slice(0, MAX_EDGES).map(edge => [edge.source, edge.target, edge.bidirectional]);
  return { nodes, edges, total: files.length, inScope: candidates.length };
}

function positionNodes(nodes) {
  const groups = [[], [], [], [], []];
  for (const node of nodes) groups[node.group].push(node);
  for (const [groupIndex, group] of groups.entries()) {
    group.sort((a, b) => b.degree - a.degree || a.path.localeCompare(b.path));
    group.forEach((node, index) => {
      const radius = index === 0 ? 0 : Math.min(185, 13.5 * Math.sqrt(index));
      const angle = index * 2.399963229728653 + groupIndex * 0.6;
      node.x = GROUP_CENTERS[groupIndex][0] + Math.cos(angle) * radius;
      node.y = GROUP_CENTERS[groupIndex][1] + Math.sin(angle) * radius;
    });
  }
}

module.exports = { GROUP_CENTERS, MAX_EDGES, MAX_NODES, graphData, groupFor, positionNodes };
