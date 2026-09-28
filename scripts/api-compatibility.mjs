export const API_CONTRACT = [
  { name: 'Plugin.registerView', since: '0.9.7', file: 'src/main.js', marker: 'this.registerView(' },
  { name: 'Plugin.addRibbonIcon', since: '0.9.7', file: 'src/main.js', marker: 'this.addRibbonIcon(' },
  { name: 'Plugin.addCommand', since: '0.9.7', file: 'src/main.js', marker: 'this.addCommand(' },
  { name: 'Plugin.addSettingTab', since: '0.9.7', file: 'src/main.js', marker: 'this.addSettingTab(' },
  { name: 'Plugin.registerEvent', since: '0.9.7', file: 'src/main.js', marker: 'this.registerEvent(' },
  { name: 'Vault.getMarkdownFiles', since: '0.9.7', file: 'src/graph-engine.js', marker: 'app.vault.getMarkdownFiles(' },
  { name: 'Workspace.getLeaf(PaneType)', since: '0.16.0', file: 'src/main.js', marker: "getLeaf('tab')" }
];

export function compareVersions(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

export function validateApiFloor(manifest, readSource) {
  const errors = [];
  for (const api of API_CONTRACT) {
    if (compareVersions(manifest.minAppVersion, api.since) < 0) {
      errors.push(`manifest.minAppVersion ${manifest.minAppVersion} is below ${api.name} floor ${api.since}`);
    }
    if (!readSource(api.file).includes(api.marker)) {
      errors.push(`API compatibility registry marker missing: ${api.name} in ${api.file}`);
    }
  }
  return errors;
}
