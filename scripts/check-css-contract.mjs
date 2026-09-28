import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function rgb(hex) {
  const normalized = hex.replace('#', '');
  if (!/^[\da-f]{6}$/i.test(normalized)) throw new TypeError(`Expected a six-digit hex color: ${hex}`);
  return [0, 2, 4].map(index => Number.parseInt(normalized.slice(index, index + 2), 16));
}

function relativeLuminance([red, green, blue]) {
  const channel = value => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function blend(foreground, background, opacity) {
  return foreground.map((channel, index) => channel * opacity + background[index] * (1 - opacity));
}

function contrast(foreground, background) {
  const [light, dark] = [relativeLuminance(foreground), relativeLuminance(background)].sort((left, right) => right - left);
  return (light + 0.05) / (dark + 0.05);
}

function filterStateContrast(css) {
  const text = css.match(/\.nexo-filter\s*\{[^}]*\bcolor:\s*(#[\da-f]{6})/i)?.[1];
  const background = css.match(/\.nexo-filters\s*\{[^}]*\bbackground:\s*(#[\da-f]{6})/i)?.[1];
  const opacity = Number(css.match(/\.nexo-filter:has\(input:not\(:checked\)\)\s*\{[^}]*\bopacity:\s*([\d.]+)/i)?.[1]);
  if (!text || !background || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) return null;
  return contrast(blend(rgb(text), rgb(background), opacity), rgb(background));
}

function ruleOpacity(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const opacity = Number(css.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\bopacity\\s*:\\s*([\\d.]+)`, 'i'))?.[1]);
  return Number.isFinite(opacity) && opacity >= 0 && opacity <= 1 ? opacity : null;
}

export function checkCssContract(css) {
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
  const inactiveFilterContrast = filterStateContrast(css);
  if (inactiveFilterContrast === null || inactiveFilterContrast < 4.5) {
    failures.push('Unchecked group-filter text must maintain at least 4.5:1 contrast against its filter background.');
  }
  const localEdgeOpacity = ruleOpacity(css, '.nexo-edges path');
  const crossDomainEdgeOpacity = ruleOpacity(css, '.nexo-edges path.is-cross-domain');
  const dimmedEdgeOpacity = ruleOpacity(css, '.nexo-edges path.is-dimmed');
  if (localEdgeOpacity === null || crossDomainEdgeOpacity === null || dimmedEdgeOpacity === null) {
    failures.push('Graph edge hierarchy must declare valid local, cross-domain, and dimmed opacity values.');
  } else {
    if (crossDomainEdgeOpacity > localEdgeOpacity) {
      failures.push('Cross-domain graph edges must not be more prominent than local edges at rest.');
    }
    if (dimmedEdgeOpacity >= Math.min(localEdgeOpacity, crossDomainEdgeOpacity)) {
      failures.push('Dimmed graph edges must remain quieter than graph edges at rest.');
    }
  }
  return failures;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const cssPath = process.argv[2] || new URL('../styles.css', import.meta.url);
  const css = await readFile(cssPath, 'utf8');
  const failures = checkCssContract(css);
  if (failures.length) {
    console.error(`CSS accessibility contract failed:\n- ${failures.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log('CSS accessibility and motion contract passed.');
  }
}
