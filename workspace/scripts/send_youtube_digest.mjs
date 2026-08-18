#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const WORKSPACE = '/home/sam/.openclaw/workspace';
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || '/home/sam/.npm-global/bin/openclaw';
const DEFAULT_TARGET = process.env.YOUTUBE_DIGEST_TELEGRAM_TARGET || '8692887396';
const DEFAULT_AUDIT_PATH = path.join(WORKSPACE, 'state/youtube_digest_runs.jsonl');
const DEFAULT_STATE_PATH = path.join(WORKSPACE, 'state/youtube_linkedin_workflow.json');
const LOCK_PATH = path.join(WORKSPACE, 'state/.youtube_digest_send.lock');
const TEMP_STATE_DIR = path.join(WORKSPACE, 'state/.youtube_digest_tmp');
const UNDELIVERED_DIR = path.join(WORKSPACE, 'state/youtube_digest_undelivered');
const MAX_TELEGRAM_CHUNK = 4096;
const TELEGRAM_HTML_DELIVERY = {
  parseMode: 'HTML',
  disable_web_page_preview: true,
  link_preview_options: { is_disabled: true },
};
const DEFAULT_SEND_ATTEMPTS = Number.parseInt(
  process.env.YOUTUBE_DIGEST_SEND_ATTEMPTS || '1',
  10,
);
const GATEWAY_DELIVERY_ERROR_PATTERNS = [
  /scope upgrade pending approval/i,
  /pairing required/i,
  /gateway timeout/i,
  /GatewayTransportError/i,
];

function parseArgs(argv) {
  const args = {
    dryRun: false,
    skipSend: false,
    target: DEFAULT_TARGET,
    auditPath: DEFAULT_AUDIT_PATH,
    statePath: DEFAULT_STATE_PATH,
    digestArgs: ['--delivery-mode', 'direct_telegram_cli'],
    resendLatest: false,
    resendRunId: null,
    forceStateCommit: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--dry-run') {
      args.dryRun = true;
      args.digestArgs.push('--dry-run');
      continue;
    }
    if (key === '--skip-send') {
      args.skipSend = true;
      continue;
    }
    if (key === '--resend-latest') {
      args.resendLatest = true;
      continue;
    }
    if (key === '--resend-run-id' && value) {
      args.resendRunId = value;
      i += 1;
      continue;
    }
    if (key === '--force-state-commit') {
      args.forceStateCommit = true;
      continue;
    }
    if (key === '--target' && value) {
      args.target = value;
      i += 1;
      continue;
    }
    if (key === '--audit' && value) {
      args.auditPath = value;
      i += 1;
      continue;
    }
    if (key === '--state' && value) {
      args.statePath = value;
      i += 1;
      continue;
    }

    args.digestArgs.push(key);
    if (value && !value.startsWith('--')) {
      args.digestArgs.push(value);
      i += 1;
    }
  }

  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || WORKSPACE,
      env: {
        ...process.env,
        PATH: `/home/sam/.npm-global/bin:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      resolve({ status: null, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on('close', (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

function acquireLock() {
  fs.mkdirSync(path.dirname(LOCK_PATH), { recursive: true });
  try {
    const stat = fs.statSync(LOCK_PATH);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs > 2 * 60 * 60 * 1000) fs.rmSync(LOCK_PATH, { force: true });
  } catch {
    // Missing lock is the normal path.
  }

  try {
    const fd = fs.openSync(LOCK_PATH, 'wx');
    fs.writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`);
    fs.closeSync(fd);
    return true;
  } catch {
    return false;
  }
}

function releaseLock() {
  fs.rmSync(LOCK_PATH, { force: true });
}

function appendAudit(auditPath, record) {
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.appendFileSync(auditPath, `${JSON.stringify(record)}\n`);
}

function safeRunToken(runId) {
  return runId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function prepareTempState(statePath, runId) {
  fs.mkdirSync(TEMP_STATE_DIR, { recursive: true });
  const tempPath = path.join(TEMP_STATE_DIR, `${safeRunToken(runId)}.json`);
  fs.copyFileSync(statePath, tempPath);
  return tempPath;
}

function commitTempState(tempPath, statePath) {
  fs.renameSync(tempPath, statePath);
}

function writeUndeliveredDigest({ runId, message, tempStatePath, error }) {
  fs.mkdirSync(UNDELIVERED_DIR, { recursive: true });
  const token = safeRunToken(runId);
  const messagePath = path.join(UNDELIVERED_DIR, `${token}.txt`);
  const statePath = path.join(UNDELIVERED_DIR, `${token}.state.json`);
  const metaPath = path.join(UNDELIVERED_DIR, `${token}.json`);

  fs.writeFileSync(messagePath, String(message || '').trimEnd() + '\n');
  if (tempStatePath && fs.existsSync(tempStatePath)) fs.copyFileSync(tempStatePath, statePath);
  fs.writeFileSync(
    metaPath,
    `${JSON.stringify(
      {
        run_id: runId,
        created_at: new Date().toISOString(),
        reason: error instanceof Error ? error.message : String(error),
        message_path: messagePath,
        candidate_state_path: fs.existsSync(statePath) ? statePath : null,
        candidate_state_sha256: fs.existsSync(statePath) ? hashFile(statePath) : null,
      },
      null,
      2,
    )}\n`,
  );

  return { message_path: messagePath, candidate_state_path: fs.existsSync(statePath) ? statePath : null };
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function parseJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function listUndeliveredMeta() {
  try {
    return fs
      .readdirSync(UNDELIVERED_DIR)
      .filter((name) => name.endsWith('.json') && !name.endsWith('.state.json'))
      .map((name) => {
        const filePath = path.join(UNDELIVERED_DIR, name);
        return { filePath, stat: fs.statSync(filePath), meta: parseJsonFile(filePath) };
      })
      .filter((entry) => entry.meta?.message_path)
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  } catch {
    return [];
  }
}

function resolveUndelivered({ runId }) {
  const entries = listUndeliveredMeta();
  const entry = runId
    ? entries.find((candidate) => candidate.meta?.run_id === runId)
    : entries[0];
  if (!entry) {
    throw new Error(runId ? `No undelivered digest found for run ${runId}` : 'No undelivered digest found');
  }

  const messagePath = entry.meta.message_path;
  const candidateStatePath = entry.meta.candidate_state_path;
  if (!fs.existsSync(messagePath)) throw new Error(`Undelivered message file missing: ${messagePath}`);
  if (candidateStatePath && !fs.existsSync(candidateStatePath)) {
    throw new Error(`Undelivered candidate state file missing: ${candidateStatePath}`);
  }

  return {
    metaPath: entry.filePath,
    runId: entry.meta.run_id || path.basename(messagePath, '.txt'),
    messagePath,
    candidateStatePath,
    candidateStateSha256: entry.meta.candidate_state_sha256 || null,
    message: fs.readFileSync(messagePath, 'utf8'),
  };
}

function markUndeliveredResolved({ metaPath, runId, stateCommit, sendResults }) {
  const meta = parseJsonFile(metaPath) || {};
  meta.resolved_at = new Date().toISOString();
  meta.resolved_by_run_id = runId;
  meta.resolved_state_commit = stateCommit;
  meta.resend_message_ids = (sendResults || [])
    .map((result) => parseJsonFileFromText(result.stdout)?.messageId || parseJsonFileFromText(result.stdout)?.payload?.messageId)
    .filter(Boolean);
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
}

function parseJsonFileFromText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function truncate(text, limit = 1800) {
  const value = String(text || '').trim();
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 20)}\n... truncated ...`;
}

function withPartLabel(chunk, index, total) {
  if (total === 1) return chunk;
  return `Part ${index + 1} of ${total}\n\n${chunk}`;
}

function splitByChannelBoundary(section) {
  const lines = section.split('\n');
  const blocks = [];
  let current = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const isChannelHeading =
      /^<b>[^<]+<\/b>$/.test(line) &&
      lines[index - 1] === '' &&
      lines[index + 1] === '' &&
      /^\d+\. <b>/.test(lines[index + 2] || '');

    if (isChannelHeading && current.join('\n').trim()) {
      blocks.push(current.join('\n').trim());
      current = [];
    }
    current.push(line);
  }

  if (current.join('\n').trim()) blocks.push(current.join('\n').trim());
  return blocks.length > 0 ? blocks : [section];
}

function deliveryError(result) {
  if (!result) return 'Telegram send did not return a result';
  const output = `${result.stderr || ''}\n${result.stdout || ''}`;
  if (result.status !== 0) return truncate(result.stderr || result.stdout);
  const gatewayWarning = GATEWAY_DELIVERY_ERROR_PATTERNS.find((pattern) => pattern.test(output));
  if (!gatewayWarning) return '';
  return truncate(result.stderr || result.stdout);
}

function chunkMessage(message) {
  const text = String(message || '').trim();
  if (text.length <= MAX_TELEGRAM_CHUNK) return [text || '(empty digest)'];

  const sections = text
    .split(/\n\n(?=━━━━━━━━━━━━━━)/)
    .flatMap((section) =>
      section.length > MAX_TELEGRAM_CHUNK - 32 ? splitByChannelBoundary(section) : [section],
    );
  const chunks = [];
  let current = '';
  for (const section of sections) {
    const next = current ? `${current}\n\n${section}` : section;
    if (next.length <= MAX_TELEGRAM_CHUNK - 32) {
      current = next;
      continue;
    }
    if (current) chunks.push(current);
    current = section;
  }
  if (current) chunks.push(current);

  if (chunks.every((chunk) => chunk.length <= MAX_TELEGRAM_CHUNK - 32)) {
    return chunks.map((chunk, index) => withPartLabel(chunk, index, chunks.length));
  }

  const fallbackChunks = [];
  let fallbackCurrent = '';
  for (const line of text.split('\n')) {
    const next = fallbackCurrent ? `${fallbackCurrent}\n${line}` : line;
    if (next.length > MAX_TELEGRAM_CHUNK - 32) {
      if (fallbackCurrent) fallbackChunks.push(fallbackCurrent);
      fallbackCurrent = line;
      while (fallbackCurrent.length > MAX_TELEGRAM_CHUNK - 32) {
        fallbackChunks.push(fallbackCurrent.slice(0, MAX_TELEGRAM_CHUNK - 32));
        fallbackCurrent = fallbackCurrent.slice(MAX_TELEGRAM_CHUNK - 32);
      }
    } else {
      fallbackCurrent = next;
    }
  }
  if (fallbackCurrent) fallbackChunks.push(fallbackCurrent);
  return fallbackChunks.map((chunk, index) => withPartLabel(chunk, index, fallbackChunks.length));
}

async function sendTelegramMessage({ target, message, dryRun, attempts = DEFAULT_SEND_ATTEMPTS }) {
  const chunks = chunkMessage(message);
  const results = [];
  const maxAttempts = Number.isFinite(attempts) && attempts > 0 ? attempts : 1;

  for (const chunk of chunks) {
    let lastResult = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const cliArgs = [
        'message',
        'send',
        '--channel',
        'telegram',
        '--target',
        target,
        '--message',
        chunk,
        '--delivery',
        JSON.stringify(TELEGRAM_HTML_DELIVERY),
        '--json',
      ];
      if (dryRun) cliArgs.push('--dry-run');
      lastResult = await runCommand(OPENCLAW_BIN, cliArgs);
      if (!deliveryError(lastResult)) break;
      if (attempt < maxAttempts) await sleep(attempt * 5000);
    }

    const errorDetail = deliveryError(lastResult);
    results.push({
      status: lastResult?.status,
      stdout: truncate(lastResult?.stdout, 1200),
      stderr: truncate(lastResult?.stderr, 1200),
      ok: !errorDetail,
    });

    if (errorDetail) {
      throw new Error(`Telegram send failed: ${errorDetail}`);
    }
  }

  return { chunks: chunks.length, results };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date();
  const timestampToken = startedAt.toISOString().replace(/[-:.Z]/g, '').slice(0, 18);
  const runIdPrefix = args.resendLatest || args.resendRunId ? 'youtube_digest_resend' : 'youtube_digest_send';
  const runId = `${runIdPrefix}_${timestampToken}Z`;
  const statePath = path.resolve(args.statePath);
  let tempStatePath = null;
  let digestMessage = '';
  let failureStage = 'setup';
  const audit = {
    run_id: runId,
    started_at: startedAt.toISOString(),
    finished_at: null,
    status: 'running',
    dry_run: args.dryRun,
    target: args.target,
    digest_args: args.digestArgs,
    state_path: statePath,
    state_commit: args.dryRun || args.skipSend ? 'no_write' : 'pending_post_delivery',
    source_run_id: null,
    resend_message_path: null,
    resend_candidate_state_path: null,
    digest_exit_code: null,
    digest_stdout_chars: 0,
    send_chunks: 0,
    error: null,
  };

  if (!acquireLock()) {
    audit.status = 'skipped_locked';
    audit.finished_at = new Date().toISOString();
    appendAudit(args.auditPath, audit);
    console.log('YouTube digest skipped because another send run is active.');
    return;
  }

  try {
    if (args.resendLatest || args.resendRunId) {
      failureStage = 'resend_lookup';
      const undelivered = resolveUndelivered({ runId: args.resendRunId });
      audit.source_run_id = undelivered.runId;
      audit.resend_message_path = undelivered.messagePath;
      audit.resend_candidate_state_path = undelivered.candidateStatePath;
      digestMessage = undelivered.message;
      audit.digest_stdout_chars = digestMessage.length;

      if (!args.skipSend) {
        failureStage = 'resend_send';
        const sendResult = await sendTelegramMessage({
          target: args.target,
          message: digestMessage,
          dryRun: args.dryRun,
        });
        audit.send_chunks = sendResult.chunks;
        audit.send_results = sendResult.results;
      }

      if (!args.dryRun && !args.skipSend && undelivered.candidateStatePath) {
        failureStage = 'resend_commit';
        const currentStateHash = hashFile(statePath);
        const candidateStateHash = hashFile(undelivered.candidateStatePath);
        const candidateHashMatchesMeta =
          !undelivered.candidateStateSha256 || undelivered.candidateStateSha256 === candidateStateHash;
        if (!candidateHashMatchesMeta) {
          throw new Error('Refusing to commit undelivered state because its checksum changed');
        }

        if (args.forceStateCommit || fs.statSync(statePath).mtimeMs <= fs.statSync(undelivered.candidateStatePath).mtimeMs) {
          fs.copyFileSync(undelivered.candidateStatePath, statePath);
          audit.state_commit = args.forceStateCommit
            ? 'forced_committed_after_resend'
            : 'committed_after_resend';
        } else {
          audit.state_commit = 'not_committed_current_state_newer';
          audit.current_state_sha256 = currentStateHash;
          audit.candidate_state_sha256 = candidateStateHash;
        }
      }

      if (!args.dryRun && !args.skipSend) {
        markUndeliveredResolved({
          metaPath: undelivered.metaPath,
          runId,
          stateCommit: audit.state_commit,
          sendResults: audit.send_results,
        });
      }

      audit.status = args.dryRun ? 'resend_dry_run_ok' : args.skipSend ? 'resend_skipped_send_no_write' : 'resent';
      console.log(digestMessage.trim());
      return;
    }

    if (!args.dryRun) tempStatePath = prepareTempState(statePath, runId);
    const digestStatePath = tempStatePath || statePath;
    failureStage = 'digest';
    const digest = await runCommand('npm', [
      '--silent',
      'run',
      'youtube:digest',
      '--',
      '--state',
      digestStatePath,
      ...args.digestArgs,
    ]);
    audit.digest_exit_code = digest.status;
    audit.digest_stdout_chars = digest.stdout.length;
    digestMessage = digest.stdout;
    if (digest.status !== 0) {
      throw new Error(`Digest command failed: ${truncate(digest.stderr || digest.stdout)}`);
    }

    if (!args.skipSend) {
      failureStage = 'send';
      const sendResult = await sendTelegramMessage({
        target: args.target,
        message: digestMessage,
        dryRun: args.dryRun,
      });
      audit.send_chunks = sendResult.chunks;
      audit.send_results = sendResult.results;
    }

    if (tempStatePath && !args.skipSend) {
      failureStage = 'commit';
      commitTempState(tempStatePath, statePath);
      tempStatePath = null;
      audit.state_commit = 'committed_after_delivery';
    }

    audit.status = args.dryRun ? 'dry_run_ok' : args.skipSend ? 'skipped_send_no_write' : 'sent';
    console.log(digestMessage.trim());
  } catch (error) {
    audit.status = 'error';
    audit.error = error instanceof Error ? error.message : String(error);
    audit.failure_stage = failureStage;
    if (failureStage === 'send' && digestMessage) {
      audit.undelivered = writeUndeliveredDigest({
        runId,
        message: digestMessage,
        tempStatePath,
        error,
      });
      audit.state_commit = 'not_committed_delivery_failed';
    }
    const failureMessage = [
      'YouTube daily watchlist failed',
      '',
      `Run ID: ${runId}`,
      `Time: ${new Date().toISOString()}`,
      `Stage: ${failureStage}`,
      `Reason: ${truncate(audit.error, 1200)}`,
      audit.undelivered?.message_path
        ? `Undelivered digest saved at: ${audit.undelivered.message_path}`
        : null,
      '',
      'Next check: run npm --silent run youtube:digest:health',
    ]
      .filter(Boolean)
      .join('\n');

    if (!args.skipSend && !args.dryRun && failureStage !== 'send') {
      try {
        const sendResult = await sendTelegramMessage({
          target: args.target,
          message: failureMessage,
          dryRun: false,
          attempts: 1,
        });
        audit.failure_alert = { status: 'sent', chunks: sendResult.chunks };
      } catch (sendError) {
        audit.failure_alert = {
          status: 'error',
          error: sendError instanceof Error ? sendError.message : String(sendError),
        };
      }
    }

    console.error(failureMessage);
    process.exitCode = 1;
  } finally {
    audit.finished_at = new Date().toISOString();
    appendAudit(args.auditPath, audit);
    if (tempStatePath && fs.existsSync(tempStatePath)) fs.rmSync(tempStatePath, { force: true });
    releaseLock();
  }
}

main();
