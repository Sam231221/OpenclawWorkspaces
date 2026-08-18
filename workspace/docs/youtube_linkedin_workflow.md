# YouTube To LinkedIn Workflow

## Current Status

The active scheduled workflow is `youtube-linkedin-daily-digest`, implemented
as the user-level systemd timer `openclaw-youtube-linkedin-digest.timer`. The
old OpenClaw cron job `youtube-linkedin-review-publish` is removed from the live
gateway and kept only as historical state under `workflow.legacy_openclaw_cron`.
Mr. Sam may also refer to it as `youtube-linkedin-preview-publish`; treat that
as the same workflow family unless the scheduler is renamed.

It watches selected YouTube channels and sends Mr. Sam a daily human-readable
Telegram digest of newly released videos. It does not create LinkedIn packets,
draft variants, thumbnails, visuals, or publish-prep automatically.

The manual LinkedIn review and publish workflow still exists, but it is not
owned by the digest timer. If the state file ever drifts or gets partially
reset, run the repair helper before assuming the review/publish sections are
gone:

```bash
cd /home/sam/.openclaw/workspace && npm --silent run youtube:workflow:repair
```

That helper only restores missing workflow scaffolding from the archived
baseline. It does not invent draft content, approvals, or publish payloads.
Those still require explicit manual commands.

Mr. Sam can then explicitly save a video for future posting or ask for a
LinkedIn draft for a specific video. LinkedIn publishing still requires the
separate guarded approval and confirmation flow.

## Scheduler

- Active timer: `openclaw-youtube-linkedin-digest.timer`
- Active service: `openclaw-youtube-linkedin-digest.service`
- Installed path: `/home/sam/.config/systemd/user/`
- Source unit files: `/home/sam/.openclaw/workspace/systemd/user/`
- Schedule: daily at `06:00:00 UTC`
- Randomized delay: none
- Persistent catch-up: disabled
- Retry: no automatic delivery retry. Telegram timeouts can be ambiguous, so
  failed sends are spooled instead of retried automatically.
- Service timeout: `20min`
- Service ordering: starts after `openclaw-gateway.service`
- Command: `npm --silent run youtube:digest:send`
- Delivery: OpenClaw CLI Telegram send to chat `8692887396`
- Audit log: `/home/sam/.openclaw/workspace/state/youtube_digest_runs.jsonl`
- Undelivered digest spool: `/home/sam/.openclaw/workspace/state/youtube_digest_undelivered/`
- Health check: `npm --silent run youtube:digest:health`
- Manual recovery dry-run: `npm --silent run youtube:digest:resend-latest:dry-run`
- Manual recovery send: `npm --silent run youtube:digest:resend-latest`

The workflow runs once per day at 06:00 UTC. Persistent catch-up is disabled so
maintenance reloads, host downtime, or late restarts do not send the morning
digest at an unexpected later time. The digest service is ordered after the
OpenClaw gateway because delivery uses the local OpenClaw CLI.

The removed legacy OpenClaw cron is:

- Job name: `youtube-linkedin-review-publish`
- Job ID: `fe974333-bc3a-484a-aba3-679aa3102702`
- Status: removed on 2026-08-10; if recreated for audit, it must remain disabled
- Former session target: isolated `linkedinengine` agent turn

Do not put the deterministic digest back behind an isolated model turn. The
previous model-backed cron repeatedly failed at prompt streaming before any tool
call could run, so the digest command never started.

### Current Digest Mode

Enabled on 2026-08-04 after Mr. Sam identified that automatic packet generation
was too brittle and could create confusing state/backlog behavior.

The active scheduler now runs a deterministic digest and send command:
`npm --silent run youtube:digest:send`

The scheduled sender checks stable YouTube RSS feeds for all configured
channels against a temporary state copy, sends a Telegram message directly
through the OpenClaw CLI, then commits the updated watchlist state only after
delivery succeeds. If Telegram delivery fails, the canonical state is left
unchanged so the same videos remain eligible for a retry, and the undelivered
digest text plus candidate state are spooled for inspection. It must not create
packets, drafts, generated thumbnails, visuals, carousel plans, or publish-prep
records.

When a delivery failure is spooled, recover with the resend helper instead of
rerunning discovery from scratch:

```bash
cd /home/sam/.openclaw/workspace
npm --silent run youtube:digest:resend-latest:dry-run
npm --silent run youtube:digest:resend-latest
```

The resend helper sends the exact spooled digest. It commits the matching
candidate state only when the current canonical state has not been modified
since the spool was created; otherwise it records the resend but leaves state
unchanged unless an operator intentionally uses `-- --force-state-commit`.

The sender treats gateway permission warnings, pairing-required responses, and
gateway timeouts as delivery failures even when a CLI dry-run exits `0`. The
health check validates the digest generator, Telegram channel status, systemd
timer state, a Telegram delivery dry-run, legacy cron disabled state, and the
latest real non-dry-run send audit.

## Canonical Files

- State: `/home/sam/.openclaw/workspace/state/youtube_linkedin_workflow.json`
- Legacy state alias: `/home/sam/.openclaw/workspace/state/youtube_linkedin_phase1.json`
- Dispatcher rules: `/home/sam/.openclaw/workspace/AGENTS.md`
- Specialist rules: `/home/sam/.openclaw/workspace-linkedinengine/AGENTS.md`
- Transcript helper: `/home/sam/.openclaw/workspace/scripts/fetch_youtube_transcript.mjs`
- Raster visual helper: `/home/sam/.openclaw/workspace/scripts/create_youtube_linkedin_visual.mjs`
- Daily digest helper: `/home/sam/.openclaw/workspace/scripts/youtube_linkedin_daily_digest.mjs`
- Daily digest sender: `/home/sam/.openclaw/workspace/scripts/send_youtube_digest.mjs`
- Daily digest health check: `/home/sam/.openclaw/workspace/scripts/youtube_digest_health.mjs`
- systemd user units: `/home/sam/.openclaw/workspace/systemd/user/`
- TranscriptAPI setup: `/home/sam/.openclaw/workspace/docs/transcriptapi_setup.md`
- Deep-dive workflow doc: `/home/sam/.openclaw/workspace/docs/youtube_linkedin_workflow_deep_dive.md`
- Daily notes: `/home/sam/.openclaw/workspace/memory/YYYY-MM-DD.md`

`youtube_linkedin_phase1.json` is a compatibility symlink. Do not create a
separate copy at that path.

## Sources

- Theo / t3.gg: `UCbRP3c757lWg9M-U7TyEkXA`
- ThePrimeTime: `UCUyeluBRhGPCW4rPe_UvBZQ`
- Fireship: `UCsBjURrPoezykLs9EqgamOA`

Each source is checked through its YouTube RSS feed. The digest records only
compact discovery metadata and avoids storing YouTube thumbnails.

## Daily Digest Flow

1. The systemd user timer starts
   `openclaw-youtube-linkedin-digest.service`.
2. The service runs:
   `cd /home/sam/.openclaw/workspace && npm --silent run youtube:digest:send`
3. The helper reads the active state file.
4. It fetches current RSS entries for Theo/t3.gg, ThePrimeTime, and Fireship.
5. It compares entries against `youtube_video_watchlist.discovered_videos`.
6. It records compact discovery metadata for newly reported videos.
7. It prints a Telegram HTML digest with escaped dynamic content, Europe/London
   date/time in the header, no separate scan-details block, lettered channel
   rows, channel-grouped new videos, `Recent videos you may have missed`, the
   saved queue, compact save/draft commands, and one linked `Watch video` line
   per video. Do not add separate raw YouTube URL or source-preview lines.
8. The send wrapper chunks the message when needed and sends it directly to
   Telegram via:
   `/home/sam/.npm-global/bin/openclaw message send --channel telegram --target 8692887396 --delivery '{"parseMode":"HTML","disable_web_page_preview":true,"link_preview_options":{"is_disabled":true}}'`
9. The wrapper records success, dry-run, skip, or failure details in
   `state/youtube_digest_runs.jsonl`.

## Manual Draft Flow

1. Mr. Sam replies with `Save video <video_id> for future posting` to keep a
   video in the future-posting queue without drafting.
2. Saara records the save with:
   `npm --silent run youtube:digest -- --save-video <video_id>`
3. Saara can answer `Status <video_id>` with:
   `npm --silent run youtube:digest -- --status-video <video_id>`
4. Mr. Sam replies with `Make LinkedIn draft for <video_id>` or a YouTube URL
   when he wants a draft.
5. Saara routes that request to `linkedinengine`.
6. `linkedinengine` fetches TranscriptAPI captions and drafts from transcript
   text only.
7. A full review packet, generated visual, or publish-prep record is created
   only if Mr. Sam explicitly asks for packet/review/publish workflow handling.
8. Publishing remains blocked until the variant and visual are approved,
    `Prepare publish` stores the exact payload preview, `Publish dry-run`
    passes without calling POST, and Mr. Sam sends
    `Publish {variant_id} confirmed`.

## Transcript Rule

TranscriptAPI is the only allowed transcript path.

- Required skill: `transcriptapi`
- Required env var: `TRANSCRIPT_API_KEY`
- Helper command: `npm run youtube:transcript -- <youtube-url-or-video-id>`
- Forced alias: `npm run youtube:transcriptapi -- <youtube-url-or-video-id>`
- Expected source fields: `source_method=transcriptapi`,
  `provider=transcriptapi`, `egress_method=transcriptapi-api`

Do not use Tailscale, `yt-dlp`, browser cookies, YouTube subtitle scraping, or
the old `youtube-transcript-generator` skill for this production workflow.

Supporting sources such as video-page metadata, official product/docs pages,
release notes, or reputable reporting may enrich or fact-check a transcript-
based packet, but they must not replace missing transcript text.

## Content Quality Rules

- Write from the transcript, not from the YouTube title.
- Do not use the video title as the opening line.
- Include concrete details or ideas from the transcript.
- Keep drafts concise but not thin, usually 160-280 words.
- Use short multi-paragraph structure, usually 4-7 paragraphs.
- Prefer one clear lesson, one practical takeaway, and one concise closing
  point.
- Avoid saying “transcript” in public-facing post copy unless the video itself
  is about transcripts.
- Add 3-6 relevant tags at the end.

## Image Rules

- Every selected packet should include a reviewable raster image asset.
- Prefer original generated visuals based on the transcript-derived topic.
- Default deterministic fallback:
  `npm run youtube:visual -- --packet-id <packet-id> --title <video-title> --topic <topic> --channel <channel> --out <png-path>`.
- The local visual helper writes a PNG directly with Node built-ins and does
  not require ImageMagick, `pnmtopng`, `rsvg-convert`, Python imaging
  libraries, or any root-installed package.
- Use LinkedIn-supported media: `image/png`, `image/jpeg`, or `image/gif`.
- Do not use YouTube frames, YouTube thumbnails, channel branding, creator
  likenesses, or copied source layouts.
- Do not rely on YouTube link previews as the review visual.
- Missing optional converters must not fail the run. If a richer image
  generation path is unavailable, use the local visual helper and record the
  fallback in run metadata.

## Publishing Rules

- Automatic LinkedIn publishing is disabled.
- LinkedIn scheduling is disabled.
- `Publish dry-run` must not call POST.
- `Prepare publish` stores an exact payload preview but must not call POST.
- Bare `Publish` is invalid.
- Real posting requires exactly `Publish {variant_id} confirmed`.
- The LinkedIn connection must be verified with a read-only check first.
- The final payload must use uploaded image media when a primary image exists.
- Do not attach the YouTube URL as a LinkedIn article/link-card source.
- A successful publish event must store the actual API-returned LinkedIn
  URN/location.

## Current Reset

The active state was reset on 2026-07-23 after a successful TranscriptAPI-backed
publish test. Historical packet artifacts from the old Tailscale/`yt-dlp`
period were removed from active state and archived only for audit.

## 2026-08-04 Runtime Change

The live cron repeatedly failed before the first assistant tool call with:
`stream disconnected before completion: error sending request for url
(https://chatgpt.com/backend-api/codex/responses)`. Local dependencies were
checked: `TRANSCRIPT_API_KEY` is present, the TranscriptAPI helper returns the
validated transcript for `434cG4g5KLE`, and the direct PNG visual helper writes
a valid `1200x627` PNG.

The first repair narrowed the cron to a bounded production pass, but Mr. Sam
then identified the deeper product issue: the scheduler should not decide which
uploads deserve LinkedIn packets. It should report newly released videos first
and wait for an explicit save or draft command.

The final 2026-08-04 runtime policy is therefore:

- daily scheduler runs `npm --silent run youtube:digest:send`,
- all configured channels are checked through hard-pinned RSS channel IDs,
- `seen` packet-selection logic is no longer used for discovery,
- no transcripts, packets, drafts, thumbnails, visuals, or publish-prep records
  are created automatically,
- manual drafts still use TranscriptAPI and the guarded review/publish flow.

## 2026-08-10 Scheduler Hardening

After Aug 5 through Aug 10 cron sessions showed zero tool events and repeated
`stage=prompt` stream disconnects, the digest was moved out of the isolated
agent runtime.

The active production path is now:

- systemd user timer: `openclaw-youtube-linkedin-digest.timer`
- service command: `npm --silent run youtube:digest:send`
- direct Telegram delivery through the OpenClaw CLI
- audit file: `state/youtube_digest_runs.jsonl`
- health command: `npm --silent run youtube:digest:health`

## State Naming

The active scheduled job name is `youtube-linkedin-daily-digest`. Keep
`youtube-linkedin-review-publish` and `youtube-linkedin-preview-publish` only in
`workflow.legacy_openclaw_cron` / `workflow.legacy_names`.

`youtube_video_watchlist.channels` is the canonical feed configuration.
`workflow.source_channels_path` points there instead of duplicating full channel
objects under `workflow`.

The old OpenClaw cron `fe974333-bc3a-484a-aba3-679aa3102702` has been removed
from the live gateway. If it ever reappears, it must remain disabled. Future
deterministic jobs should use code plus OS scheduling. Use LLM-backed cron only
when the scheduled task actually requires judgment, drafting, classification,
or delegation.
