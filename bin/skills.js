#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SKILL_PREFIX = 'defprod-';
const SKILLS_SRC = path.join(__dirname, '..', 'skills');
const CONTRIB_SRC = path.join(__dirname, '..', 'contrib');
const SHIPPED_MANIFEST = path.join(__dirname, '..', 'known-shipped.json');
const CONFIG_FILE = '.defprod/defprod.json';
const LOCK_FILE = '.defprod/skills.lock.json';

function usage() {
  console.log(`
  @defprod/skills — Agent skills for DefProd

  Usage:
    npx @defprod/skills install [target-dir]   Copy official skills into .claude/skills/defprod-*/
    npx @defprod/skills update  [target-dir]   Update skills, preserving local modifications

  Options:
    --skills-dir <path>  Install skills to a custom directory instead of .claude/skills/
    --contrib <name>     Also install a community skill from contrib/ (repeatable)
    --help               Show this help message

  Target directory defaults to the current working directory.

  The install directory is resolved in order: --skills-dir flag, skillsDir in
  .defprod/defprod.json, then the default (.claude/skills/).

  Examples:
    npx @defprod/skills install
    npx @defprod/skills install --skills-dir .cursor/skills
    npx @defprod/skills install --contrib defprod-django-tests
  `);
}

function getTargetDir(args) {
  // Filter out named args and their values
  const filtered = [];
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--contrib' || args[i] === '--skills-dir') && i + 1 < args.length) {
      i++; // skip the value
    } else if (!args[i].startsWith('-')) {
      filtered.push(args[i]);
    }
  }
  return filtered[1] || process.cwd();
}

function getNamedArg(args, flag) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && i + 1 < args.length) {
      return args[i + 1];
    }
  }
  return null;
}

function getContribNames(args) {
  const names = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--contrib' && i + 1 < args.length) {
      names.push(args[i + 1]);
      i++;
    }
  }
  return names;
}

function resolveSkillsDir(targetDir, args) {
  // 1. CLI argument
  const cliDir = getNamedArg(args, '--skills-dir');
  if (cliDir) {
    return path.isAbsolute(cliDir) ? cliDir : path.join(targetDir, cliDir);
  }

  // 2. .defprod/defprod.json config
  const configPath = path.join(targetDir, CONFIG_FILE);
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.skillsDir) {
        return path.isAbsolute(config.skillsDir)
          ? config.skillsDir
          : path.join(targetDir, config.skillsDir);
      }
    } catch (_) {
      // Invalid JSON — fall through to default
    }
  }

  // 3. Default
  return path.join(targetDir, '.claude', 'skills');
}

function discoverContribSkills() {
  if (!fs.existsSync(CONTRIB_SRC)) return [];
  return fs.readdirSync(CONTRIB_SRC).filter(name =>
    name.startsWith(SKILL_PREFIX) && fs.statSync(path.join(CONTRIB_SRC, name)).isDirectory()
  );
}

function listContrib() {
  const skills = discoverContribSkills();
  if (skills.length === 0) {
    console.log('No community skills available yet.');
    return;
  }
  console.log('Available community skills:\n');
  for (const skill of skills) {
    const skillFile = path.join(CONTRIB_SRC, skill, 'SKILL.md');
    let desc = '';
    if (fs.existsSync(skillFile)) {
      const content = fs.readFileSync(skillFile, 'utf8');
      const match = content.match(/^description:\s*(.+)$/m);
      if (match) desc = match[1].trim();
    }
    console.log(`  ${skill}${desc ? ` — ${desc}` : ''}`);
  }
  console.log(`\nInstall with: npx @defprod/skills install --contrib <name>`);
}

function discoverSkills() {
  return fs.readdirSync(SKILLS_SRC).filter(name =>
    name.startsWith(SKILL_PREFIX) && fs.statSync(path.join(SKILLS_SRC, name)).isDirectory()
  );
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function copySkillFrom(srcDir, skillName, destDir, lock) {
  const src = path.join(srcDir, skillName);
  const dest = path.join(destDir, skillName);
  fs.mkdirSync(dest, { recursive: true });

  const files = fs.readdirSync(src);
  for (const file of files) {
    const srcFile = path.join(src, file);
    const destFile = path.join(dest, file);
    fs.copyFileSync(srcFile, destFile);
    recordLock(lock, skillName, file, sha256File(srcFile));
  }
  return files.length;
}

function copySkill(skillName, destDir, lock) {
  return copySkillFrom(SKILLS_SRC, skillName, destDir, lock);
}

function loadShippedManifest() {
  try {
    return JSON.parse(fs.readFileSync(SHIPPED_MANIFEST, 'utf8'));
  } catch (_) {
    return {};
  }
}

function loadLock(targetDir) {
  const lockPath = path.join(targetDir, LOCK_FILE);
  if (!fs.existsSync(lockPath)) return { version: 1, skills: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || !parsed.skills) {
      return { version: 1, skills: {} };
    }
    return parsed;
  } catch (_) {
    return { version: 1, skills: {} };
  }
}

function saveLock(targetDir, lock) {
  const lockPath = path.join(targetDir, LOCK_FILE);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
}

function recordLock(lock, skill, file, hash) {
  if (!lock.skills[skill]) lock.skills[skill] = {};
  lock.skills[skill][file] = hash;
}

function isPristine(destHash, skill, file, lock, shipped) {
  const lockHash = lock.skills[skill] && lock.skills[skill][file];
  if (lockHash && destHash === lockHash) return true;
  const shippedHashes = shipped[`${skill}/${file}`];
  return Array.isArray(shippedHashes) && shippedHashes.includes(destHash);
}

function install(targetDir, contribNames, args) {
  const skillsDir = resolveSkillsDir(targetDir, args);
  fs.mkdirSync(skillsDir, { recursive: true });

  const lock = loadLock(targetDir);

  // Install official skills
  const skills = discoverSkills();
  if (skills.length === 0) {
    console.log('No skills found in package. This is a bug — please report it.');
    process.exit(1);
  }

  let installed = 0;
  let skipped = 0;

  console.log('Official skills:');
  for (const skill of skills) {
    const dest = path.join(skillsDir, skill);
    if (fs.existsSync(dest)) {
      console.log(`  skip  ${skill}/ (already installed — use 'update' to refresh)`);
      skipped++;
    } else {
      const count = copySkill(skill, skillsDir, lock);
      console.log(`  init  ${skill}/ (${count} file${count !== 1 ? 's' : ''})`);
      installed++;
    }
  }

  // Install requested community skills
  if (contribNames.length > 0) {
    console.log('\nCommunity skills:');
    const available = discoverContribSkills();

    for (const name of contribNames) {
      if (!available.includes(name)) {
        console.log(`  FAIL  ${name}/ (not found in contrib/)`);
        continue;
      }
      const dest = path.join(skillsDir, name);
      if (fs.existsSync(dest)) {
        console.log(`  skip  ${name}/ (already installed — use 'update' to refresh)`);
        skipped++;
      } else {
        const count = copySkillFrom(CONTRIB_SRC, name, skillsDir, lock);
        console.log(`  init  ${name}/ (${count} file${count !== 1 ? 's' : ''})`);
        installed++;
      }
    }
  }

  saveLock(targetDir, lock);

  console.log(`\nDone. ${installed} skill${installed !== 1 ? 's' : ''} installed${skipped ? `, ${skipped} skipped` : ''}.`);
  console.log('\nGet started:');
  console.log('  1. Run /defprod-onboard-repo to scan your codebase and propose products');
  console.log('  2. Run /defprod-onboard-product <name> for each product to build the full definition');
  console.log('  3. Use /defprod-implement-feature and /defprod-fix-bug for story-aligned development');
  console.log('\nFull guide: https://github.com/defprod1/defprod-skills#getting-started');
}

function updateSkillSet(label, srcDir, skillsDir, skills, stats, lock, shipped) {
  if (skills.length === 0) return;

  console.log(`${label}:`);
  for (const skill of skills) {
    const src = path.join(srcDir, skill);
    const dest = path.join(skillsDir, skill);

    if (!fs.existsSync(dest)) {
      // Only auto-add official skills; community skills need explicit --contrib
      if (srcDir === SKILLS_SRC) {
        const count = copySkillFrom(srcDir, skill, skillsDir, lock);
        console.log(`  add   ${skill}/ (${count} file${count !== 1 ? 's' : ''})`);
        stats.added++;
      }
      continue;
    }

    const srcFiles = fs.readdirSync(src);
    let skillUpdated = false;

    for (const file of srcFiles) {
      const srcFile = path.join(src, file);
      const destFile = path.join(dest, file);
      const srcHash = sha256File(srcFile);

      if (!fs.existsSync(destFile)) {
        fs.copyFileSync(srcFile, destFile);
        recordLock(lock, skill, file, srcHash);
        skillUpdated = true;
        continue;
      }

      const destHash = sha256File(destFile);

      if (destHash === srcHash) {
        // Already at latest. Backfill the lock for pre-1.2.3 installs.
        recordLock(lock, skill, file, srcHash);
        continue;
      }

      if (isPristine(destHash, skill, file, lock, shipped)) {
        fs.copyFileSync(srcFile, destFile);
        recordLock(lock, skill, file, srcHash);
        skillUpdated = true;
      } else {
        stats.modified.push(`${skill}/${file}`);
      }
    }

    if (skillUpdated) {
      console.log(`  upd   ${skill}/`);
      stats.updated++;
    } else {
      console.log(`  ok    ${skill}/`);
      stats.unchanged++;
    }
  }
}

function update(targetDir, args) {
  const skillsDir = resolveSkillsDir(targetDir, args);

  if (!fs.existsSync(skillsDir)) {
    console.log('No .claude/skills/ directory found. Run "install" first.');
    process.exit(1);
  }

  const lock = loadLock(targetDir);
  const shipped = loadShippedManifest();
  const stats = { updated: 0, unchanged: 0, added: 0, modified: [] };

  // Update official skills
  updateSkillSet('Official skills', SKILLS_SRC, skillsDir, discoverSkills(), stats, lock, shipped);

  // Update installed community skills (only those already present)
  const contribSkills = discoverContribSkills();
  const installedContrib = contribSkills.filter(name =>
    fs.existsSync(path.join(skillsDir, name))
  );
  if (installedContrib.length > 0) {
    console.log('');
    updateSkillSet('Community skills', CONTRIB_SRC, skillsDir, installedContrib, stats, lock, shipped);
  }

  saveLock(targetDir, lock);

  console.log(`\nUpdated ${stats.updated}, added ${stats.added}, unchanged ${stats.unchanged}.`);

  if (stats.modified.length > 0) {
    console.log(`\nLocally modified files (not overwritten):`);
    for (const f of stats.modified) {
      console.log(`  ${f}`);
    }
    console.log('\nTo accept the new version, delete the file and run update again.');
  }
}

// --- Main ---

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  usage();
  process.exit(0);
}

const command = args[0];
const targetDir = getTargetDir(args);
const contribNames = getContribNames(args);

switch (command) {
  case 'install':
    install(targetDir, contribNames, args);
    break;
  case 'update':
    update(targetDir, args);
    break;
  case 'contrib':
    listContrib();
    break;
  default:
    console.error(`Unknown command: ${command}\n`);
    usage();
    process.exit(1);
}
