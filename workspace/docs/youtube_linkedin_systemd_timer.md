# YouTube-to-LinkedIn Systemd Timer

This document explains the active scheduled job for the OpenClaw
YouTube-to-LinkedIn daily digest.

The active scheduler is not an OpenClaw Control UI cron job. It is a user-level
systemd timer:

```text
openclaw-youtube-linkedin-digest.timer
```

The old OpenClaw cron jobs such as `youtube-linkedin-review-publish` are legacy
and should remain disabled or be removed from the Control UI once their history
is no longer useful.

## What It Does

The timer runs the deterministic YouTube daily digest workflow once per day.

It:

1. Starts a systemd service at 06:00 UTC.
2. Runs the workspace npm command `youtube:digest:send`.
3. Reads the pinned YouTube RSS/watchlist state.
4. Generates a human-readable Telegram digest.
5. Sends the digest through the local OpenClaw Telegram delivery path.
6. Writes audit records and delivery failure records.

It does not:

- Create LinkedIn drafts automatically.
- Create LinkedIn packets automatically.
- Generate thumbnails, visuals, or carousels automatically.
- Publish or schedule LinkedIn posts.
- Start an LLM/model-backed agent turn.

Manual LinkedIn actions still happen only after an explicit command such as
`Make LinkedIn draft for <video-id>`.

## Why It Uses Systemd

This job is deterministic server automation, so systemd is a better fit than an
OpenClaw model-backed cron job.

The old OpenClaw cron path ran through an isolated agent/model session and had
failures such as:

```text
stream disconnected before completion
```

For this digest, an LLM is unnecessary. The script only needs to read state,
check RSS/watchlist data, format a message, deliver it, and record the result.

Using systemd makes the scheduler:

- Independent of model streaming.
- Cheaper to run.
- Easier to inspect with `systemctl` and `journalctl`.
- More reliable for daily server automation.
- Safer because it only runs the explicit script command.

## Live Systemd Files

These are the installed files that systemd actually loads:

```text
/home/sam/.config/systemd/user/openclaw-youtube-linkedin-digest.timer
/home/sam/.config/systemd/user/openclaw-youtube-linkedin-digest.service
```

The timer file:

```ini
[Unit]
Description=Run OpenClaw YouTube-to-LinkedIn daily digest at 06:00 UTC

[Timer]
OnCalendar=*-*-* 06:00:00 UTC
Persistent=false
Unit=openclaw-youtube-linkedin-digest.service

[Install]
WantedBy=timers.target
```

The service file:

```ini
[Unit]
Description=OpenClaw YouTube-to-LinkedIn daily digest sender
Wants=network-online.target openclaw-gateway.service
After=network-online.target openclaw-gateway.service

[Service]
Type=oneshot
WorkingDirectory=/home/sam/.openclaw/workspace
Environment=PATH=/home/sam/.npm-global/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/bin
ExecStart=/usr/bin/npm --silent run youtube:digest:send
TimeoutStartSec=20min
StandardOutput=journal
StandardError=journal
```

## Workspace Source Copies

The workspace keeps source copies of the systemd unit files here:

```text
/home/sam/.openclaw/workspace/systemd/user/openclaw-youtube-linkedin-digest.timer
/home/sam/.openclaw/workspace/systemd/user/openclaw-youtube-linkedin-digest.service
```

When changing the timer or service, edit the workspace copy first, then install
it to:

```text
/home/sam/.config/systemd/user/
```

After installing changes, reload user systemd:

```bash
systemctl --user daemon-reload
systemctl --user restart openclaw-youtube-linkedin-digest.timer
```

## Execution Chain

The full execution chain is:

```text
openclaw-youtube-linkedin-digest.timer
  -> openclaw-youtube-linkedin-digest.service
    -> /usr/bin/npm --silent run youtube:digest:send
      -> scripts/send_youtube_digest.mjs
        -> npm --silent run youtube:digest
          -> scripts/youtube_linkedin_daily_digest.mjs
```

The relevant npm scripts are in:

```text
/home/sam/.openclaw/workspace/package.json
```

Current related scripts:

```json
{
  "youtube:digest": "node scripts/youtube_linkedin_daily_digest.mjs",
  "youtube:digest:send": "node scripts/send_youtube_digest.mjs",
  "youtube:digest:send:dry-run": "node scripts/send_youtube_digest.mjs --dry-run",
  "youtube:digest:resend-latest": "node scripts/send_youtube_digest.mjs --resend-latest",
  "youtube:digest:resend-latest:dry-run": "node scripts/send_youtube_digest.mjs --resend-latest --dry-run",
  "youtube:digest:health": "node scripts/youtube_digest_health.mjs"
}
```

## Main Script Files

Digest sender:

```text
/home/sam/.openclaw/workspace/scripts/send_youtube_digest.mjs
```

This is the script run by systemd through npm. It handles locking, digest
generation, Telegram delivery, audit logs, and undelivered-message spooling.

Digest generator:

```text
/home/sam/.openclaw/workspace/scripts/youtube_linkedin_daily_digest.mjs
```

This generates the actual daily digest from the workflow/watchlist state. It is
also used by manual commands such as save, unsave, and status.

Health checker:

```text
/home/sam/.openclaw/workspace/scripts/youtube_digest_health.mjs
```

This checks the digest generator, Telegram channel health, systemd timer/service
status, and recent audit records.

Workflow metadata helper:

```text
/home/sam/.openclaw/workspace/scripts/youtube_linkedin_workflow_metadata.mjs
```

This records the canonical active workflow metadata, including the systemd timer
name, service name, and digest commands.

## State And Audit Files

Canonical workflow state:

```text
/home/sam/.openclaw/workspace/state/youtube_linkedin_workflow.json
```

Legacy compatibility symlink/path:

```text
/home/sam/.openclaw/workspace/state/youtube_linkedin_phase1.json
```

Digest send audit log:

```text
/home/sam/.openclaw/workspace/state/youtube_digest_runs.jsonl
```

Undelivered digest spool:

```text
/home/sam/.openclaw/workspace/state/youtube_digest_undelivered/
```

Temporary state directory used during delivery:

```text
/home/sam/.openclaw/workspace/state/.youtube_digest_tmp/
```

Send lock file:

```text
/home/sam/.openclaw/workspace/state/.youtube_digest_send.lock
```

The lock prevents overlapping digest sends.

## Related Documentation

Main workflow documentation:

```text
/home/sam/.openclaw/workspace/docs/youtube_linkedin_workflow.md
```

Deep-dive workflow documentation:

```text
/home/sam/.openclaw/workspace/docs/youtube_linkedin_workflow_deep_dive.md
```

Dispatcher/runtime policy:

```text
/home/sam/.openclaw/workspace/AGENTS.md
```

## Useful Commands

Check the active timer:

```bash
systemctl --user status openclaw-youtube-linkedin-digest.timer --no-pager
```

Show the next scheduled run:

```bash
systemctl --user list-timers openclaw-youtube-linkedin-digest.timer --all --no-pager
```

Show the installed timer and service contents:

```bash
systemctl --user cat openclaw-youtube-linkedin-digest.timer openclaw-youtube-linkedin-digest.service
```

Run a dry-send test:

```bash
cd /home/sam/.openclaw/workspace
npm --silent run youtube:digest:send:dry-run
```

Run the health check:

```bash
cd /home/sam/.openclaw/workspace
npm --silent run youtube:digest:health
```

Run the digest sender manually:

```bash
cd /home/sam/.openclaw/workspace
npm --silent run youtube:digest:send
```

Dry-run the latest spooled digest resend:

```bash
cd /home/sam/.openclaw/workspace
npm --silent run youtube:digest:resend-latest:dry-run
```

Resend the latest spooled digest after confirming Telegram is healthy:

```bash
cd /home/sam/.openclaw/workspace
npm --silent run youtube:digest:resend-latest
```

View recent service logs:

```bash
journalctl --user -u openclaw-youtube-linkedin-digest.service -n 100 --no-pager
```

View recent timer logs:

```bash
journalctl --user -u openclaw-youtube-linkedin-digest.timer -n 100 --no-pager
```

## Safe Changes

Safe changes:

- Adjusting the schedule in the workspace timer file.
- Updating the service timeout.
- Updating the sender script retry behavior.
- Updating the health check.
- Removing disabled legacy OpenClaw cron jobs from the Control UI.

Risky changes:

- Deleting the live files from `/home/sam/.config/systemd/user/`.
- Renaming `/home/sam/.openclaw/workspace` without updating the service.
- Re-enabling the old OpenClaw cron job.
- Adding automatic LinkedIn draft/publish behavior to the digest sender.
- Setting `Persistent=true` without understanding catch-up behavior.

## Current Operating Policy

Keep this workflow digest-only:

```text
Daily scheduler: systemd
Daily job: npm --silent run youtube:digest:send
Delivery: Telegram through local OpenClaw path
Drafting: manual only
Publishing: manual and explicitly confirmed only
OpenClaw legacy cron: disabled or removed from UI
```
