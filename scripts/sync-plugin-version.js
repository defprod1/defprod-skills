#!/usr/bin/env node

/**
 * Keep the Claude Code plugin's version equal to the package version.
 *
 * Runs as the npm `version` lifecycle script, so `npm version <x>` (with or
 * without --no-git-tag-version) rewrites .claude-plugin/plugin.json in the same
 * step as package.json. verify-skills.js fails if the two ever disagree.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLUGIN = path.join(ROOT, '.claude-plugin', 'plugin.json');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const plugin = JSON.parse(fs.readFileSync(PLUGIN, 'utf8'));
if (plugin.version !== version) {
  plugin.version = version;
  fs.writeFileSync(PLUGIN, JSON.stringify(plugin, null, 2) + '\n');
  console.log(`sync-plugin-version: .claude-plugin/plugin.json -> ${version}`);
}
