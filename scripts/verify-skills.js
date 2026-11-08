#!/usr/bin/env node

/**
 * Pre-publish verification for @defprod/skills.
 *
 * Checks:
 * 1. SKILL.md frontmatter — valid YAML, required fields present
 * 2. Scaffolding removal — contrib skills must not contain {{placeholders}} or <!-- comments -->
 * 3. MCP tool name cross-reference — every mcp__defprod__* reference matches a known tool
 * 4. Config key consistency — defprod.json keys mentioned in skills are documented in README
 * 5. retired-skills.json shape
 * 6. Local-extensions pointer block in every official skill
 * 7. Claude Code plugin manifests — valid, version in step with package.json, server added by address only
 * 8. Installer smoke test — run install into a temp dir, verify files land correctly and no plugin manifest leaks
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const SKILLS_DIR = path.join(ROOT, 'skills');
const CONTRIB_DIR = path.join(ROOT, 'contrib');
const README = path.join(ROOT, 'README.md');
const CLI = path.join(ROOT, 'bin', 'skills.js');

let errors = 0;

function fail(msg) {
  console.error(`  FAIL  ${msg}`);
  errors++;
}

function pass(msg) {
  console.log(`  ok    ${msg}`);
}

// --- 1. Frontmatter lint ---

console.log('\n1. Frontmatter lint');

const REQUIRED_FIELDS = ['name', 'description', 'allowed-tools'];

const skillDirs = fs.readdirSync(SKILLS_DIR).filter(d =>
  fs.statSync(path.join(SKILLS_DIR, d)).isDirectory()
);

// Also validate contrib skills (excluding TEMPLATE)
const contribDirs = fs.existsSync(CONTRIB_DIR)
  ? fs.readdirSync(CONTRIB_DIR).filter(d =>
      d !== 'TEMPLATE' && d !== '.gitkeep' && fs.statSync(path.join(CONTRIB_DIR, d)).isDirectory()
    )
  : [];

const allSkillEntries = [
  ...skillDirs.map(d => ({ dir: d, base: SKILLS_DIR, label: d })),
  ...contribDirs.map(d => ({ dir: d, base: CONTRIB_DIR, label: `contrib/${d}` })),
];

for (const entry of allSkillEntries) {
  const skillFile = path.join(entry.base, entry.dir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) {
    fail(`${entry.label}/SKILL.md not found`);
    continue;
  }

  const content = fs.readFileSync(skillFile, 'utf8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    fail(`${entry.label}/SKILL.md — no frontmatter block found`);
    continue;
  }

  const frontmatter = fmMatch[1];
  for (const field of REQUIRED_FIELDS) {
    if (!frontmatter.includes(`${field}:`)) {
      fail(`${entry.label}/SKILL.md — missing required field: ${field}`);
    }
  }

  // Check name matches directory
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  if (nameMatch && nameMatch[1].trim() !== entry.dir) {
    fail(`${entry.label}/SKILL.md — name "${nameMatch[1].trim()}" doesn't match directory "${entry.dir}"`);
  }

  pass(`${entry.label}/SKILL.md — frontmatter valid`);
}

// --- 2. Scaffolding removal (contrib skills only) ---

console.log('\n2. Scaffolding removal (contrib skills)');

if (contribDirs.length === 0) {
  pass('no contrib skills to check');
} else {
  for (const entry of contribDirs.map(d => ({ dir: d, base: CONTRIB_DIR, label: `contrib/${d}` }))) {
    const skillFile = path.join(entry.base, entry.dir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;

    const content = fs.readFileSync(skillFile, 'utf8');
    const lines = content.split('\n');
    let clean = true;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('<!--')) {
        fail(`${entry.label}/SKILL.md:${i + 1} — HTML comment not removed (scaffolding)`);
        clean = false;
      }
      if (lines[i].match(/\{\{.*\}\}/)) {
        fail(`${entry.label}/SKILL.md:${i + 1} — {{placeholder}} not replaced`);
        clean = false;
      }
    }

    if (clean) {
      pass(`${entry.label}/SKILL.md — no scaffolding remaining`);
    }
  }
}

// --- 3. MCP tool cross-reference ---

console.log('\n3. MCP tool cross-reference');

const KNOWN_MCP_TOOLS = [
  'createArchitectureElement', 'createArea', 'createProduct', 'createRepo', 'createUserStory',
  'deleteArchitectureElement', 'deleteArea', 'deleteProduct', 'deleteRepo', 'deleteUserStory',
  'getArchitectureForProduct', 'getArchitectureTree', 'getArea',
  'getBriefForProduct', 'getProduct', 'getRepo', 'getUserStory', 'whoAmI',
  'listAreas', 'listProducts', 'listRepos', 'listUserStories',
  'createChange', 'listChanges', 'listTeamChanges', 'getChange', 'patchChange', 'deleteChange',
  'startChangeStage', 'finishChangeStage', 'cancelChangeStage', 'cancelChange', 'reopenChange',
  'assessChangeRisk', 'recordChangeDefect', 'confirmChangePipeline', 'getEffectiveChangePipeline',
  'createChangeGroup', 'getChangeGroup', 'listChangeGroups', 'setChangeGroupMembership',
  'moveArchitectureElement',
  'patchArchitectureElement', 'patchArea', 'patchBrief', 'patchProduct', 'patchRepo', 'patchUserStory',
];

for (const entry of allSkillEntries) {
  const skillFile = path.join(entry.base, entry.dir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) continue;

  const content = fs.readFileSync(skillFile, 'utf8');
  const mcpRefs = content.match(/mcp__defprod__(\w+)/g) || [];

  for (const ref of mcpRefs) {
    const toolName = ref.replace('mcp__defprod__', '');
    if (!KNOWN_MCP_TOOLS.includes(toolName)) {
      fail(`${entry.label}/SKILL.md — unknown MCP tool: ${ref}`);
    }
  }

  if (mcpRefs.length > 0) {
    pass(`${entry.label}/SKILL.md — ${mcpRefs.length} MCP reference(s) valid`);
  }
}

// --- 4. Config key consistency ---

console.log('\n4. Config key consistency');

if (!fs.existsSync(README)) {
  fail('README.md not found — cannot check config key documentation');
} else {
  const readmeContent = fs.readFileSync(README, 'utf8');

  for (const entry of allSkillEntries) {
    const skillFile = path.join(entry.base, entry.dir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;

    const content = fs.readFileSync(skillFile, 'utf8');
    // Look for defprod.json key references in backticks
    const keyRefs = content.match(/`(?:products\[\]\.)?(frontendApp|backendApp|e2eDir|compileCheck|reviewQueuePath|name)`/g) || [];
    const keys = [...new Set(keyRefs.map(k => k.replace(/`/g, '').replace('products[].', '')))];

    for (const key of keys) {
      if (!readmeContent.includes(key)) {
        fail(`${entry.label}/SKILL.md — config key "${key}" not documented in README`);
      }
    }

    if (keys.length > 0) {
      pass(`${entry.label}/SKILL.md — ${keys.length} config key(s) documented`);
    }
  }
}

// --- 5. retired-skills.json shape ---

console.log('\n5. Retired-skills manifest');

const RETIRED_PATH = path.join(ROOT, 'retired-skills.json');
const SHIPPED_PATH = path.join(ROOT, 'known-shipped.json');

if (!fs.existsSync(RETIRED_PATH)) {
  pass('retired-skills.json absent (no retired skills to track)');
} else {
  let retiredDoc;
  try {
    retiredDoc = JSON.parse(fs.readFileSync(RETIRED_PATH, 'utf8'));
  } catch (e) {
    fail(`retired-skills.json — not valid JSON: ${e.message}`);
    retiredDoc = null;
  }

  if (retiredDoc) {
    if (!Array.isArray(retiredDoc.retired)) {
      fail('retired-skills.json — missing or non-array `retired` field');
    } else {
      let shipped = {};
      if (fs.existsSync(SHIPPED_PATH)) {
        try { shipped = JSON.parse(fs.readFileSync(SHIPPED_PATH, 'utf8')); } catch (_) { /* ignore */ }
      }

      for (const entry of retiredDoc.retired) {
        if (!entry.name || typeof entry.name !== 'string') {
          fail(`retired-skills.json — entry missing valid \`name\``);
          continue;
        }
        if (!entry.retiredIn || typeof entry.retiredIn !== 'string') {
          fail(`retired-skills.json — ${entry.name}: missing \`retiredIn\``);
        }
        if (!entry.reason || typeof entry.reason !== 'string') {
          fail(`retired-skills.json — ${entry.name}: missing \`reason\``);
        }

        // The retired name MUST NOT still exist as a live skill.
        if (fs.existsSync(path.join(SKILLS_DIR, entry.name))) {
          fail(`retired-skills.json — ${entry.name}: dir still present in skills/ (retired but not removed)`);
        }

        // We need at least one historical hash for at least one file under this
        // skill name in known-shipped.json, otherwise the installer's pristine
        // check has nothing to compare against — it would conservatively keep
        // every retired-skill dir as "modified".
        const hasShippedHashes = Object.keys(shipped).some(k =>
          k.startsWith(`${entry.name}/`) && Array.isArray(shipped[k]) && shipped[k].length > 0
        );
        if (!hasShippedHashes) {
          fail(`retired-skills.json — ${entry.name}: no historical hashes in known-shipped.json (prune cannot verify pristine state)`);
        }

        pass(`retired-skills.json — ${entry.name} (retired in ${entry.retiredIn})`);
      }
    }
  }
}

// --- 6. Local-extensions pointer block ---

// Every official SKILL.md must advertise the SKILL.local.md companion so consumers
// can customise a skill without forking it (see the local-customization design).
// Keep this sentinel in sync with the block inserted into each skill.
const LOCAL_POINTER_SENTINEL = '> **Local extensions.**';

console.log('\n6. Local-extensions pointer block');

for (const dir of skillDirs) {
  const skillFile = path.join(SKILLS_DIR, dir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) continue;

  const content = fs.readFileSync(skillFile, 'utf8');
  if (!content.includes(LOCAL_POINTER_SENTINEL) || !content.includes('SKILL.local.md')) {
    fail(`${dir}/SKILL.md — missing the "Local extensions" pointer block (must reference SKILL.local.md)`);
  } else {
    pass(`${dir}/SKILL.md — local-extensions pointer present`);
  }
}

// --- 7. Claude Code plugin manifests ---

// The repo root is itself a Claude Code plugin (skills/ is the plugin's skills
// dir) and its own one-plugin marketplace. A broken manifest breaks every
// plugin install, and the MCP entry must never carry a secret.
console.log('\n7. Claude Code plugin manifests');

const PLUGIN_DIR = path.join(ROOT, '.claude-plugin');
const PLUGIN_JSON = path.join(PLUGIN_DIR, 'plugin.json');
const MARKETPLACE_JSON = path.join(PLUGIN_DIR, 'marketplace.json');

function readJson(file, label) {
  if (!fs.existsSync(file)) {
    fail(`${label} not found`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail(`${label} — not valid JSON: ${e.message}`);
    return null;
  }
}

const pluginDoc = readJson(PLUGIN_JSON, '.claude-plugin/plugin.json');
const marketplaceDoc = readJson(MARKETPLACE_JSON, '.claude-plugin/marketplace.json');
const packageVersion = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

if (pluginDoc) {
  if (pluginDoc.name !== 'defprod') {
    fail(`plugin.json — name is "${pluginDoc.name}", expected "defprod"`);
  }
  if (pluginDoc.version !== packageVersion) {
    fail(`plugin.json — version ${pluginDoc.version} != package.json ${packageVersion} (run: node scripts/sync-plugin-version.js)`);
  } else {
    pass(`plugin.json — version ${pluginDoc.version} matches package.json`);
  }

  const servers = pluginDoc.mcpServers || {};
  const server = servers.defprod;
  if (!server) {
    fail('plugin.json — mcpServers.defprod missing');
  } else {
    if (server.type !== 'http') fail(`plugin.json — mcpServers.defprod.type is "${server.type}", expected "http"`);
    if (server.url !== 'https://mcp.defprod.one/mcp') fail(`plugin.json — mcpServers.defprod.url is "${server.url}"`);
    const extra = Object.keys(server).filter(k => k !== 'type' && k !== 'url');
    if (extra.length > 0) {
      fail(`plugin.json — mcpServers.defprod carries ${extra.join(', ')}: the server is added by its address alone, never with headers, env or a key`);
    } else {
      pass('plugin.json — defprod server added by address only');
    }
  }
  const others = Object.keys(servers).filter(k => k !== 'defprod');
  if (others.length > 0) fail(`plugin.json — unexpected MCP servers: ${others.join(', ')}`);
  if (fs.existsSync(path.join(ROOT, '.mcp.json'))) {
    fail('.mcp.json at the repo root — keep the plugin\'s server in plugin.json so the repo itself does not prompt for it');
  }
}

if (marketplaceDoc && pluginDoc) {
  const entries = Array.isArray(marketplaceDoc.plugins) ? marketplaceDoc.plugins : [];
  const entry = entries.find(p => p.name === pluginDoc.name);
  if (!entry) {
    fail(`marketplace.json — no plugin named "${pluginDoc.name}"`);
  } else if (entry.source !== './') {
    fail(`marketplace.json — plugin "${entry.name}" source is ${JSON.stringify(entry.source)}, expected "./"`);
  } else {
    pass(`marketplace.json — "${marketplaceDoc.name}" lists "${entry.name}" from the repo root`);
  }
}

// --- 8. Installer smoke test ---

console.log('\n8. Installer smoke test');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'defprod-skills-test-'));

try {
  execSync(`node "${CLI}" install "${tmpDir}"`, { stdio: 'pipe' });

  for (const dir of skillDirs) {
    const installed = path.join(tmpDir, '.claude', 'skills', dir, 'SKILL.md');
    if (fs.existsSync(installed)) {
      pass(`install — ${dir}/SKILL.md installed`);
    } else {
      fail(`install — ${dir}/SKILL.md not found after install`);
    }
  }

  // The plugin's manifests describe this package, not a consumer's repo.
  const leaked = ['.claude-plugin', path.join('.claude', '.claude-plugin'), path.join('.claude', 'skills', '.claude-plugin')]
    .filter(p => fs.existsSync(path.join(tmpDir, p)));
  if (leaked.length > 0) {
    fail(`install — plugin manifests copied into the target: ${leaked.join(', ')}`);
  } else {
    pass('install — no plugin manifests copied into the target');
  }
} catch (e) {
  fail(`install command failed: ${e.message}`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// --- Summary ---

console.log(`\n${errors === 0 ? 'All checks passed.' : `${errors} error(s) found.`}\n`);
process.exit(errors === 0 ? 0 : 1);
