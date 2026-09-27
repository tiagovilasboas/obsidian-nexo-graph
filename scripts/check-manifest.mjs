#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const errors = [];
const requiredText = ['id', 'name', 'version', 'minAppVersion', 'description', 'author'];

for (const key of requiredText) {
  if (typeof manifest[key] !== 'string' || manifest[key].trim() === '') {
    errors.push(`manifest.${key} must be a non-empty string`);
  }
}

if (typeof manifest.id === 'string') {
  if (!/^[a-z0-9-]+$/.test(manifest.id)) errors.push('manifest.id must use lowercase letters, digits, and hyphens');
  if (manifest.id.includes('obsidian')) errors.push('manifest.id must not contain "obsidian"');
}
if (typeof manifest.version === 'string' && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  errors.push('manifest.version must use x.y.z semver');
}
if (typeof manifest.minAppVersion === 'string' && !/^\d+\.\d+\.\d+$/.test(manifest.minAppVersion)) {
  errors.push('manifest.minAppVersion must use x.y.z semver');
}
if (typeof manifest.description === 'string') {
  if (manifest.description.length > 250) errors.push('manifest.description must be 250 characters or fewer');
  if (!manifest.description.endsWith('.')) errors.push('manifest.description must end with a period');
}
if (typeof manifest.isDesktopOnly !== 'boolean') errors.push('manifest.isDesktopOnly must be a boolean');

for (const path of ['README.md', 'LICENSE', 'main.js']) {
  try {
    read(path);
  } catch {
    errors.push(`${path} must exist at the repository root`);
  }
}

if (errors.length) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Community manifest contract passed for ${manifest.id} ${manifest.version}.`);
}
