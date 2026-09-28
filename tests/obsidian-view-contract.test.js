const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(...values) { values.filter(Boolean).forEach(value => this.values.add(value)); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    const enabled = force === undefined ? !this.values.has(value) : Boolean(force);
    if (enabled) this.values.add(value);
    else this.values.delete(value);
    return enabled;
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.attributes = new Map();
    this.children = [];
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.style = { setProperty: (name, value) => { (this.styles ||= new Map()).set(name, value); } };
    this.isConnected = true;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') this.addClass(...String(value).split(/\s+/));
  }
  getAttribute(name) { return this.attributes.get(name); }
  addClass(...values) { this.classList.add(...values); }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  prepend(child) { child.parentElement = this; this.children.unshift(child); }
  insertBefore(child, before) {
    child.parentElement = this;
    const index = before ? this.children.indexOf(before) : -1;
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
  }
  remove() {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
    this.isConnected = false;
  }
  empty() { this.children = []; this.textContent = ''; }
  createDiv(options = {}) { return this.createElement('div', options); }
  createSpan(options = {}) { return this.createElement('span', options); }
  createEl(tagName, options = {}) { return this.createElement(tagName, options); }
  createElement(tagName, options) {
    const child = new FakeElement(tagName);
    if (options.cls) child.addClass(...String(options.cls).split(/\s+/));
    if (options.text !== undefined) child.textContent = options.text;
    for (const [name, value] of Object.entries(options.attr || {})) child.setAttribute(name, value);
    this.appendChild(child);
    return child;
  }
  addEventListener(type, listener) { (this.listeners.get(type) || this.listeners.set(type, []).get(type)).push(listener); }
  dispatch(type, event = {}) {
    event.target ||= this;
    event.preventDefault ||= () => { event.defaultPrevented = true; };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
  closest(selector) {
    if (!selector.startsWith('.')) return null;
    const className = selector.slice(1);
    for (let element = this; element; element = element.parentElement) {
      if (element.classList.contains(className)) return element;
    }
    return null;
  }
  getBoundingClientRect() { return { left: 20, top: 40, width: 12, height: 12 }; }
  setPointerCapture(pointerId) { this.pointerId = pointerId; }
}

function descendants(root, predicate, matches = []) {
  for (const child of root.children) {
    if (predicate(child)) matches.push(child);
    descendants(child, predicate, matches);
  }
  return matches;
}

class PluginStub {
  constructor() { this.registeredEvents = []; }
  registerEvent(event) { this.registeredEvents.push(event); }
  registerView(type, factory) { this.viewType = type; this.viewFactory = factory; }
  addRibbonIcon() {}
  addCommand() {}
  addSettingTab() {}
}

class ItemViewStub {
  constructor(leaf) {
    this.leaf = leaf;
    this.app = leaf.app;
    this.contentEl = new FakeElement('section');
    this.containerEl = this.contentEl;
  }
}

class MenuStub {
  constructor() { MenuStub.instances.push(this); }
  addItem(configure) {
    const item = {
      setTitle: () => item,
      setIcon: () => item,
      onClick: callback => { this.open = callback; return item; }
    };
    configure(item);
  }
  showAtMouseEvent(event) { this.event = event; }
}
MenuStub.instances = [];

function loadPluginClass() {
  const originalLoad = Module._load;
  const modulePath = require.resolve('../src/main');
  delete require.cache[modulePath];
  Module._load = function(request, parent, isMain) {
    if (request === 'obsidian') return {
      ItemView: ItemViewStub,
      Menu: MenuStub,
      Plugin: PluginStub,
      PluginSettingTab: class {},
      Setting: class {}
    };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return require('../src/main');
  } finally {
    Module._load = originalLoad;
  }
}

function fixtureApp() {
  const opened = [];
  const graphLeaves = [];
  return {
    opened,
    workspace: {
      on: () => ({}),
      getActiveFile: () => ({ path: 'rules/one.md' }),
      getLeavesOfType: type => type === 'nexo-graph-view' ? graphLeaves : [],
      getLeaf: () => ({ openFile: file => opened.push(file), setViewState: async () => {} }),
      revealLeaf: () => {}
    },
    vault: {
      getMarkdownFiles: () => [
        { path: 'rules/one.md', basename: 'one' },
        { path: 'agents/two.md', basename: 'two' }
      ],
      on: () => ({})
    },
    metadataCache: {
      resolvedLinks: { 'rules/one.md': { 'agents/two.md': 1 } },
      on: () => ({})
    },
    graphLeaves
  };
}

async function createView() {
  const NexoGraphPlugin = loadPluginClass();
  const app = fixtureApp();
  const plugin = new NexoGraphPlugin();
  plugin.app = app;
  plugin.loadData = async () => ({
    groups: [
      { name: 'Rules', prefixes: ['rules/'], color: '#00ff41' },
      { name: 'Agents', prefixes: ['agents/'], color: '#84f5b2' }
    ]
  });
  await plugin.onload();
  const view = plugin.viewFactory({ app });
  app.graphLeaves.push({ view });
  return { app, view };
}

function installFakeRuntime() {
  const original = { document: global.document, window: global.window, MouseEvent: global.MouseEvent };
  const scheduled = [];
  global.document = { createElementNS: (_namespace, tagName) => new FakeElement(tagName) };
  global.window = {
    setTimeout(callback, delay) { const token = { callback, delay, cancelled: false }; scheduled.push(token); return token; },
    clearTimeout(token) { if (token) token.cancelled = true; }
  };
  global.MouseEvent = class MouseEvent {
    constructor(type, options) { Object.assign(this, options, { type }); }
    preventDefault() { this.defaultPrevented = true; }
  };
  return {
    scheduled,
    restore() {
      global.document = original.document;
      global.window = original.window;
      global.MouseEvent = original.MouseEvent;
    }
  };
}

test('NEXO-004 renders an SVG graph and exposes selected state through focus and keyboard', async () => {
  const runtime = installFakeRuntime();
  try {
    const { app, view } = await createView();
    view.render();

    const svg = descendants(view.contentEl, element => element.tagName === 'svg')[0];
    const nodes = descendants(view.contentEl, element => element.classList.contains('nexo-node'));
    assert.equal(svg.getAttribute('role'), 'group');
    assert.equal(svg.getAttribute('aria-label'), 'Interactive graph of linked notes');
    assert.equal(nodes.length, 2);
    assert.equal(nodes[0].getAttribute('role'), 'button');
    assert.equal(nodes[0].getAttribute('tabindex'), '0');
    assert.match(nodes[0].getAttribute('aria-label'), /Space selects, Enter opens/);

    nodes[0].dispatch('focus');
    assert.equal(nodes[1].classList.contains('is-neighbor'), true);
    const select = nodes[0].dispatch('keydown', { key: ' ' });
    assert.equal(select.defaultPrevented, true);
    assert.equal(nodes[0].getAttribute('aria-pressed'), 'true');
    nodes[0].dispatch('keydown', { key: 'Escape' });
    assert.equal(nodes[0].getAttribute('aria-pressed'), 'false');

    nodes[0].dispatch('keydown', { key: 'Enter' });
    assert.equal(app.opened.length, 1);
    assert.equal(app.opened[0].path, 'rules/one.md');
  } finally {
    runtime.restore();
  }
});

test('NEXO-004 supports pointer emphasis, keyboard context menus, and debounced view refresh', async () => {
  const runtime = installFakeRuntime();
  try {
    const { view } = await createView();
    view.render();
    const nodes = descendants(view.contentEl, element => element.classList.contains('nexo-node'));

    nodes[0].dispatch('pointerenter');
    assert.equal(nodes[1].classList.contains('is-neighbor'), true);
    nodes[0].dispatch('pointerleave');
    assert.equal(nodes[1].classList.contains('is-neighbor'), false);

    const menuEvent = nodes[0].dispatch('keydown', { key: 'F10', shiftKey: true });
    assert.equal(menuEvent.defaultPrevented, true);
    assert.equal(MenuStub.instances.at(-1).event.type, 'contextmenu');

    let renders = 0;
    view.render = () => { renders++; };
    view.refresh();
    view.refresh();
    assert.equal(runtime.scheduled.length, 2);
    assert.equal(runtime.scheduled[0].cancelled, true);
    assert.equal(runtime.scheduled[1].delay, 250);
    runtime.scheduled[1].callback();
    assert.equal(renders, 1);
  } finally {
    runtime.restore();
  }
});

test('NEXO-004 reports link sampling limits without a missing runtime constant', async () => {
  const runtime = installFakeRuntime();
  try {
    const { app, view } = await createView();
    const files = Array.from({ length: 501 }, (_, index) => ({ path: `rules/${String(index).padStart(3, '0')}.md`, basename: `note-${index}` }));
    app.vault.getMarkdownFiles = () => files;
    app.metadataCache.resolvedLinks = Object.fromEntries(files.map((source, index) => [
      source.path,
      Object.fromEntries(files.slice(index + 1).map(target => [target.path, 1]))
    ]));

    view.render();

    assert.match(view.footerLimit.textContent, /Showing 1600 links/);
  } finally {
    runtime.restore();
  }
});
