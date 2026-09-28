import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_CONTRACT, compareVersions, validateApiFloor } from '../scripts/api-compatibility.mjs';

const testDirectory = dirname(fileURLToPath(import.meta.url));

test('version comparison handles numeric components instead of lexical order', () => {
  assert.equal(compareVersions('1.13.0', '0.16.0'), 1);
  assert.equal(compareVersions('1.9.0', '1.13.0'), -1);
  assert.equal(compareVersions('1.13.0', '1.13.0'), 0);
});

test('declared Obsidian APIs exist in source and predate the manifest floor', () => {
  const sources = new Map(API_CONTRACT.map(api => [api.file, readSource(api.file)]));
  assert.deepEqual(validateApiFloor({ minAppVersion: '1.13.0' }, path => sources.get(path)), []);
});

test('API compatibility gate rejects a floor below an API and a stale source registry', () => {
  const sources = new Map(API_CONTRACT.map(api => [api.file, readSource(api.file)]));
  const belowFloor = validateApiFloor({ minAppVersion: '0.15.0' }, path => sources.get(path));
  assert.ok(belowFloor.some(error => error.includes('Workspace.getLeaf(PaneType)')));

  sources.set('src/main.js', sources.get('src/main.js').replaceAll("getLeaf('tab')", 'getLeaf(false)'));
  const staleRegistry = validateApiFloor({ minAppVersion: '1.13.0' }, path => sources.get(path));
  assert.ok(staleRegistry.some(error => error.includes('Workspace.getLeaf(PaneType)')));
});

function readSource(path) { return readFileSync(resolve(testDirectory, '..', path), 'utf8'); }
