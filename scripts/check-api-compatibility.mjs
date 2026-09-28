#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { validateApiFloor } from './api-compatibility.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const errors = validateApiFloor(manifest, read);

if (errors.length) {
  console.error(`Obsidian API compatibility contract failed:\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`Obsidian API floor passed: all registered APIs predate minAppVersion ${manifest.minAppVersion}.`);
}
