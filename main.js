const { ItemView, Menu, Plugin, PluginSettingTab, Setting } = require('obsidian');
const MAX_NODES = 500;
const MAX_EDGES = 1600;
// Signal Field keeps the four configured domains around a neutral Nexo core.
// The diamond gives a reader a stable centre of gravity without force-layout drift.
const GROUP_CENTERS = [[600, 165], [930, 400], [600, 635], [270, 400], [600, 400]];
const GROUP_RADIUS = 146;

function groupFor(path, rules) {
  const normalized = path.toLowerCase();
  const index = rules.findIndex(rule => rule.prefix && normalized.startsWith(rule.prefix.toLowerCase()));
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
  return { nodes, edges, total: files.length, inScope: candidates.length, linksInScope: edgePairs.size };
}

function positionNodes(nodes) {
  const groups = [[], [], [], [], []];
  for (const node of nodes) groups[node.group].push(node);
  for (const [groupIndex, group] of groups.entries()) {
    group.sort((a, b) => b.degree - a.degree || a.path.localeCompare(b.path));
    const spacing = group.length <= 1 ? 13.5 : Math.min(13.5, (GROUP_RADIUS - 18) / Math.sqrt(group.length - 1));
    group.forEach((node, index) => {
      const radius = index === 0 ? 0 : 18 + spacing * Math.sqrt(index - 1);
      const angle = index * 2.399963229728653 + groupIndex * 0.6;
      node.x = GROUP_CENTERS[groupIndex][0] + Math.cos(angle) * radius;
      node.y = GROUP_CENTERS[groupIndex][1] + Math.sin(angle) * radius;
    });
  }
}

function edgeRoute(source, target) {
  const local = source.group === target.group || source.group > 3 || target.group > 3;
  if (local) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const bend = Math.min(28, length * 0.07);
    const side = source.path.localeCompare(target.path) < 0 ? 1 : -1;
    const controlX = (source.x + target.x) / 2 - dy / length * bend * side;
    const controlY = (source.y + target.y) / 2 + dx / length * bend * side;
    return { crossDomain: false, d: `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}` };
  }

  const pair = [source.group, target.group].sort((a, b) => a - b).join(':');
  if (pair === '0:2') {
    // Opposite domains travel through an exterior lane so the Nexo core stays readable.
    return { crossDomain: true, d: `M ${source.x} ${source.y} C -120 ${source.y}, -120 ${target.y}, ${target.x} ${target.y}` };
  }
  if (pair === '1:3') {
    return { crossDomain: true, d: `M ${source.x} ${source.y} C ${source.x} -90, ${target.x} -90, ${target.x} ${target.y}` };
  }

  const [coreX, coreY] = GROUP_CENTERS[4];
  const [firstX, firstY] = GROUP_CENTERS[source.group];
  const [secondX, secondY] = GROUP_CENTERS[target.group];
  const midpointX = (firstX + secondX) / 2;
  const midpointY = (firstY + secondY) / 2;
  const distance = Math.max(1, Math.hypot(midpointX - coreX, midpointY - coreY));
  const controlX = midpointX + (midpointX - coreX) / distance * 132;
  const controlY = midpointY + (midpointY - coreY) / distance * 132;
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
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.localMode = false;
    this.localDepth = 1;
    this.anchorPath = '';
    this.query = '';
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
      this.scale = 1;
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
    });

    this.renderGraph();
  }

  renderGraph() {
    const root = this.contentEl;
    const search = this.searchEl;
    if (!search) return;
    this.svgEl?.remove();

    const { nodes, edges, inScope, linksInScope } = graphData(this.app, this.plugin.settings.groups, {
      localMode: this.localMode,
      anchorPath: this.anchorPath,
      depth: this.localDepth,
      visibleGroups: this.visibleGroups
    });
    positionNodes(nodes);
    const byPath = new Map(nodes.map(node => [node.path, node]));
    const svg = svgElement('svg', { viewBox: '0 0 1200 800', role: 'img', 'aria-label': 'Graph of linked notes' });
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
    const [coreX, coreY] = GROUP_CENTERS[4];
    GROUP_CENTERS.forEach(([x, y], index) => {
      const color = this.plugin.settings.groups[index]?.color || '#668b72';
      const gradient = svgElement('radialGradient', { id: `nexo-halo-${index}` });
      gradient.appendChild(svgElement('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': index === 4 ? 0.08 : 0.17 }));
      gradient.appendChild(svgElement('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 }));
      defs.appendChild(gradient);
      const arrow = svgElement('marker', { id: `nexo-arrow-${index}`, markerWidth: 7, markerHeight: 7, refX: 6, refY: 3.5, viewBox: '0 0 7 7', orient: 'auto', markerUnits: 'userSpaceOnUse' });
      arrow.appendChild(svgElement('path', { d: 'M 0 0 L 7 3.5 L 0 7 z', fill: color }));
      defs.appendChild(arrow);
      if (index < 4) {
        atmosphere.appendChild(svgElement('path', {
          d: `M ${coreX} ${coreY} L ${x} ${y}`,
          class: 'nexo-field-spoke',
          'stroke': color
        }));
        atmosphere.appendChild(svgElement('circle', { cx: x, cy: y, r: GROUP_RADIUS + 24, class: 'nexo-field-outline', stroke: color }));
        atmosphere.appendChild(svgElement('circle', { cx: x, cy: y, r: GROUP_RADIUS - 42, class: 'nexo-field-ring', stroke: color }));
      }
      atmosphere.appendChild(svgElement('circle', { cx: x, cy: y, r: index === 4 ? 156 : GROUP_RADIUS + 38, fill: `url(#nexo-halo-${index})` }));
      if (index < 4) {
        const caption = svgElement('text', { x, y: y - GROUP_RADIUS + 22, 'text-anchor': 'middle', class: 'nexo-cluster-label' });
        caption.style.fill = color;
        caption.textContent = this.plugin.settings.groups[index].name.toUpperCase();
        atmosphere.appendChild(caption);
      }
    });
    const core = svgElement('g', { class: 'nexo-core', 'aria-hidden': 'true' });
    core.appendChild(svgElement('circle', { cx: coreX, cy: coreY, r: 54, class: 'nexo-core-ring' }));
    core.appendChild(svgElement('circle', { cx: coreX, cy: coreY, r: 26, class: 'nexo-core-ring is-inner' }));
    core.appendChild(svgElement('path', { d: `M ${coreX} ${coreY - 16} L ${coreX + 16} ${coreY} L ${coreX} ${coreY + 16} L ${coreX - 16} ${coreY} Z`, class: 'nexo-core-mark' }));
    const coreTitle = svgElement('text', { x: coreX, y: coreY + 78, 'text-anchor': 'middle', class: 'nexo-core-label' });
    coreTitle.textContent = 'NEXO / SIGNAL FIELD';
    core.appendChild(coreTitle);
    atmosphere.appendChild(core);
    const edgeLayer = svgElement('g', { class: 'nexo-edges' });
    const nodeLayer = svgElement('g', { class: 'nexo-nodes' });
    viewport.append(edgeLayer, nodeLayer);
    const edgeElements = [];
    const nodesByGroup = new Map();
    for (const node of nodes) {
      if (!nodesByGroup.has(node.group)) nodesByGroup.set(node.group, []);
      nodesByGroup.get(node.group).push(node);
    }
    const labelCandidates = new Set();
    for (const group of nodesByGroup.values()) {
      group.sort((a, b) => b.degree - a.degree || a.path.localeCompare(b.path));
      group.slice(0, 4).forEach(node => labelCandidates.add(node.path));
    }

    for (const [source, target, bidirectional] of edges) {
      const a = byPath.get(source);
      const b = byPath.get(target);
      const route = edgeRoute(a, b);
      const edge = svgElement('path', { d: route.d });
      edge.classList.toggle('is-cross-domain', route.crossDomain);
      edge.style.setProperty('--nexo-edge-color', this.plugin.settings.groups[a.group]?.color || '#3f8e5b');
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
        element.classList.toggle('is-dimmed', !matchesQuery || !matchesNeighborhood);
        element.classList.toggle('is-labeled', nodes.length < 80 || labelCandidates.has(node.path) || queryMatches || this.emphasisPath === node.path);
      }
      for (const [source, target, edge] of edgeElements) {
        const incident = !this.emphasisPath || source === this.emphasisPath || target === this.emphasisPath;
        edge.classList.toggle('is-dimmed', !incident);
      }
      if (this.searchStatus) this.searchStatus.textContent = searchSummary(nodes, query);
    };
    this.updateGraphEmphasis = updateEmphasis;
    for (const node of nodes) {
      const group = svgElement('g', { class: 'nexo-node', transform: `translate(${node.x} ${node.y})`, tabindex: '0', role: 'button', 'aria-label': `Open ${node.name}` });
      group.style.setProperty('--nexo-node-color', this.plugin.settings.groups[node.group]?.color || '#729680');
      const radius = Math.min(10, 3.5 + Math.sqrt(node.degree) * 1.2);
      group.appendChild(svgElement('circle', { r: radius }));
      const label = svgElement('text', { x: radius + 5, y: 3.5, class: 'nexo-node-label' });
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
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          const bounds = group.getBoundingClientRect();
          showContextMenu(new MouseEvent('contextmenu', {
            bubbles: true,
            clientX: bounds.left + bounds.width / 2,
            clientY: bounds.top + bounds.height / 2
          }));
          event.preventDefault();
        }
      });
      group.addEventListener('pointerenter', () => { this.emphasisPath = node.path; updateEmphasis(); });
      group.addEventListener('pointerleave', () => { if (this.emphasisPath === node.path) this.emphasisPath = ''; updateEmphasis(); });
      group.addEventListener('focus', () => { this.emphasisPath = node.path; updateEmphasis(); });
      group.addEventListener('blur', () => { if (this.emphasisPath === node.path) this.emphasisPath = ''; updateEmphasis(); });
      group.addEventListener('contextmenu', showContextMenu);
      nodeLayer.appendChild(group);
      nodeElements.push([node, group]);
    }

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
    this.footerSummary.textContent = `${nodes.length.toLocaleString()} shown · ${inScope.toLocaleString()} ${scopeLabel} · ${edges.length.toLocaleString()} links`;
    const limits = [];
    if (inScope > MAX_NODES) limits.push(`Showing ${MAX_NODES} notes in rounds across folder groups, ranked by connections within each group`);
    if (linksInScope > edges.length) limits.push(`Showing ${MAX_EDGES} links in rounds across folder-group pairs, ranked by endpoint connections`);
    this.footerLimit.textContent = limits.join('. ') + (limits.length ? '. Filter groups or use Local mode to narrow the graph.' : '');
    if (!this.legendEl) {
      const legend = footer.createDiv({ cls: 'nexo-legend' });
      this.legendEl = legend;
      this.plugin.settings.groups.forEach(rule => {
        const item = legend.createSpan();
        item.style.setProperty('--nexo-node-color', rule.color);
        item.createSpan({ cls: 'nexo-dot' });
        item.createSpan({ text: rule.name });
      });
    }
  }
}

class NexoGraphSettings extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const container = this.containerEl;
    container.empty();
    container.createEl('h2', { text: 'Nexo Graph' });
    container.createEl('p', { text: 'Assign a folder prefix and color to each signal group. The first matching prefix wins. These settings stay in this vault.' });
    this.plugin.settings.groups.forEach((rule, index) => {
      new Setting(container).setName(`${rule.name} folder prefix`).setDesc('Example: pages/pessoal/').addText(input => input
        .setValue(rule.prefix)
        .onChange(async value => { rule.prefix = value.trim(); await this.plugin.saveSettings(); }));
      new Setting(container).setName(`${rule.name} color`).addColorPicker(input => input
        .setValue(rule.color)
        .onChange(async value => { rule.color = value; await this.plugin.saveSettings(); }));
    });
  }
}

module.exports = class NexoGraphPlugin extends Plugin {
  async onload() {
    const saved = await this.loadData();
    this.settings = { groups: DEFAULT_SETTINGS.groups.map((rule, index) => ({ ...rule, ...(saved?.groups?.[index] || {}) })) };
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
    this.registerEvent(this.app.vault.on('create', refresh));
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
