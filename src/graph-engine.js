const MAX_NODES = 500;
const MAX_EDGES = 1600;
// Active domains orbit a stable, neutral core. Coordinates are recomputed
// deterministically so empty configured groups do not reserve visual space.
const CORE_CENTER = [600, 400];
const DOMAIN_ORBIT_RADIUS = 290;
const GROUP_RADIUS = 146;
const CORE_EXCLUSION_RADIUS = 86;

function groupFor(path, rules) {
  const normalized = path.toLowerCase();
  const index = rules.findIndex(rule => {
    const prefixes = Array.isArray(rule.prefixes) ? rule.prefixes : [rule.prefix];
    return prefixes.some(prefix => typeof prefix === 'string' && prefix.trim() && normalized.startsWith(prefix.trim().toLowerCase()));
  });
  return index < 0 ? rules.length : index;
}

function searchMatches(nodes, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return nodes;
  return nodes.filter(node => node.name.toLowerCase().includes(normalized) || node.path.toLowerCase().includes(normalized));
}

function searchSummary(nodes, query) {
  const normalized = query.trim();
  const matches = searchMatches(nodes, normalized);
  if (!normalized) return `${nodes.length} searchable ${nodes.length === 1 ? 'note' : 'notes'}`;
  if (!matches.length) return `No notes match “${normalized}”`;
  return `${matches.length} matching ${matches.length === 1 ? 'note' : 'notes'}`;
}

function handleNodeKey(event, actions) {
  if (event.key === 'Enter') {
    event.preventDefault();
    actions.open();
    return true;
  }
  if (event.key === ' ') {
    event.preventDefault();
    actions.toggleSelection();
    return true;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    actions.clearSelection();
    return true;
  }
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
    event.preventDefault();
    actions.showContextMenu();
    return true;
  }
  return false;
}

function activeGroupCenters(groupIndexes) {
  const groups = [...new Set(groupIndexes.filter(index => Number.isInteger(index) && index >= 0 && index < 4))].sort((a, b) => a - b);
  const centers = new Map();
  if (!groups.length) return centers;

  const count = groups.length;
  const startAngle = count === 1 || count === 2 ? 0 : count === 3 ? -Math.PI / 2 : -Math.PI / 4;
  const orbitRadius = count === 3 ? 238 : DOMAIN_ORBIT_RADIUS;
  groups.forEach((group, index) => {
    const angle = startAngle + index * (Math.PI * 2 / count);
    centers.set(group, [
      CORE_CENTER[0] + Math.cos(angle) * orbitRadius,
      CORE_CENTER[1] + Math.sin(angle) * orbitRadius
    ]);
  });
  return centers;
}

function labelPlan(nodes, perGroupLimit = 4, clearance = 3) {
  const groupIndexes = [...new Set(nodes.map(node => node.group))];
  const centers = activeGroupCenters(groupIndexes);
  const groups = new Map();
  for (const node of nodes) {
    if (!groups.has(node.group)) groups.set(node.group, []);
    groups.get(node.group).push(node);
  }

  const positions = new Map();
  const visible = new Set();
  const boxes = [];
  for (const [groupIndex, group] of [...groups].sort(([left], [right]) => left - right)) {
    group.sort((a, b) => b.degree - a.degree || a.path.localeCompare(b.path));
    const center = centers.get(groupIndex) || CORE_CENTER;
    group.forEach((node, rank) => {
      const radius = Math.min(10, 3.5 + Math.sqrt(node.degree) * 1.2);
      const width = Math.max(8, node.name.length * 6.6);
      const directionX = groupIndex < 4 ? center[0] - CORE_CENTER[0] : node.x - CORE_CENTER[0];
      const directionY = groupIndex < 4 ? center[1] - CORE_CENTER[1] : node.y - CORE_CENTER[1];
      const horizontal = Math.abs(directionX) >= Math.abs(directionY);
      const outward = horizontal ? Math.sign(directionX) || 1 : Math.sign(directionY) || 1;
      const position = horizontal
        ? { x: outward * (radius + 8), y: rank % 2 ? 12 : -5, anchor: outward > 0 ? 'start' : 'end' }
        : { x: rank % 2 ? 5 : -5, y: outward * (radius + (outward > 0 ? 15 : 7)), anchor: 'middle' };
      positions.set(node.path, position);
      if (rank >= perGroupLimit) return;

      const left = node.x + position.x - (position.anchor === 'start' ? 0 : position.anchor === 'end' ? width : width / 2);
      const top = node.y + position.y - 9;
      const box = { path: node.path, left, top, right: left + width, bottom: top + 14 };
      const collides = boxes.some(other =>
        box.left < other.right + clearance && box.right + clearance > other.left &&
        box.top < other.bottom + clearance && box.bottom + clearance > other.top
      );
      if (!collides) {
        visible.add(node.path);
        boxes.push(box);
      }
    });
  }
  return { positions, visible, boxes };
}

function selectNodesByGroup(candidates, degree, rules) {
  const groups = new Map();
  for (const file of candidates) {
    const group = groupFor(file.path, rules);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(file);
  }
  for (const files of groups.values()) {
    files.sort((a, b) => (degree.get(b.path) || 0) - (degree.get(a.path) || 0) || a.path.localeCompare(b.path));
  }

  const selected = [];
  const groupQueues = [...groups.entries()].sort(([a], [b]) => a - b).map(([, files]) => files);
  while (selected.length < MAX_NODES) {
    let added = false;
    for (const files of groupQueues) {
      if (files.length && selected.length < MAX_NODES) {
        selected.push(files.shift());
        added = true;
      }
    }
    if (!added) break;
  }
  return selected;
}

function selectRepresentativeEdges(edgePairs, nodes, limit = MAX_EDGES) {
  const byPath = new Map(nodes.map(node => [node.path, node]));
  const buckets = new Map();
  for (const edge of edgePairs.values()) {
    const source = byPath.get(edge.source);
    const target = byPath.get(edge.target);
    const pair = [source.group, target.group].sort((a, b) => a - b).join(':');
    if (!buckets.has(pair)) buckets.set(pair, []);
    buckets.get(pair).push(edge);
  }

  const score = (edge) => {
    const source = byPath.get(edge.source);
    const target = byPath.get(edge.target);
    return [source.group === target.group ? 1 : 0, -(source.degree + target.degree), edge.source, edge.target];
  };
  const compare = (a, b) => {
    const left = score(a);
    const right = score(b);
    return left[0] - right[0] || left[1] - right[1] || left[2].localeCompare(right[2]) || left[3].localeCompare(right[3]);
  };
  const groups = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, edges]) => edges.sort(compare));
  const selected = [];
  for (let round = 0; selected.length < limit; round++) {
    let added = false;
    for (const edges of groups) {
      if (edges[round] && selected.length < limit) {
        selected.push(edges[round]);
        added = true;
      }
    }
    if (!added) break;
  }
  return selected;
}

function graphData(app, rules, options = {}) {
  const allFiles = app.vault.getMarkdownFiles();
  const ignoredPrefixes = Array.isArray(options.ignoredPrefixes) ? options.ignoredPrefixes : [];
  const files = allFiles.filter(file => !ignoredPrefixes.some(prefix =>
    typeof prefix === 'string' && prefix.trim() && file.path.toLowerCase().startsWith(prefix.trim().toLowerCase())
  ));
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

  const groupCounts = Array.from({ length: rules.length + 1 }, () => 0);
  for (const file of candidates) groupCounts[groupFor(file.path, rules)]++;
  candidates = candidates.filter(file => options.visibleGroups?.has(groupFor(file.path, rules)) ?? true);
  const chosen = selectNodesByGroup(candidates, degree, rules);
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
      const [left, right] = [source, target].sort();
      const key = `${left}\u0000${right}`;
      const existing = edgePairs.get(key);
      if (existing) {
        existing.source = left;
        existing.target = right;
        existing.bidirectional = true;
      }
      else edgePairs.set(key, { source, target, bidirectional: false });
  }
  const edges = selectRepresentativeEdges(edgePairs, nodes).map(edge => [edge.source, edge.target, edge.bidirectional]);
  return { nodes, edges, total: allFiles.length, ignoredCount: allFiles.length - files.length, inScope: candidates.length, linksInScope: edgePairs.size, groupCounts };
}

function positionNodes(nodes) {
  const groups = [[], [], [], [], []];
  for (const node of nodes) groups[node.group].push(node);
  const centers = activeGroupCenters(groups.slice(0, 4).flatMap((group, index) => group.length ? [index] : []));
  for (const [groupIndex, group] of groups.entries()) {
    group.sort((a, b) => b.degree - a.degree || a.path.localeCompare(b.path));
    if (groupIndex === 4) {
      // Keep unclassified notes neutral and outside the central mark.
      group.forEach((node, index) => {
        const radius = 112 + Math.min(30, Math.sqrt(index) * 3);
        const angle = index * 2.399963229728653;
        node.x = CORE_CENTER[0] + Math.cos(angle) * radius;
        node.y = CORE_CENTER[1] + Math.sin(angle) * radius;
      });
      continue;
    }
    if (!group.length) continue;
    const [centerX, centerY] = centers.get(groupIndex);
    const spacing = group.length <= 1 ? 0 : Math.min(26, (GROUP_RADIUS - 36) / Math.sqrt(group.length - 1));
    group.forEach((node, index) => {
      const radius = index === 0 ? 0 : 36 + spacing * Math.sqrt(index - 1);
      const angle = index * 2.399963229728653 + groupIndex * 0.6;
      node.x = centerX + Math.cos(angle) * radius;
      node.y = centerY + Math.sin(angle) * radius;
    });
  }
  return centers;
}

function edgeRoute(source, target) {
  const local = source.group === target.group;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const midpointX = (source.x + target.x) / 2;
  const midpointY = (source.y + target.y) / 2;
  const normalX = -dy / length;
  const normalY = dx / length;
  let hash = 0;
  for (const character of `${source.path}|${target.path}`) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const side = hash & 1 ? 1 : -1;
  if (local) {
    const bend = Math.min(28, length * 0.07);
    const controlX = (source.x + target.x) / 2 - dy / length * bend * side;
    const controlY = (source.y + target.y) / 2 + dx / length * bend * side;
    return { crossDomain: false, d: `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}` };
  }
  const [coreX, coreY] = CORE_CENTER;
  const centerDistance = Math.hypot(midpointX - coreX, midpointY - coreY);
  const lane = centerDistance < CORE_EXCLUSION_RADIUS + 20 ? 132 + (hash % 3) * 18 : Math.min(64, Math.max(24, length * 0.12));
  const controlX = midpointX + normalX * lane * side;
  const controlY = midpointY + normalY * lane * side;
  return { crossDomain: true, d: `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}` };
}

module.exports = { CORE_CENTER, CORE_EXCLUSION_RADIUS, DOMAIN_ORBIT_RADIUS, GROUP_RADIUS, MAX_EDGES, MAX_NODES, activeGroupCenters, edgeRoute, graphData, groupFor, handleNodeKey, labelPlan, positionNodes, searchMatches, searchSummary, selectNodesByGroup, selectRepresentativeEdges };
