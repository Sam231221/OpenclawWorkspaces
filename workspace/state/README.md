# Workspace State

This folder contains runtime state and audit files for local OpenClaw workflows.

Do not delete files here blindly. Some files are active inputs for scripts or
compatibility paths used by existing workflows.

## Active Files

- `youtube_linkedin_workflow.json` - canonical YouTube-to-LinkedIn workflow and
  watchlist state.
- `youtube_linkedin_phase1.json` - legacy compatibility symlink to the canonical
  workflow state.
- `youtube_digest_runs.jsonl` - append-only audit log for digest send attempts.
- `capture_google_calendar_audit.jsonl` - append-only audit log for confirmed
  Google Calendar capture writes.

## Active Directories

- `.youtube_digest_tmp/` - temporary candidate state during digest send runs.
- `youtube_digest_undelivered/` - live spool for undelivered digest messages and
  candidate state snapshots.
- `archive/` - workflow baselines that may still be used by repair scripts.

## Cleanup Policy

Safe cleanup:

- Move old files from `youtube_digest_undelivered/` into
  `/home/sam/.openclaw/archives/workspace-cleanup/<date>/` after they have been
  reviewed or are no longer needed.
- Keep `youtube_digest_undelivered/` itself, because the sender expects the
  directory to exist or be creatable.
- Rotate large audit logs only after preserving a dated copy.

Do not remove:

- `youtube_linkedin_workflow.json`
- `youtube_linkedin_phase1.json`
- `state/archive/youtube_linkedin_workflow_20260723_before_transcriptapi_only_reset.json`

The repair helper currently depends on that archived baseline path.
