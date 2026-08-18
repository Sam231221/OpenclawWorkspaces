#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || '/home/sam/.openclaw';
const AGENTS_DIR = path.join(OPENCLAW_HOME, 'agents');
const ARCHIVE_ROOT = path.join(OPENCLAW_HOME, 'archives/sessions');
const DEFAULT_DAYS = 30;
const DEFAULT_ARCHIVE_RETENTION_DAYS = 180;
const PROTECTED_NAMES = new Set(['sessions.json', '.usage-cost-cache.json']);

const args = parseArgs(process.argv.slice(2));
const apply = Boolean(args.apply);
const days = positiveInt(args.days, DEFAULT_DAYS);
const archiveRetentionDays = positiveInt(
  args['archive-retention-days'],
  DEFAULT_ARCHIVE_RETENTION_DAYS,
);
const pruneArchives = Boolean(args['prune-archives']);
const now = new Date();
const cutoffMs = now.getTime() - days * 24 * 60 * 60 * 1000;

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  if (!fs.existsSync(AGENTS_DIR)) {
    throw new Error(`Agents directory not found: ${AGENTS_DIR}`);
  }

  const sessionDirs = findSessionDirs(AGENTS_DIR);
  const candidates = [];
  const protectedFiles = [];

  for (const sessionDir of sessionDirs) {
    const activePaths = readActiveSessionPaths(sessionDir);
    for (const filePath of walkFiles(sessionDir)) {
      const decision = classifyFile(filePath, sessionDir, activePaths);
      if (decision.protect) {
        protectedFiles.push({ path: filePath, reason: decision.reason });
        continue;
      }
      if (decision.archive) {
        candidates.push(filePath);
      }
    }
  }

  const archiveGroups = groupByMonth(candidates);
  const plannedArchives = [...archiveGroups.entries()].map(([month, files]) => ({
    month,
    files,
    archivePath: makeArchivePath(month),
  }));

  printPlan({
    sessionDirs,
    candidates,
    protectedFiles,
    plannedArchives,
  });

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to archive and delete old raw session files.');
    return;
  }

  for (const archive of plannedArchives) {
    await createArchive(archive.archivePath, archive.files);
    assertArchiveLooksValid(archive.archivePath);
    for (const filePath of archive.files) {
      fs.unlinkSync(filePath);
    }
    console.log(
      `Archived and removed ${archive.files.length} files: ${archive.archivePath}`,
    );
  }

  if (pruneArchives) {
    const removed = pruneOldArchives(archiveRetentionDays);
    console.log(`Pruned ${removed.length} session archives older than ${archiveRetentionDays} days.`);
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') {
      parsed.apply = true;
    } else if (arg === '--prune-archives') {
      parsed['prune-archives'] = true;
    } else if (arg.startsWith('--days=')) {
      parsed.days = arg.slice('--days='.length);
    } else if (arg === '--days') {
      parsed.days = argv[++index];
    } else if (arg.startsWith('--archive-retention-days=')) {
      parsed['archive-retention-days'] = arg.slice('--archive-retention-days='.length);
    } else if (arg === '--archive-retention-days') {
      parsed['archive-retention-days'] = argv[++index];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function positiveInt(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, got: ${value}`);
  }
  return parsed;
}

function findSessionDirs(rootDir) {
  const dirs = [];
  for (const agentName of fs.readdirSync(rootDir)) {
    const sessionsDir = path.join(rootDir, agentName, 'sessions');
    if (isDirectory(sessionsDir)) {
      dirs.push(sessionsDir);
    }
  }
  return dirs.sort();
}

function readActiveSessionPaths(sessionDir) {
  const active = new Set();
  const indexPath = path.join(sessionDir, 'sessions.json');
  if (!fs.existsSync(indexPath)) return active;

  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    for (const entry of Object.values(parsed)) {
      if (!entry || typeof entry !== 'object') continue;
      if (typeof entry.sessionFile === 'string') {
        active.add(path.resolve(entry.sessionFile));
      }
      if (typeof entry.sessionId === 'string') {
        active.add(path.resolve(path.join(sessionDir, `${entry.sessionId}.jsonl`)));
        active.add(path.resolve(path.join(sessionDir, `${entry.sessionId}.trajectory.jsonl`)));
        active.add(path.resolve(path.join(sessionDir, `${entry.sessionId}.trajectory-path.json`)));
      }
    }
  } catch (error) {
    console.warn(`WARN: could not parse ${indexPath}: ${error.message}`);
  }

  return active;
}

function* walkFiles(rootDir) {
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'skills-prompts') continue;
      yield* walkFiles(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

function classifyFile(filePath, sessionDir, activePaths) {
  const base = path.basename(filePath);
  const resolved = path.resolve(filePath);
  if (PROTECTED_NAMES.has(base)) {
    return { protect: true, reason: 'protected metadata/cache file' };
  }
  if (activePaths.has(resolved)) {
    return { protect: true, reason: 'active session referenced by sessions.json' };
  }

  const stat = fs.statSync(filePath);
  if (stat.mtimeMs >= cutoffMs) {
    return { protect: true, reason: `newer than ${days} days` };
  }

  const relative = path.relative(sessionDir, filePath);
  if (relative.startsWith('..')) {
    return { protect: true, reason: 'outside session directory' };
  }

  const archiveable =
    base.endsWith('.jsonl') ||
    base.includes('.jsonl.') ||
    base.endsWith('.trajectory.jsonl') ||
    base.endsWith('.trajectory-path.json') ||
    base.includes('.reset.') ||
    base.includes('.deleted.') ||
    base.endsWith('.migrated');

  if (!archiveable) {
    return { protect: true, reason: 'not a recognized session history file' };
  }

  return { archive: true };
}

function groupByMonth(files) {
  const groups = new Map();
  for (const filePath of files.sort()) {
    const stat = fs.statSync(filePath);
    const date = new Date(stat.mtimeMs);
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const group = groups.get(month) || [];
    group.push(filePath);
    groups.set(month, group);
  }
  return groups;
}

function makeArchivePath(month) {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const archiveDir = path.join(ARCHIVE_ROOT, month);
  const ext = hasCommand('zstd') ? 'tar.zst' : 'tar.gz';
  return path.join(archiveDir, `openclaw-sessions-${month}-${stamp}.${ext}`);
}

async function createArchive(archivePath, files) {
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  const relativeFiles = files.map((filePath) => path.relative('/', filePath));
  const compressionArgs = archivePath.endsWith('.tar.zst')
    ? ['--zstd']
    : ['--gzip'];
  const argsForTar = [
    '--create',
    ...compressionArgs,
    '--file',
    archivePath,
    '--null',
    '--files-from',
    '-',
  ];
  await runWithInput('tar', argsForTar, `${relativeFiles.join('\0')}\0`, '/');
}

function assertArchiveLooksValid(archivePath) {
  const stat = fs.statSync(archivePath);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`Archive was not created correctly: ${archivePath}`);
  }
}

function pruneOldArchives(retentionDays) {
  if (!fs.existsSync(ARCHIVE_ROOT)) return [];
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const removed = [];
  for (const filePath of walkFiles(ARCHIVE_ROOT)) {
    if (!filePath.endsWith('.tar.zst') && !filePath.endsWith('.tar.gz')) continue;
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs >= cutoff) continue;
    fs.unlinkSync(filePath);
    removed.push(filePath);
  }
  return removed;
}

function printPlan({ sessionDirs, candidates, protectedFiles, plannedArchives }) {
  console.log(`OpenClaw session cleanup (${apply ? 'apply' : 'dry-run'})`);
  console.log(`Session dirs scanned: ${sessionDirs.length}`);
  console.log(`Retention: ${days} days`);
  console.log(`Archive root: ${ARCHIVE_ROOT}`);
  console.log(`Files to archive/delete: ${candidates.length}`);
  console.log(`Protected/skipped files: ${protectedFiles.length}`);

  if (plannedArchives.length > 0) {
    console.log('\nPlanned archives:');
    for (const archive of plannedArchives) {
      console.log(`- ${archive.month}: ${archive.files.length} files -> ${archive.archivePath}`);
    }
  }

  const byAgent = new Map();
  for (const filePath of candidates) {
    const match = filePath.match(/\/agents\/([^/]+)\/sessions\//);
    const agent = match?.[1] || 'unknown';
    byAgent.set(agent, (byAgent.get(agent) || 0) + 1);
  }
  if (byAgent.size > 0) {
    console.log('\nFiles by agent:');
    for (const [agent, count] of [...byAgent.entries()].sort()) {
      console.log(`- ${agent}: ${count}`);
    }
  }
}

function hasCommand(command) {
  const pathEntries = (process.env.PATH || '').split(path.delimiter);
  return pathEntries.some((entry) => fs.existsSync(path.join(entry, command)));
}

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function runWithInput(command, argsForCommand, input, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argsForCommand, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (status) => {
      if (status === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited ${status}: ${stderr.trim()}`));
      }
    });
    child.stdin.end(input);
  });
}
