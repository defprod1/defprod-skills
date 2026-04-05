#!/usr/bin/env node

/**
 * Pre-publish verification for @defprod/skills.
 *
 * Checks:
 * 1. SKILL.md frontmatter — valid YAML, required fields present
 * 2. Scaffolding removal — contrib skills must not contain {{placeholders}} or <!-- comments -->
 * 3. MCP tool name cross-reference — every mcp__defprod-mcp__* reference matches a known tool
 * 4. Config key consistency — defprod.json keys mentioned in skills are documented in README
 * 5. Installer smoke test — run install into a temp dir, verify files land correctly
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
  'createArchitectureElement', 'createArea', 'createProduct', 'createUserStory',
  'deleteArchitectureElement', 'deleteArea', 'deleteProduct', 'deleteUserStory',
  'getArchitectureForProduct', 'getArchitectureTree', 'getArea',
  'getBriefForProduct', 'getProduct', 'getUserStory',
  'listAreas', 'listProducts', 'listUserStories',
  'moveArchitectureElement',
  'patchArchitectureElement', 'patchArea', 'patchBrief', 'patchProduct', 'patchUserStory',
];

for (const entry of allSkillEntries) {
  const skillFile = path.join(entry.base, entry.dir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) continue;

  const content = fs.readFileSync(skillFile, 'utf8');
  const mcpRefs = content.match(/mcp__defprod-mcp__(\w+)/g) || [];

  for (const ref of mcpRefs) {
    const toolName = ref.replace('mcp__defprod-mcp__', '');
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
    const keyRefs = content.match(/`(?:products\[\]\.)?(frontendApp|backendApp|e2eDir|compileCheck|name)`/g) || [];
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

// --- 5. Installer smoke test ---

console.log('\n5. Installer smoke test');

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
} catch (e) {
  fail(`install command failed: ${e.message}`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// --- Summary ---

console.log(`\n${errors === 0 ? 'All checks passed.' : `${errors} error(s) found.`}\n`);
process.exit(errors === 0 ? 0 : 1);
