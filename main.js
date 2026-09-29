const { ItemView, Menu, Plugin, PluginSettingTab, Setting } = require('obsidian');
const MAX_NODES = 500;
const MAX_EDGES = 1600;
const LABEL_ALL_THRESHOLD = 32;
const CORE_CENTER = [600, 400];
const CORE_EXCLUSION_RADIUS = 86;
const CORE_TITLE_BOX = { left: 488, top: 426, right: 712, bottom: 446, kind: 'core-title' };

function nodeRadius(degree) {
  return Math.min(3.7, 1.4 + Math.sqrt(Math.max(0, degree)) * 0.34);
}

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
      const radius = nodeRadius(node.degree);
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

const VIEW_TYPE = 'nexo-graph-view';
const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_SETTINGS = {
  groups: [
    { name: 'Personal', prefix: 'pages/pessoal/', color: '#84f5b2' },
    { name: 'Career', prefix: 'pages/carreira/', color: '#00ff41' },
    { name: 'Operations', prefix: 'pages/ops/', color: '#b8ff5a' },
    { name: 'Meta', prefix: 'pages/meta/', color: '#00e5a0' }
  ]
};

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

class NexoGraphView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.timer = null;
    this.scale = 1.12;
    this.panX = 0;
    this.panY = 0;
    this.localMode = false;
    this.localDepth = 1;
    this.anchorPath = '';
    this.query = '';
    this.selectedPath = '';
    this.visibleGroups = new Set([0, 1, 2, 3, 4]);
    this.emphasisPath = '';
    this.svgEl = null;
    this.footerEl = null;
    this.updateGraphEmphasis = () => {};
    this.applyGraphTransform = () => {};
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Nexo Graph'; }
  getIcon() { return 'git-fork'; }

  async onOpen() { this.render(); }
  async onClose() {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
  }

  refresh() {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      if (this.containerEl.isConnected) this.render();
    }, 250);
  }

  setAnchorPath(path) {
    if (path) this.anchorPath = path;
    if (this.localButton) {
      this.localButton.disabled = !this.anchorPath;
      this.localButton.title = this.anchorPath ? 'Show notes connected to the last active note' : 'Open the graph from a note to enable local mode';
    }
    if (this.localMode) this.refreshGraph();
  }

  refreshGraph() {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      if (this.containerEl.isConnected && this.svgEl) this.renderGraph();
    }, 250);
  }

  render() {
    const root = this.contentEl;
    root.empty();
    this.svgEl = null;
    this.footerEl = null;
    this.footerSummary = null;
    this.footerLimit = null;
    this.searchStatus = null;
    this.legendEl = null;
    root.addClass('nexo-graph');
    const toolbar = root.createDiv({ cls: 'nexo-toolbar' });
    const identity = toolbar.createDiv({ cls: 'nexo-identity' });
    identity.createSpan({ cls: 'nexo-mark', text: '◈' });
    identity.createSpan({ text: 'NEXO GRAPH' });
    const search = toolbar.createEl('input', { cls: 'nexo-search', attr: { type: 'search', placeholder: 'Find a note…', 'aria-label': 'Find a note' } });
    search.value = this.query;
    const controls = toolbar.createDiv({ cls: 'nexo-controls' });
    const minus = controls.createEl('button', { text: '−', attr: { 'aria-label': 'Zoom out' } });
    const reset = controls.createEl('button', { text: '⌖', attr: { 'aria-label': 'Reset view' } });
    const plus = controls.createEl('button', { text: '+', attr: { 'aria-label': 'Zoom in' } });
    const local = controls.createEl('button', { text: 'Local', attr: { 'aria-label': 'Toggle local graph', 'aria-pressed': String(this.localMode) } });
    local.disabled = !this.anchorPath;
    local.title = this.anchorPath ? 'Show notes connected to the last active note' : 'Open the graph from a note to enable local mode';
    const depth = controls.createEl('select', { attr: { 'aria-label': 'Local graph depth', title: 'Local graph depth' } });
    [1, 2, 3].forEach(level => depth.createEl('option', { text: `${level} hop${level > 1 ? 's' : ''}`, value: String(level) }));
    depth.value = String(this.localDepth);
    depth.disabled = !this.localMode;
    this.searchEl = search;
    this.localButton = local;
    this.depthSelect = depth;
    const updateLocalControls = () => {
      local.setAttribute('aria-pressed', String(this.localMode));
      depth.disabled = !this.localMode;
    };
    minus.addEventListener('click', () => this.zoomGraph(0.8));
    plus.addEventListener('click', () => this.zoomGraph(1.25));
    reset.addEventListener('click', () => {
      this.scale = 1.12;
      this.panX = 0;
      this.panY = 0;
      this.applyGraphTransform();
    });
    local.addEventListener('click', () => {
      this.localMode = !this.localMode;
      updateLocalControls();
      this.renderGraph();
    });
    depth.addEventListener('change', () => { this.localDepth = Number(depth.value); this.renderGraph(); });
    search.addEventListener('input', () => {
      this.query = search.value;
      this.updateGraphEmphasis();
    });

    const groupFilter = root.createDiv({ cls: 'nexo-filters', attr: { role: 'group', 'aria-label': 'Filter graph groups' } });
    const filterGroups = [...this.plugin.settings.groups, { name: 'Other', color: '#668b72' }];
    this.groupFilterControls = [];
    filterGroups.forEach((rule, index) => {
      const label = groupFilter.createEl('label', { cls: 'nexo-filter' });
      const checkbox = label.createEl('input', { attr: { type: 'checkbox', 'aria-label': `Show ${rule.name} notes` } });
      checkbox.checked = this.visibleGroups.has(index);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) this.visibleGroups.add(index);
        else this.visibleGroups.delete(index);
        this.renderGraph();
      });
      const swatch = label.createSpan({ cls: 'nexo-filter-dot' });
      swatch.style.setProperty('--nexo-node-color', rule.color);
      label.createSpan({ text: rule.name });
      const count = label.createSpan({ cls: 'nexo-filter-count', text: '(0)' });
      this.groupFilterControls.push({ checkbox, count, name: rule.name });
    });

    this.renderGraph();
  }

  renderGraph() {
    const root = this.contentEl;
    const search = this.searchEl;
    if (!search) return;
    this.svgEl?.remove();

    const { nodes, edges, ignoredCount, inScope, linksInScope, groupCounts } = graphData(this.app, this.plugin.settings.groups, {
      ignoredPrefixes: this.plugin.settings.ignoredPrefixes,
      localMode: this.localMode,
      anchorPath: this.anchorPath,
      depth: this.localDepth,
      visibleGroups: this.visibleGroups
    });
    if (this.selectedPath && !nodes.some(node => node.path === this.selectedPath)) this.selectedPath = '';
    if (this.selectedPath) this.emphasisPath = this.selectedPath;
    this.groupFilterControls?.forEach(({ checkbox, count, name }, index) => {
      const total = groupCounts[index] || 0;
      count.textContent = `(${total})`;
      checkbox.setAttribute('aria-label', `Show ${name} notes (${total})`);
    });
    positionNodes(nodes, edges);
    const byPath = new Map(nodes.map(node => [node.path, node]));
    const svg = svgElement('svg', { viewBox: '0 0 1200 800', role: 'group', 'aria-label': 'Interactive graph of linked notes' });
    svg.classList.add('nexo-map');
    root.insertBefore(svg, this.footerEl || null);
    this.svgEl = svg;
    const backdrop = svgElement('rect', { x: 0, y: 0, width: 1200, height: 800, class: 'nexo-backdrop' });
    svg.appendChild(backdrop);
    if (!nodes.length) {
      const empty = svgElement('text', { x: 600, y: 400, 'text-anchor': 'middle', class: 'nexo-empty' });
      empty.textContent = this.localMode && !this.anchorPath ? 'Open Nexo Graph from a note to explore its neighborhood' : 'No notes match these filters';
      svg.appendChild(empty);
    }
    const viewport = svgElement('g');
    svg.appendChild(viewport);
    const defs = svgElement('defs');
    svg.prepend(defs);
    const atmosphere = svgElement('g', { class: 'nexo-atmosphere' });
    viewport.appendChild(atmosphere);
    const [coreX, coreY] = CORE_CENTER;
    const visualGroups = [...this.plugin.settings.groups, { name: 'Other', color: '#668b72' }];
    const coreGradient = svgElement('radialGradient', { id: 'nexo-halo-core' });
    coreGradient.appendChild(svgElement('stop', { offset: '0%', 'stop-color': '#668b72', 'stop-opacity': 0.08 }));
    coreGradient.appendChild(svgElement('stop', { offset: '100%', 'stop-color': '#668b72', 'stop-opacity': 0 }));
    defs.appendChild(coreGradient);
    visualGroups.forEach((rule, index) => {
      const color = rule.color || '#668b72';
      const arrow = svgElement('marker', { id: `nexo-arrow-${index}`, markerWidth: 7, markerHeight: 7, refX: 6, refY: 3.5, viewBox: '0 0 7 7', orient: 'auto', markerUnits: 'userSpaceOnUse' });
      arrow.appendChild(svgElement('path', { d: 'M 0 0 L 7 3.5 L 0 7 z', fill: color }));
      defs.appendChild(arrow);
    });
    atmosphere.appendChild(svgElement('circle', { cx: coreX, cy: coreY, r: 329, class: 'nexo-field-boundary' }));
    atmosphere.appendChild(svgElement('circle', { cx: coreX, cy: coreY, r: 250, class: 'nexo-field-ring' }));
    atmosphere.appendChild(svgElement('circle', { cx: coreX, cy: coreY, r: 156, fill: 'url(#nexo-halo-core)' }));
    const core = svgElement('g', { class: 'nexo-core', role: 'presentation' });
    core.appendChild(svgElement('circle', { cx: coreX, cy: coreY, r: 17, class: 'nexo-core-orbit' }));
    core.appendChild(svgElement('path', { d: `M ${coreX - 6} ${coreY + 6} V ${coreY - 6} L ${coreX + 6} ${coreY + 6} V ${coreY - 6}`, class: 'nexo-core-monogram' }));
    core.appendChild(svgElement('path', { d: `M ${coreX} ${coreY - 2.5} L ${coreX + 2.5} ${coreY} L ${coreX} ${coreY + 2.5} L ${coreX - 2.5} ${coreY} Z`, class: 'nexo-core-nexus' }));
    const coreTitle = svgElement('text', { x: coreX, y: coreY + 40, 'text-anchor': 'middle', class: 'nexo-core-label' });
    coreTitle.textContent = 'NEXO / KNOWLEDGE CORE';
    core.appendChild(coreTitle);
    const edgeLayer = svgElement('g', { class: 'nexo-edges' });
    const nodeLayer = svgElement('g', { class: 'nexo-nodes' });
    viewport.append(edgeLayer, nodeLayer);
    const edgeElements = [];
    const labels = labelPlan(nodes, 4, 3, reservedLabelBoxes());

    for (const [source, target, bidirectional] of edges) {
      const a = byPath.get(source);
      const b = byPath.get(target);
      const route = edgeRoute(a, b);
      const edge = svgElement('path', { d: route.d });
      edge.classList.toggle('is-cross-domain', route.crossDomain);
      edge.style.setProperty('--nexo-edge-color', visualGroups[a.group]?.color || '#3f8e5b');
      edge.setAttribute('marker-end', `url(#nexo-arrow-${a.group})`);
      if (bidirectional) edge.setAttribute('marker-start', `url(#nexo-arrow-${b.group})`);
      edge.setAttribute('aria-label', bidirectional ? `${a.name} and ${b.name} link to each other` : `${a.name} links to ${b.name}`);
      edgeLayer.appendChild(edge);
      edgeElements.push([source, target, edge]);
    }
    const nodeElements = [];
    const updateEmphasis = () => {
      const query = search.value.trim().toLowerCase();
      const matchingPaths = new Set(searchMatches(nodes, query).map(node => node.path));
      const related = new Set(this.emphasisPath ? [this.emphasisPath] : []);
      if (this.emphasisPath) {
        for (const [source, target] of edgeElements) {
          if (source === this.emphasisPath) related.add(target);
          if (target === this.emphasisPath) related.add(source);
        }
      }
      for (const [node, element] of nodeElements) {
        const queryMatches = Boolean(query && matchingPaths.has(node.path));
        const matchesQuery = !query || queryMatches;
        const matchesNeighborhood = !this.emphasisPath || related.has(node.path);
        element.classList.toggle('is-match', Boolean(query && matchesQuery));
        element.classList.toggle('is-neighbor', Boolean(this.emphasisPath && node.path !== this.emphasisPath && related.has(node.path)));
        element.classList.toggle('is-selected', this.selectedPath === node.path);
        element.classList.toggle('is-dimmed', !matchesQuery || !matchesNeighborhood);
        element.classList.toggle('is-labeled', shouldShowAllLabels(nodes.length) || labels.visible.has(node.path) || queryMatches || this.emphasisPath === node.path);
        element.setAttribute('aria-pressed', String(this.selectedPath === node.path));
      }
      for (const [source, target, edge] of edgeElements) {
        const incident = !this.emphasisPath || source === this.emphasisPath || target === this.emphasisPath;
        edge.classList.toggle('is-dimmed', !incident);
        edge.classList.toggle('is-emphasized', Boolean(this.emphasisPath && incident));
      }
      if (this.searchStatus) this.searchStatus.textContent = searchSummary(nodes, query);
    };
    this.updateGraphEmphasis = updateEmphasis;
    for (const node of nodes) {
      const group = svgElement('g', { class: 'nexo-node', transform: `translate(${node.x} ${node.y})`, tabindex: '0', role: 'button', 'aria-label': `Open ${node.name}; Space selects, Enter opens` });
      group.style.setProperty('--nexo-node-color', visualGroups[node.group]?.color || '#729680');
      const radius = nodeRadius(node.degree);
      group.appendChild(svgElement('circle', { r: 9, class: 'nexo-node-hit-area', 'aria-hidden': 'true' }));
      group.appendChild(svgElement('circle', { r: radius }));
      const labelPosition = labels.positions.get(node.path) || { x: 0, y: -radius - 7, anchor: 'middle' };
      const label = svgElement('text', {
        x: labelPosition.x,
        y: labelPosition.y,
        'text-anchor': labelPosition.anchor,
        class: 'nexo-node-label'
      });
      label.textContent = node.name;
      group.appendChild(label);
      const title = svgElement('title');
      title.textContent = node.path;
      group.appendChild(title);
      const open = () => this.app.workspace.getLeaf('tab').openFile(node.file);
      const showContextMenu = event => {
        event.preventDefault();
        const menu = new Menu();
        menu.addItem(item => item.setTitle('Open note').setIcon('file-text').onClick(open));
        menu.showAtMouseEvent(event);
      };
      group.addEventListener('click', open);
      group.addEventListener('keydown', event => handleNodeKey(event, {
        open,
        toggleSelection: () => {
          this.selectedPath = this.selectedPath === node.path ? '' : node.path;
          this.emphasisPath = this.selectedPath;
          updateEmphasis();
        },
        clearSelection: () => {
          this.selectedPath = '';
          this.emphasisPath = '';
          if (search.value) {
            search.value = '';
            this.query = '';
          }
          updateEmphasis();
        },
        showContextMenu: () => {
          const bounds = group.getBoundingClientRect();
          showContextMenu(new MouseEvent('contextmenu', {
            bubbles: true,
            clientX: bounds.left + bounds.width / 2,
            clientY: bounds.top + bounds.height / 2
          }));
        }
      }));
      group.addEventListener('pointerenter', () => { this.emphasisPath = node.path; updateEmphasis(); });
      group.addEventListener('pointerleave', () => { if (this.emphasisPath === node.path) this.emphasisPath = this.selectedPath; updateEmphasis(); });
      group.addEventListener('focus', () => { this.emphasisPath = node.path; updateEmphasis(); });
      group.addEventListener('blur', () => { if (this.emphasisPath === node.path) this.emphasisPath = this.selectedPath; updateEmphasis(); });
      group.addEventListener('contextmenu', showContextMenu);
      nodeLayer.appendChild(group);
      nodeElements.push([node, group]);
    }

    // Keep the branded center legible above routes; placement still excludes
    // nodes and labels from its clear area.
    viewport.appendChild(core);

    const transform = () => viewport.setAttribute('transform', `translate(${600 + this.panX} ${400 + this.panY}) scale(${this.scale}) translate(-600 -400)`);
    this.applyGraphTransform = transform;
    this.zoomGraph = delta => {
      this.scale = Math.max(0.45, Math.min(3.2, this.scale * delta));
      this.applyGraphTransform();
    };
    transform();
    svg.addEventListener('wheel', event => { event.preventDefault(); this.zoomGraph(event.deltaY < 0 ? 1.12 : 0.89); }, { passive: false });
    let drag = null;
    svg.addEventListener('pointerdown', event => {
      if (event.target.closest('.nexo-node')) return;
      drag = [event.clientX, event.clientY, this.panX, this.panY];
      svg.setPointerCapture(event.pointerId);
    });
    svg.addEventListener('pointermove', event => {
      if (!drag) return;
      const bounds = svg.getBoundingClientRect();
      this.panX = drag[2] + (event.clientX - drag[0]) * 1200 / bounds.width;
      this.panY = drag[3] + (event.clientY - drag[1]) * 800 / bounds.height;
      this.applyGraphTransform();
    });
    svg.addEventListener('pointerup', () => { drag = null; });
    svg.addEventListener('pointercancel', () => { drag = null; });
    updateEmphasis();

    const footer = this.footerEl || root.createDiv({ cls: 'nexo-footer' });
    this.footerEl = footer;
    if (!this.footerSummary) this.footerSummary = footer.createSpan();
    if (!this.footerLimit) this.footerLimit = footer.createSpan();
    if (!this.searchStatus) this.searchStatus = footer.createSpan({ cls: 'nexo-search-status', attr: { role: 'status', 'aria-live': 'polite' } });
    this.searchStatus.textContent = searchSummary(nodes, search.value);
    const scopeLabel = this.localMode ? `within ${this.anchorPath.split('/').pop() || 'local graph'}` : 'in vault';
    const ignoredLabel = ignoredCount ? ` · ${ignoredCount.toLocaleString()} excluded by path filters` : '';
    this.footerSummary.textContent = `${nodes.length.toLocaleString()} shown · ${inScope.toLocaleString()} ${scopeLabel}${ignoredLabel} · ${edges.length.toLocaleString()} links`;
    const limits = [];
    if (inScope > MAX_NODES) limits.push(`Showing ${MAX_NODES} notes in rounds across folder groups, ranked by connections within each group`);
    if (linksInScope > edges.length) limits.push(`Showing ${MAX_EDGES} links in rounds across folder-group pairs, ranked by endpoint connections`);
    this.footerLimit.textContent = limits.join('. ') + (limits.length ? '. Filter groups or use Local mode to narrow the graph.' : '');
    if (!this.legendEl) this.legendEl = footer.createDiv({ cls: 'nexo-legend' });
    this.legendEl.empty();
    const legendGroups = visibleLegendGroups([...this.plugin.settings.groups, { name: 'Other', color: '#668b72' }], groupCounts);
    legendGroups.forEach(rule => {
      const item = this.legendEl.createSpan();
      item.style.setProperty('--nexo-node-color', rule.color || '#668b72');
      item.createSpan({ cls: 'nexo-dot' });
      item.createSpan({ text: rule.name });
    });
  }
}

class NexoGraphSettings extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const container = this.containerEl;
    container.empty();
    container.createEl('h2', { text: 'Nexo Graph' });
    container.createEl('p', { text: 'Assign one or more comma-separated folder prefixes and a color to each signal group. The first matching group wins. These settings stay in this vault.' });
    new Setting(container).setName('Ignore path prefixes').setDesc('Comma-separated paths to keep out of the graph, such as trash or archived backups.').addText(input => input
      .setPlaceholder('_trash/, archive/')
      .setValue(this.plugin.settings.ignoredPrefixes.join(', '))
      .onChange(async value => {
        this.plugin.settings.ignoredPrefixes = value.split(',').map(prefix => prefix.trim()).filter(Boolean);
        await this.plugin.saveSettings();
      }));
    this.plugin.settings.groups.forEach((rule, index) => {
      new Setting(container).setName('Group name').setDesc('A short label shown in the graph, filters, and legend.').addText(input => input
        .setValue(rule.name)
        .setPlaceholder(DEFAULT_SETTINGS.groups[index]?.name || `Group ${index + 1}`)
        .onChange(async value => {
          rule.name = value || DEFAULT_SETTINGS.groups[index]?.name || `Group ${index + 1}`;
          await this.plugin.saveSettings();
        }));
      new Setting(container).setName(`${rule.name} folder prefixes`).setDesc('Comma-separated. Example: pages/pessoal/, pages/ideas/').addText(input => input
        .setValue((Array.isArray(rule.prefixes) ? rule.prefixes : [rule.prefix]).filter(Boolean).join(', '))
        .onChange(async value => {
          rule.prefixes = value.split(',').map(prefix => prefix.trim()).filter(Boolean);
          rule.prefix = rule.prefixes[0] || '';
          await this.plugin.saveSettings();
        }));
      new Setting(container).setName(`${rule.name} color`).addColorPicker(input => input
        .setValue(rule.color)
        .onChange(async value => { rule.color = value; await this.plugin.saveSettings(); }));
    });
  }
}

module.exports = class NexoGraphPlugin extends Plugin {
  async onload() {
    const saved = await this.loadData();
    this.settings = {
      groups: DEFAULT_SETTINGS.groups.map((rule, index) => ({ ...rule, ...(saved?.groups?.[index] || {}) })),
      ignoredPrefixes: Array.isArray(saved?.ignoredPrefixes) ? saved.ignoredPrefixes : []
    };
    this.lastActivePath = this.app.workspace.getActiveFile()?.path || '';
    this.registerEvent(this.app.workspace.on('active-leaf-change', leaf => {
      if (leaf?.view?.getViewType() === VIEW_TYPE) return;
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile) {
        this.lastActivePath = activeFile.path;
        this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach(graphLeaf => {
          if (graphLeaf.view.localMode) graphLeaf.view.setAnchorPath(activeFile.path);
        });
      }
    }));
    this.registerView(VIEW_TYPE, leaf => new NexoGraphView(leaf, this));
    this.addRibbonIcon('git-fork', 'Open Nexo Graph', () => this.openGraph());
    this.addCommand({ id: 'open-nexo-graph', name: 'Open Nexo Graph', callback: () => this.openGraph() });
    this.addSettingTab(new NexoGraphSettings(this.app, this));
    const refresh = () => this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach(leaf => leaf.view.refresh());
    this.registerEvent(this.app.metadataCache.on('resolved', refresh));
    // File events can precede parsing; metadata changes carry the updated links.
    this.registerEvent(this.app.metadataCache.on('changed', refresh));
    this.registerEvent(this.app.vault.on('create', refresh));
    this.registerEvent(this.app.vault.on('modify', refresh));
    this.registerEvent(this.app.vault.on('delete', refresh));
    this.registerEvent(this.app.vault.on('rename', refresh));
  }

  async openGraph() {
    const activePath = this.app.workspace.getActiveFile()?.path || this.lastActivePath;
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    leaf.view.setAnchorPath(activePath);
    this.app.workspace.revealLeaf(leaf);
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach(leaf => leaf.view.refresh());
  }
};
