#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SKILL_PREFIX = 'defprod-';
const SKILLS_SRC = path.join(__dirname, '..', 'skills');
const CONTRIB_SRC = path.join(__dirname, '..', 'contrib');
const CONFIG_FILE = '.defprod/defprod.json';

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

function copySkill(skillName, destDir) {
  const src = path.join(SKILLS_SRC, skillName);
  const dest = path.join(destDir, skillName);
  fs.mkdirSync(dest, { recursive: true });

  const files = fs.readdirSync(src);
  for (const file of files) {
    fs.copyFileSync(path.join(src, file), path.join(dest, file));
  }
  return files.length;
}

function filesMatch(a, b) {
  if (!fs.existsSync(a) || !fs.existsSync(b)) return false;
  return fs.readFileSync(a, 'utf8') === fs.readFileSync(b, 'utf8');
}

function install(targetDir, contribNames, args) {
  const skillsDir = resolveSkillsDir(targetDir, args);
  fs.mkdirSync(skillsDir, { recursive: true });

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
      const count = copySkill(skill, skillsDir);
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
        const src = path.join(CONTRIB_SRC, name);
        const destSkill = path.join(skillsDir, name);
        fs.mkdirSync(destSkill, { recursive: true });
        const files = fs.readdirSync(src);
        for (const file of files) {
          fs.copyFileSync(path.join(src, file), path.join(destSkill, file));
        }
        console.log(`  init  ${name}/ (${files.length} file${files.length !== 1 ? 's' : ''})`);
        installed++;
      }
    }
  }

  console.log(`\nInstalled ${installed} skill${installed !== 1 ? 's' : ''}${skipped ? `, skipped ${skipped}` : ''}.`);

  // Offer to scaffold .defprod/defprod.json
  const configPath = path.join(targetDir, CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    console.log(`\nTip: Create ${CONFIG_FILE} to configure project-specific paths.`);
    console.log('Skills work without it (they discover paths automatically), but config gives faster, more deterministic results.');
    console.log('See README for the full config reference.');
  }

  console.log('\nDone. Skills are ready to use.');
}

function updateSkillSet(label, srcDir, skillsDir, skills, stats) {
  if (skills.length === 0) return;

  console.log(`${label}:`);
  for (const skill of skills) {
    const src = path.join(srcDir, skill);
    const dest = path.join(skillsDir, skill);

    if (!fs.existsSync(dest)) {
      // Only auto-add official skills; community skills need explicit --contrib
      if (srcDir === SKILLS_SRC) {
        copySkill(skill, skillsDir);
        const count = fs.readdirSync(src).length;
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

      if (!fs.existsSync(destFile)) {
        fs.copyFileSync(srcFile, destFile);
        skillUpdated = true;
      } else if (filesMatch(srcFile, destFile)) {
        // Unchanged
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

  const stats = { updated: 0, unchanged: 0, added: 0, modified: [] };

  // Update official skills
  updateSkillSet('Official skills', SKILLS_SRC, skillsDir, discoverSkills(), stats);

  // Update installed community skills (only those already present)
  const contribSkills = discoverContribSkills();
  const installedContrib = contribSkills.filter(name =>
    fs.existsSync(path.join(skillsDir, name))
  );
  if (installedContrib.length > 0) {
    console.log('');
    updateSkillSet('Community skills', CONTRIB_SRC, skillsDir, installedContrib, stats);
  }

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
