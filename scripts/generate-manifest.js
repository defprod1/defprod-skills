#!/usr/bin/env node

/**
 * Generates known-shipped.json — a manifest of SHA-256 hashes for every
 * file that was ever shipped in a released version of @defprod/skills.
 *
 * The update command uses this to distinguish a pristine prior-version
 * install (safe to overwrite) from a file the user actually modified
 * (must be preserved). Without it, users who installed any earlier
 * version see every file flagged as "locally modified" and nothing
 * updates.
 *
 * Scans: all annotated/lightweight tags matching v* plus the current
 * working tree. Keys are paths relative to the install root (e.g.
 * "defprod-onboard-repo/SKILL.md"), values are arrays of hex SHA-256
 * digests seen at any point. Order is not significant.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'known-shipped.json');
const SRC_PREFIXES = ['skills/', 'contrib/'];

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
}

function listTags() {
  const out = git(['tag', '--list', 'v*', '--sort=v:refname']).toString().trim();
  return out ? out.split('\n') : [];
}

function listFilesAtRef(ref) {
  const out = git(['ls-tree', '-r', '--name-only', ref, '--', 'skills', 'contrib']).toString().trim();
  return out ? out.split('\n') : [];
}

function readFileAtRef(ref, filePath) {
  return git(['show', `${ref}:${filePath}`]);
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function installKey(gitPath) {
  for (const prefix of SRC_PREFIXES) {
    if (gitPath.startsWith(prefix)) return gitPath.slice(prefix.length);
  }
  return null;
}

function addHash(manifest, key, hash) {
  if (!manifest[key]) manifest[key] = [];
  if (!manifest[key].includes(hash)) manifest[key].push(hash);
}

function walkWorkingTree(dir, manifest) {
  if (!fs.existsSync(dir)) return;
  const prefix = path.relative(ROOT, dir).replace(/\\/g, '/') + '/';
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        const rel = path.relative(ROOT, full).replace(/\\/g, '/');
        const key = installKey(rel);
        if (!key) continue;
        addHash(manifest, key, sha256(fs.readFileSync(full)));
      }
    }
  }
}

function main() {
  const manifest = {};
  const tags = listTags();

  for (const tag of tags) {
    let files;
    try {
      files = listFilesAtRef(tag);
    } catch (_) {
      continue;
    }
    for (const file of files) {
      const key = installKey(file);
      if (!key) continue;
      let content;
      try {
        content = readFileAtRef(tag, file);
      } catch (_) {
        continue;
      }
      addHash(manifest, key, sha256(content));
    }
  }

  // Include the current working tree so a freshly-built package counts
  // its own files as "shipped" even before the next tag exists.
  walkWorkingTree(path.join(ROOT, 'skills'), manifest);
  walkWorkingTree(path.join(ROOT, 'contrib'), manifest);

  const sortedKeys = Object.keys(manifest).sort();
  const out = {};
  for (const k of sortedKeys) out[k] = manifest[k].sort();

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');

  const fileCount = sortedKeys.length;
  const hashCount = sortedKeys.reduce((n, k) => n + out[k].length, 0);
  console.log(`Wrote ${path.relative(ROOT, OUT)} — ${fileCount} paths, ${hashCount} historical hashes across ${tags.length} tag(s).`);
}

main();
