#!/usr/bin/env node

const transcriptTimeoutMs = Number.parseInt(
  process.env.YOUTUBE_TRANSCRIPT_TIMEOUT_MS ?? '90000',
  10,
);
const transcriptApiBaseUrl =
  process.env.TRANSCRIPT_API_BASE_URL?.trim() || 'https://transcriptapi.com';
const transcriptApiUserAgent =
  process.env.TRANSCRIPT_API_USER_AGENT?.trim() || 'SaaraOpenClaw/1.0';

function usage() {
  console.error([
    'Usage: npm run youtube:transcript -- <youtube-url-or-video-id> [lang]',
    '',
    'Transcript source:',
    '  TranscriptAPI only. TRANSCRIPT_API_KEY must be configured.',
  ].join('\n'));
}

function extractVideoId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    const id = url.searchParams.get('v');
    if (/^[a-zA-Z0-9_-]{11}$/.test(id ?? '')) return id;

    const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];
  } catch {
    return null;
  }

  return null;
}

function canonicalVideoUrl(videoID) {
  return `https://www.youtube.com/watch?v=${videoID}`;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), transcriptTimeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function transcriptTextFromPayload(payload) {
  if (typeof payload.transcript === 'string') {
    return payload.transcript.trim();
  }

  if (Array.isArray(payload.transcript)) {
    return payload.transcript
      .map((segment) => (typeof segment === 'string' ? segment : segment?.text))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (typeof payload.text === 'string') {
    return payload.text.trim();
  }

  return '';
}

async function transcribeWithTranscriptApi(videoID) {
  const apiKey = process.env.TRANSCRIPT_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('TRANSCRIPT_API_KEY is not set');
  }

  const url = new URL('/api/v2/youtube/transcript', transcriptApiBaseUrl);
  url.searchParams.set('video_url', canonicalVideoUrl(videoID));
  url.searchParams.set('format', 'json');
  url.searchParams.set('include_timestamp', 'false');
  url.searchParams.set('send_metadata', 'true');

  const response = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': transcriptApiUserAgent,
    },
  });

  const responseText = await response.text();
  if (!response.ok) {
    let message = responseText.trim();
    try {
      const payload = JSON.parse(responseText);
      message = payload.error || payload.message || message;
    } catch {
      // Keep raw response text as the error detail.
    }
    throw new Error(`TranscriptAPI request failed with ${response.status}: ${message}`);
  }

  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new Error('TranscriptAPI returned non-JSON response');
  }

  const transcript = transcriptTextFromPayload(payload);
  if (!transcript) {
    throw new Error('TranscriptAPI returned empty transcript text');
  }

  return {
    transcript,
    payload,
    metadata: payload.metadata ?? {},
    segmentCount: Array.isArray(payload.transcript) ? payload.transcript.length : 0,
  };
}

async function main() {
  const input = process.argv[2];
  const lang = process.argv[3] ?? 'en';
  const videoID = extractVideoId(input);

  if (!videoID) {
    usage();
    process.exitCode = 2;
    return;
  }

  try {
    const result = await transcribeWithTranscriptApi(videoID);
    console.log(JSON.stringify({
      ok: true,
      videoID,
      lang,
      title: result.metadata.title ?? '',
      description: result.metadata.description ?? '',
      segment_count: result.segmentCount,
      transcript_char_count: result.transcript.length,
      transcript_status: 'available',
      source_method: 'transcriptapi',
      provider: 'transcriptapi',
      egress_method: 'transcriptapi-api',
      subtitle_mode: result.payload.language ? 'api' : '',
      subtitle_language: result.payload.language ?? lang,
      transcriptapi_base_url: transcriptApiBaseUrl,
      attempts: [],
      transcript: result.transcript,
    }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({
      ok: false,
      videoID,
      lang,
      transcript_status: 'failed',
      source_method: 'transcriptapi',
      provider: 'transcriptapi',
      egress_method: 'transcriptapi-api',
      attempts: [{
        method: 'transcriptapi',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      }],
    }, null, 2));
    process.exitCode = 1;
  }
}

await main();
