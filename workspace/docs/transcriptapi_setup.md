# TranscriptAPI Setup

## Status

TranscriptAPI is the only transcript provider for the YouTube-to-LinkedIn
workflow.

- Skill: `/home/sam/.openclaw/workspace/skills/transcriptapi`
- Specialist copy: `/home/sam/.openclaw/workspace-linkedinengine/skills/transcriptapi`
- Required environment variable: `TRANSCRIPT_API_KEY`
- Gateway drop-in:
  `/home/sam/.config/systemd/user/openclaw-gateway.service.d/transcriptapi.conf`
- Provider setting: `YOUTUBE_TRANSCRIPT_PROVIDER=transcriptapi`

Do not store or print the API key in docs, state, logs, prompts, or chat output.

## Commands

Use either command from `/home/sam/.openclaw/workspace`:

```bash
npm run youtube:transcript -- <youtube-url-or-video-id>
npm run youtube:transcriptapi -- <youtube-url-or-video-id>
```

Both commands call:

```bash
node scripts/fetch_youtube_transcript.mjs
```

The helper returns JSON with:

- `ok`
- `videoID`
- `title`
- `segment_count`
- `transcript_char_count`
- `transcript_status`
- `source_method=transcriptapi`
- `provider=transcriptapi`
- `egress_method=transcriptapi-api`
- `subtitle_language`
- `transcript`

## Workflow Rule

If TranscriptAPI fails or returns no usable transcript, the workflow must mark
the video `insufficient_source_context` and skip or hold it for manual review.

No fallback is allowed through Tailscale, `yt-dlp`, browser cookies, YouTube
subtitle scraping, or the old `youtube-transcript-generator` skill.

## Validation

Last validation video:

- Video ID: `434cG4g5KLE`
- Title returned by TranscriptAPI: `Stop Reading Every Line of Code`
- Source method: `transcriptapi`
- Transcript status: `available`
- Transcript character count: `26510`
