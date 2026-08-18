# Workspace Scripts

This folder contains local helper scripts used by the main OpenClaw workspace.

## Active Scripts

- `youtube_linkedin_daily_digest.mjs` - generates the YouTube daily digest and
  handles manual save/status operations.
- `send_youtube_digest.mjs` - systemd-run wrapper that sends the digest,
  records audit entries, handles locking, and spools undelivered messages.
- `youtube_digest_health.mjs` - health check for the digest generator, Telegram
  delivery path, systemd timer/service, and recent audit status.
- `youtube_linkedin_workflow_metadata.mjs` - shared metadata for the active
  YouTube-to-LinkedIn workflow.
- `repair_youtube_linkedin_workflow.mjs` - restores expected workflow scaffolding
  from the archived baseline if the state file drifts.
- `fetch_youtube_transcript.mjs` - TranscriptAPI-only YouTube transcript helper.
- `create_youtube_linkedin_visual.mjs` - local PNG visual helper for manual
  LinkedIn packet/image workflows.
- `cleanup_openclaw_sessions.mjs` - archive-first cleanup for old OpenClaw raw
  session files.

## Cleanup Policy

Scripts in this folder should be referenced by `package.json`, documentation,
or a known workflow. Temporary one-off scripts should be removed or moved to
`/home/sam/.openclaw/archives/workspace-cleanup/` after use.
