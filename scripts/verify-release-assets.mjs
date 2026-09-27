#!/usr/bin/env node

/**
 * Verifies that an already-published GitHub release contains the exact files
 * from its tag. Usage: node scripts/verify-release-assets.mjs <tag>
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [tag] = process.argv.slice(2);
const releaseFiles = ["main.js", "manifest.json", "styles.css"];

function fail(message) {
  console.error(`Release verification failed: ${message}`);
  process.exit(1);
}

function command(commandName, args, options = {}) {
  try {
    return execFileSync(commandName, args, { encoding: "utf8", ...options }).trim();
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    fail(detail);
  }
}

function commandBytes(commandName, args) {
  try {
    return execFileSync(commandName, args);
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    fail(detail);
  }
}

function remoteRepository() {
  const remote = command("git", ["config", "--get", "remote.origin.url"]);
  const match = remote.match(/(?:github\.com[:/])([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!match) fail(`origin is not a GitHub repository: ${remote}`);
  return match[1];
}

if (!tag) fail("pass the release tag, for example: 0.1.0");

const taggedManifest = JSON.parse(command("git", ["show", `${tag}:manifest.json`]));
if (taggedManifest.version !== tag) {
  fail(`tag '${tag}' does not exactly match manifest.version '${taggedManifest.version}'`);
}

const temporaryDirectory = mkdtempSync(join(tmpdir(), "nexo-graph-release-"));
const repository = remoteRepository();

try {
  for (const file of releaseFiles) {
    const source = commandBytes("git", ["show", `${tag}:${file}`]);
    const sourcePath = join(temporaryDirectory, `source-${file}`);
    const assetPath = join(temporaryDirectory, file);
    writeFileSync(sourcePath, source);

    command("gh", [
      "release",
      "download",
      tag,
      "--repo",
      repository,
      "--pattern",
      file,
      "--dir",
      temporaryDirectory,
      "--clobber",
    ]);

    const sourceBytes = readFileSync(sourcePath);
    const assetBytes = readFileSync(assetPath);
    if (!sourceBytes.equals(assetBytes)) {
      fail(`${file} differs from ${tag}:${file}`);
    }
    console.log(`Verified ${file}`);
  }

  console.log(`Release ${tag} matches its tagged source.`);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
