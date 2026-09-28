const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, readdir } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

let createSyntheticVault;
let writeSyntheticVault;
let PROFILES;

test.before(async () => {
  ({ createSyntheticVault, writeSyntheticVault, PROFILES } = await import('../scripts/create-synthetic-vault.mjs'));
});

test('NEXO-008 generates deterministic generic small, medium, and dense fixtures', () => {
  for (const [profile, expected] of Object.entries(PROFILES)) {
    const first = createSyntheticVault(profile);
    const second = createSyntheticVault(profile);
    assert.equal(first.paths.length, expected.noteCount);
    assert.equal(first.links.length, expected.linkCount);
    assert.deepEqual(first.paths, second.paths);
    assert.deepEqual(first.links, second.links);
    assert.ok(first.paths.every(path => /^(rules|agents|architecture|ops)\/node-\d{3}\.md$/.test(path)));
    assert.equal(new Set(first.links.map(([source, target]) => [source, target].sort((left, right) => left - right).join(':'))).size, expected.linkCount);
  }
});

test('NEXO-008 distributes a small fixture through the requested number of generic groups', () => {
  const fixture = createSyntheticVault('small', { groupCount: 2 });
  assert.equal(fixture.paths.length, 12);
  assert.deepEqual(fixture.groups.map(group => group.name), ['Rules QA', 'Agents']);
  assert.equal(fixture.paths.filter(path => path.startsWith('rules/')).length, 6);
  assert.equal(fixture.paths.filter(path => path.startsWith('agents/')).length, 6);
});

test('NEXO-008 writes an isolated vault with the current plugin assets and settings', async () => {
  const output = await mkdtemp(join(tmpdir(), 'nexo-008-'));
  const fixture = createSyntheticVault('small');
  await writeSyntheticVault(output, fixture);

  const pluginAssets = await readdir(join(output, '.obsidian/plugins/nexo-graph'));
  assert.deepEqual(pluginAssets.sort(), ['data.json', 'main.js', 'manifest.json', 'styles.css']);
  const enabledPlugins = JSON.parse(await readFile(join(output, '.obsidian/community-plugins.json'), 'utf8'));
  assert.deepEqual(enabledPlugins, ['nexo-graph']);
  const firstNote = await readFile(join(output, fixture.paths[0]), 'utf8');
  assert.match(firstNote, /^# node-001/m);
  assert.match(firstNote, /\[\[(rules|agents|architecture|ops)\/node-\d{3}\]\]/);
});

test('NEXO-008 refuses to overwrite a generated vault', async () => {
  const output = await mkdtemp(join(tmpdir(), 'nexo-008-existing-'));
  await writeSyntheticVault(output, createSyntheticVault('small'));
  await assert.rejects(
    writeSyntheticVault(output, createSyntheticVault('medium')),
    /Refusing to write into a non-empty directory/
  );
});

test('NEXO-008 rejects synthetic file paths that escape the output vault', async () => {
  const output = await mkdtemp(join(tmpdir(), 'nexo-008-contained-'));
  const fixture = createSyntheticVault('small');
  const escaped = { ...fixture, files: new Map([...fixture.files, ['../outside.md', '# outside\n']]) };
  const absolute = { ...fixture, files: new Map([...fixture.files, ['/tmp/outside.md', '# outside\n']]) };

  await assert.rejects(writeSyntheticVault(output, escaped), /stay within the output directory/);
  await assert.rejects(writeSyntheticVault(output, absolute), /non-empty relative paths/);
  assert.deepEqual(await readdir(output), []);
});
