import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const failures = [];

if (!/\.nexo-node:focus-visible\s*\{[^}]*outline\s*:\s*none/i.test(css)) {
  failures.push('SVG note nodes must suppress the browser outline only when a visible focus treatment is provided.');
}
if (!/\.nexo-node:focus-visible\s+circle\s*\{[^}]*stroke\s*:\s*#fff/i.test(css)) {
  failures.push('Keyboard-focused SVG nodes must have a visible node stroke.');
}
if (!/\.nexo-controls\s+button:focus-visible[\s\S]*?outline\s*:\s*2px/i.test(css)) {
  failures.push('Toolbar buttons must expose a visible keyboard focus outline.');
}
if (!/\.nexo-filter\s+input:focus-visible[\s\S]*?outline\s*:\s*2px/i.test(css)) {
  failures.push('Group filters must expose a visible keyboard focus outline.');
}
if (!/\.nexo-node\.is-selected\s+circle\s*\{[^}]*stroke\s*:\s*#fff/i.test(css)) {
  failures.push('Selected graph nodes must remain visually distinct after keyboard focus moves.');
}
if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.nexo-node[\s\S]*?transition:\s*none/i.test(css)) {
  failures.push('Node transitions must be disabled for reduced-motion users.');
}
const spokeRule = css.match(/\.nexo-field-spoke\s*\{[^}]*animation\s*:\s*([^;}]+)/i);
if (spokeRule && spokeRule[1].trim().toLowerCase() !== 'none') {
  failures.push('Signal Field background lines must not animate continuously.');
}

if (failures.length) {
  console.error(`CSS accessibility contract failed:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('CSS accessibility and motion contract passed.');
}
