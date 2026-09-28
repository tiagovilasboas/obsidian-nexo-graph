import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PROFILES = Object.freeze({
  small: Object.freeze({ noteCount: 12, linkCount: 24 }),
  medium: Object.freeze({ noteCount: 96, linkCount: 384 }),
  dense: Object.freeze({ noteCount: 500, linkCount: 1600 })
});

export const GROUPS = Object.freeze([
  Object.freeze({ name: 'Rules QA', prefix: 'rules/', color: '#84f5b2' }),
  Object.freeze({ name: 'Agents', prefix: 'agents/', color: '#00ff41' }),
  Object.freeze({ name: 'Architecture', prefix: 'architecture/', color: '#b8ff5a' }),
  Object.freeze({ name: 'Ops', prefix: 'ops/', color: '#00e5a0' })
]);

function assertProfile(profile) {
  if (!Object.hasOwn(PROFILES, profile)) throw new TypeError(`Unknown profile: ${profile}. Use small, medium, or dense.`);
}

function assertGroupCount(groupCount) {
  if (!Number.isInteger(groupCount) || groupCount < 1 || groupCount > GROUPS.length) {
    throw new TypeError(`Group count must be an integer from 1 to ${GROUPS.length}.`);
  }
}

function distribute(noteCount, groupCount) {
  const base = Math.floor(noteCount / groupCount);
  const remainder = noteCount % groupCount;
  return Array.from({ length: groupCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function linkOffsets(noteCount, groupCount) {
  const groupSize = Math.ceil(noteCount / groupCount);
  const preferred = [1, groupSize, groupSize + 1, groupSize * 2, groupSize * 2 + 1];
  const rest = Array.from({ length: noteCount - 1 }, (_, index) => index + 1);
  return [...new Set([...preferred, ...rest].filter(offset => offset > 0 && offset < noteCount))];
}

export function createLinks(noteCount, linkCount, groupCount) {
  if (!Number.isInteger(linkCount) || linkCount < 0 || linkCount > noteCount * (noteCount - 1) / 2) {
    throw new TypeError(`Cannot create ${linkCount} unique links for ${noteCount} notes.`);
  }
  const links = [];
  const seen = new Set();
  for (const offset of linkOffsets(noteCount, groupCount)) {
    for (let source = 0; source < noteCount; source++) {
      const target = (source + offset) % noteCount;
      const [left, right] = source < target ? [source, target] : [target, source];
      const key = `${left}:${right}`;
      if (left === right || seen.has(key)) continue;
      seen.add(key);
      links.push([source, target]);
      if (links.length === linkCount) return links;
    }
  }
  throw new Error(`Only generated ${links.length} unique links; expected ${linkCount}.`);
}

export function createSyntheticVault(profile, { groupCount = GROUPS.length } = {}) {
  assertProfile(profile);
  assertGroupCount(groupCount);
  const { noteCount, linkCount } = PROFILES[profile];
  const groups = GROUPS.slice(0, groupCount);
  const paths = [];
  const counts = distribute(noteCount, groupCount);
  counts.forEach((count, groupIndex) => {
    for (let index = 1; index <= count; index++) {
      paths.push(`${groups[groupIndex].prefix}node-${String(index).padStart(3, '0')}.md`);
    }
  });
  const links = createLinks(paths.length, linkCount, groupCount);
  const outgoing = Array.from({ length: paths.length }, () => []);
  links.forEach(([source, target]) => outgoing[source].push(paths[target].replace(/\.md$/, '')));
  const files = new Map(paths.map((path, index) => [
    path,
    `# ${basename(path, '.md')}\n\n${outgoing[index].map(target => `[[${target}]]`).join('\n')}\n`
  ]));
  const settings = {
    groups,
    ignoredPrefixes: []
  };
  return { profile, groupCount, groups, paths, links, files, settings };
}

async function ensureEmptyDirectory(outputPath) {
  try {
    const entries = await readdir(outputPath);
    if (entries.length) throw new Error(`Refusing to write into a non-empty directory: ${outputPath}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await mkdir(outputPath, { recursive: true });
}

function outputFile(outputPath, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath || isAbsolute(relativePath)) {
    throw new TypeError('Synthetic vault file paths must be non-empty relative paths.');
  }
  const target = resolve(outputPath, relativePath);
  const fromOutput = relative(outputPath, target);
  if (!fromOutput || fromOutput.startsWith('..') || isAbsolute(fromOutput)) {
    throw new TypeError(`Synthetic vault file path must stay within the output directory: ${relativePath}`);
  }
  return target;
}

export async function writeSyntheticVault(outputPath, fixture, { pluginSource = resolve(dirname(fileURLToPath(import.meta.url)), '..') } = {}) {
  const output = resolve(outputPath);
  const files = [...fixture.files].map(([relativePath, content]) => [outputFile(output, relativePath), content]);
  await ensureEmptyDirectory(output);
  for (const [target, content] of files) {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
  const pluginDestination = resolve(output, '.obsidian/plugins/nexo-graph');
  await mkdir(pluginDestination, { recursive: true });
  for (const asset of ['main.js', 'manifest.json', 'styles.css']) {
    await cp(resolve(pluginSource, asset), resolve(pluginDestination, asset));
  }
  await writeFile(resolve(pluginDestination, 'data.json'), `${JSON.stringify(fixture.settings, null, 2)}\n`, 'utf8');
  await writeFile(resolve(output, '.obsidian/community-plugins.json'), `${JSON.stringify(['nexo-graph'], null, 2)}\n`, 'utf8');
  return output;
}

function parseArguments(argumentsList) {
  const values = { groupCount: GROUPS.length };
  for (let index = 0; index < argumentsList.length; index++) {
    const argument = argumentsList[index];
    if (argument === '--profile') values.profile = argumentsList[++index];
    else if (argument === '--output') values.output = argumentsList[++index];
    else if (argument === '--groups') values.groupCount = Number(argumentsList[++index]);
    else if (argument === '--plugin-source') values.pluginSource = argumentsList[++index];
    else if (argument === '--help') values.help = true;
    else throw new TypeError(`Unknown argument: ${argument}`);
  }
  return values;
}

function usage() {
  return 'Usage: node scripts/create-synthetic-vault.mjs --profile <small|medium|dense> --output <empty-directory> [--groups 1|2|3|4] [--plugin-source <directory>]';
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
    } else {
      if (!options.profile || !options.output) throw new TypeError(usage());
      const fixture = createSyntheticVault(options.profile, options);
      const output = await writeSyntheticVault(options.output, fixture, options);
      console.log(JSON.stringify({ output, profile: fixture.profile, notes: fixture.paths.length, links: fixture.links.length, groups: fixture.groupCount }));
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
