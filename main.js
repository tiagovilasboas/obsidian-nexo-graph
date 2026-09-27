const { ItemView, Menu, Plugin, PluginSettingTab, Setting } = require('obsidian');
const { GROUP_CENTERS, MAX_NODES, graphData, positionNodes } = require('./graph-engine');

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
    this.refresh();
  }

  render() {
    const root = this.contentEl;
    root.empty();
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
    local.addEventListener('click', () => { this.localMode = !this.localMode; this.render(); });
    const depth = controls.createEl('select', { attr: { 'aria-label': 'Local graph depth', title: 'Local graph depth' } });
    [1, 2, 3].forEach(level => depth.createEl('option', { text: `${level} hop${level > 1 ? 's' : ''}`, value: String(level) }));
    depth.value = String(this.localDepth);
    depth.disabled = !this.localMode;
    depth.addEventListener('change', () => { this.localDepth = Number(depth.value); this.render(); });

    const groupFilter = root.createDiv({ cls: 'nexo-filters', attr: { role: 'group', 'aria-label': 'Filter graph groups' } });
    const filterGroups = [...this.plugin.settings.groups, { name: 'Other', color: '#668b72' }];
    filterGroups.forEach((rule, index) => {
      const label = groupFilter.createEl('label', { cls: 'nexo-filter' });
      const checkbox = label.createEl('input', { attr: { type: 'checkbox', 'aria-label': `Show ${rule.name} notes` } });
      checkbox.checked = this.visibleGroups.has(index);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) this.visibleGroups.add(index);
        else this.visibleGroups.delete(index);
        this.render();
      });
      const swatch = label.createSpan({ cls: 'nexo-filter-dot' });
      swatch.style.setProperty('--nexo-node-color', rule.color);
      label.createSpan({ text: rule.name });
    });

    const { nodes, edges, total, inScope } = graphData(this.app, this.plugin.settings.groups, {
      localMode: this.localMode,
      anchorPath: this.anchorPath,
      depth: this.localDepth,
      visibleGroups: this.visibleGroups
    });
    positionNodes(nodes);
    const byPath = new Map(nodes.map(node => [node.path, node]));
    const svg = svgElement('svg', { viewBox: '0 0 1200 800', role: 'img', 'aria-label': 'Graph of linked notes' });
    svg.classList.add('nexo-map');
    root.appendChild(svg);
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
    GROUP_CENTERS.forEach(([x, y], index) => {
      const color = this.plugin.settings.groups[index]?.color || '#668b72';
      const gradient = svgElement('radialGradient', { id: `nexo-halo-${index}` });
      gradient.appendChild(svgElement('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': index === 4 ? 0.08 : 0.17 }));
      gradient.appendChild(svgElement('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 }));
      defs.appendChild(gradient);
      const arrow = svgElement('marker', { id: `nexo-arrow-${index}`, markerWidth: 7, markerHeight: 7, refX: 6, refY: 3.5, viewBox: '0 0 7 7', orient: 'auto', markerUnits: 'userSpaceOnUse' });
      arrow.appendChild(svgElement('path', { d: 'M 0 0 L 7 3.5 L 0 7 z', fill: color }));
      defs.appendChild(arrow);
      atmosphere.appendChild(svgElement('circle', { cx: x, cy: y, r: index === 4 ? 180 : 260, fill: `url(#nexo-halo-${index})` }));
      if (index < 4) {
        const caption = svgElement('text', { x, y: y - 195, 'text-anchor': 'middle', class: 'nexo-cluster-label' });
        caption.style.fill = color;
        caption.textContent = this.plugin.settings.groups[index].name.toUpperCase();
        atmosphere.appendChild(caption);
      }
    });
    const edgeLayer = svgElement('g', { class: 'nexo-edges' });
    const nodeLayer = svgElement('g', { class: 'nexo-nodes' });
    viewport.append(edgeLayer, nodeLayer);
    const edgeElements = [];

    for (const [source, target, bidirectional] of edges) {
      const a = byPath.get(source);
      const b = byPath.get(target);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const bend = Math.min(34, Math.hypot(dx, dy) * 0.045);
      const middleX = (a.x + b.x) / 2 - dy / Math.max(1, Math.hypot(dx, dy)) * bend;
      const middleY = (a.y + b.y) / 2 + dx / Math.max(1, Math.hypot(dx, dy)) * bend;
      const edge = svgElement('path', { d: `M ${a.x} ${a.y} Q ${middleX} ${middleY} ${b.x} ${b.y}` });
      edge.style.setProperty('--nexo-edge-color', this.plugin.settings.groups[a.group]?.color || '#3f8e5b');
      edge.setAttribute('marker-end', `url(#nexo-arrow-${a.group})`);
      if (bidirectional) edge.setAttribute('marker-start', `url(#nexo-arrow-${b.group})`);
      edge.setAttribute('aria-label', bidirectional ? `${a.name} and ${b.name} link to each other` : `${a.name} links to ${b.name}`);
      edgeLayer.appendChild(edge);
      edgeElements.push([source, target, edge]);
    }
    const nodeElements = [];
    const emphasis = { path: '' };
    const updateEmphasis = () => {
      const query = search.value.trim().toLowerCase();
      const related = new Set(emphasis.path ? [emphasis.path] : []);
      if (emphasis.path) {
        for (const [source, target] of edgeElements) {
          if (source === emphasis.path) related.add(target);
          if (target === emphasis.path) related.add(source);
        }
      }
      for (const [node, element] of nodeElements) {
        const matchesQuery = !query || node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query);
        const matchesNeighborhood = !emphasis.path || related.has(node.path);
        element.classList.toggle('is-match', Boolean(query && matchesQuery));
        element.classList.toggle('is-neighbor', Boolean(emphasis.path && node.path !== emphasis.path && related.has(node.path)));
        element.classList.toggle('is-dimmed', !matchesQuery || !matchesNeighborhood);
      }
      for (const [source, target, edge] of edgeElements) {
        const incident = !emphasis.path || source === emphasis.path || target === emphasis.path;
        edge.classList.toggle('is-dimmed', !incident);
      }
    };
    for (const node of nodes) {
      const group = svgElement('g', { class: 'nexo-node', transform: `translate(${node.x} ${node.y})`, tabindex: '0', role: 'button', 'aria-label': `Open ${node.name}` });
      group.style.setProperty('--nexo-node-color', this.plugin.settings.groups[node.group]?.color || '#729680');
      const radius = Math.min(10, 3.5 + Math.sqrt(node.degree) * 1.2);
      group.appendChild(svgElement('circle', { r: radius }));
      if (node.degree >= 4 || nodes.length < 80) {
        const label = svgElement('text', { x: radius + 5, y: 3.5 });
        label.textContent = node.name;
        group.appendChild(label);
      }
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
      group.addEventListener('pointerenter', () => { emphasis.path = node.path; updateEmphasis(); });
      group.addEventListener('pointerleave', () => { emphasis.path = ''; updateEmphasis(); });
      group.addEventListener('focus', () => { emphasis.path = node.path; updateEmphasis(); });
      group.addEventListener('blur', () => { emphasis.path = ''; updateEmphasis(); });
      group.addEventListener('contextmenu', showContextMenu);
      nodeLayer.appendChild(group);
      nodeElements.push([node, group]);
    }

    const transform = () => viewport.setAttribute('transform', `translate(${600 + this.panX} ${400 + this.panY}) scale(${this.scale}) translate(-600 -400)`);
    transform();
    const zoom = delta => { this.scale = Math.max(0.45, Math.min(3.2, this.scale * delta)); transform(); };
    minus.addEventListener('click', () => zoom(0.8));
    plus.addEventListener('click', () => zoom(1.25));
    reset.addEventListener('click', () => { this.scale = 1; this.panX = 0; this.panY = 0; transform(); });
    svg.addEventListener('wheel', event => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.12 : 0.89); }, { passive: false });
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
      transform();
    });
    svg.addEventListener('pointerup', () => { drag = null; });
    svg.addEventListener('pointercancel', () => { drag = null; });
    search.addEventListener('input', () => {
      this.query = search.value;
      updateEmphasis();
    });
    updateEmphasis();

    const footer = root.createDiv({ cls: 'nexo-footer' });
    const scopeLabel = this.localMode ? `within ${this.anchorPath.split('/').pop() || 'local graph'}` : 'in vault';
    footer.createSpan({ text: `${nodes.length.toLocaleString()} shown · ${inScope.toLocaleString()} ${scopeLabel} · ${edges.length.toLocaleString()} links` });
    if (inScope > MAX_NODES) footer.createSpan({ text: `Showing the ${MAX_NODES} most connected notes. Filter groups or use local mode to narrow the graph.` });
    const legend = footer.createDiv({ cls: 'nexo-legend' });
    this.plugin.settings.groups.forEach(rule => {
      const item = legend.createSpan();
      item.style.setProperty('--nexo-node-color', rule.color);
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
