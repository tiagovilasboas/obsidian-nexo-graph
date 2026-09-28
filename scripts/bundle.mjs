#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../src/graph-engine.js', import.meta.url), 'utf8')
  .replace(/\nmodule\.exports = \{[^\n]+\};?\s*$/, '\n');
const engineImport = "const { GROUP_CENTERS, GROUP_RADIUS, MAX_NODES, edgeRoute, graphData, positionNodes, searchMatches, searchSummary } = require('./graph-engine');";

if (!source.includes(engineImport)) {
  throw new Error('Expected graph-engine import was not found in src/main.js');
}

const bundled = source.replace(engineImport, engine.trimEnd());
const outputPath = new URL('../main.js', import.meta.url);

if (process.argv.includes('--check')) {
  let existing = '';
  try {
    existing = readFileSync(outputPath, 'utf8');
  } catch {}
  if (existing !== bundled) {
    console.error('main.js is stale; run node scripts/bundle.mjs and commit the generated file.');
    process.exit(1);
  }
  console.log('main.js matches src/main.js and src/graph-engine.js.');
} else {
  writeFileSync(outputPath, bundled);
  console.log('Generated main.js.');
}
