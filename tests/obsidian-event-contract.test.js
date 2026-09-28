const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

class PluginStub {
  registerEvent(event) { (this.registeredEvents ||= []).push(event); }
  registerView() {}
  addRibbonIcon() {}
  addCommand() {}
  addSettingTab() {}
}

function loadPluginClass() {
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === 'obsidian') {
      return {
        ItemView: class {},
        Menu: class {},
        Plugin: PluginStub,
        PluginSettingTab: class {},
        Setting: class {}
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return require('../src/main');
  } finally {
    Module._load = originalLoad;
  }
}

function emitter(events) {
  return { on(name, callback) { events.push({ name, callback }); return { name, callback }; } };
}

test('vault and metadata changes refresh every open graph view', async () => {
  const NexoGraphPlugin = loadPluginClass();
  const workspaceEvents = [];
  const metadataEvents = [];
  const vaultEvents = [];
  let refreshes = 0;
  const leaves = [{ view: { localMode: false, refresh() { refreshes++; } } }];
  const app = {
    workspace: {
      ...emitter(workspaceEvents),
      getActiveFile: () => ({ path: 'rules/policy.md' }),
      getLeavesOfType: type => type === 'nexo-graph-view' ? leaves : []
    },
    metadataCache: emitter(metadataEvents),
    vault: emitter(vaultEvents)
  };
  const plugin = new NexoGraphPlugin();
  plugin.app = app;
  plugin.loadData = async () => ({ groups: [{ prefixes: ['rules/'] }] });

  await plugin.onload();

  assert.deepEqual(metadataEvents.map(event => event.name), ['resolved', 'changed']);
  assert.deepEqual(vaultEvents.map(event => event.name), ['create', 'modify', 'delete', 'rename']);
  for (const event of [...metadataEvents, ...vaultEvents]) event.callback();
  assert.equal(refreshes, 6);
});

test('settings migration keeps default names while custom names and vault state persist', async () => {
  const NexoGraphPlugin = loadPluginClass();
  const workspaceEvents = [];
  let stored;
  let refreshes = 0;
  const app = {
    workspace: {
      ...emitter(workspaceEvents),
      getActiveFile: () => null,
      getLeavesOfType: () => [{ view: { localMode: false, refresh() { refreshes++; } } }]
    },
    metadataCache: emitter([]),
    vault: emitter([])
  };
  const plugin = new NexoGraphPlugin();
  plugin.app = app;
  plugin.loadData = async () => ({
    groups: [{ prefixes: ['rules/'], color: '#123456' }, { name: 'Agents', prefixes: ['agent/'] }],
    ignoredPrefixes: ['_trash/']
  });
  plugin.saveData = async data => { stored = structuredClone(data); };

  await plugin.onload();
  assert.equal(plugin.settings.groups[0].name, 'Personal', 'legacy groups inherit their default label');
  assert.equal(plugin.settings.groups[1].name, 'Agents');
  assert.deepEqual(plugin.settings.ignoredPrefixes, ['_trash/']);

  plugin.settings.groups[0].name = 'Rules';
  await plugin.saveSettings();
  assert.equal(stored.groups[0].name, 'Rules');
  assert.deepEqual(stored.ignoredPrefixes, ['_trash/']);
  assert.equal(refreshes, 1);
});
