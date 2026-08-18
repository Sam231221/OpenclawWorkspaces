#!/usr/bin/env node
import fs from 'node:fs';
import {
  DEFAULT_WORKFLOW_STATE_PATH,
  syncWorkflowMetadata,
} from './youtube_linkedin_workflow_metadata.mjs';

const DEFAULT_STATE_PATH = DEFAULT_WORKFLOW_STATE_PATH;
const DEFAULT_ARCHIVE_PATH =
  '/home/sam/.openclaw/workspace/state/archive/youtube_linkedin_workflow_20260723_before_transcriptapi_only_reset.json';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = {
    statePath: DEFAULT_STATE_PATH,
    archivePath: DEFAULT_ARCHIVE_PATH,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === '--state' && value) {
      args.statePath = value;
      index += 1;
      continue;
    }
    if (key === '--archive' && value) {
      args.archivePath = value;
      index += 1;
      continue;
    }
    if (key === '--dry-run') {
      args.dryRun = true;
    }
  }

  return args;
}

function hasMeaningfulObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

function ensureObject(target, key) {
  if (target[key] == null || typeof target[key] !== 'object' || Array.isArray(target[key])) {
    target[key] = {};
  }
}

function restoreObject(target, key, fallback, changes) {
  if (hasMeaningfulObject(target[key]) || !hasMeaningfulObject(fallback)) return;
  target[key] = structuredClone(fallback);
  changes.push(`restored ${key}`);
}

function repairWorkflow(state, archive, statePath = DEFAULT_STATE_PATH) {
  const changes = [];

  restoreObject(state, 'workflow', archive?.workflow, changes);
  restoreObject(state, 'runtime', archive?.runtime, changes);
  restoreObject(state, 'phase2_runtime', archive?.phase2_runtime, changes);
  restoreObject(state, 'phase3_runtime', archive?.phase3_runtime, changes);
  restoreObject(state, 'phase4_runtime', archive?.phase4_runtime, changes);
  restoreObject(state, 'phase5_runtime', archive?.phase5_runtime, changes);
  restoreObject(state, 'youtube_video_watchlist', archive?.youtube_video_watchlist, changes);

  ensureObject(state, 'workflow');
  ensureObject(state, 'runtime');
  ensureObject(state, 'phase2_runtime');
  ensureObject(state, 'phase3_runtime');
  ensureObject(state, 'phase4_runtime');
  ensureObject(state, 'phase5_runtime');
  ensureObject(state, 'youtube_video_watchlist');

  if (!state.workflow?.name && archive?.workflow?.name) {
    state.workflow.name = archive.workflow.name;
    changes.push('restored workflow.name');
  }
  if (!state.workflow?.aliases && archive?.workflow?.aliases) {
    state.workflow.aliases = structuredClone(archive.workflow.aliases);
    changes.push('restored workflow.aliases');
  }
  if (!state.workflow?.display_name && archive?.workflow?.display_name) {
    state.workflow.display_name = archive.workflow.display_name;
    changes.push('restored workflow.display_name');
  }
  if (!state.workflow?.legacy_openclaw_cron?.cron_job_id && archive?.workflow?.cron_job_id) {
    state.workflow.legacy_openclaw_cron ??= {};
    state.workflow.legacy_openclaw_cron.cron_job_id = archive.workflow.cron_job_id;
    changes.push('restored workflow.legacy_openclaw_cron.cron_job_id');
  }
  syncWorkflowMetadata(state, { statePath });

  if (!state.runtime?.approval_state_machine_enabled) {
    state.runtime.approval_state_machine_enabled = true;
    changes.push('enabled approval_state_machine');
  }
  if (!state.runtime?.linkedin_publish_gate_enabled) {
    state.runtime.linkedin_publish_gate_enabled = true;
    changes.push('enabled linkedin_publish_gate');
  }

  state.version = (state.version ?? 0) + 1;
  state.runtime.updated_at = new Date().toISOString();
  state.runtime.latest_change =
    'Repaired YouTube-to-LinkedIn workflow scaffolding after state drift or partial reset.';

  return changes;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = readJson(args.statePath);
  const archive = fs.existsSync(args.archivePath) ? readJson(args.archivePath) : null;
  const changes = repairWorkflow(state, archive, args.statePath);

  if (args.dryRun) {
    console.log(JSON.stringify({ dry_run: true, changes }, null, 2));
    return;
  }

  writeJson(args.statePath, state);
  console.log(
    JSON.stringify(
      {
        repaired: true,
        state_path: args.statePath,
        archive_path: args.archivePath,
        changes,
        version: state.version,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
