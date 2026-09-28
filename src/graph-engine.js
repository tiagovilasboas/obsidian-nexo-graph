const MAX_NODES = 500;
const MAX_EDGES = 1600;
const LABEL_ALL_THRESHOLD = 32;
const CORE_CENTER = [600, 400];
const CORE_EXCLUSION_RADIUS = 86;
const CORE_TITLE_BOX = { left: 488, top: 464, right: 712, bottom: 484, kind: 'core-title' };

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

function shouldShowAllLabels(nodeCount) {
  return nodeCount < LABEL_ALL_THRESHOLD;
}

function visibleLegendGroups(groups, counts) {
  return groups.filter((_, index) => (counts[index] || 0) > 0);
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

function reservedLabelBoxes() {
  return [{ ...CORE_TITLE_BOX }];
}

function labelPlan(nodes, perGroupLimit = 4, clearance = 3, reservedBoxes = []) {
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
    group.forEach((node, rank) => {
      const radius = Math.min(10, 3.5 + Math.sqrt(node.degree) * 1.2);
      const width = Math.max(8, node.name.length * 6.6);
      const directionX = node.x - CORE_CENTER[0];
      const directionY = node.y - CORE_CENTER[1];
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
      const collides = [...reservedBoxes, ...boxes].some(other =>
        box.left < other.right + clearance && box.right + clearance > other.left &&
        box.top < other.bottom + clearance && box.bottom + clearance > other.top
      );
      if (!collides) {
        visible.add(node.path);
        boxes.push(box);
      }
    });
  }
  return { positions, visible, boxes, reservedBoxes };
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

function stableHash(value) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return hash;
}

function positionNodes(nodes, edges = []) {
  if (!nodes.length) return;
  const [centerX, centerY] = CORE_CENTER;
  const innerRadius = CORE_EXCLUSION_RADIUS + 38;
  const outerRadius = 328;
  const ordered = [...nodes].sort((a, b) => a.path.localeCompare(b.path));
  const positions = new Map();
  const nodeIndexes = new Map(ordered.map((node, index) => [node.path, index]));
  ordered.forEach(node => {
    const angle = stableHash(`${node.path}|angle`) / 0x100000000 * Math.PI * 2;
    const ratio = stableHash(`${node.path}|radius`) / 0x100000000;
    const radius = Math.sqrt(innerRadius ** 2 + ratio * (outerRadius ** 2 - innerRadius ** 2));
    node.x = centerX + Math.cos(angle) * radius;
    node.y = centerY + Math.sin(angle) * radius;
    positions.set(node.path, node);
  });

  // A small, fixed relaxation gives connected notes a gentle neural pull.
  // Pairwise repulsion prevents pileups; the annular clamp preserves the core
  // and the circular silhouette. Bounded iterations keep rendering predictable.
  const springs = edges
    .map(([source, target]) => [positions.get(source), positions.get(target)])
    .filter(([a, b]) => a && b)
    .sort(([leftA, leftB], [rightA, rightB]) =>
      leftA.path.localeCompare(rightA.path) || leftB.path.localeCompare(rightB.path)
    );
  const minDistance = 34;
  for (let iteration = 0; iteration < 20; iteration++) {
    const forces = ordered.map(() => [0, 0]);
    for (let left = 0; left < ordered.length; left++) {
      const a = ordered[left];
      for (let right = left + 1; right < ordered.length; right++) {
        const b = ordered[right];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;
        if (distance < 0.01) { dx = left % 2 ? 1 : -1; dy = right % 2 ? 1 : -1; distance = Math.hypot(dx, dy); }
        const strength = (minDistance - distance) * 0.035 / distance;
        const fx = dx * strength;
        const fy = dy * strength;
        forces[left][0] += fx; forces[left][1] += fy;
        forces[right][0] -= fx; forces[right][1] -= fy;
      }
    }
    for (const [a, b] of springs) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const strength = Math.min(1.6, Math.max(0, distance - 78) * 0.006) / distance;
      const fx = dx * strength;
      const fy = dy * strength;
      const left = nodeIndexes.get(a.path);
      const right = nodeIndexes.get(b.path);
      forces[left][0] += fx; forces[left][1] += fy;
      forces[right][0] -= fx; forces[right][1] -= fy;
    }
    ordered.forEach((node, index) => {
      node.x += Math.max(-3, Math.min(3, forces[index][0]));
      node.y += Math.max(-3, Math.min(3, forces[index][1]));
      const dx = node.x - centerX;
      const dy = node.y - centerY;
      const radius = Math.hypot(dx, dy) || 1;
      const bounded = Math.min(outerRadius, Math.max(innerRadius, radius));
      node.x = centerX + dx / radius * bounded;
      node.y = centerY + dy / radius * bounded;
    });
  }
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

module.exports = { CORE_CENTER, CORE_EXCLUSION_RADIUS, MAX_EDGES, MAX_NODES, edgeRoute, graphData, groupFor, handleNodeKey, labelPlan, positionNodes, reservedLabelBoxes, searchMatches, searchSummary, selectNodesByGroup, selectRepresentativeEdges, shouldShowAllLabels, visibleLegendGroups };
