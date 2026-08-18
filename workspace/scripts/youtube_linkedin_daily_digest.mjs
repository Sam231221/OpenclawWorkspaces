#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_WORKFLOW_STATE_PATH,
  syncWorkflowMetadata,
} from './youtube_linkedin_workflow_metadata.mjs';

const DEFAULT_STATE_PATH = DEFAULT_WORKFLOW_STATE_PATH;
const DEFAULT_DIGEST_TIME_ZONE = 'Europe/London';
const FEED_FETCH_TIMEOUT_MS = Number.parseInt(
  process.env.YOUTUBE_DIGEST_FEED_TIMEOUT_MS || '15000',
  10,
);

const DEFAULT_CHANNELS = [
  {
    key: 'theo_t3gg',
    name: 'Theo / t3.gg',
    handle: '@t3dotgg',
    channel_id: 'UCbRP3c757lWg9M-U7TyEkXA',
    feed_url:
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCbRP3c757lWg9M-U7TyEkXA',
  },
  {
    key: 'theprimetime',
    name: 'ThePrimeTime',
    handle: '@ThePrimeTimeagen',
    channel_id: 'UCUyeluBRhGPCW4rPe_UvBZQ',
    feed_url:
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCUyeluBRhGPCW4rPe_UvBZQ',
  },
  {
    key: 'fireship',
    name: 'Fireship',
    handle: '@Fireship',
    channel_id: 'UCsBjURrPoezykLs9EqgamOA',
    feed_url:
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA',
  },
];

function parseArgs(argv) {
  const args = {
    dryRun: false,
    statePath: DEFAULT_STATE_PATH,
    now: new Date(),
    lookbackHours: 72,
    saveVideoId: '',
    unsaveVideoId: '',
    statusVideoId: '',
    note: '',
    deliveryMode: 'cron_final_reply',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (key === '--state' && value) {
      args.statePath = value;
      i += 1;
      continue;
    }
    if (key === '--now' && value) {
      args.now = new Date(value);
      i += 1;
      continue;
    }
    if (key === '--lookback-hours' && value) {
      args.lookbackHours = Number.parseInt(value, 10);
      i += 1;
      continue;
    }
    if (key === '--save-video' && value) {
      args.saveVideoId = normalizeVideoId(value);
      i += 1;
      continue;
    }
    if (key === '--unsave-video' && value) {
      args.unsaveVideoId = normalizeVideoId(value);
      i += 1;
      continue;
    }
    if (key === '--status-video' && value) {
      args.statusVideoId = normalizeVideoId(value);
      i += 1;
      continue;
    }
    if (key === '--note' && value) {
      args.note = value;
      i += 1;
      continue;
    }
    if (key === '--delivery-mode' && value) {
      args.deliveryMode = value;
      i += 1;
      continue;
    }
  }

  if (Number.isNaN(args.now.getTime())) {
    throw new Error('Invalid --now value');
  }

  if (!Number.isFinite(args.lookbackHours) || args.lookbackHours < 1) {
    throw new Error('Invalid --lookback-hours value');
  }

  return args;
}

function normalizeVideoId(input) {
  if (!input) return '';
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
    }
    const id = url.searchParams.get('v');
    if (/^[a-zA-Z0-9_-]{11}$/.test(id ?? '')) return id;
    const shorts = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    return shorts ? shorts[1] : '';
  } catch {
    return '';
  }
}

function readState(statePath) {
  return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

function writeState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function ensureWatchlist(state) {
  state.youtube_video_watchlist ??= {};
  const watchlist = state.youtube_video_watchlist;
  watchlist.mode = 'daily_digest_only';
  watchlist.packet_generation = 'manual_only';
  watchlist.thumbnail_storage = 'do_not_store_youtube_thumbnails';
  watchlist.timezone ??= DEFAULT_DIGEST_TIME_ZONE;
  watchlist.channels = DEFAULT_CHANNELS;
  watchlist.discovered_videos ??= {};
  watchlist.saved_for_future_posting ??= [];
  watchlist.digests ??= [];
  return watchlist;
}

function xmlDecode(text) {
  return String(text ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number.parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCodePoint(Number.parseInt(n, 16)),
    );
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match ? xmlDecode(match[1]) : '';
}

function parseFeed(xml, channel) {
  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  for (const match of xml.matchAll(entryRegex)) {
    const entry = match[1];
    const videoId = firstMatch(entry, /<yt:videoId>([^<]+)<\/yt:videoId>/);
    if (!videoId) continue;
    const link =
      firstMatch(entry, /<link[^>]+href="([^"]+)"/) ||
      `https://www.youtube.com/watch?v=${videoId}`;
    const publishedAt = firstMatch(entry, /<published>([^<]+)<\/published>/);
    const updatedAt = firstMatch(entry, /<updated>([^<]+)<\/updated>/);
    entries.push({
      video_id: videoId,
      title: firstMatch(entry, /<title>([\s\S]*?)<\/title>/).trim(),
      channel_key: channel.key,
      channel: channel.name,
      channel_id: channel.channel_id,
      channel_handle: channel.handle,
      url: link,
      published_at: publishedAt,
      updated_at: updatedAt,
      source: 'youtube_rss',
    });
  }
  return entries;
}

async function fetchFeed(channel) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(channel.feed_url, {
      headers: { 'User-Agent': 'SaaraOpenClaw/1.0' },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${channel.name} RSS failed with ${response.status}`);
    }
    return parseFeed(text, channel);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`${channel.name} RSS timed out after ${FEED_FETCH_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function displayChannelName(channel) {
  if (channel?.key === 'theo_t3gg') return 'Theo / t3dotgg';
  return channel?.name || 'Unknown channel';
}

function resolveTimeZone(state, watchlist) {
  return (
    watchlist.timezone ||
    state?.user?.timezone ||
    state?.settings?.timezone ||
    process.env.YOUTUBE_DIGEST_TIMEZONE ||
    DEFAULT_DIGEST_TIME_ZONE
  );
}

function humanDate(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(date);
}

function humanTime(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(date);
}

function byChannel(items, channelKey) {
  return items.filter((item) => item.channel_key === channelKey);
}

function sortByPublishedDesc(items) {
  return [...items].sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );
}

function videoUrl(itemOrVideoId) {
  if (typeof itemOrVideoId === 'string') {
    return `https://www.youtube.com/watch?v=${itemOrVideoId}`;
  }
  return itemOrVideoId.url || `https://www.youtube.com/watch?v=${itemOrVideoId.video_id}`;
}

function watchVideoLine(itemOrVideoId) {
  return `▶️ <a href="${escapeHtml(videoUrl(itemOrVideoId))}">Watch video</a>`;
}

function formatVideo(item, index, timeZone) {
  const published = new Date(item.published_at);
  const lines = [
    `${index}. <b>${escapeHtml(item.title || 'Untitled video')}</b>`,
    `🗓 ${escapeHtml(humanDate(published, timeZone))}, ${escapeHtml(humanTime(published, timeZone))} ${escapeHtml(timeZone)}`,
    watchVideoLine(item),
  ];
  if (item.video_id) {
    lines.push(`🔖 Save: <code>Save video ${escapeHtml(item.video_id)}</code>`);
    lines.push(`✍️ Draft: <code>Make LinkedIn draft for ${escapeHtml(item.video_id)}</code>`);
  }
  return lines.join('\n');
}

function formatChannelSection(channels, items, timeZone, emptyText) {
  if (items.length === 0) return emptyText;

  const lines = [];
  for (const channel of channels) {
    const channelItems = sortByPublishedDesc(byChannel(items, channel.key));
    if (channelItems.length === 0) continue;
    if (lines.length > 0) lines.push('');
    lines.push(`<b>${escapeHtml(displayChannelName(channel))}</b>`, '');
    channelItems.forEach((item, index) => lines.push(formatVideo(item, index + 1, timeZone), ''));
    if (lines.at(-1) === '') lines.pop();
  }
  return lines.join('\n');
}

function formatSavedQueue(watchlist) {
  const saved = watchlist.saved_for_future_posting
    .map((id) => watchlist.discovered_videos[id])
    .filter(Boolean)
    .filter((item) => item.saved_for_future_posting);

  if (saved.length === 0) return 'No videos saved yet.';

  return sortByPublishedDesc(saved)
    .map((item) =>
      [
        `<b>${escapeHtml(item.title || 'Untitled video')}</b> — ${escapeHtml(
          item.channel_key === 'theo_t3gg' ? 'Theo / t3dotgg' : item.channel || 'Unknown channel',
        )}`,
        watchVideoLine(item),
      ].join('\n'),
    )
    .join('\n\n');
}

function countForChannel(items, channelKey) {
  return byChannel(items, channelKey).length;
}

function formatChannelCounts(channels, newItems, missouts) {
  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return channels
    .map((channel, index) => {
      const newCount = countForChannel(newItems, channel.key);
      const missoutCount = countForChannel(missouts, channel.key);
      return `${labels[index] ?? `${index + 1}`}. <b>${escapeHtml(
        displayChannelName(channel),
      )}</b> — <i>${newCount} new · ${missoutCount} missed</i>`;
    })
    .join('\n');
}

function formatDigestMessage({
  now,
  windowStart,
  windowEnd,
  channels,
  newItems,
  missouts,
  watchlist,
  state,
}) {
  const timeZone = resolveTimeZone(state, watchlist);
  const savedCount = watchlist.saved_for_future_posting.length;
  const lines = [
    '📺 <b>YouTube Daily Watchlist</b>',
    `📅 <b>${escapeHtml(humanDate(now, timeZone))}</b> · <i>${escapeHtml(
      humanTime(now, timeZone),
    )} ${escapeHtml(timeZone)}</i>`,
    `⏰ <i>Daily send: 06:00 ${escapeHtml(timeZone)}</i>`,
    '',
    '<b>Summary</b>',
    `• 🆕 <b>${newItems.length}</b> <i>new today</i>`,
    `• ⏪ <b>${missouts.length}</b> <i>recently missed</i>`,
    `• 🔖 <b>${savedCount}</b> <i>saved</i>`,
    '',
    '<b>Channels</b>',
    formatChannelCounts(channels, newItems, missouts),
    '',
    '━━━━━━━━━━━━━━',
    '',
    '🆕 <b>NEW VIDEOS</b>',
    '',
    formatChannelSection(
      channels,
      newItems,
      timeZone,
      'No new videos were published during this scan.',
    ),
    '',
    '━━━━━━━━━━━━━━',
    '',
    '⏪ <b>RECENT VIDEOS YOU MAY HAVE MISSED</b>',
    '',
    formatChannelSection(
      channels,
      missouts,
      timeZone,
      'You’re all caught up—no recently missed videos.',
    ),
    '',
    '━━━━━━━━━━━━━━',
    '',
    '🔖 <b>SAVED FOR LATER</b>',
    '',
    formatSavedQueue(watchlist),
    '',
    '━━━━━━━━━━━━━━',
    '',
    '💬 <b>AVAILABLE COMMANDS</b>',
    '',
    '• <code>Save video VIDEO_ID</code>',
    '• <code>Make LinkedIn draft for VIDEO_ID</code>',
    '• <code>Status</code>',
  ];
  return lines.join('\n');
}

function updateDiscovery({ watchlist, item, now, digestId, shouldReport }) {
  const existing = watchlist.discovered_videos[item.video_id] ?? {};
  const next = {
    ...existing,
    ...item,
    status: existing.status ?? 'discovered',
    first_discovered_at: existing.first_discovered_at ?? now.toISOString(),
    last_checked_at: now.toISOString(),
    packet_id: existing.packet_id ?? null,
    draft_requested_at: existing.draft_requested_at ?? null,
    saved_for_future_posting: Boolean(existing.saved_for_future_posting),
  };
  if (shouldReport) {
    next.first_reported_at = next.first_reported_at ?? now.toISOString();
    next.last_reported_at = now.toISOString();
    next.last_digest_id = digestId;
    next.report_count = (next.report_count ?? 0) + 1;
  }
  watchlist.discovered_videos[item.video_id] = next;
}

async function runDigest(args, state, watchlist) {
  const now = args.now;
  const fallbackStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowStart = watchlist.last_digest_window_end
    ? new Date(watchlist.last_digest_window_end)
    : fallbackStart;
  const windowEnd = now;
  const lookbackStart = new Date(now.getTime() - args.lookbackHours * 60 * 60 * 1000);
  const digestId = `youtube_digest_${now.toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`;
  const channels = watchlist.channels;
  const fetched = [];
  const errors = [];

  for (const channel of channels) {
    try {
      const entries = await fetchFeed(channel);
      fetched.push(...entries);
    } catch (error) {
      errors.push({
        channel: channel.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const newItems = [];
  const missouts = [];
  for (const item of fetched) {
    const published = new Date(item.published_at);
    if (Number.isNaN(published.getTime()) || published < lookbackStart || published > windowEnd) {
      continue;
    }

    const existing = watchlist.discovered_videos[item.video_id];
    const alreadyReported = Boolean(existing?.first_reported_at);
    const inWindow = published > windowStart && published <= windowEnd;
    const shouldReport = !alreadyReported && (inWindow || published <= windowStart);

    if (shouldReport && inWindow) newItems.push(item);
    if (shouldReport && !inWindow) missouts.push(item);
    updateDiscovery({ watchlist, item, now, digestId, shouldReport });
  }

  const digest = {
    digest_id: digestId,
    created_at: now.toISOString(),
    window_start: windowStart.toISOString(),
    window_end: windowEnd.toISOString(),
    lookback_start: lookbackStart.toISOString(),
    mode: 'daily_digest_only',
    channels_checked: channels.map((channel) => channel.key),
    feed_errors: errors,
    new_video_ids: sortByPublishedDesc(newItems).map((item) => item.video_id),
    missout_video_ids: sortByPublishedDesc(missouts).map((item) => item.video_id),
    packet_generation: 'none',
    thumbnail_storage: 'none',
    delivery: args.dryRun ? 'dry_run_stdout' : args.deliveryMode,
  };

  watchlist.last_digest_sent_at = now.toISOString();
  watchlist.last_digest_window_start = windowStart.toISOString();
  watchlist.last_digest_window_end = windowEnd.toISOString();
  watchlist.digests.push(digest);
  watchlist.digests = watchlist.digests.slice(-90);

  state.version = (state.version ?? 0) + 1;
  state.runtime ??= {};
  state.runtime.automatic_packet_generation_enabled = false;
  state.runtime.packet_generation_trigger = 'manual_only';
  state.runtime.thumbnail_storage_policy = 'do_not_store_youtube_thumbnails';
  state.runtime.latest_change =
    'Ran YouTube-to-LinkedIn daily digest; packet generation remains manual.';
  state.runtime.updated_at = now.toISOString();

  syncWorkflowMetadata(state, { statePath: args.statePath });

  state.runtime_audit_notes ??= [];
  state.runtime_audit_notes.unshift({
    timestamp: now.toISOString(),
    actor: 'saara',
    action: 'daily_youtube_digest_run',
    notes:
      `Digest checked ${channels.length} channels, reported ${newItems.length} new videos and ` +
      `${missouts.length} missout videos. No packets, drafts, or thumbnails were created.`,
  });

  const message = formatDigestMessage({
    now,
    windowStart,
    windowEnd,
    channels,
    newItems: sortByPublishedDesc(newItems),
    missouts: sortByPublishedDesc(missouts),
    watchlist,
    state,
  });

  return { message, errors };
}

function saveVideo(args, state, watchlist, save) {
  const videoId = save ? args.saveVideoId : args.unsaveVideoId;
  if (!videoId) throw new Error(save ? 'Missing --save-video id' : 'Missing --unsave-video id');

  const now = args.now;
  const existing = watchlist.discovered_videos[videoId] ?? {
    video_id: videoId,
    title: '',
    channel: '',
    url: `https://www.youtube.com/watch?v=${videoId}`,
    status: 'discovered',
    first_discovered_at: now.toISOString(),
  };

  existing.saved_for_future_posting = save;
  existing.status = save ? 'saved_for_future_posting' : 'discovered';
  existing.last_saved_action_at = now.toISOString();
  if (args.note) existing.save_note = args.note;
  watchlist.discovered_videos[videoId] = existing;

  if (save && !watchlist.saved_for_future_posting.includes(videoId)) {
    watchlist.saved_for_future_posting.push(videoId);
  }
  if (!save) {
    watchlist.saved_for_future_posting = watchlist.saved_for_future_posting.filter(
      (id) => id !== videoId,
    );
  }

  state.version = (state.version ?? 0) + 1;
  state.events ??= [];
  state.events.push({
    timestamp: now.toISOString(),
    actor: 'saara',
    type: save ? 'youtube_video_saved_for_future_posting' : 'youtube_video_removed_from_future_posting',
    video_id: videoId,
    note: args.note || '',
  });

  const lines = [
    save ? '🔖 <b>Saved for later</b>' : '🔖 <b>Removed from saved videos</b>',
    '',
    existing.title ? `<b>${escapeHtml(existing.title)}</b>` : 'Watchlist video updated.',
  ];
  if (existing.channel) lines.push(`Channel: ${escapeHtml(existing.channel)}`);
  lines.push(
    watchVideoLine(existing.video_id ? existing : videoId),
    '',
    save
      ? `Next command: <code>Make LinkedIn draft for ${escapeHtml(videoId)}</code>`
      : 'No draft was created.',
  );
  return lines.join('\n');
}

function statusVideo(args, state, watchlist) {
  const videoId = args.statusVideoId;
  if (!videoId) throw new Error('Missing --status-video id');

  const existing = watchlist.discovered_videos[videoId];
  if (!existing) {
    return [
      '📺 <b>YouTube watchlist status</b>',
      '',
      'Video not found in the daily watchlist yet.',
      watchVideoLine(videoId),
      '',
      'No draft, packet, image, or publish record exists from the digest workflow.',
    ].join('\n');
  }

  const timeZone = resolveTimeZone(state, watchlist);
  const published = existing.published_at ? new Date(existing.published_at) : null;
  return [
    '📺 <b>YouTube watchlist status</b>',
    '',
    `<b>${escapeHtml(existing.title || 'Untitled video')}</b>`,
    `Channel: ${escapeHtml(existing.channel || 'Unknown channel')}`,
    `Published: ${
      published && !Number.isNaN(published.getTime())
        ? `${escapeHtml(humanDate(published, timeZone))}, ${escapeHtml(
            humanTime(published, timeZone),
          )} ${escapeHtml(timeZone)}`
        : 'Unknown'
    }`,
    watchVideoLine(existing.video_id ? existing : videoId),
    `Status: ${escapeHtml(existing.status || 'discovered')}`,
    `Saved: ${existing.saved_for_future_posting ? 'yes' : 'no'}`,
    `Packet ID: ${escapeHtml(existing.packet_id || 'none')}`,
    `Draft requested: ${existing.draft_requested_at ? 'yes' : 'no'}`,
    '',
    existing.saved_for_future_posting
      ? `Next command: <code>Make LinkedIn draft for ${escapeHtml(videoId)}</code>`
      : `Save command: <code>Save video ${escapeHtml(videoId)}</code>`,
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = readState(args.statePath);
  const watchlist = ensureWatchlist(state);
  syncWorkflowMetadata(state, { statePath: args.statePath });

  let message;
  if (args.saveVideoId) {
    message = saveVideo(args, state, watchlist, true);
  } else if (args.unsaveVideoId) {
    message = saveVideo(args, state, watchlist, false);
  } else if (args.statusVideoId) {
    message = statusVideo(args, state, watchlist);
  } else {
    const result = await runDigest(args, state, watchlist);
    message = result.message;
    if (result.errors.length > 0) {
      message += `\n\n━━━━━━━━━━━━━━\n\n⚠️ <b>FEED WARNINGS</b>\n\n${result.errors
        .map((error) => `• <b>${escapeHtml(error.channel)}</b>: ${escapeHtml(error.error)}`)
        .join('\n')}`;
    }
  }

  if (!args.dryRun && !args.statusVideoId) writeState(args.statePath, state);
  console.log(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
