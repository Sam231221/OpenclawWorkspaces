# YouTube To LinkedIn Workflow Deep Dive

Last updated: 2026-08-14

This document explains the current `youtube-linkedin-daily-digest` workflow:
daily YouTube discovery, Telegram digest delivery, manual save/draft commands,
state management, naming cleanup, and known risks.

## Current Design

The scheduled cron is now a daily YouTube digest. It is not an automatic
LinkedIn packet generator.

The cron watches configured YouTube RSS feeds, reports newly released videos to
Mr. Sam on Telegram, and stores only compact discovery metadata. It does not
create LinkedIn drafts, review packets, generated thumbnails, visuals, carousel
plans, or publish-prep records unless Mr. Sam explicitly asks for a specific
video to be drafted or prepared.

The manual review/publish workflow is still separate and stateful. If the
workflow sections appear missing after a reset or migration, repair the state
scaffolding first with:

```bash
cd /home/sam/.openclaw/workspace && npm --silent run youtube:workflow:repair
```

That repair step only restores workflow structure from the archived baseline.
It does not create new draft text, approvals, or published posts.

Nothing is posted to LinkedIn automatically.

## Why The Design Changed

The earlier workflow tried to select videos, fetch transcripts, draft posts,
score variants, create visuals, update state, and deliver review packets during
one scheduled run. That created several problems:

- It could silently fail before useful work started.
- It could create packets for videos Mr. Sam had not asked to draft.
- It could accumulate pending packet and image state.
- It relied on unclear `seen` semantics.
- It mixed legacy `phase1`, `phase2`, `phase3`, and later naming.
- Telegram output was too technical and not easy to review.

The safer design is:

1. Cron only reports new videos.
2. Mr. Sam decides what to save or draft.
3. Drafting happens only for a specific requested video.
4. Watchlist state is committed only after the digest has actually been
   delivered.

## Cron Job

- Active job name: `youtube-linkedin-daily-digest`
- Active scheduler: `openclaw-youtube-linkedin-digest.timer`
- Active service: `openclaw-youtube-linkedin-digest.service`
- Schedule: daily at `06:00 UTC`
- Randomized delay: none
- Delivery target: Telegram direct chat `8692887396`
- Command: `npm --silent run youtube:digest:send`

Legacy OpenClaw cron metadata:

- Job name: `youtube-linkedin-review-publish`
- Alias: `youtube-linkedin-preview-publish`
- Job ID: `fe974333-bc3a-484a-aba3-679aa3102702`
- Status: disabled
- Former execution agent: `linkedinengine`

The legacy cron prompt should remain disabled. The active systemd service runs:

```bash
cd /home/sam/.openclaw/workspace && npm --silent run youtube:digest:send
```

The sender runs discovery against a temporary state copy, sends the Telegram
digest, and atomically promotes the candidate state only after delivery
succeeds. If delivery fails, it leaves the canonical state unchanged and writes
the undelivered digest under `state/youtube_digest_undelivered/`.

## Source Channels

The workflow uses hard-pinned YouTube channel IDs and RSS feeds:

| Source | Handle | Channel ID |
| --- | --- | --- |
| Theo / t3.gg | `@t3dotgg` | `UCbRP3c757lWg9M-U7TyEkXA` |
| ThePrimeTime | `@ThePrimeTimeagen` | `UCUyeluBRhGPCW4rPe_UvBZQ` |
| Fireship | `@Fireship` | `UCsBjURrPoezykLs9EqgamOA` |

The RSS format is:

```text
https://www.youtube.com/feeds/videos.xml?channel_id=<channel_id>
```

This avoids relying on vague web search results or the model choosing one
channel more often than the others.

## Daily Digest Flow

1. The systemd timer starts `openclaw-youtube-linkedin-digest.service`.
2. The service executes `npm --silent run youtube:digest:send`.
3. The helper reads:
   `/home/sam/.openclaw/workspace/state/youtube_linkedin_workflow.json`
4. It fetches RSS entries for all configured channels.
5. It compares video IDs against
   `youtube_video_watchlist.discovered_videos`.
6. It reports videos that were not previously reported.
7. It stores compact discovery metadata.
8. It does not fetch transcripts.
9. It does not create packets.
10. It does not create or store thumbnails.
11. It prints a human-readable digest for Telegram.

## Telegram Digest Format

The daily Telegram message should use this shape:

```text
YouTube daily watchlist - 2026-08-04

Window: 2026-08-03 09:00 UTC to 2026-08-04 09:00 UTC
Channels checked: Theo / t3.gg, ThePrimeTime, Fireship
Summary: 2 new, 1 yesterday missout, 1 saved
Channel counts: Theo / t3.gg: 1 new, 0 missout; ThePrimeTime: 0 new, 1 missout; Fireship: 1 new, 0 missout

New videos:

Theo / t3.gg:
- <title>
  Channel: Theo / t3.gg
  Published: 2026-08-04 07:30 UTC
  Video ID: <video_id>
  Source: https://www.youtube.com/watch?v=<video_id>
  Save: Save video <video_id> for future posting
  Draft: Make LinkedIn draft for <video_id>

ThePrimeTime:
- No new videos found for this section.

Fireship:
- <title>
  Channel: Fireship
  Published: 2026-08-04 06:00 UTC
  Video ID: <video_id>
  Source: https://www.youtube.com/watch?v=<video_id>
  Save: Save video <video_id> for future posting
  Draft: Make LinkedIn draft for <video_id>

Some yesterday missout videos:

Theo / t3.gg:
- No new videos found for this section.

ThePrimeTime:
- <title>
  Channel: ThePrimeTime
  Published: 2026-08-03 22:40 UTC
  Video ID: <video_id>
  Source: https://www.youtube.com/watch?v=<video_id>
  Save: Save video <video_id> for future posting
  Draft: Make LinkedIn draft for <video_id>

Fireship:
- No new videos found for this section.

Saved for future posting:
- <title> (<channel>) - <video_id>

Commands you can send:
- Save video <video_id> for future posting
- Make LinkedIn draft for <video_id>
- Status <video_id>
```

The `Some yesterday missout videos:` section is for videos that were published
before the current digest window but were not previously reported, for example
because they appeared in RSS after the prior Telegram message had already been
sent.

## Manual Commands

The digest message intentionally gives simple commands.

### Save

Command:

```text
Save video <video_id> for future posting
```

Saara should handle this directly by running:

```bash
cd /home/sam/.openclaw/workspace && npm --silent run youtube:digest -- --save-video <video_id>
```

This marks the video as saved in
`youtube_video_watchlist.saved_for_future_posting`. It does not create a draft,
packet, image, or publish record.

### Draft

Command:

```text
Make LinkedIn draft for <video_id>
```

Saara routes this to `linkedinengine` with the video ID and any known metadata
from `youtube_video_watchlist.discovered_videos`.

`linkedinengine` must then:

1. Fetch TranscriptAPI captions with:
   `npm run youtube:transcript -- <video_id>`
2. Draft from transcript text only.
3. Avoid using the YouTube title as the opening line.
4. Avoid creating a full packet unless Mr. Sam explicitly asks for a review
   packet, visual, or publish-prep workflow.

### Status

Command:

```text
Status <video_id>
```

Saara should handle daily-digest video status directly by running:

```bash
cd /home/sam/.openclaw/workspace && npm --silent run youtube:digest -- --status-video <video_id>
```

This reports the watchlist status, saved flag, packet ID if any, and whether a
draft was requested. It does not create or update state.

### Packet Or Publish

Full review packets, generated visuals, and publish-prep records are still
available, but only after explicit packet/publish commands.

Publishing still requires the guarded flow:

- approved variant,
- approved visual or publishable raster image,
- read-only LinkedIn connection verification,
- exact payload preview,
- dry-run without POST,
- exact current confirmation:
  `Publish <variant_id> confirmed`.

## State Files

Canonical state:

```text
/home/sam/.openclaw/workspace/state/youtube_linkedin_workflow.json
```

Legacy alias:

```text
/home/sam/.openclaw/workspace/state/youtube_linkedin_phase1.json
```

The legacy alias exists only for compatibility. New docs and code should use
`youtube_linkedin_workflow.json`.

## Current State Sections

Important active sections:

- `workflow`: active scheduler, legacy cron metadata, mode, and delivery.
- `runtime`: operational flags and current behavior.
- `youtube_video_watchlist`: digest-mode channel list, discovered videos,
  saved queue, and digest history.
- `runs`: legacy/specialist run audit entries.
- `phase3_packets`: legacy packet records.
- `variants`: draft variants.
- `visual_assets`: generated visual records.
- `approval_events`: approval/rejection/revision events.
- `publish_events`: publish-prep and publish audit events.
- `events`: miscellaneous immutable events.
- `runtime_audit_notes`: operational changes and repairs.

## Naming Cleanup

The workflow still contains legacy `phase` names because old commands and state
paths may refer to them. They should now be treated as compatibility keys.

Use these conceptual names in new docs and prompts:

| Legacy key | Current meaning |
| --- | --- |
| `phase3_packets` | `packets` |
| `variants` | `drafts` |
| `visual_assets` | `visuals` |
| `phase2_runtime` | old auto-drafting config, now disabled for cron |
| `phase3_runtime` | old auto-visual config, now manual only |
| `phase4_runtime` | review state machine |
| `phase5_runtime` | guarded publish gate |

New scheduler metadata should use `workflow.active_scheduler`. Keep the old
OpenClaw cron name only under `workflow.legacy_openclaw_cron`.

`youtube_video_watchlist.channels` is the canonical channel/feed list. New code
should point to it through `workflow.source_channels_path` instead of copying
full channel objects under `workflow`.

## What Gets Stored In Digest Mode

The digest stores compact video metadata:

- video ID,
- title,
- channel,
- channel ID,
- YouTube URL,
- published timestamp,
- first discovered timestamp,
- first reported timestamp,
- last digest ID,
- saved/draft status.

It does not store:

- raw YouTube thumbnails,
- generated thumbnails,
- YouTube frames,
- creator images,
- transcripts,
- LinkedIn drafts,
- packet records,
- carousel plans,
- publish-prep records.

Those heavier artifacts are created only after explicit manual instructions.

## Seen Logic

The old `seen` list is ambiguous because it mixed discovery, selection, packet
creation, and source-context outcomes.

Digest mode should not rely on `seen` for daily discovery. It should use:

```text
youtube_video_watchlist.discovered_videos
```

A video should not be shown in every daily digest once it has
`first_reported_at`. If it was published before the current window but never
reported, it belongs under:

```text
Some yesterday missout videos:
```

This separates "we reported this video to Mr. Sam" from "we created a LinkedIn
packet for it."

## If Channels Post Daily And Mr. Sam Does Nothing

The daily digest continues to list new videos.

If Mr. Sam does not reply:

- compact discovered-video records accumulate,
- the same reported video is not repeated every day,
- no draft is created,
- no packet is created,
- no visual is generated,
- no YouTube thumbnail is stored,
- nothing is posted to LinkedIn.

The saved-for-future queue grows only when Mr. Sam explicitly sends a save
command.

## If Mr. Sam Saves Videos But Does Not Draft

Saved videos remain in:

```text
youtube_video_watchlist.saved_for_future_posting
```

The daily digest includes a saved queue summary. No draft or packet is created
until Mr. Sam asks:

```text
Make LinkedIn draft for <video_id>
```

## Potential Issues

### RSS Feed Delays

YouTube RSS may expose a video after the previous digest was already sent. The
missout section handles this by reporting previously unreported videos from the
lookback window.

### Feed Limit

YouTube RSS usually returns recent entries only. If the cron is broken for too
long and a channel publishes many videos, old videos may fall out of the RSS
feed before being discovered.

Mitigation: keep cron healthy and add alerting if it misses runs.

### State Growth

Discovery records and digest history can still grow. The helper keeps digest
history to the latest 90 entries, but discovered videos need a future retention
policy.

Recommended future policy:

- auto-hide unsaved discovered videos after 30 days,
- keep saved videos until removed or drafted,
- keep packet/publish records for audit,
- archive old generated assets only when packets are archived.

### Telegram Delivery Quality

Cron messages must stay human-readable. They must not send raw JSON,
semicolon-separated diagnostic dumps, or internal endpoint-heavy text unless Mr.
Sam explicitly asks for debug output.

### Manual Draft Ambiguity

If Mr. Sam says "draft this" without a video ID and multiple videos are in the
latest digest, Saara should ask one concise clarification question.

### Transcript Dependency

TranscriptAPI is not used for the daily digest. It is required for manual draft
generation. If TranscriptAPI fails or returns no usable transcript, the draft
should be blocked as `insufficient_source_context`.

## Operational Checklist

When debugging:

1. Check cron status for job `fe974333-bc3a-484a-aba3-679aa3102702`.
2. Run a dry digest:
   `npm --silent run youtube:digest -- --dry-run`
3. Validate RSS fetches for all three channel IDs.
4. Validate state JSON parses.
5. Inspect `youtube_video_watchlist.last_digest_window_end`.
6. Inspect `youtube_video_watchlist.discovered_videos`.
7. Confirm no new `phase3_packets`, `variants`, or `visual_assets` were created
   by the cron.
8. If a manual draft fails, test:
   `npm run youtube:transcript -- <video_id>`

## Key Principle

Daily cron should discover and inform. It should not decide, draft, design, or
prepare LinkedIn posts without Mr. Sam choosing a specific video.
