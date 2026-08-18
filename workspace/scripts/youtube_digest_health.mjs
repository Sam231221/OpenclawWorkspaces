#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const WORKSPACE = '/home/sam/.openclaw/workspace';
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || '/home/sam/.npm-global/bin/openclaw';
const LEGACY_CRON_ID = 'fe974333-bc3a-484a-aba3-679aa3102702';
const AUDIT_PATH = path.join(WORKSPACE, 'state/youtube_digest_runs.jsonl');
const UNDELIVERED_DIR = path.join(WORKSPACE, 'state/youtube_digest_undelivered');
const TIMER_NAME = 'openclaw-youtube-linkedin-digest.timer';
const SERVICE_NAME = 'openclaw-youtube-linkedin-digest.service';
const TELEGRAM_TARGET = process.env.YOUTUBE_DIGEST_TELEGRAM_TARGET || '8692887396';
const DELIVERY_ERROR_PATTERNS = [
  /scope upgrade pending approval/i,
  /pairing required/i,
  /gateway timeout/i,
  /GatewayTransportError/i,
];

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: WORKSPACE,
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

function auditRecords() {
  try {
    const lines = fs.readFileSync(AUDIT_PATH, 'utf8').trim().split('\n').filter(Boolean);
    return lines.map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function oneLine(text, limit = 500) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function commandHasDeliveryError(result) {
  const output = `${result?.stderr || ''}\n${result?.stdout || ''}`;
  return DELIVERY_ERROR_PATTERNS.some((pattern) => pattern.test(output));
}

function commandReportsCronNotFound(result) {
  const output = `${result?.stderr || ''}\n${result?.stdout || ''}`;
  return /cron job not found/i.test(output);
}

function latestRealAudit(records) {
  return records.filter((record) => !record.dry_run).at(-1) ?? null;
}

function latestAudit(records) {
  return records.at(-1) ?? null;
}

function latestUndeliveredMeta() {
  try {
    return fs
      .readdirSync(UNDELIVERED_DIR)
      .filter((name) => name.endsWith('.json') && !name.endsWith('.state.json'))
      .map((name) => {
        const filePath = path.join(UNDELIVERED_DIR, name);
        return { filePath, stat: fs.statSync(filePath), data: parseJson(fs.readFileSync(filePath, 'utf8')) };
      })
      .filter((entry) => entry.data?.message_path && !entry.data?.resolved_at)
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)[0]?.data ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const checks = [];
  let failed = false;

  const dryRun = await runCommand('npm', ['--silent', 'run', 'youtube:digest', '--', '--dry-run']);
  checks.push({
    name: 'digest_dry_run',
    ok: dryRun.status === 0,
    detail: dryRun.status === 0 ? `${dryRun.stdout.length} chars` : oneLine(dryRun.stderr || dryRun.stdout),
  });

  const channels = await runCommand(OPENCLAW_BIN, ['channels', 'status', '--json']);
  const channelStatus = parseJson(channels.stdout);
  const telegram = channelStatus?.channelAccounts?.telegram?.find((account) => account.accountId === 'default');
  checks.push({
    name: 'telegram_channel',
    ok: channels.status === 0 && telegram?.running === true && telegram?.connected === true,
    detail:
      channels.status === 0
        ? `running=${telegram?.running === true}, connected=${telegram?.connected === true}`
        : oneLine(channels.stderr || channels.stdout),
  });

  const timerActive = await runCommand('systemctl', ['--user', 'is-active', TIMER_NAME]);
  checks.push({
    name: 'systemd_timer_active',
    ok: timerActive.status === 0,
    detail: oneLine(timerActive.stdout || timerActive.stderr),
  });

  const timerEnabled = await runCommand('systemctl', ['--user', 'is-enabled', TIMER_NAME]);
  checks.push({
    name: 'systemd_timer_enabled',
    ok: timerEnabled.status === 0,
    detail: oneLine(timerEnabled.stdout || timerEnabled.stderr),
  });

  const serviceStatus = await runCommand('systemctl', ['--user', 'is-active', SERVICE_NAME]);
  checks.push({
    name: 'systemd_service_not_failed',
    ok: serviceStatus.status === 0 || oneLine(serviceStatus.stdout) === 'inactive',
    detail: oneLine(serviceStatus.stdout || serviceStatus.stderr),
  });

  const sendDryRun = await runCommand(OPENCLAW_BIN, [
    'message',
    'send',
    '--channel',
    'telegram',
    '--target',
    TELEGRAM_TARGET,
    '--message',
    'OpenClaw YouTube digest delivery dry-run health check',
    '--json',
    '--dry-run',
  ]);
  checks.push({
    name: 'telegram_send_dry_run',
    ok: sendDryRun.status === 0 && !commandHasDeliveryError(sendDryRun),
    detail:
      sendDryRun.status === 0 && !commandHasDeliveryError(sendDryRun)
        ? 'delivery route accepted dry-run'
        : oneLine(sendDryRun.stderr || sendDryRun.stdout),
  });

  const legacyCron = await runCommand(OPENCLAW_BIN, ['cron', 'get', LEGACY_CRON_ID]);
  const legacyCronJson = parseJson(legacyCron.stdout);
  const legacyCronNotFound = commandReportsCronNotFound(legacyCron);
  checks.push({
    name: 'legacy_agent_cron_absent_or_disabled',
    ok: legacyCronNotFound || (legacyCron.status === 0 && legacyCronJson?.enabled === false),
    detail:
      legacyCronNotFound
        ? 'removed'
        : legacyCron.status === 0
          ? `enabled=${legacyCronJson?.enabled}`
        : oneLine(legacyCron.stderr || legacyCron.stdout),
  });

  const records = auditRecords();
  const audit = latestAudit(records);
  checks.push({
    name: 'last_audit_record',
    ok: true,
    detail: audit ? `${audit.status} at ${audit.finished_at || audit.started_at}` : 'none yet',
  });

  const realAudit = latestRealAudit(records);
  const latestUndelivered = latestUndeliveredMeta();
  const lastRealSendOk = realAudit ? ['sent', 'resent', 'skipped_locked'].includes(realAudit.status) : false;
  checks.push({
    name: 'last_real_send',
    ok: lastRealSendOk,
    detail: realAudit
      ? `${realAudit.status} at ${realAudit.finished_at || realAudit.started_at}${
          realAudit.error ? ` - ${oneLine(realAudit.error, 260)}` : ''
        }${
          !lastRealSendOk && latestUndelivered
            ? `; recovery: npm --silent run youtube:digest:resend-latest`
            : ''
        }`
      : 'none yet',
  });

  for (const check of checks) {
    if (!check.ok) failed = true;
    console.log(`${check.ok ? 'OK' : 'FAIL'} ${check.name}: ${check.detail}`);
  }

  process.exitCode = failed ? 1 : 0;
}

main();
